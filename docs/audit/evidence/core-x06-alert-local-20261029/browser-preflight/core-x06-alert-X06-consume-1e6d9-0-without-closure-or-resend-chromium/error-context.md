# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: core-x06-alert.spec.ts >> X06 consumes current X05 OPEN evidence into public P23 and common C10 without closure or resend
- Location: tests/e2e/core-x06-alert.spec.ts:7:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('[data-route-access="authorized"]')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('[data-route-access="authorized"]')

```

```yaml
- main:
  - heading "Alerts 访问不可用" [level=1]
  - paragraph: 访问条件变化，告警与恢复意图已清除：unavailable
  - button "重新核对访问权限"
  - link "返回收件箱":
    - /url: /alerts
- alert
```

# Test source

```ts
  51  |     slow?: boolean;
  52  |     streamForbidden?: boolean;
  53  |     stateRows?: boolean;
  54  |     largeDecimal?: boolean;
  55  |     dropPath?: string;
  56  |     nonJsonPath?: string;
  57  |     refusal?: 401 | 403;
  58  | } = {};
  59  | const streams = new Set<ServerResponse>();
  60  | let probes: string[] = [];
  61  | export function probe(label: string) { probes.push(label); }
  62  | export const networkRows = () => rows;
  63  | export function fault(next: typeof flags) { flags = next; }
  64  | const proxy = createServer({}, async (req, res) => {
  65  |     const u = new URL(req.url!, origin), path = u.pathname, method = req.method!;
  66  |     for (const [k, v] of Object.entries({ 'access-control-allow-origin': terminal, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': 'content-type,x-csrf-token,x-request-id,idempotency-key,if-match', 'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS', 'cache-control': 'no-store', 'access-control-expose-headers': 'x-stream-id' }))
  67  |         res.setHeader(k, v);
  68  |     if (method === 'OPTIONS') {
  69  |         res.writeHead(204);
  70  |         res.end();
  71  |         return;
  72  |     }
  73  |     const chunks: Buffer[] = [];
  74  |     for await (const b of req)
  75  |         chunks.push(Buffer.from(b));
  76  |     const body = Buffer.concat(chunks);
  77  |     const row: Row = { query: Object.fromEntries([...u.searchParams].map(([k, v]) => [k, k === 'ticket' ? 'sha256:' + hash(v) : v])), method, path, status: 0, source: 'REFERENCE_BYTES', control: Boolean(req.headers['x-frontend-g8-control']), bodyHash: hash(body), version: req.headers['if-match'] as string | undefined, keyHash: req.headers['idempotency-key'] ? hash(String(req.headers['idempotency-key'])) : undefined };
  78  |     rows.push(row);
  79  |     if (!row.control && ['POST', 'PUT', 'DELETE'].includes(method) && path.startsWith('/v1/admin/') && (flags.rateLimit || flags.conflict)) {
  80  |         row.source = 'SYNTHETIC_HTTP_REFUSAL';
  81  |         row.status = flags.rateLimit ? 429 : 409;
  82  |         const bytes = Buffer.from(JSON.stringify({ code: flags.rateLimit ? 'RATE_LIMITED' : 'VERSION_CONFLICT', message: 'private SQL secret', correlationId: 'aaaaaaaa-1111-4111-8111-111111111111', ...flags.rateLimit ? { retryAfter: 1 } : {} }));
  83  |         row.responseHash = hash(bytes);
  84  |         res.writeHead(row.status, { 'content-type': 'application/json', 'content-length': bytes.length });
  85  |         res.end(bytes);
  86  |         return;
  87  |     }
  88  |     if (!row.control && flags.nonJsonPath && path === flags.nonJsonPath) {
  89  |         row.source = 'SYNTHETIC_NON_JSON_AUTHORITY_REFUSAL';
  90  |         row.status = flags.refusal ?? 403;
  91  |         res.writeHead(row.status, { 'content-type': 'text/html' });
  92  |         res.end('<html>private gateway rejection</html>');
  93  |         return;
  94  |     }
  95  |     const upstream = request({ host: '127.0.0.1', port, path: req.url, method, headers: { ...req.headers, cookie: `quantos_session=${row.control ? String(req.headers['x-frontend-g8-session']) : flags.readonly ? 'session-approver' : activeSession}; quantos_csrf=${csrf}`, origin: terminal } }, response => {
  96  |         row.status = response.statusCode!;
  97  |         if (path === '/v1/settings/sessions/stream') {
  98  |             res.writeHead(row.status, { 'content-type': 'text/event-stream' });
  99  |             res.flushHeaders();
  100 |             streams.add(res);
  101 |             response.pipe(res);
  102 |             res.on('close', () => { streams.delete(res); response.destroy(); });
  103 |             return;
  104 |         }
  105 |         const output: Buffer[] = [];
  106 |         response.on('data', b => output.push(Buffer.from(b)));
  107 |         response.on('end', () => {
  108 |             let bytes = Buffer.concat(output);
  109 |             if (row.status === 200 && !row.control && flags.foreign && path === '/v1/alerts') {
  110 |                 const v = JSON.parse(bytes.toString());
  111 |                 v.items[0].accountId = 'aaaaaaaa-1111-4111-8111-111111111111';
  112 |                 bytes = Buffer.from(JSON.stringify(v));
  113 |                 row.source = 'SYNTHETIC_FOREIGN_ACCOUNT';
  114 |             }
  115 |             row.responseHash = hash(bytes);
  116 |             if (!row.control && method !== 'GET' && !path.startsWith('/v1/auth/') && [200, 201, 202].includes(row.status)) {
  117 |                 const v = JSON.parse(bytes.toString());
  118 |                 receipts.push(v);
  119 |             }
  120 |             if ((flags.dropPath === path || flags.drop && path.startsWith('/v1/admin/')) && ['POST', 'PUT', 'DELETE'].includes(method) && [200, 201, 202].includes(row.status)) {
  121 |                 flags.drop = false;
  122 |                 delete flags.dropPath;
  123 |                 row.source = 'REFERENCE_COMMITTED_RESPONSE_DROPPED';
  124 |                 res.writeHead(row.status, { 'content-type': 'application/json', 'content-length': bytes.length + 1 });
  125 |                 res.write(bytes.subarray(0, 5));
  126 |                 setTimeout(() => res.destroy(), 20);
  127 |                 return;
  128 |             }
  129 |             res.writeHead(row.status, { 'content-type': path.endsWith('/stream') ? 'text/event-stream' : 'application/json', 'content-length': bytes.length, ...(response.headers['x-stream-id'] ? { 'x-stream-id': response.headers['x-stream-id'] } : {}) });
  130 |             res.end(bytes);
  131 |         });
  132 |     });
  133 |     upstream.on('error', () => {
  134 |         if (!res.headersSent)
  135 |             res.writeHead(502);
  136 |         res.end();
  137 |     });
  138 |     res.on('close', () => upstream.destroy());
  139 |     upstream.end(body);
  140 | });
  141 | export async function control(path: string, body?: unknown, version?: string, options: {
  142 |     method?: "GET" | "PUT" | "POST" | "DELETE";
  143 |     session?: "session-current" | "session-viewer" | "session-owner" | "session-approver";
  144 | } = {}): Promise<{
  145 |     status: number;
  146 |     body: Record<string, unknown>;
  147 | }> {
  148 |     const method = options.method ?? (body ? "PUT" : "GET"), write = method !== "GET";
  149 |     return new Promise((resolve, reject) => { const req = secureRequest(origin + path, { rejectUnauthorized: false, method, headers: { "x-frontend-g8-control": "1", "x-frontend-g8-session": options.session ?? "session-owner", ...(write ? { "content-type": "application/json", ...(version ? { "if-match": version } : {}), "idempotency-key": crypto.randomUUID(), "x-request-id": crypto.randomUUID(), "x-csrf-token": csrf } : {}) } }, res => { const parts: Buffer[] = []; res.on("data", b => parts.push(Buffer.from(b))); res.on("end", () => resolve({ status: res.statusCode!, body: Buffer.concat(parts).length ? JSON.parse(Buffer.concat(parts).toString()) : {} })); }); req.on("error", reject); req.end(body ? JSON.stringify(body) : undefined); });
  150 | }
> 151 | export async function authorized(page: Page) { await expect(page.locator('[data-route-access="authorized"]')).toBeVisible(); }
      |                                                                                                               ^ Error: expect(locator).toBeVisible() failed
  152 | export function installReferenceHooks(mode: "paper" | "shadow" | "assisted-local" | "assisted-mtls-local" = "paper", assistedEnabled = true) {
  153 |     test.beforeAll(async () => {
  154 |         expect(process.env.DATABASE_URL).toBeUndefined();
  155 |         expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
  156 |         scratch = await mkdtemp(join(tmpdir(), "quantos-frontend-g8-"));
  157 |         execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", join(scratch, "key.pem"), "-out", join(scratch, "cert.pem"), "-days", "1", "-subj", "/CN=127.0.0.1", "-addext", "subjectAltName=IP:127.0.0.1"], { stdio: "ignore" });
  158 |         proxy.setSecureContext({ key: await readFile(join(scratch, "key.pem")), cert: await readFile(join(scratch, "cert.pem")) });
  159 |         await new Promise<void>(r => proxy.listen(4010, "127.0.0.1", r));
  160 |     });
  161 |     test.beforeEach(async ({ context, page }) => {
  162 |         page.on("dialog", dialog => dialog.type() === "beforeunload" ? dialog.accept() : dialog.dismiss());
  163 |         await page.emulateMedia({ colorScheme: "dark" });
  164 |         rows = [];
  165 |         receipts.length = 0;
  166 |         activeSession = 'session-current';
  167 |         probes = [];
  168 |         fault({});
  169 |         await context.addCookies([{ name: "quantos_csrf", value: csrf, url: terminal }]);
  170 |         await context.route("**/*", route => ["localhost", "127.0.0.1"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
  171 |         const reserve = reserveServer();
  172 |         await new Promise<void>(r => reserve.listen(0, "127.0.0.1", r));
  173 |         port = (reserve.address() as {
  174 |             port: number;
  175 |         }).port;
  176 |         await new Promise<void>(r => reserve.close(() => r()));
  177 |         zone=mode==="assisted-mtls-local"?await ownedZone():undefined;
  178 |         child = spawn(resolve("target/debug/bff-gateway"), [], { env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, ...(zone?{QUANTOS_BFF_OWNED_MTLS_DIRECTORY:zone.directory}:{}), GITHUB_SHA: process.env.GITHUB_SHA, QUANTOS_SKIP_ENV: "1", QUANTOS_BFF_MODE: "reference", QUANTOS_BFF_REFERENCE_CONTEXT: mode, QUANTOS_BFF_OWNED_ASSISTED: (mode === "assisted-local" || mode === "assisted-mtls-local") && assistedEnabled ? "enabled" : "off", QUANTOS_BFF_BIND: `127.0.0.1:${port}`, QUANTOS_BFF_PUBLIC_ORIGIN: origin }, stdio: ["ignore", "pipe", "pipe"] });
  179 |         await new Promise<void>((done, reject) => {
  180 |             const timer = setTimeout(() => reject(Error("reference startup timeout")), 15000);
  181 |             child.once("error", e => { clearTimeout(timer); reject(e); });
  182 |             child.stdout!.on("data", b => {
  183 |                 if (String(b).includes('"ready":true')) {
  184 |                     clearTimeout(timer);
  185 |                     done();
  186 |                 }
  187 |             });
  188 |         });
  189 |         await page.bringToFront();
  190 |     });
  191 |     test.afterEach(async ({ context, page }, info) => {
  192 |         if (info.status !== "passed" && !page.isClosed()) {
  193 |             await writeFile(info.outputPath("page-state.txt"), await page.locator("main").innerText({ timeout: 1000 }).catch(() => "unavailable"));
  194 |             await page.screenshot({ path: info.outputPath("failure.png"), fullPage: true, timeout: 5000 }).catch(() => { });
  195 |         }
  196 |         await writeFile(info.outputPath("frontend-g8.json"), JSON.stringify({ schema: "quantos-frontend-g8-browser/v1", scenario: info.title, status: info.status, sourceCommit: process.env.GITHUB_SHA, binarySha256: hash(await readFile("target/debug/bff-gateway")), identity: "EXPLICIT_REFERENCE_COOKIE_BRIDGE", cors: "LOOPBACK_PROXY_SUBSTITUTION", mode, businessWrites: mode === "assisted-mtls-local" ? "CORE_L4_PUBLIC_UI_TO_ACTUAL_L02_MTLS_OWNED_PROTOCOL" : mode === "assisted-local" ? "CORE_L03_PUBLIC_DUAL_TO_NATIVE_L01_OWNED_PROTOCOL_PORT" : "PAPER_C01_C07_C08_C09_C10_RECOVERY_ONLY_NOT_ASSISTED_TESTNET", referenceInstance: `owned-process-${port}`, realIdp: "NOT_RUN", realCookieCors: "NOT_RUN", probes, rows }, null, 2));
  197 |         await context.close();
  198 |         for (const s of streams)
  199 |             s.destroy();
  200 |         streams.clear();
  201 |         proxy.closeAllConnections();
  202 |         if (child?.exitCode === null) {
  203 |             child.kill();
  204 |             await new Promise(r => child.once("close", r));
  205 |         }
  206 |         await zone?.close();zone=undefined;
  207 |     });
  208 |     test.afterAll(async () => { proxy.closeAllConnections(); await new Promise<void>(r => proxy.close(() => r())); await rm(scratch, { recursive: true, force: true }); });
  209 | }
  210 | 
```