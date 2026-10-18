import { expect, it } from "vitest";
import { createResearchRun, cancelResearchRun, getResearchRun, getDataSnapshot, getResearchArtifact, getResearchAttachment, ResearchStreamReducer, subscribeResearchRun } from "../src/research/gateway";
const id="11111111-1111-4111-8111-111111111111",other="22222222-2222-4222-8222-222222222222",hash="sha256:"+"a".repeat(64);
const input={capability:"research.hypothesis.v1" as const,dataSnapshotId:id,question:"A bounded question",budget:"10",deadlineAt:"2099-01-01T00:00:00Z"};
const accepted={jobId:id,status:"accepted",statusRef:`/v1/research-runs/${id}`,correlationId:id,auditRef:id};
const run={runId:id,capability:input.capability,dataSnapshotId:id,budget:"10",deadlineAt:input.deadlineAt,status:"queued",inputHash:hash,engineVersion:"pending",artifactRefs:[],evidenceRefs:[],correlationId:id,createdAt:"2026-10-18T00:00:00Z"};
const reply=(body:unknown,status=200):typeof fetch=>async()=>Response.json(body,{status});
it("validates accepted status references and refuses a different job on cancellation",async()=>{
 expect((await createResearchRun("http://localhost",input,id,"csrf",reply(accepted,202))).jobId).toBe(id);
 await expect(createResearchRun("http://localhost",input,id,"csrf",reply({...accepted,statusRef:`/v1/research-runs/${other}`},202))).rejects.toMatchObject({operation:"createResearchRun",status:202});
 await expect(cancelResearchRun("http://localhost",other,id,"csrf",reply({...accepted,status:"cancel_requested"},202))).rejects.toMatchObject({operation:"cancelResearchRun",status:202});
});
it("binds detail resources and rejects malformed successful responses",async()=>{
 expect((await getResearchRun("http://localhost",id,reply(run))).runId).toBe(id);
 await expect(getResearchRun("http://localhost",other,reply(run))).rejects.toMatchObject({status:200});
 await expect(getResearchRun("http://localhost",id,reply({...run,budget:10}))).rejects.toMatchObject({status:200});
 await expect(getDataSnapshot("http://localhost",id,reply({}))).rejects.toMatchObject({status:200});
 await expect(getResearchArtifact("http://localhost",id,reply({}))).rejects.toMatchObject({status:200});
});
it("binds attachment identity and metadata hash and hides server error text",async()=>{
 const attachment={artifactId:id,mediaType:"application/json",contentHash:hash,content:{summary:"controlled"},auditRef:id};
 expect((await getResearchAttachment("http://localhost",id,hash,reply(attachment))).contentHash).toBe(hash);
 await expect(getResearchAttachment("http://localhost",other,hash,reply(attachment))).rejects.toMatchObject({status:200});
 await expect(getResearchAttachment("http://localhost",id,"sha256:"+"b".repeat(64),reply(attachment))).rejects.toMatchObject({status:200});
 await expect(getResearchRun("http://localhost",id,reply({message:"private path must not leak"},403))).rejects.toMatchObject({message:"资源不存在或无权访问。",status:403});
});
it("passes timeout and cancellation into the shared bounded transport",async()=>{
 await expect(getResearchRun("http://localhost",id,(_input,init)=>new Promise((_r,reject)=>init?.signal?.addEventListener("abort",()=>reject(init.signal?.reason))),{timeoutMs:5})).rejects.toMatchObject({code:"TIMEOUT"});
 const c=new AbortController();c.abort();await expect(getResearchRun("http://localhost",id,reply(run),{signal:c.signal})).rejects.toMatchObject({code:"CANCELLED"});
});
const event=(sequence=1,eventId=id)=>({streamId:id,sequence,eventId,occurredAt:"2026-10-18T00:00:00Z",correlationId:id,payloadVersion:"v1",payload:{type:"research.queued",runId:id}});
it("rejects mismatched streams and payload IDs before acknowledgement",()=>{
 const r=new ResearchStreamReducer(id);expect(()=>r.accept({...event(),streamId:other})).toThrow("resource mismatch");expect(()=>r.accept({...event(),payload:{...event().payload,runId:other}})).toThrow("resource mismatch");expect(r.resumeAfter).toBe(0);
 expect(()=>subscribeResearchRun("http://localhost",other,{reducer:r})).toThrow("resource mismatch");
});
it("drops duplicates and late events, detects gaps, and retains terminal revocation",()=>{
 const r=new ResearchStreamReducer(id);expect(r.accept(event()).type).toBe("apply");expect(r.accept(event()).type).toBe("duplicate");expect(r.accept(event(3,other))).toMatchObject({type:"gap",expected:2,got:3});expect(r.resumeAfter).toBe(1);
 expect(r.accept(event(2,other)).type).toBe("apply");expect(r.accept(event(1,crypto.randomUUID())).type).toBe("duplicate");
 expect(r.accept({...event(3,crypto.randomUUID()),payload:{type:"permission_revoked",runId:id}}).type).toBe("closed");expect(r.isClosed).toBe(true);expect(r.resumeAfter).toBe(2);expect(r.accept(event(3,crypto.randomUUID())).type).toBe("duplicate");
});
it("refuses unsupported envelopes without advancing the reducer",()=>{const r=new ResearchStreamReducer(id);expect(()=>r.accept({...event(),payloadVersion:"v999"})).toThrow();expect(r.resumeAfter).toBe(0);});

it("rejects invalid resume positions before connecting",()=>{for(const n of [-1,1.5,Number.MAX_SAFE_INTEGER+1])expect(()=>new ResearchStreamReducer(id,n)).toThrow("resume sequence");});
