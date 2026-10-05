import {expect,it} from "vitest";
import {createBffFetch} from "../src/bff-transport";
it("keeps caller stream cancellation connected after SSE headers return", async () => {
  const caller=new AbortController();let forwarded:AbortSignal|undefined;
  const impl=(async (_:unknown,init?:RequestInit)=>{forwarded=init?.signal??undefined;return new Response("data: {}\n\n",{headers:{"content-type":"text/event-stream"}});}) as typeof fetch;
  const response=await createBffFetch(impl,{signal:caller.signal,timeoutMs:10})("https://bff.example/stream");
  expect(await response.text()).toBe("data: {}\n\n");expect(forwarded?.aborted).toBe(false);
  caller.abort();expect(forwarded?.aborted).toBe(true);
});
it("rejects invalid deadlines before dispatch",()=>{
 const impl=(async()=>Response.json({})) as typeof fetch;
 for(const timeoutMs of [0,-1,NaN,Infinity])expect(()=>createBffFetch(impl,{timeoutMs})).toThrow(RangeError);
});
it("buffers empty successful responses and preserves their headers",async()=>{
 const impl=(async()=>new Response(null,{status:204,headers:{"x-correlation-id":"test"}})) as typeof fetch;
 const response=await createBffFetch(impl)("https://bff.example/logout",{method:"POST"});
 expect(response.status).toBe(204);expect(await response.text()).toBe("");expect(response.headers.get("x-correlation-id")).toBe("test");
});
