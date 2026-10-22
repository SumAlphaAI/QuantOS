import {checkedDownloadOrigin, validateDownloadLease} from "../downloads/lease";
import { createBffClient, parseBffResponse, bffZodSchemas, type BffOperationId, type BffRequestOptions } from "@sumalpha/api-client";
import type { BffComponents, BffOperations } from "@sumalpha/api-client";

export type AuditSearch = NonNullable<BffOperations["searchAuditEvents"]["parameters"]["query"]>;
export type ExportRequest = BffOperations["createExport"]["requestBody"]["content"]["application/json"];
export type AuditEventPage = Omit<BffComponents["schemas"]["AuditEventPage"], "items"> & {items: BffComponents["schemas"]["AuditEvent"][]};
export type EvidenceChainPage = BffComponents["schemas"]["EvidenceChainPage"];
export type ExportJob = BffComponents["schemas"]["ExportJob"];
export type ExportDownloadMetadata = BffComponents["schemas"]["ExportDownloadMetadata"];

export class AuditGatewayError extends Error {
  constructor(
    message: string,
    readonly operation: string,
    readonly status?: number,
    readonly correlationId?: string,
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "AuditGatewayError";
  }
}

function failure(operation: string, result: { response: Response; error?: { correlationId?: string; retryAfter?: number } }): AuditGatewayError {
  const status = result.response.status;
  const message = status === 410
    ? "导出已过期，请重新创建。"
    : status === 403 || status === 404
      ? "资源不存在或无权访问。"
      : "审计服务暂不可用，请稍后重试。";
  return new AuditGatewayError(message, operation, status, result.error?.correlationId, result.error?.retryAfter);
}

function required<T>(operation: BffOperationId, result: {data?: T; error?: unknown; response: Response}, expectedId?: string): T {
  if (result.data === undefined) {
    const checked = bffZodSchemas.ErrorEnvelope.safeParse(result.error);
    throw failure(operation, {response: result.response, error: checked.success ? checked.data : undefined});
  }
  try {
    const value = parseBffResponse(operation, result.response.status, result.data) as T;
    if (expectedId) {
      const identity = operation === "getEvidenceChain" ? (value as EvidenceChainPage).correlationId : (value as ExportJob).exportId;
      if (identity !== expectedId) throw Error("Mismatched response resource");
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
  options: BffRequestOptions = {},
): Promise<AuditEventPage> {
  const result = await createBffClient({ baseUrl: origin, fetch: fetchImpl, ...options }).GET("/v1/audit/events", { params: { query } });
  return required("searchAuditEvents", result);
}

export async function loadEvidenceChain(
  origin: string,
  correlationId: string,
  query: Pick<AuditSearch, "cursor" | "pageSize"> = {},
  fetchImpl: typeof fetch = fetch,
  options: BffRequestOptions = {},
): Promise<EvidenceChainPage> {
  const result = await createBffClient({ baseUrl: origin, fetch: fetchImpl, ...options }).GET("/v1/audit/evidence-chains/{correlationId}", {
    params: { path: { correlationId }, query },
  });
  return required("getEvidenceChain", result, correlationId);
}

export async function createControlledExport(
  origin: string,
  body: ExportRequest,
  idempotencyKey: string,
  csrfToken: string,
  reauthTokenRef: string,
  fetchImpl: typeof fetch = fetch,
  options: BffRequestOptions = {},
): Promise<ExportJob> {
  const result = await createBffClient({ baseUrl: origin, fetch: fetchImpl, ...options }).POST("/v1/exports", {
    body,
    params: { header: { "Idempotency-Key": idempotencyKey, "X-Request-Id": crypto.randomUUID(), "X-CSRF-Token": csrfToken, "X-Reauth-Token-Ref": reauthTokenRef } },
  });
  return required("createExport", result);
}

export async function loadExportStatus(origin: string, exportId: string, fetchImpl: typeof fetch = fetch, options: BffRequestOptions = {}): Promise<ExportJob> {
  const result = await createBffClient({ baseUrl: origin, fetch: fetchImpl, ...options }).GET("/v1/exports/{exportId}", { params: { path: { exportId } } });
  return required("getExportStatus", result, exportId);
}

export async function cancelControlledExport(
  origin: string,
  exportId: string,
  idempotencyKey: string,
  csrfToken: string,
  reauthTokenRef: string,
  fetchImpl: typeof fetch = fetch,
  options: BffRequestOptions = {},
): Promise<ExportJob> {
  const result = await createBffClient({ baseUrl: origin, fetch: fetchImpl, ...options }).POST("/v1/exports/{exportId}/cancel", {
    params: {
      path: { exportId },
      header: { "Idempotency-Key": idempotencyKey, "X-Request-Id": crypto.randomUUID(), "X-CSRF-Token": csrfToken, "X-Reauth-Token-Ref": reauthTokenRef },
    },
  });
  return required("cancelExport", result, exportId);
}

export async function getControlledExportDownload(
  origin: string,
  exportId: string,
  fetchImpl: typeof fetch = fetch,
  options: BffRequestOptions = {},
): Promise<ExportDownloadMetadata> {
  try {checkedDownloadOrigin(origin);} catch {throw new AuditGatewayError("下载服务配置无效。", "getExportDownload");}
  const result = await createBffClient({ baseUrl: origin, fetch: fetchImpl, ...options }).GET("/v1/exports/{exportId}/download", {
    params: { path: { exportId } },
  });
  const metadata = required("getExportDownload", result, exportId);
  try {validateDownloadLease(origin, metadata, exportId, Date.now());} catch {throw new AuditGatewayError("审计服务响应无效，请稍后重试。", "getExportDownload", result.response.status);}
  return metadata;
}
