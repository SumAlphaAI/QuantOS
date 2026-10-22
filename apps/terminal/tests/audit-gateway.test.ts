import { describe, expect, it } from "vitest";

import {
  AuditGatewayError,
  cancelControlledExport,
  createControlledExport,
  getControlledExportDownload,
  loadEvidenceChain,
  loadExportStatus,
  searchAuditEvents,
} from "../src/audit/gateway";

const EXPORT_ID = "11111111-2222-4333-8444-555555555555";
const CORRELATION_ID = "66666666-7777-4888-8999-000000000000";
const AUDIT_REF = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

function exportJob(status: "queued" | "cancelled") {
  return {
    exportId: EXPORT_ID,
    status,
    format: "jsonl" as const,
    requestedBy: "auditor",
    requestedAt: "2026-09-16T10:00:00Z",
    watermark: "QuantOS audit copy",
    retentionUntil: "2026-09-23T10:00:00Z",
    correlationId: CORRELATION_ID,
    auditRef: AUDIT_REF,
  };
}

describe("BFF-FE-007 generated audit gateway", () => {
  it("retrieves evidence and export status through authenticated BFF routes", async () => {
    const requests: Request[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const request = input as Request;
      requests.push(request);
      const body = request.url.includes("evidence-chains") ? { correlationId: CORRELATION_ID, items: [], complete: true } : exportJob("queued");
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    expect((await loadEvidenceChain("https://bff.example", CORRELATION_ID, { cursor: "next", pageSize: 25 }, fetchImpl)).complete).toBe(true);
    expect((await loadExportStatus("https://bff.example", EXPORT_ID, fetchImpl)).status).toBe("queued");
    expect(requests[0]?.url).toContain(`evidence-chains/${CORRELATION_ID}?cursor=next&pageSize=25`);
    expect(requests[1]?.url).toContain(`/exports/${EXPORT_ID}`);
    expect(requests.every(request => request.credentials === "include")).toBe(true);
  });
  it("uses server-side cursor filters for audit search", async () => {
    let requestUrl = "";
    const fetchImpl = (async (input: RequestInfo | URL) => {
      requestUrl = input instanceof Request ? input.url : String(input);
      return new Response(JSON.stringify({ items: [], nextCursor: "audit:50" }), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    const page = await searchAuditEvents("https://bff.example", { correlationId: CORRELATION_ID, pageSize: 50 }, fetchImpl);
    expect(page.nextCursor).toBe("audit:50");
    expect(requestUrl).toContain(`correlationId=${CORRELATION_ID}`);
    expect(requestUrl).toContain("pageSize=50");
  });

  it("forwards idempotency, CSRF and recent-auth for create and cancel", async () => {
    const captured: Headers[] = [];
    let calls = 0;
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      captured.push(input instanceof Request ? input.headers : new Headers(init?.headers));
      calls += 1;
      return new Response(JSON.stringify(exportJob(calls === 1 ? "queued" : "cancelled")), { status: 202, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    const created = await createControlledExport("https://bff.example", {
      scope: { correlationIds: [CORRELATION_ID] }, format: "jsonl", reason: "Regulatory review",
      watermark: "QuantOS audit copy", retentionDays: 7,
    }, "create-1", "csrf-1", "reauth-1", fetchImpl);
    expect(created.status).toBe("queued");
    await cancelControlledExport("https://bff.example", EXPORT_ID, "cancel-1", "csrf-1", "reauth-1", fetchImpl);
    expect(captured[0]?.get("idempotency-key")).toBe("create-1");
    expect(captured[0]?.get("x-csrf-token")).toBe("csrf-1");
    expect(captured[0]?.get("x-reauth-token-ref")).toBe("reauth-1");
    expect(captured[1]?.get("idempotency-key")).toBe("cancel-1");
  });

  it("maps expired downloads without exposing transport details", async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({
      code: "EXPORT_EXPIRED", message: "internal object key", correlationId: CORRELATION_ID,
    }), { status: 410, headers: { "content-type": "application/json" } })) as typeof fetch;
    const error = await getControlledExportDownload("https://bff.example", EXPORT_ID, fetchImpl).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(AuditGatewayError);
    expect((error as AuditGatewayError).message).toBe("导出已过期，请重新创建。");
    expect((error as AuditGatewayError).message).not.toContain("object key");
  });
});

it("every controlled audit operation conceals denied resources and rejects transport failures", async () => {
  const operations=[
    (f:typeof fetch)=>searchAuditEvents("https://bff.example",{},f),
    (f:typeof fetch)=>loadEvidenceChain("https://bff.example",CORRELATION_ID,undefined,f),
    (f:typeof fetch)=>createControlledExport("https://bff.example",{scope:{correlationIds:[CORRELATION_ID]},format:"jsonl",reason:"Review",watermark:"audit",retentionDays:7},"key","csrf","reauth",f),
    (f:typeof fetch)=>loadExportStatus("https://bff.example",EXPORT_ID,f),
    (f:typeof fetch)=>cancelControlledExport("https://bff.example",EXPORT_ID,"key","csrf","reauth",f),
    (f:typeof fetch)=>getControlledExportDownload("https://bff.example",EXPORT_ID,f),
  ];
  for (const status of [403,404,500]) for (const operation of operations) {
    const fetchImpl=(async()=>new Response(JSON.stringify({code:"DENIED",message:"internal detail"}),{status,headers:{"content-type":"application/json"}})) as typeof fetch;
    const error=await operation(fetchImpl).catch((error:unknown)=>error);
    expect(error).toBeInstanceOf(AuditGatewayError);
    expect((error as Error).message).not.toContain("internal detail");
  }
  const fetchImpl=(async()=>new Response(JSON.stringify({exportId:EXPORT_ID,url:"https://download.example",expiresAt:"2026-10-02T00:00:00Z"}),{headers:{"content-type":"application/json"}})) as typeof fetch;
  await expect(getControlledExportDownload("https://bff.example",EXPORT_ID,fetchImpl)).rejects.toBeInstanceOf(AuditGatewayError);
});

it("validates every success schema and rejects unsafe download leases", async () => {
 const operations=[
  (f:typeof fetch)=>searchAuditEvents("https://bff.example",{},f),
  (f:typeof fetch)=>loadEvidenceChain("https://bff.example",CORRELATION_ID,undefined,f),
  (f:typeof fetch)=>createControlledExport("https://bff.example",{scope:{correlationIds:[CORRELATION_ID]},format:"jsonl",reason:"Regulatory review",watermark:"audit",retentionDays:7},"key","csrf","reauth",f),
  (f:typeof fetch)=>loadExportStatus("https://bff.example",EXPORT_ID,f),
  (f:typeof fetch)=>cancelControlledExport("https://bff.example",EXPORT_ID,"key","csrf","reauth",f),
  (f:typeof fetch)=>getControlledExportDownload("https://bff.example",EXPORT_ID,f),
 ];
 for(const op of operations){const f=(async()=>new Response(JSON.stringify({unexpected:true}),{headers:{"content-type":"application/json"}})) as typeof fetch;await expect(op(f)).rejects.toBeInstanceOf(AuditGatewayError);}
 const metadata={exportId:EXPORT_ID,downloadUrl:"https://bff.example/_bff/export-content/22222222-2222-4222-8222-222222222222/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",expiresAt:new Date(Date.now()+60_000).toISOString(),retentionUntil:new Date(Date.now()+86_400_000).toISOString(),sha256:"a".repeat(64),sizeBytes:12,mediaType:"application/x-ndjson",watermarked:true,auditRef:AUDIT_REF};
 for(const patch of [{downloadUrl:metadata.downloadUrl.replace("bff.example","terminal.example")},{downloadUrl:metadata.downloadUrl+"?x=1"},{downloadUrl:metadata.downloadUrl+"#x"},{downloadUrl:metadata.downloadUrl.replace("/_bff","/other/../_bff")},{watermarked:false},{expiresAt:"2000-01-01T00:00:00Z"},{expiresAt:new Date(Date.now()+600_000).toISOString()},{downloadUrl:"http://bff.example/object"},{downloadUrl:"https://user:password@bff.example/object"},{retentionUntil:"2000-01-01T00:00:00Z"}]){const f=(async()=>new Response(JSON.stringify({...metadata,...patch}),{headers:{"content-type":"application/json"}})) as typeof fetch;await expect(getControlledExportDownload("https://bff.example",EXPORT_ID,f)).rejects.toBeInstanceOf(AuditGatewayError);}
 const valid=(async()=>new Response(JSON.stringify(metadata),{headers:{"content-type":"application/json"}})) as typeof fetch;expect(await getControlledExportDownload("https://bff.example",EXPORT_ID,valid)).toEqual(metadata);
 const unsafe=(async()=>new Response(JSON.stringify({items:[{redactionApplied:false}]}),{headers:{"content-type":"application/json"}})) as typeof fetch;await expect(searchAuditEvents("https://bff.example",{},unsafe)).rejects.toBeInstanceOf(AuditGatewayError);
});

it("binds chain, status, cancel and download responses to the requested resource", async () => {
  const other="99999999-2222-4333-8444-555555555555";
  const chain=(async()=>Response.json({correlationId:other,items:[],complete:true})) as typeof fetch;
  await expect(loadEvidenceChain("https://bff.example",CORRELATION_ID,{},chain)).rejects.toBeInstanceOf(AuditGatewayError);
  const job=(async()=>Response.json({...exportJob("cancelled"),exportId:other},{status:202})) as typeof fetch;
  await expect(cancelControlledExport("https://bff.example",EXPORT_ID,"key","csrf","reauth",job)).rejects.toBeInstanceOf(AuditGatewayError);
  const status=(async()=>Response.json({...exportJob("queued"),exportId:other})) as typeof fetch;
  await expect(loadExportStatus("https://bff.example",EXPORT_ID,status)).rejects.toBeInstanceOf(AuditGatewayError);
  const download=(async()=>Response.json({exportId:other,downloadUrl:"https://bff.example/ticket",expiresAt:new Date(Date.now()+30_000).toISOString(),retentionUntil:new Date(Date.now()+86_400_000).toISOString(),sha256:"a".repeat(64),sizeBytes:10,mediaType:"application/x-ndjson",watermarked:true,auditRef:AUDIT_REF})) as typeof fetch;
  await expect(getControlledExportDownload("https://bff.example",EXPORT_ID,download)).rejects.toBeInstanceOf(AuditGatewayError);
});

it("bounds uncertain export writes, supports cancellation and never retries automatically", async () => {
  let calls=0;let signal:AbortSignal|undefined;
  const stalled=(async (_:unknown,init?:RequestInit)=>{calls++;signal=init?.signal??undefined;return new Promise<Response>(()=>{});}) as typeof fetch;
  await expect(createControlledExport("https://bff.example",{scope:{correlationIds:[CORRELATION_ID]},format:"jsonl",reason:"Regulatory review",watermark:"audit",retentionDays:7},"key","csrf","reauth",stalled,{timeoutMs:10})).rejects.toMatchObject({code:"TIMEOUT",outcomeUnknown:true});
  expect(calls).toBe(1);expect(signal?.aborted).toBe(true);
  const controller=new AbortController();controller.abort();
  await expect(loadExportStatus("https://bff.example",EXPORT_ID,stalled,{signal:controller.signal})).rejects.toMatchObject({code:"CANCELLED"});expect(calls).toBe(1);
});
