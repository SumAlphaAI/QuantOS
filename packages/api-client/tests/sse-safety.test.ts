import { describe, expect, it } from "vitest";
import { bffZodSchemas } from "../src/bff-gen/quantos-bff.zod.js";
import { consumeSse, parseSse, SseContractError, SseStreamReducer, type SseEventEnvelope } from "../src/sse.js";
const uuid="11111111-1111-4111-8111-111111111111";
const event=(sequence=1,type="progress"):SseEventEnvelope=>({streamId:uuid,sequence,
  eventId:`22222222-2222-4222-8222-${String(sequence).padStart(12,"0")}`,occurredAt:"2026-10-03T00:00:00Z",
  correlationId:uuid,payloadVersion:"v1",payload:{type,nested:{budget:"0.01"}}});
const response=(events:SseEventEnvelope[])=>new Response(events.map(e=>`data: ${JSON.stringify(e)}\n\n`).join(""),{headers:{"content-type":"text/event-stream"}});
describe("A1 SSE security and recovery",()=>{
  it("rejects unknown schema/version before changing state",()=>{
    const reducer=new SseStreamReducer();
    expect(()=>reducer.accept({...event(),payloadVersion:"v999"})).toThrow(SseContractError);
    expect(()=>reducer.accept({...event(),sequence:0})).toThrow(SseContractError);
    expect(reducer.resumeAfter).toBe(0);
  });
  it("discarding a late unseen event never lowers the acknowledged resume sequence",()=>{
    const reducer=new SseStreamReducer(9);expect(reducer.accept(event(1)).type).toBe('duplicate');
    expect(reducer.resumeAfter).toBe(9);expect(reducer.accept(event(10)).type).toBe('apply');
  });
  it("Zod preserves permission_revoked and nested payload through the reducer",()=>{
    const input=event(1,"permission_revoked");const parsed=bffZodSchemas.StreamEvent.parse(input);
    expect(parsed).toEqual(input);
    const reducer=new SseStreamReducer();expect(reducer.accept(parsed).type).toBe("closed");
    expect(reducer.accept(event(2)).type).toBe("duplicate");expect(reducer.resumeAfter).toBe(0);
  });
  it("resumes after network/5xx and acknowledged sequence, with cookie credentials",async()=>{
    const queries:string[]=[];let call=0;
    const actions=[];
    for await(const action of consumeSse({url:"https://bff.invalid/stream?afterSequence=99",retryDelayMs:0,fetchImpl:async(url,init)=>{
      queries.push(new URL(String(url)).search);expect(init?.credentials).toBe("include");call++;
      if(call===1)throw Error("network");
      if(call===2)return new Response(null,{status:503});
      if(call===3)return response([event()]);
      return response([event(2,"permission_revoked")]);
    }}))actions.push(action.type);
    expect(actions).toEqual(["apply","closed"]);
    expect(queries).toEqual(["?afterSequence=0","?afterSequence=0","?afterSequence=0","?afterSequence=1"]);
  });
  it("bounds server retries",async()=>{
    let calls=0;const stream=consumeSse({url:"https://bff.invalid/stream",maxReconnects:1,retryDelayMs:0,fetchImpl:async()=>{
      calls++;return new Response(null,{status:500});
    }});
    await expect(stream.next()).rejects.toThrow("retry limit");expect(calls).toBe(2);
  });
  it("401 terminates without reconnecting",async()=>{
    let calls=0;const stream=consumeSse({url:"https://bff.invalid/stream",fetchImpl:async()=>{calls++;return new Response(null,{status:401});}});
    expect((await stream.next()).value).toEqual({type:"closed",reason:"permission_revoked"});expect((await stream.next()).done).toBe(true);expect(calls).toBe(1);
  });
  it("parses CRLF and releases the reader",async()=>{
    const body=new Response(`: heartbeat\r\ndata: ${JSON.stringify(event())}\r\n\r\n`).body!;
    const received=[];for await(const value of parseSse(body))received.push(value);
    expect(received).toEqual([event()]);expect(body.locked).toBe(false);
  });
  it("malformed JSON is a terminal contract error",async()=>{
    let calls=0;const stream=consumeSse({url:"https://bff.invalid/stream",fetchImpl:async()=>{calls++;return new Response('data: {broken}\n\n');}});
    await expect(stream.next()).rejects.toThrow(SseContractError);expect(calls).toBe(1);
  });
  it("aborted streams do not start another request",async()=>{
    const controller=new AbortController();controller.abort(Error("cancelled"));let calls=0;
    const stream=consumeSse({url:"https://bff.invalid/stream",signal:controller.signal,fetchImpl:async()=>{calls++;return response([]);}});
    await expect(stream.next()).rejects.toThrow("cancelled");expect(calls).toBe(0);
  });
});
