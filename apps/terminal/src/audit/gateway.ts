import { createBffClient } from "@sumalpha/api-client";
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

export async function searchAuditEvents(
  origin: string,
  query: AuditSearch,
  fetchImpl: typeof fetch = fetch,
): Promise<AuditEventPage> {
  const result = await createBffClient({ baseUrl: origin, fetch: fetchImpl }).GET("/v1/audit/events", { params: { query } });
  if (!result.data) throw failure("searchAuditEvents", result);
  return result.data;
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
  if (!result.data) throw failure("getEvidenceChain", result);
  return result.data;
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
    params: { header: { "Idempotency-Key": idempotencyKey, "X-CSRF-Token": csrfToken, "X-Reauth-Token-Ref": reauthTokenRef } },
  });
  if (!result.data) throw failure("createExport", result);
  return result.data;
}

export async function loadExportStatus(origin: string, exportId: string, fetchImpl: typeof fetch = fetch): Promise<ExportJob> {
  const result = await createBffClient({ baseUrl: origin, fetch: fetchImpl }).GET("/v1/exports/{exportId}", { params: { path: { exportId } } });
  if (!result.data) throw failure("getExportStatus", result);
  return result.data;
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
      header: { "Idempotency-Key": idempotencyKey, "X-CSRF-Token": csrfToken, "X-Reauth-Token-Ref": reauthTokenRef },
    },
  });
  if (!result.data) throw failure("cancelExport", result);
  return result.data;
}

export async function getControlledExportDownload(
  origin: string,
  exportId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ExportDownloadMetadata> {
  const result = await createBffClient({ baseUrl: origin, fetch: fetchImpl }).GET("/v1/exports/{exportId}/download", {
    params: { path: { exportId } },
  });
  if (!result.data) throw failure("getExportDownload", result);
  return result.data;
}
