// Explicit offline integration entry point: cargo build -p bff-gateway --bin bff-gateway first.
// A loopback TLS proxy transports original bytes. No URL rewriting or route.fulfill.
import {beforeAll, afterAll, expect, it} from "vitest";
import {spawn, execFileSync, type ChildProcess} from "node:child_process";
import {createServer as tcpServer} from "node:net";
import {createServer as tlsServer, request as tlsRequest, type Server} from "node:https";
import {request as httpRequest} from "node:http";
import {mkdtemp, readFile, writeFile, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import {createHash} from "node:crypto";
import {chromium} from "@playwright/test";
import {listBrowserDownloads, requestBrowserDownload} from "../../apps/terminal/src/settings/platform";
import {createSettingsRuntime} from "../../apps/terminal/src/settings/runtime";
const hash = (b: Uint8Array | string) => "sha256:" + createHash("sha256").update(b).digest("hex");
const rows: Array<{method: string; path: string; status: number; bytes: number; responseSha256: string}> = [];
const outcomes: Array<Record<string, unknown>> = [];
const csrf = "csrf-token-0000000000000001", correlation = "aaaaaaaa-1111-4111-8111-111111111111";
let scratch: string, origin: string, child: ChildProcess, proxy: Server, binarySha256: string, sourceCommit: string;
let exportId: string, grant: string;
const normalized = (path: string) => path.startsWith("/_bff/export-content/") ? "/_bff/export-content/{ticket}/{signature}" : path.replace(/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}/g, "{id}");
async function call(path: string, method = "GET", body?: unknown, identity = "session-current", extra: Record<string, string> = {}, signal?: AbortSignal): Promise<Response> {
  const raw = body === undefined ? undefined : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    // The TLS exception is scoped to this generated loopback test certificate.
    const req = tlsRequest(origin + path, {method, rejectUnauthorized: false, signal, headers: {cookie: `quantos_session=${identity}; quantos_csrf=${csrf}`, origin: "http://localhost:3190", "content-type": "application/json", "x-csrf-token": csrf, "x-request-id": crypto.randomUUID(), ...extra}}, response => {
      const parts: Buffer[] = [];response.on("data", part => parts.push(Buffer.from(part)));response.on("error", reject);
      response.on("end", () => {const bytes = Buffer.concat(parts), status = response.statusCode!;const headers = new Headers();for (const [key, value] of Object.entries(response.headers)) if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(",") : value);
        rows.push({method, path: normalized(path), status, bytes: bytes.length, responseSha256: hash(bytes)});
        resolve(new Response([204, 304].includes(status) ? null : bytes, {status, headers}));});
    });req.on("error", reject);if (raw) req.write(raw);req.end();
  });
}
const consumerFetch = (identity = "session-current"): typeof fetch => async input => {
  const req = input as Request;const url = new URL(req.url);expect(url.origin).toBe(origin);expect(req.credentials).toBe("include");expect(req.method).toBe("GET");
  return call(url.pathname + url.search, "GET", undefined, identity, {}, req.signal);
};
async function readyRecord() {const page = await listBrowserDownloads(origin, {}, consumerFetch());return page.items.find(r => r.downloadId === exportId)!;}
beforeAll(async () => {
  expect(process.env.DATABASE_URL).toBeUndefined();expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
  sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {encoding: "utf8"}).trim();
  if (process.env.G1_DL_EXPECT_SOURCE) expect(sourceCommit).toBe(process.env.G1_DL_EXPECT_SOURCE);
  const binary = resolve("target/debug/bff-gateway");binarySha256 = hash(await readFile(binary));
  scratch = await mkdtemp(join(tmpdir(), "quantos-g1-download-"));
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", join(scratch, "key.pem"), "-out", join(scratch, "cert.pem"), "-days", "1", "-subj", "/CN=127.0.0.1", "-addext", "subjectAltName=IP:127.0.0.1"], {stdio: "ignore"});
  const reserved = tcpServer();await new Promise<void>(r => reserved.listen(0, "127.0.0.1", r));const port = (reserved.address() as {port: number}).port;await new Promise<void>(r => reserved.close(() => r()));
  proxy = tlsServer({key: await readFile(join(scratch, "key.pem")), cert: await readFile(join(scratch, "cert.pem"))}, (req, res) => {
    if (req.url === "/probe") {res.writeHead(200, {"content-type": "text/html", "cache-control": "no-store"});res.end('<!doctype html><title>Local reference attachment probe</title><a id="download">Download</a>');return;}
    const upstream = httpRequest({host: "127.0.0.1", port, path: req.url, method: req.method, headers: req.headers}, response => {res.writeHead(response.statusCode!, response.headers);response.pipe(res);});
    upstream.on("error", () => {res.writeHead(502);res.end();});req.pipe(upstream);
  });await new Promise<void>(r => proxy.listen(0, "127.0.0.1", r));origin = `https://127.0.0.1:${(proxy.address() as {port: number}).port}`;
  child = spawn(binary, [], {env: {PATH: process.env.PATH, HOME: process.env.HOME, QUANTOS_SKIP_ENV: "1", QUANTOS_BFF_MODE: "reference", QUANTOS_BFF_BIND: `127.0.0.1:${port}`, QUANTOS_BFF_PUBLIC_ORIGIN: origin}, stdio: ["ignore", "pipe", "pipe"]});
  await new Promise<void>((resolve, reject) => {const timer = setTimeout(() => reject(Error("reference startup timeout")), 15000);child.once("error", e => {clearTimeout(timer);reject(e);});child.stdout!.on("data", b => {if (String(b).includes('"ready":true')) {clearTimeout(timer);resolve();}});});
  const challenge = await (await call("/v1/auth/mfa/challenges", "POST", {purpose: "security_change", code: "123456"})).json();
  const reauth = await (await call("/v1/auth/reauth", "POST", {challengeRef: challenge.challengeRef})).json();grant = reauth.reauthTokenRef;
  const r = await call("/v1/exports", "POST", {scope: {correlationIds: [correlation]}, format: "jsonl", reason: "Bounded download integration", watermark: "Controlled reference copy", retentionDays: 7}, "session-current", {"x-reauth-token-ref": grant, "idempotency-key": crypto.randomUUID()});expect(r.status).toBe(202);exportId = (await r.json()).exportId;
}, 30000);
afterAll(async () => {
  if (child?.exitCode === null) {child.kill();await new Promise(r => child.once("close", r));}
  if (proxy) {proxy.closeAllConnections();await new Promise<void>(r => proxy.close(() => r()));}
  if (process.env.G1_DL_ATTEMPT) await writeFile(join(process.env.G1_DL_ATTEMPT, "reference-delivery.json"), JSON.stringify({schema: "quantos-g1-reference-delivery/v1", sourceCommit, binarySha256, topology: "LOOPBACK_HTTPS_PROXY_ORIGINAL_BYTES_NO_URL_REWRITE", tls: "EPHEMERAL_TEST_CERTIFICATE_ONLY", realIdp: "NOT_RUN", targetDatabaseStorage: "NOT_RUN", realCookieCors: "NOT_RUN", fullP17BusinessJourney: "NOT_RUN", firefox: "BLOCKED_ENVIRONMENT", webKitAttachment: "BLOCKED_ENVIRONMENT_TEST_INTERCEPTION", sensitiveResponses: "HASH_ONLY", outcomes, rows}, null, 2) + "\n");
  if (scratch) await rm(scratch, {recursive: true, force: true});
}, 10000);
it("configured BFF origin ignores untrusted Host and Forwarded headers", async () => {
  const response = await call(`/v1/exports/${exportId}/download`, "GET", undefined, "session-current", {host: "untrusted.invalid", forwarded: "host=untrusted.invalid;proto=http", "x-forwarded-host": "untrusted.invalid"});
  expect(response.status).toBe(200);const metadata = await response.json();expect(new URL(metadata.downloadUrl).origin).toBe(origin);
  outcomes.push({id: "closed-issuer-origin", status: "PASS"});
});
it("actual generated C17 consumer and runtime obtain a valid reference lease and real bytes", async () => {
  const actions = createSettingsRuntime({mock: false, origin, section: "browser", fetchImpl: consumerFetch(), runtime: () => ({online: true, width: 1440, csrf: ""})});
  const snapshot = await actions.load();const record = snapshot.bundle.downloads!.find(r => r.downloadId === exportId)!;expect(record.downloadUrl).toBeUndefined();
  const lease = await actions.download(record);expect(new URL(lease.url).origin).toBe(origin);
  const response = await call(new URL(lease.url).pathname);expect(response.status).toBe(200);expect(response.headers.get("content-disposition")).toContain("attachment");expect(response.headers.get("cache-control")).toBe("no-store");expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  const bytes = await response.text();expect(bytes).toContain("QuantOS restricted copy");expect(bytes).toContain('"redactionPolicy":"audit-v1"');actions.close();
  outcomes.push({id: "generated-runtime-delivery", status: "PASS", contentSha256: hash(bytes), bytes: Buffer.byteLength(bytes)});
});
it("a consumed ticket cannot replay and explicit fresh lease succeeds with the attested bytes", async () => {
  const record = await readyRecord();const lease = await requestBrowserDownload(origin, record, Date.now, consumerFetch());const path = new URL(lease.url).pathname;
  const [a, b] = await Promise.all([call(path), call(path)]);expect([a.status, b.status].sort()).toEqual([200, 410]);const success = a.status === 200 ? a : b;const bytes = await success.arrayBuffer();
  const fresh = await requestBrowserDownload(origin, record, Date.now, consumerFetch());expect(fresh.url === lease.url).toBe(false);const r = await call(new URL(fresh.url).pathname);expect(r.status).toBe(200);expect(hash(new Uint8Array(await r.arrayBuffer()))).toBe(hash(new Uint8Array(bytes)));
  outcomes.push({id: "concurrent-one-shot-and-explicit-retry", status: "PASS"});
});
it("actual capability, invalid session, tampering and cancelled-resource refusals retain authorization", async () => {
  const record = await readyRecord();const lease = await requestBrowserDownload(origin, record, Date.now, consumerFetch());const path = new URL(lease.url).pathname;
  expect((await call(path, "GET", undefined, "session-viewer")).status).toBe(403);expect((await call(path, "GET", undefined, "invalid-session")).status).toBe(401);
  const tampered = path.slice(0, -1) + (path.endsWith("a") ? "b" : "a");expect((await call(tampered)).status).toBe(410);
  // Do not cancel the shared export until the final case; these refusals must not consume it.
  expect((await call(path)).status).toBe(200);outcomes.push({id: "scope-session-signature-refusals", status: "PASS"});
});
it("Chromium receives actual reference attachment bytes through HTTPS without response interception", async () => {
  const record = await readyRecord();const lease = await requestBrowserDownload(origin, record, Date.now, consumerFetch());
  const browser = await chromium.launch({headless: true});try {
    const context = await browser.newContext({ignoreHTTPSErrors: true, acceptDownloads: true});await context.addCookies([{name: "quantos_session", value: "session-current", url: origin, httpOnly: true, secure: true, sameSite: "Lax"}]);
    const page = await context.newPage();await page.goto(origin + "/probe");await page.locator("#download").evaluate((node, url) => {node.setAttribute("href", url);}, lease.url);
    const received = page.waitForEvent("download", {timeout: 15000});await page.locator("#download").click();const download = await received;expect(await download.failure()).toBeNull();const local = await download.path();expect(local).toBeTruthy();const bytes = await readFile(local!);
    expect(bytes.toString()).toContain("QuantOS restricted copy");expect(hash(bytes)).toBe(outcomes.find(o => o.id === "generated-runtime-delivery")!.contentSha256);expect(download.suggestedFilename()).toBe("quantos-audit-export");
    expect((await call(new URL(lease.url).pathname)).status).toBe(410);outcomes.push({id: "chromium-real-attachment", status: "PASS", contentSha256: hash(bytes), bytes: bytes.length, scope: "CONTENT_TRANSPORT_ONLY_NOT_FULL_P17_UI", responseInterception: false});await context.close();
  } finally {await browser.close();}
}, 30000);
it("metadata attests bytes and the history/audit never retain ticket URLs; cancellation refuses old leases", async () => {
  const r = await call(`/v1/exports/${exportId}/download`);expect(r.status).toBe(200);const l = await r.json();const content = await call(new URL(l.downloadUrl).pathname);const bytes = new Uint8Array(await content.arrayBuffer());expect(hash(bytes)).toBe("sha256:" + l.sha256);expect(bytes.length).toBe(l.sizeBytes);
  const outstanding = await requestBrowserDownload(origin, await readyRecord(), Date.now, consumerFetch());
  const cancel = await call(`/v1/exports/${exportId}/cancel`, "POST", undefined, "session-current", {"x-reauth-token-ref": grant, "idempotency-key": crypto.randomUUID()});expect(cancel.status).toBe(202);expect((await call(new URL(outstanding.url).pathname)).status).toBe(410);
  const audit = await (await call("/v1/audit/events")).text();expect(audit).toContain("export.download_consumed");expect(audit).toContain("export.consume_denied");expect(audit).not.toContain("/_bff/export-content/");expect(audit).not.toContain(l.downloadUrl);
  const history = await listBrowserDownloads(origin, {}, consumerFetch());expect(history.items.every(i => !i.downloadUrl)).toBe(true);outcomes.push({id: "metadata-audit-cancellation", status: "PASS", contentSha256: hash(bytes), bytes: bytes.length});
});
