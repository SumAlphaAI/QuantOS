import { createBffClient, parseBffResponse, bffZodSchemas, type BffOperationId } from "@sumalpha/api-client";
import type { BffComponents, BffOperations } from "@sumalpha/api-client";

export type AuditSearch = NonNullable<BffOperations["searchAuditEvents"]["parameters"]["query"]>;
export type ExportRequest = BffOperations["createExport"]["requestBody"]["content"]["application/json"];
export type AuditEventPage = BffComponents["schemas"]["AuditEventPage"];
export type EvidenceChainPage = BffComponents["schemas"]["EvidenceChainPage"];
export type ExportJob = BffComponents["schemas"]["ExportJob"];
export type ExportDownloadMetadata = BffComponents["schemas"]["ExportDownloadMetadata"];

export class AuditGatewayError extends Error {
  constructor(
    message: string,
    readonly operation: string,
    readonly status?: number,
    readonly correlationId?: string,
  ) {
    super(message);
    this.name = "AuditGatewayError";
  }
}

function failure(operation: string, result: { response: Response; error?: { correlationId?: string } }): AuditGatewayError {
  const status = result.response.status;
  const message = status === 410
    ? "导出已过期，请重新创建。"
    : status === 403 || status === 404
      ? "资源不存在或无权访问。"
      : "审计服务暂不可用，请稍后重试。";
  return new AuditGatewayError(message, operation, status, result.error?.correlationId);
}

function required<T>(operation: BffOperationId, result: {data?: T; error?: unknown; response: Response}): T {
  if (result.data === undefined) {
    const checked = bffZodSchemas.ErrorEnvelope.safeParse(result.error);
    throw failure(operation, {response: result.response, error: checked.success ? checked.data : undefined});
  }
  try {
    const value = parseBffResponse(operation, result.response.status, result.data) as T;
    if (operation === "getExportDownload") {
      const meta = value as ExportDownloadMetadata;
      const url = new URL(meta.downloadUrl);
      const expires = Date.parse(meta.expiresAt);
      const retention = Date.parse(meta.retentionUntil);
      if (url.protocol !== "https:" || url.username || url.password || expires <= Date.now() || expires > Date.now() + 300_000 || expires > retention || retention <= Date.now()) throw Error("Invalid download lease");
    }
    return value;
  } catch {
    throw new AuditGatewayError("审计服务响应无效，请稍后重试。", operation, result.response.status);
  }
}

export async function searchAuditEvents(
  origin: string,
  query: AuditSearch,
  fetchImpl: typeof fetch = fetch,
): Promise<AuditEventPage> {
  const result = await createBffClient({ baseUrl: origin, fetch: fetchImpl }).GET("/v1/audit/events", { params: { query } });
  return required("searchAuditEvents", result);
}

export async function loadEvidenceChain(
  origin: string,
  correlationId: string,
  query: Pick<AuditSearch, "cursor" | "pageSize"> = {},
  fetchImpl: typeof fetch = fetch,
): Promise<EvidenceChainPage> {
  const result = await createBffClient({ baseUrl: origin, fetch: fetchImpl }).GET("/v1/audit/evidence-chains/{correlationId}", {
    params: { path: { correlationId }, query },
  });
  return required("getEvidenceChain", result);
}

export async function createControlledExport(
  origin: string,
  body: ExportRequest,
  idempotencyKey: string,
  csrfToken: string,
  reauthTokenRef: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ExportJob> {
  const result = await createBffClient({ baseUrl: origin, fetch: fetchImpl }).POST("/v1/exports", {
    body,
    params: { header: { "Idempotency-Key": idempotencyKey, "X-Request-Id": crypto.randomUUID(), "X-CSRF-Token": csrfToken, "X-Reauth-Token-Ref": reauthTokenRef } },
  });
  return required("createExport", result);
}

export async function loadExportStatus(origin: string, exportId: string, fetchImpl: typeof fetch = fetch): Promise<ExportJob> {
  const result = await createBffClient({ baseUrl: origin, fetch: fetchImpl }).GET("/v1/exports/{exportId}", { params: { path: { exportId } } });
  return required("getExportStatus", result);
}

export async function cancelControlledExport(
  origin: string,
  exportId: string,
  idempotencyKey: string,
  csrfToken: string,
  reauthTokenRef: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ExportJob> {
  const result = await createBffClient({ baseUrl: origin, fetch: fetchImpl }).POST("/v1/exports/{exportId}/cancel", {
    params: {
      path: { exportId },
      header: { "Idempotency-Key": idempotencyKey, "X-Request-Id": crypto.randomUUID(), "X-CSRF-Token": csrfToken, "X-Reauth-Token-Ref": reauthTokenRef },
    },
  });
  return required("cancelExport", result);
}

export async function getControlledExportDownload(
  origin: string,
  exportId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ExportDownloadMetadata> {
  const result = await createBffClient({ baseUrl: origin, fetch: fetchImpl }).GET("/v1/exports/{exportId}/download", {
    params: { path: { exportId } },
  });
  return required("getExportDownload", result);
}
