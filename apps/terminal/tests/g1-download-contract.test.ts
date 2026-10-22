import {expect, it} from "vitest";
import {bffZodSchemas} from "@sumalpha/api-client";
import {getControlledExportDownload} from "../src/audit/gateway";
import {requestBrowserDownload} from "../src/settings/platform";
const id = "11111111-1111-4111-8111-111111111111", ticket = "22222222-2222-4222-8222-222222222222";
const origin = "https://bff.test:8443", now = Date.parse("2026-10-22T12:00:00Z");
const record = {downloadId: id, objectLabel: "受控审计导出", format: "jsonl", requestedAt: new Date(now - 1000).toISOString(), status: "ready" as const, expiresAt: new Date(now + 600000).toISOString(), downloadPath: `/v1/exports/${id}/download`};
const lease = {exportId: id, downloadUrl: `${origin}/_bff/export-content/${ticket}/${"a".repeat(64)}`, expiresAt: new Date(now + 300000).toISOString(), sha256: "b".repeat(64), sizeBytes: 20, mediaType: "application/x-ndjson", watermarked: true, retentionUntil: record.expiresAt, auditRef: id};
const fetcher = (body: unknown): typeof fetch => async () => Response.json(body);
it("API and content use the configured BFF origin even with a different Terminal origin", async () => {
  expect(await requestBrowserDownload(origin, record, () => now, fetcher(lease))).toEqual({url: lease.downloadUrl, expiresAt: lease.expiresAt});
  await expect(requestBrowserDownload("https://terminal.test", record, () => now, fetcher(lease))).rejects.toThrow();
});
it("rejects ambiguous, HTTP and URL-prefix API origins before any network I/O", async () => {
  let requests = 0;const f: typeof fetch = async () => {requests++;return Response.json(lease);};
  for (const base of ["http://127.0.0.1:4010", "https://user@bff.test:8443", origin + "/base", origin + "?q=1", origin + "#x", origin + "\\", "https://BFF.test:8443", origin + "\n", "https://bff.test:443"]) await expect(requestBrowserDownload(base, record, () => now, f)).rejects.toThrow();
  expect(requests).toBe(0);
});
it("rejects content URL normalization and encoded path tricks instead of silently changing URLs", async () => {
  for (const url of [lease.downloadUrl.replace("bff.test", "BFF.test"), lease.downloadUrl.replace("/_bff", "/other/../_bff"), lease.downloadUrl.replace("/_bff", "/%5fbff"), lease.downloadUrl.replace("/_bff", "\\_bff"), lease.downloadUrl + "?", lease.downloadUrl + "#", lease.downloadUrl.replace(ticket, "-".repeat(36))]) await expect(requestBrowserDownload(origin, record, () => now, fetcher({...lease, downloadUrl: url}))).rejects.toThrow();
});
it("validates both retention metadata and absolute 300-second lease bounds", async () => {
  for (const patch of [{retentionUntil: new Date(now + 100000).toISOString()}, {retentionUntil: new Date(now + 900000).toISOString()}, {expiresAt: new Date(now + 300001).toISOString()}, {expiresAt: new Date(now).toISOString()}]) await expect(requestBrowserDownload(origin, record, () => now, fetcher({...lease, ...patch}))).rejects.toThrow();
  expect((await requestBrowserDownload(origin, record, () => now, fetcher({...lease, retentionUntil: "2026-10-22T14:10:00+02:00"}))).url).toBe(lease.downloadUrl);
});
it("generated C10 schema refuses query tickets and untrusted URL shapes before consumers", () => {
  expect(bffZodSchemas.ExportDownloadMetadata.safeParse(lease).success).toBe(true);
  for (const downloadUrl of ["https://downloads.invalid/export?ticket=secret", lease.downloadUrl + "?x=1", lease.downloadUrl.replace("https://", "http://"), lease.downloadUrl.replace("bff.test", "user:password@bff.test"), lease.downloadUrl.replace(ticket, "-".repeat(36))]) expect(bffZodSchemas.ExportDownloadMetadata.safeParse({...lease, downloadUrl}).success).toBe(false);
});

it("C10 audit consumer shares C17 origin refusal and rejects invalid API configuration before I/O", async () => {
  const fresh = {...lease, expiresAt: new Date(Date.now()+30000).toISOString(), retentionUntil: new Date(Date.now()+60000).toISOString()};
  expect((await getControlledExportDownload(origin, id, fetcher(fresh))).downloadUrl).toBe(fresh.downloadUrl);
  await expect(getControlledExportDownload("https://terminal.test", id, fetcher(fresh))).rejects.toThrow();
  let count = 0;const f: typeof fetch = async () => {count++;return Response.json(fresh);};
  for (const base of ["http://bff.test", origin+"/path", origin+"?x=1"]) await expect(getControlledExportDownload(base, id, f)).rejects.toThrow();
  expect(count).toBe(0);
});
