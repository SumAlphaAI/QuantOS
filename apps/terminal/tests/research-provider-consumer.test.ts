import { referenceBffExecutable, referenceBffRoot, referenceBffSourceEnv } from "./helpers/reference-bff";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { afterAll, beforeAll, expect, it } from "vitest";
import { loadEvidenceChain } from "../src/audit/gateway";
import { listResearchRuns, createResearchRun, getResearchRun, cancelResearchRun, listDataSnapshots, getDataSnapshot, getResearchArtifact, getResearchAttachment, subscribeResearchRun, ResearchStreamReducer, type ResearchInput } from "../src/research/gateway";

let child: ChildProcess, origin: string;
const csrf = "csrf-token-0000000000000001";
let loseCreateResponse = false;
const transport: typeof fetch = async (input, init) => {
  const request = new Request(input, init);
  request.headers.set("cookie", `quantos_session=session-current; quantos_csrf=${csrf}`);
  request.headers.set("origin", "http://localhost:3190");
  const response = await fetch(request);
  if (loseCreateResponse && request.method === "POST" && new URL(request.url).pathname === "/v1/research-runs") {
    loseCreateResponse = false;
    await response.body?.cancel();
    throw Error("synthetic lost response after committed create");
  }
  return response;
};
beforeAll(async () => {
  const reserve = createServer();
  await new Promise<void>(r => reserve.listen(0, "127.0.0.1", r));
  const port = (reserve.address() as { port: number }).port;
  await new Promise<void>(r => reserve.close(() => r()));
  origin = `http://127.0.0.1:${port}`;
  child = spawn(referenceBffExecutable(), [], { cwd: referenceBffRoot, env: { ...referenceBffSourceEnv(), NODE_ENV: "test", PATH: process.env.PATH, HOME: process.env.HOME, QUANTOS_SKIP_ENV: "1", QUANTOS_BFF_MODE: "reference", QUANTOS_BFF_BIND: `127.0.0.1:${port}` }, stdio: ["ignore", "pipe", "pipe"] });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(Error("reference startup timeout")), 10000);
    child.once("error", error => { clearTimeout(timer); reject(error); });
    child.once("exit", () => { clearTimeout(timer); reject(Error("reference startup exit")); });
    child.stdout?.on("data", chunk => { if (String(chunk).includes('"ready":true')) { clearTimeout(timer); resolve(); } });
  });
}, 15000);
afterAll(async () => { if (child && child.exitCode === null) { child.kill(); await new Promise(r => child.once("close", r)); } });

const snapshot="11111111-1111-4111-8111-000000000001",artifact="44444444-4444-4444-8444-444444444444";
it("recovers research commands through actual Rust HTTP and follows Audit, artifact and stream evidence",async()=>{
 const first=await listDataSnapshots(origin,{pageSize:1,sort:"snapshotId:asc"},transport);expect(first.nextCursor).toBeTruthy();
 const next=await listDataSnapshots(origin,{pageSize:1,sort:"snapshotId:asc",cursor:first.nextCursor},transport);expect(next.items[0]).not.toEqual(first.items[0]);
 expect((await getDataSnapshot(origin,snapshot,transport)).qualityBlocked).toBe(false);
 const metadata=await getResearchArtifact(origin,artifact,transport);const attachment=await getResearchAttachment(origin,artifact,metadata.contentHash,transport);expect(attachment.contentHash).toBe(metadata.contentHash);
 expect((await loadEvidenceChain(origin,attachment.correlationId!,{},transport)).items[0]?.eventId).toBe(attachment.auditRef);
 const body:ResearchInput={capability:"research.hypothesis.v1",dataSnapshotId:snapshot,question:"Actual bounded research consumer",budget:"10",deadlineAt:new Date(Date.now()+3600000).toISOString(),attachments:[artifact]};
 const key=crypto.randomUUID();loseCreateResponse=true;
 await expect(createResearchRun(origin,body,key,csrf,transport)).rejects.toMatchObject({code:"NETWORK",outcomeUnknown:true});
 const accepted=await createResearchRun(origin,body,key,csrf,transport);
 const retries=await Promise.all(Array.from({length:6},()=>createResearchRun(origin,body,key,csrf,transport)));expect(retries.every(v=>JSON.stringify(v)===JSON.stringify(accepted))).toBe(true);
 expect((await listResearchRuns(origin,{},transport)).items).toHaveLength(1);expect((await getResearchRun(origin,accepted.jobId,transport)).status).toBe("queued");
 await expect(createResearchRun(origin,{...body,question:"Changed intent"},key,csrf,transport)).rejects.toMatchObject({status:409});
 await expect(createResearchRun(origin,{...body,dataSnapshotId:"11111111-1111-4111-8111-000000000002"},crypto.randomUUID(),csrf,transport)).rejects.toMatchObject({status:422});
 const cancelKey=crypto.randomUUID();const cancelled=await cancelResearchRun(origin,accepted.jobId,cancelKey,csrf,transport);expect(await cancelResearchRun(origin,accepted.jobId,cancelKey,csrf,transport)).toEqual(cancelled);
 expect((await getResearchRun(origin,accepted.jobId,transport)).status).toBe("cancelled");
 const chain=await loadEvidenceChain(origin,accepted.correlationId,{},transport);expect(chain.items[0]?.eventId).toBe(accepted.auditRef);expect(chain.items.some(e=>e.eventId===cancelled.auditRef&&e.causationId===accepted.auditRef)).toBe(true);
 const reducer=new ResearchStreamReducer(accepted.jobId),controller=new AbortController();let dropped=false;
 const interrupted:typeof fetch=async(input,init)=>{const response=await transport(input,init);if(!dropped){dropped=true;await response.body?.cancel();return new Response("",{headers:{"content-type":"text/event-stream"}});}return response;};
 const stream=subscribeResearchRun(origin,accepted.jobId,{fetchImpl:interrupted,reducer,signal:controller.signal,retryDelayMs:0});
 expect((await stream.next()).value).toMatchObject({type:"apply",event:{sequence:1}});expect((await stream.next()).value).toMatchObject({type:"apply",event:{sequence:2}});controller.abort();await stream.return(undefined);expect(reducer.resumeAfter).toBe(2);
 const logout=await transport(origin+"/v1/auth/logout",{method:"POST",headers:{"x-csrf-token":csrf}});expect(logout.status).toBe(204);
 const resumed=subscribeResearchRun(origin,accepted.jobId,{fetchImpl:transport,reducer,retryDelayMs:0});expect((await resumed.next()).value).toEqual({type:"closed",reason:"permission_revoked"});expect((await resumed.next()).done).toBe(true);
 await expect(getResearchRun(origin,accepted.jobId,transport)).rejects.toMatchObject({status:401});
},15000);
