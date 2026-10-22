import { createBffClient, parseBffResponse, bffZodSchemas, type BffRequestOptions } from "@sumalpha/api-client";
import { handleAuthHttpStatus } from "../auth/flow";
import type { BrowserCapabilityPolicy, BrowserRuntimeCapabilities, DownloadRecord } from "./c17";

// A local native permission only narrows the server policy; it grants no domain authority.
export function resolveBrowserPlatform(policy: BrowserCapabilityPolicy, runtime: BrowserRuntimeCapabilities, online: boolean) {
  return {
    notifications: online && policy.notifications === "browser" && runtime.notifications === "granted" ? "browser" : "in_app_only",
    clipboard: online && runtime.clipboard ? "user_gesture" : "manual",
    downloads: online && policy.downloadsViaBff && runtime.downloads,
    domainActions: online && !policy.offlineDomainActions,
    localFileImport: false,
  } as const;
}
function checked<T>(operation: "getPlatformCapabilities" | "listDownloads" | "getExportDownload", result: {data?: T; error?: unknown; response: Response}): T {
  if (result.response.status === 401) handleAuthHttpStatus(401);
  if (result.data === undefined) throw Object.assign(new Error(`Browser platform request refused (${result.response.status})`), {status: result.response.status});
  return parseBffResponse(operation, result.response.status, result.data) as T;
}
export async function loadBrowserPlatform(origin: string, fetchImpl: typeof fetch = fetch, options: BffRequestOptions = {}) {
  const client = createBffClient({baseUrl: origin, fetch: fetchImpl, ...options});
  const policy = bffZodSchemas.BrowserCapabilityPolicy.strict().parse(checked("getPlatformCapabilities", await client.GET("/v1/platform/browser-capabilities")));
  if (policy.permissionState && Object.keys(policy.permissionState).some(key => !["notifications", "clipboard", "authority", "requestedByServer"].includes(key))) throw new Error("Unexpected permission metadata");
  return policy;
}
export async function listBrowserDownloads(origin: string, query: {cursor?: string; pageSize?: number; sort?: string; filter?: string} = {}, fetchImpl: typeof fetch = fetch, options: BffRequestOptions = {}) {
  const client = createBffClient({baseUrl: origin, fetch: fetchImpl, ...options});
  const page = checked("listDownloads", await client.GET("/v1/settings/downloads", {params: {query}}));
  return {nextCursor: page.nextCursor, items: page.items.map(item => { const record = bffZodSchemas.DownloadRecord.strict().parse(item); if (record.downloadUrl) throw new Error("History must not retain download leases"); return record; })};
}
// Called only by an explicit download gesture. Never persist/log the returned lease.
export async function requestBrowserDownload(origin: string, raw: DownloadRecord, nowMs: () => number = Date.now, fetchImpl: typeof fetch = fetch, options: BffRequestOptions = {}) {
  const record = bffZodSchemas.DownloadRecord.strict().parse(raw);
  const id = bffZodSchemas.UUID.parse(record.downloadId);
  if (record.downloadUrl || !Number.isFinite(nowMs()) || record.status !== "ready" || !record.expiresAt || !Number.isFinite(Date.parse(record.expiresAt)) || Date.parse(record.expiresAt) <= nowMs() || record.downloadPath !== `/v1/exports/${id}/download`) throw new Error("Download unavailable; reload history");
  const client = createBffClient({baseUrl: origin, fetch: fetchImpl, ...options});
  const lease = checked("getExportDownload", await client.GET("/v1/exports/{exportId}/download", {params: {path: {exportId: id}}}));
  const url = new URL(lease.downloadUrl), base = new URL(origin), now = nowMs(), expiry = Date.parse(lease.expiresAt);
  if (!Number.isFinite(now) || Date.parse(record.expiresAt) <= now || expiry > Date.parse(record.expiresAt) || lease.exportId !== id || url.protocol !== "https:" || url.origin !== base.origin || url.username || url.password || url.search || url.hash || !/^\/_bff\/export-content\/[0-9a-f-]{36}\/[0-9a-f]{64}$/.test(url.pathname) || !Number.isFinite(expiry) || expiry <= now || expiry > now + 300_000) throw new Error("Invalid short-lived download lease");
  return {url: url.href, expiresAt: lease.expiresAt};
}
