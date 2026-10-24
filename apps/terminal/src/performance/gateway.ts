import {createBffClient, bffZodSchemas, parseBffResponse, type BffComponents} from "@sumalpha/api-client";
export const performanceClient = (origin: string, transport: typeof fetch = fetch) => createBffClient({baseUrl: origin, fetch: transport, timeoutMs: 10000});
/** Recovery retains the original actor/session/key; no optimistic financial values. */
export function acceptedReport(raw: unknown, status: number) {
  if (status !== 202) throw Error("Report was not accepted");
  return parseBffResponse("createPerformanceReport", status, raw) as BffComponents["schemas"]["PerformanceReport"];
}
export function performanceView(raw: unknown, accountId: string) {
  const value = bffZodSchemas.PerformanceView.parse(raw);
  if (value.accountId !== accountId) throw Error("Performance account mismatch");
  if (!value.coverage.complete && !value.provisional) throw Error("Partial coverage must be provisional");
  if (value.series.some(p => p.provisional) && !value.provisional) throw Error("Unreconciled data must be provisional");
  return value;
}
/** Hash the actual response bytes before parsing. Never rewrite decimal strings. */
export async function verifiedReport(response: Response, rawGrant: unknown, accountId: string) {
  const grant = bffZodSchemas.PerformanceDownload.parse(rawGrant);
  if (grant.accountId !== accountId || response.status !== 200) throw Error("Report download refused");
  const bytes = new Uint8Array(await response.arrayBuffer());
  const hash = "sha256:" + Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), b => b.toString(16).padStart(2, "0")).join("");
  if (hash !== grant.sha256 || bytes.byteLength !== grant.sizeBytes) throw Error("Report integrity mismatch");
  const document = bffZodSchemas.PerformanceReportDocument.parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));
  if (document.metadata.reportId !== grant.reportId || document.metadata.ledgerVersion !== grant.ledgerVersion || document.metadata.valuationSnapshotId !== grant.valuationSnapshotId) throw Error("Report version mismatch");
  for (const key of ["status", "createdAt", "expiresAt", "correlationId", "auditRef", "supersededBy"] as const) {
    if (JSON.stringify(document.metadata[key]) !== JSON.stringify(grant[key])) throw Error("Report metadata mismatch");
  }
  for (const key of ["accountId", "currency", "method", "asOf", "ledgerVersion", "valuationSnapshotId", "period", "periodMode", "provisional", "coverage"] as const) {
    if (JSON.stringify(document.metadata[key]) !== JSON.stringify(grant[key]) || JSON.stringify(document.performance[key]) !== JSON.stringify(document.metadata[key])) throw Error("Report metadata mismatch");
  }
  performanceView(document.performance, accountId);
  return document;
}
