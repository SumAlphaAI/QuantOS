import { beforeAll, afterAll, expect, it } from "vitest";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { createSettingsRuntime } from "../../../../apps/terminal/src/settings/runtime";
import { requestBrowserDownload } from "../../../../apps/terminal/src/settings/platform";
import { type DownloadRecord } from "../../../../apps/terminal/src/settings/c17";
const output = resolve(process.env.G1_GAP_ATTEMPT!, "reference-probes.json");
const bff = "https://bff.g1.test", terminal = "https://terminal.g1.test", csrf = "csrf-token-0000000000000001";
const id = "11111111-1111-4111-8111-111111111111", ticket = "22222222-2222-4222-8222-222222222222";
let child: ChildProcess, origin: string;
const rows: Array<{method: string; path: string; status: number; responseSha256: string}> = [];
const outcomes: Array<Record<string, unknown>> = [];
const hash = (raw: string | Buffer) => "sha256:" + createHash("sha256").update(raw).digest("hex");
async function call(path: string, method = "GET", body?: unknown, extra: Record<string, string> = {}, identity = "session-current", signal?: AbortSignal) {
  const response = await fetch(origin + path, {method, signal, headers: {cookie: `quantos_session=${identity}; quantos_csrf=${csrf}`, origin: "http://localhost:3190", "content-type": "application/json", "x-csrf-token": csrf, "x-request-id": crypto.randomUUID(), ...extra}, body: body === undefined ? undefined : JSON.stringify(body)});
  const raw = await response.text(); rows.push({method, path: path.replace(/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/g, "{id}"), status: response.status, responseSha256: hash(raw)});
  return new Response(raw, {status: response.status, headers: response.headers});
}
const bridge = (identity = "session-current"): typeof fetch => async input => { const request = input as Request; const url = new URL(request.url); expect(url.origin).toBe(bff); expect(request.method).toBe("GET"); return call(url.pathname + url.search, "GET", undefined, {}, identity, request.signal); };
beforeAll(async () => {
  expect(process.env.DATABASE_URL).toBeUndefined(); expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
  const saved = JSON.parse(await readFile("docs/audit/evidence/ui-p17-local-20261022/function-attempt-01/bff-executable.json", "utf8"));
  const binary = await readFile(saved.path); expect(hash(binary)).toBe(saved.sha256);
  expect(execFileSync("git", ["diff", "--name-only", saved.sourceCommit, "HEAD", "--", "Cargo.toml", "Cargo.lock", "crates/", "services/bff-gateway/", "proto/"], {encoding: "utf8"})).toBe("");
  const server = createServer(); await new Promise<void>(r => server.listen(0, "127.0.0.1", r)); const port = (server.address() as {port: number}).port; await new Promise<void>(r => server.close(() => r())); origin = `http://127.0.0.1:${port}`;
  child = spawn(resolve(saved.path), [], {env: {PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "test", QUANTOS_SKIP_ENV: "1", QUANTOS_BFF_MODE: "reference", QUANTOS_BFF_BIND: `127.0.0.1:${port}`}, stdio: ["ignore", "pipe", "pipe"]});
  await new Promise<void>((resolve, reject) => { const timer = setTimeout(() => reject(Error("reference startup timeout")), 15000); child.once("error", e => {clearTimeout(timer); reject(e);}); child.stdout?.on("data", raw => {if (String(raw).includes('"ready":true')) {clearTimeout(timer); resolve();}}); });
  const challenge = await (await call("/v1/auth/mfa/challenges", "POST", {purpose: "security_change", code: "123456"})).json();
  const grant = await (await call("/v1/auth/reauth", "POST", {challengeRef: challenge.challengeRef})).json();
  const created = await call("/v1/exports", "POST", {scope: {correlationIds: ["aaaaaaaa-1111-4111-8111-111111111111"]}, format: "jsonl", reason: "G1 bounded offline gap probe", watermark: "G1 reference fixture", retentionDays: 7}, {"x-reauth-token-ref": grant.reauthTokenRef, "idempotency-key": crypto.randomUUID()}); expect(created.status).toBe(202);
}, 20000);
afterAll(async () => {
  if (child?.exitCode === null) {child.kill(); await new Promise(r => child.once("close", r));}
  await writeFile(output, JSON.stringify({schema: "quantos-g1-reference-gap-probes/v1", mode: "LOOPBACK_REFERENCE_IN_MEMORY", responseForwarding: "BYTE_FOR_BYTE_NO_URL_REWRITE", sensitiveResponses: "HASH_ONLY", targetDatabase: "NOT_RUN", realIdp: "NOT_RUN", browserCookieCors: "NOT_RUN_NODE_IDENTITY_BRIDGE", endToEndAttachment: "NOT_RUN", outcomes, rows}, null, 2) + "\n");
});
it("actual C01/C17 reads are guarded and the real reference lease is refused without consuming content", async () => {
  const actions = createSettingsRuntime({mock: false, origin: bff, section: "browser", fetchImpl: bridge(), runtime: () => ({online: true, width: 1440, csrf: ""})}); const start = rows.length;
  const snapshot = await actions.load(); expect(rows.slice(start, start + 2).map(r => r.path)).toEqual(["/v1/session", "/v1/context"]);
  const record = snapshot.bundle.downloads!.find(row => row.status === "ready")!; expect(record).toBeDefined(); expect(record.downloadUrl).toBeUndefined();
  await expect(actions.download(record)).rejects.toThrow("Invalid short-lived download lease");
  expect(rows.slice(start).filter(r => r.path.endsWith("/download"))).toHaveLength(1); expect(rows.some(r => r.path.startsWith("/_bff/export-content/"))).toBe(false);
  actions.close(); outcomes.push({id: "reference-lease", assertion: "PASS", delivery: "GAP_REFERENCE_URL_REJECTED", contentConsumption: "NOT_RUN"});
});
it("actual viewer history is 403 with no snapshot publication", async () => {
  const actions = createSettingsRuntime({mock: false, origin: bff, section: "browser", fetchImpl: bridge("session-viewer"), runtime: () => ({online: true, width: 1440, csrf: ""})}); const start = rows.length;
  await expect(actions.load()).rejects.toMatchObject({status: 403}); expect(rows.slice(start).some(r => r.path === "/v1/settings/downloads" && r.status === 403)).toBe(true); actions.close(); outcomes.push({id: "viewer-history", assertion: "PASS", outcome: "REFUSED_403"});
});
it("actual invalid session stops before every private C17 read", async () => {
  const actions = createSettingsRuntime({mock: false, origin: bff, section: "browser", fetchImpl: bridge("invalid-session"), runtime: () => ({online: true, width: 1440, csrf: ""})}); const start = rows.length;
  await expect(actions.load()).rejects.toMatchObject({status: 401}); expect(rows.slice(start).map(r => r.path)).toEqual(["/v1/session"]); actions.close(); outcomes.push({id: "invalid-session", assertion: "PASS", outcome: "REFUSED_401_BEFORE_PRIVATE_READ"});
});
for (const split of [false, true]) it(`live-style URL template with split origin=${split} verifies the consumer boundary only`, async () => {
  const now = Date.now(), contentOrigin = split ? terminal : bff;
  const record: DownloadRecord = {downloadId: id, objectLabel: "synthetic topology probe", format: "csv", requestedAt: new Date(now - 1000).toISOString(), status: "ready", expiresAt: new Date(now + 60000).toISOString(), downloadPath: `/v1/exports/${id}/download`};
  const lease = {exportId: id, downloadUrl: `${contentOrigin}/_bff/export-content/${ticket}/${"a".repeat(64)}`, expiresAt: new Date(now + 30000).toISOString(), sha256: "b".repeat(64), sizeBytes: 4, mediaType: "text/csv", watermarked: true, retentionUntil: record.expiresAt, auditRef: id};
  const fetchImpl: typeof fetch = async () => Response.json(lease);
  if (split) await expect(requestBrowserDownload(bff, record, () => now, fetchImpl)).rejects.toThrow("Invalid short-lived download lease");
  else expect((await requestBrowserDownload(bff, record, () => now, fetchImpl)).url).toBe(lease.downloadUrl);
  outcomes.push({id: split ? "split-origin-template" : "same-origin-template", assertion: "PASS", scope: "SYNTHETIC_CONSUMER_ONLY_NOT_LIVE_SIGNER", outcome: split ? "REFUSED_ORIGIN_MISMATCH" : "ACCEPTED_URL_ONLY_NOT_DELIVERY"});
});
