import type {BffComponents} from "@sumalpha/api-client";
type Lease = BffComponents["schemas"]["ExportDownloadMetadata"];
// C10 and C17 share one closed origin policy. Never normalize an untrusted lease
// into a different URL; signatures/paths must reach the issuer unchanged.
export function checkedDownloadOrigin(origin: string): URL {
  const base = new URL(origin);
  if (base.protocol !== "https:" || base.username || base.password || base.pathname !== "/" || base.search || base.hash || ![base.origin, base.origin + "/"].includes(origin)) throw new Error("Invalid download API origin");
  return base;
}
export function validateDownloadLease(origin: string, lease: Lease, exportId: string, now: number, historyRetention?: string): URL {
  const base = checkedDownloadOrigin(origin), url = new URL(lease.downloadUrl), expiry = Date.parse(lease.expiresAt), retention = Date.parse(lease.retentionUntil);
  if (!Number.isFinite(now) || !Number.isFinite(retention) || retention <= now || expiry > retention || (historyRetention !== undefined && retention !== Date.parse(historyRetention)) || lease.exportId !== exportId || url.href !== lease.downloadUrl || url.protocol !== "https:" || url.origin !== base.origin || url.username || url.password || url.search || url.hash || !/^\/_bff\/export-content\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{64}$/.test(url.pathname) || !Number.isFinite(expiry) || expiry <= now || expiry > now + 300_000) throw new Error("Invalid short-lived download lease");
  return url;
}
