import { describe, expect, it } from "vitest";

import {
  AuditGatewayError,
  cancelControlledExport,
  createControlledExport,
  getControlledExportDownload,
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
