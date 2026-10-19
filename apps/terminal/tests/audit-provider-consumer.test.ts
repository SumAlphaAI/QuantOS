import { referenceBffExecutable, referenceBffRoot, referenceBffSourceEnv } from "./helpers/reference-bff";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { afterAll, beforeAll, expect, it } from "vitest";
import { completeLoginMfa, completeRecentAuth } from "../src/auth/bff";
import { searchAuditEvents, loadEvidenceChain, createControlledExport, loadExportStatus, cancelControlledExport, getControlledExportDownload, type ExportRequest } from "../src/audit/gateway";

let child: ChildProcess, origin: string;
const csrf = "csrf-token-0000000000000001";
let loseCreateResponse = false;
const transport: typeof fetch = async (input, init) => {
  const request = new Request(input, init);
  request.headers.set("cookie", `quantos_session=session-current; quantos_csrf=${csrf}`);
  request.headers.set("origin", "http://localhost:3190");
  const response = await fetch(request);
  if (loseCreateResponse && request.method === "POST" && new URL(request.url).pathname === "/v1/exports") {
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
    const timer = setTimeout(() => reject(Error("reference startup timeout")), 30000);
    child.once("error", error => { clearTimeout(timer); reject(error); });
    child.once("exit", () => { clearTimeout(timer); reject(Error("reference startup exit")); });
    child.stdout?.on("data", chunk => { if (String(chunk).includes('"ready":true')) { clearTimeout(timer); resolve(); } });
  });
}, 35000);
afterAll(async () => { if (child && child.exitCode === null) { child.kill(); await new Promise(r => child.once("close", r)); } });

const correlation="aaaaaaaa-1111-4111-8111-111111111111";
it("recovers a lost create response with the same key and traverses actual redacted export evidence", async () => {
  const page=await searchAuditEvents(origin,{correlationId:correlation,pageSize:3},transport);
  expect(page.items.length).toBe(3);
  const seen=new Set<string>();for(const event of page.items)seen.add(event.eventId);let cursor=page.nextCursor;
  while(cursor){const next=await searchAuditEvents(origin,{correlationId:correlation,pageSize:3,cursor},transport);for(const item of next.items){expect(seen.has(item.eventId)).toBe(false);seen.add(item.eventId);expect(item.redactionApplied).toBe(true);}cursor=next.nextCursor;}
  expect(seen.size).toBe(8);
  const challenge=await completeLoginMfa(origin,"123456",csrf,transport);
  const grant=await completeRecentAuth(origin,challenge.challengeRef,csrf,transport);
  const body:ExportRequest={scope:{correlationIds:[correlation]},format:"jsonl",reason:"Controlled audit recovery",watermark:"QuantOS audit copy",retentionDays:7};
  const key=crypto.randomUUID();loseCreateResponse=true;
  await expect(createControlledExport(origin,body,key,csrf,grant.reauthTokenRef,transport)).rejects.toMatchObject({code:"NETWORK",outcomeUnknown:true});
  const recovered=await createControlledExport(origin,body,key,csrf,grant.reauthTokenRef,transport);
  expect(await createControlledExport(origin,body,key,csrf,grant.reauthTokenRef,transport)).toEqual(recovered);
  expect(recovered.correlationId).not.toBe(correlation);
  expect((await searchAuditEvents(origin,{kind:"export.created"},transport)).items).toHaveLength(1);
  const ready=await loadExportStatus(origin,recovered.exportId,transport);expect(ready.status).toBe("ready");
  const metadata=await getControlledExportDownload(origin,recovered.exportId,transport);expect(metadata.watermarked).toBe(true);expect(Date.parse(metadata.expiresAt)).toBeLessThanOrEqual(Date.now()+300_000);
  // Metadata only: reference URLs are intentionally not fetched.
  const chain=await loadEvidenceChain(origin,recovered.correlationId,{pageSize:2},transport);
  expect(chain.items[0]?.eventId).toBe(recovered.auditRef);expect(chain.complete).toBe(false);
  const tail=await loadEvidenceChain(origin,recovered.correlationId,{pageSize:2,cursor:chain.nextCursor},transport);
  expect(tail.items.every(e=>e.causationId===recovered.auditRef)).toBe(true);
  const cancelKey=crypto.randomUUID();const cancelled=await cancelControlledExport(origin,recovered.exportId,cancelKey,csrf,grant.reauthTokenRef,transport);
  expect(await cancelControlledExport(origin,recovered.exportId,cancelKey,csrf,grant.reauthTokenRef,transport)).toEqual(cancelled);
  await expect(getControlledExportDownload(origin,recovered.exportId,transport)).rejects.toMatchObject({status:409});
  await expect(getControlledExportDownload(origin,"eeeeeeee-1111-4111-8111-111111111111",transport)).rejects.toMatchObject({status:410,message:"导出已过期，请重新创建。"});
},15000);
