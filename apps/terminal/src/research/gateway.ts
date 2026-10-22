import { createBffClient, parseBffResponse, bffZodSchemas, consumeSse, SseStreamReducer, SseContractError, type SseEventEnvelope, type ConsumeSseOptions, type BffOperationId, type BffOperations, type BffRequestOptions } from "@sumalpha/api-client";

export type ResearchInput = BffOperations["createResearchRun"]["requestBody"]["content"]["application/json"];
export type ResearchQuery = NonNullable<BffOperations["listResearchRuns"]["parameters"]["query"]>;
export type SnapshotQuery = NonNullable<BffOperations["listDataSnapshots"]["parameters"]["query"]>;
export class ResearchGatewayError extends Error {
  constructor(readonly operation: string, readonly status: number, readonly fields: Record<string,string> = {}, readonly correlationId?: string, readonly retryAfter?: number) { super(status === 403 || status === 404 ? "资源不存在或无权访问。" : status === 410 ? "列表已过期，请刷新。" : "研究服务响应无效或暂不可用。"); }
  get outcomeUnknown() {return this.operation === "createResearchRun" && (this.status >= 500 || this.status < 400);}
}
function required<T>(operation: BffOperationId, result: { data?: T; error?: unknown; response: Response }, expected?: { field: string; value: string }): T {
  if (result.data === undefined) {
    const parsed=bffZodSchemas.ErrorEnvelope.safeParse(result.error), e=parsed.success?parsed.data:undefined;
    const allowed=["capability","dataSnapshotId","question","budget","deadlineAt","attachments"];
    const fields=Object.fromEntries(Object.keys(e?.fieldErrors??{}).filter(k=>allowed.includes(k)).map(k=>[k,"服务端拒绝此字段，请核对后重新提交。"]));
    throw new ResearchGatewayError(operation,result.response.status,result.response.status===422?fields:{},e?.correlationId,e?.retryAfter);
  }
  try {
    const data = parseBffResponse(operation, result.response.status, result.data) as T;
    const value = data as Record<string, unknown>;
    if (expected && value[expected.field] !== expected.value) throw Error("Resource mismatch");
    if (["createResearchRun", "cancelResearchRun"].includes(operation) && value.statusRef !== `/v1/research-runs/${String(value.jobId)}`) throw Error("Status reference mismatch");
    return data;
  } catch { throw new ResearchGatewayError(operation, result.response.status); }
}
const client = (origin: string, fetchImpl: typeof fetch, options: BffRequestOptions) => createBffClient({ baseUrl: origin, fetch: fetchImpl, ...options });
export async function listResearchRuns(origin: string, query: ResearchQuery = {}, fetchImpl: typeof fetch = fetch, options: BffRequestOptions = {}) {
  return required("listResearchRuns", await client(origin, fetchImpl, options).GET("/v1/research-runs", { cache: "no-store", params: { query } }));
}
export async function createResearchRun(origin: string, body: ResearchInput, key: string, csrf: string, fetchImpl: typeof fetch = fetch, options: BffRequestOptions = {}) {
  return required("createResearchRun", await client(origin, fetchImpl, options).POST("/v1/research-runs", { body, params: { header: { "Idempotency-Key": key, "X-Request-Id": crypto.randomUUID(), "X-CSRF-Token": csrf } } }));
}
export async function getResearchRun(origin: string, runId: string, fetchImpl: typeof fetch = fetch, options: BffRequestOptions = {}) {
  return required("getResearchRun", await client(origin, fetchImpl, options).GET("/v1/research-runs/{runId}", { params: { path: { runId } } }), { field: "runId", value: runId });
}
export async function cancelResearchRun(origin: string, runId: string, key: string, csrf: string, fetchImpl: typeof fetch = fetch, options: BffRequestOptions = {}) {
  return required("cancelResearchRun", await client(origin, fetchImpl, options).POST("/v1/research-runs/{runId}/cancel", { params: { path: { runId }, header: { "Idempotency-Key": key, "X-Request-Id": crypto.randomUUID(), "X-CSRF-Token": csrf } } }), { field: "jobId", value: runId });
}
export async function listDataSnapshots(origin: string, query: SnapshotQuery = {}, fetchImpl: typeof fetch = fetch, options: BffRequestOptions = {}) {
  return required("listDataSnapshots", await client(origin, fetchImpl, options).GET("/v1/data-snapshots", { cache: "no-store", params: { query } }));
}
export async function getDataSnapshot(origin: string, snapshotId: string, fetchImpl: typeof fetch = fetch, options: BffRequestOptions = {}) {
  return required("getDataSnapshot", await client(origin, fetchImpl, options).GET("/v1/data-snapshots/{snapshotId}", { cache: "no-store", params: { path: { snapshotId } } }), { field: "snapshotId", value: snapshotId });
}
export async function getResearchArtifact(origin: string, artifactId: string, fetchImpl: typeof fetch = fetch, options: BffRequestOptions = {}) {
  return required("getArtifact", await client(origin, fetchImpl, options).GET("/v1/artifacts/{artifactId}", { params: { path: { artifactId } } }), { field: "artifactId", value: artifactId });
}
export async function getResearchAttachment(origin: string, artifactId: string, expectedContentHash: string, fetchImpl: typeof fetch = fetch, options: BffRequestOptions = {}) {
  const data = required("getArtifactAttachment", await client(origin, fetchImpl, options).GET("/v1/artifacts/{artifactId}/attachment", { params: { path: { artifactId } } }), { field: "artifactId", value: artifactId });
  // The server verifies canonical archived bytes; bind the response to the metadata
  // already selected by this consumer, without inventing a second JSON encoding.
  if (data.contentHash !== expectedContentHash) throw new ResearchGatewayError("getArtifactAttachment", 200);
  return data;
}
export class ResearchStreamReducer extends SseStreamReducer {
  constructor(readonly runId: string, startAfter = 0) { super(startAfter); if (!Number.isSafeInteger(startAfter) || startAfter < 0) throw new SseContractError("Invalid research resume sequence"); }
  override accept(event: SseEventEnvelope) {
    if (!bffZodSchemas.StreamEvent.safeParse(event).success) throw new SseContractError("Invalid research stream envelope");
    if (event.streamId !== this.runId || (event.payload.runId !== undefined && event.payload.runId !== this.runId)) throw new SseContractError("Research stream resource mismatch");
    return super.accept(event);
  }
}
export function subscribeResearchRun(origin: string, runId: string, options: Omit<ConsumeSseOptions, "url" | "reducer"> & { reducer?: ResearchStreamReducer } = {}) {
  const reducer = options.reducer ?? new ResearchStreamReducer(runId);
  if (reducer.runId !== runId) throw new SseContractError("Research reducer resource mismatch");
  return consumeSse({ ...options, reducer, url: new URL(`/v1/research-runs/${encodeURIComponent(runId)}/stream`, origin).toString() });
}
