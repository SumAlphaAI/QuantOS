# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: core-l4.spec.ts >> CORE L4 current P10 P11 mTLS common C10 read and recovery
- Location: tests/e2e/core-l4.spec.ts:7:5

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
  - heading "访问条件未能核实" [level=1]
  - paragraph: 请重新登录后核对当前账户和模式。
- alert
```

# Test source

```ts
  56  |     dropPath?: string;
  57  |     nonJsonPath?: string;
  58  |     refusal?: 401 | 403;
  59  | } = {};
  60  | const streams = new Set<ServerResponse>();
  61  | let probes: string[] = [];
  62  | export function probe(label: string) { probes.push(label); }
  63  | export const networkRows = () => rows;
  64  | export function fault(next: typeof flags) { flags = next; }
  65  | const proxy = createServer({}, async (req, res) => {
  66  |     const u = new URL(req.url!, origin), path = u.pathname, method = req.method!;
  67  |     for (const [k, v] of Object.entries({ 'access-control-allow-origin': terminal, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': 'content-type,x-csrf-token,x-request-id,idempotency-key,if-match', 'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS', 'cache-control': 'no-store', 'access-control-expose-headers': 'x-stream-id' }))
  68  |         res.setHeader(k, v);
  69  |     if (method === 'OPTIONS') {
  70  |         res.writeHead(204);
  71  |         res.end();
  72  |         return;
  73  |     }
  74  |     const chunks: Buffer[] = [];
  75  |     for await (const b of req)
  76  |         chunks.push(Buffer.from(b));
  77  |     const body = Buffer.concat(chunks);
  78  |     const row: Row = { query: Object.fromEntries([...u.searchParams].map(([k, v]) => [k, k === 'ticket' ? 'sha256:' + hash(v) : v])), method, path, status: 0, source: 'REFERENCE_BYTES', control: Boolean(req.headers['x-frontend-g8-control']), bodyHash: hash(body), version: req.headers['if-match'] as string | undefined, keyHash: req.headers['idempotency-key'] ? hash(String(req.headers['idempotency-key'])) : undefined };
  79  |     rows.push(row);
  80  |     if (!row.control && ['POST', 'PUT', 'DELETE'].includes(method) && path.startsWith('/v1/admin/') && (flags.rateLimit || flags.conflict)) {
  81  |         row.source = 'SYNTHETIC_HTTP_REFUSAL';
  82  |         row.status = flags.rateLimit ? 429 : 409;
  83  |         const bytes = Buffer.from(JSON.stringify({ code: flags.rateLimit ? 'RATE_LIMITED' : 'VERSION_CONFLICT', message: 'private SQL secret', correlationId: 'aaaaaaaa-1111-4111-8111-111111111111', ...flags.rateLimit ? { retryAfter: 1 } : {} }));
  84  |         row.responseHash = hash(bytes);
  85  |         res.writeHead(row.status, { 'content-type': 'application/json', 'content-length': bytes.length });
  86  |         res.end(bytes);
  87  |         return;
  88  |     }
  89  |     if (!row.control && flags.nonJsonPath && path === flags.nonJsonPath) {
  90  |         row.source = 'SYNTHETIC_NON_JSON_AUTHORITY_REFUSAL';
  91  |         row.status = flags.refusal ?? 403;
  92  |         res.writeHead(row.status, { 'content-type': 'text/html' });
  93  |         res.end('<html>private gateway rejection</html>');
  94  |         return;
  95  |     }
  96  |     const upstream = request({ host: '127.0.0.1', port, path: req.url, method, headers: { ...req.headers, cookie: `quantos_session=${row.control ? String(req.headers['x-frontend-g8-session']) : flags.readonly ? 'session-approver' : activeSession}; quantos_csrf=${csrf}`, origin: terminal } }, response => {
  97  |         row.status = response.statusCode!;
  98  |         if (path === '/v1/settings/sessions/stream') {
  99  |             res.writeHead(row.status, { 'content-type': 'text/event-stream' });
  100 |             res.flushHeaders();
  101 |             streams.add(res);
  102 |             response.pipe(res);
  103 |             res.on('close', () => { streams.delete(res); response.destroy(); });
  104 |             return;
  105 |         }
  106 |         const output: Buffer[] = [];
  107 |         response.on('data', b => output.push(Buffer.from(b)));
  108 |         response.on('end', () => {
  109 |             let bytes = Buffer.concat(output);
  110 |             if (row.status >= 400) {
  111 |                 try { const code = JSON.parse(bytes.toString()).code; row.errorCode = typeof code === "string" && /^[A-Z_]{1,80}$/.test(code) ? code : "UNSTRUCTURED_REFUSAL"; }
  112 |                 catch { row.errorCode = "UNSTRUCTURED_REFUSAL"; }
  113 |             }
  114 |             if (row.status === 200 && !row.control && flags.foreign && path === '/v1/alerts') {
  115 |                 const v = JSON.parse(bytes.toString());
  116 |                 v.items[0].accountId = 'aaaaaaaa-1111-4111-8111-111111111111';
  117 |                 bytes = Buffer.from(JSON.stringify(v));
  118 |                 row.source = 'SYNTHETIC_FOREIGN_ACCOUNT';
  119 |             }
  120 |             row.responseHash = hash(bytes);
  121 |             if (!row.control && method !== 'GET' && !path.startsWith('/v1/auth/') && [200, 201, 202].includes(row.status)) {
  122 |                 const v = JSON.parse(bytes.toString());
  123 |                 receipts.push(v);
  124 |             }
  125 |             if ((flags.dropPath === path || flags.drop && path.startsWith('/v1/admin/')) && ['POST', 'PUT', 'DELETE'].includes(method) && [200, 201, 202].includes(row.status)) {
  126 |                 flags.drop = false;
  127 |                 delete flags.dropPath;
  128 |                 row.source = 'REFERENCE_COMMITTED_RESPONSE_DROPPED';
  129 |                 res.writeHead(row.status, { 'content-type': 'application/json', 'content-length': bytes.length + 1 });
  130 |                 res.write(bytes.subarray(0, 5));
  131 |                 setTimeout(() => res.destroy(), 20);
  132 |                 return;
  133 |             }
  134 |             res.writeHead(row.status, { 'content-type': path.endsWith('/stream') ? 'text/event-stream' : 'application/json', 'content-length': bytes.length, ...(response.headers['x-stream-id'] ? { 'x-stream-id': response.headers['x-stream-id'] } : {}) });
  135 |             res.end(bytes);
  136 |         });
  137 |     });
  138 |     upstream.on('error', () => {
  139 |         if (!res.headersSent)
  140 |             res.writeHead(502);
  141 |         res.end();
  142 |     });
  143 |     res.on('close', () => upstream.destroy());
  144 |     upstream.end(body);
  145 | });
  146 | export async function control(path: string, body?: unknown, version?: string, options: {
  147 |     method?: "GET" | "PUT" | "POST" | "DELETE";
  148 |     session?: "session-current" | "session-viewer" | "session-owner" | "session-approver";
  149 | } = {}): Promise<{
  150 |     status: number;
  151 |     body: Record<string, unknown>;
  152 | }> {
  153 |     const method = options.method ?? (body ? "PUT" : "GET"), write = method !== "GET";
  154 |     return new Promise((resolve, reject) => { const req = secureRequest(origin + path, { rejectUnauthorized: false, method, headers: { "x-frontend-g8-control": "1", "x-frontend-g8-session": options.session ?? "session-owner", ...(write ? { "content-type": "application/json", ...(version ? { "if-match": version } : {}), "idempotency-key": crypto.randomUUID(), "x-request-id": crypto.randomUUID(), "x-csrf-token": csrf } : {}) } }, res => { const parts: Buffer[] = []; res.on("data", b => parts.push(Buffer.from(b))); res.on("end", () => resolve({ status: res.statusCode!, body: Buffer.concat(parts).length ? JSON.parse(Buffer.concat(parts).toString()) : {} })); }); req.on("error", reject); req.end(body ? JSON.stringify(body) : undefined); });
  155 | }
> 156 | export async function authorized(page: Page) { await expect(page.locator('[data-route-access="authorized"]')).toBeVisible(); }
      |                                                                                                               ^ Error: expect(locator).toBeVisible() failed
  157 | export function installReferenceHooks(mode: "paper" | "shadow" | "assisted-local" | "assisted-mtls-local" = "paper", assistedEnabled = true) {
  158 |     test.beforeAll(async () => {
  159 |         expect(process.env.DATABASE_URL).toBeUndefined();
  160 |         expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
  161 |         scratch = await mkdtemp(join(tmpdir(), "quantos-frontend-g8-"));
  162 |         execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", join(scratch, "key.pem"), "-out", join(scratch, "cert.pem"), "-days", "1", "-subj", "/CN=127.0.0.1", "-addext", "subjectAltName=IP:127.0.0.1"], { stdio: "ignore" });
  163 |         proxy.setSecureContext({ key: await readFile(join(scratch, "key.pem")), cert: await readFile(join(scratch, "cert.pem")) });
  164 |         await new Promise<void>(r => proxy.listen(4010, "127.0.0.1", r));
  165 |     });
  166 |     test.beforeEach(async ({ context, page }) => {
  167 |         page.on("dialog", dialog => dialog.type() === "beforeunload" ? dialog.accept() : dialog.dismiss());
  168 |         await page.emulateMedia({ colorScheme: "dark" });
  169 |         rows = [];
  170 |         receipts.length = 0;
  171 |         activeSession = 'session-current';
  172 |         probes = [];
  173 |         fault({});
  174 |         await context.addCookies([{ name: "quantos_csrf", value: csrf, url: terminal }]);
  175 |         await context.route("**/*", route => ["localhost", "127.0.0.1"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
  176 |         zone=mode==="assisted-mtls-local"?await ownedZone():undefined;
  177 |         child = spawn(resolve("target/debug/bff-gateway"), [], { env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, ...(zone?{QUANTOS_BFF_OWNED_MTLS_DIRECTORY:zone.directory}:{}), GITHUB_SHA: process.env.GITHUB_SHA, QUANTOS_SKIP_ENV: "1", QUANTOS_BFF_MODE: "reference", QUANTOS_BFF_REFERENCE_CONTEXT: mode, QUANTOS_BFF_OWNED_ASSISTED: (mode === "assisted-local" || mode === "assisted-mtls-local") && assistedEnabled ? "enabled" : "off", QUANTOS_BFF_BIND: "127.0.0.1:0", QUANTOS_BFF_PUBLIC_ORIGIN: origin }, stdio: ["ignore", "pipe", "pipe"] });
  178 |         await new Promise<void>((done, reject) => {
  179 |             const timer = setTimeout(() => reject(Error("reference startup timeout")), 15000);
  180 |             child.once("error", e => { clearTimeout(timer); reject(e); });
  181 |             let output = "";
  182 |             child.stdout!.on("data", b => {
  183 |                 output += String(b);
  184 |                 if (output.includes("\n")) {
  185 |                     const ready = JSON.parse(output.split("\n")[0]), address = new URL("http://" + ready.address);
  186 |                     expect(ready.ready).toBe(true); expect(address.hostname).toBe("127.0.0.1"); expect(isIP(address.hostname)).toBe(4);
  187 |                     port = Number(address.port); expect(port).toBeGreaterThan(0);
  188 |                     clearTimeout(timer);
  189 |                     done();
  190 |                 }
  191 |             });
  192 |         });
  193 |         await page.bringToFront();
  194 |     });
  195 |     test.afterEach(async ({ context, page }, info) => {
  196 |         if (info.status !== "passed" && !page.isClosed()) {
  197 |             await writeFile(info.outputPath("page-state.txt"), await page.locator("main").innerText({ timeout: 1000 }).catch(() => "unavailable"));
  198 |             await page.screenshot({ path: info.outputPath("failure.png"), fullPage: true, timeout: 5000 }).catch(() => { });
  199 |         }
  200 |         await writeFile(info.outputPath("frontend-g8.json"), JSON.stringify({ schema: "quantos-frontend-g8-browser/v1", scenario: info.title, status: info.status, sourceCommit: process.env.GITHUB_SHA, binarySha256: hash(await readFile("target/debug/bff-gateway")), identity: "EXPLICIT_REFERENCE_COOKIE_BRIDGE", cors: "LOOPBACK_PROXY_SUBSTITUTION", mode, businessWrites: mode === "assisted-mtls-local" ? "CORE_L4_PUBLIC_UI_TO_ACTUAL_L02_MTLS_OWNED_PROTOCOL" : mode === "assisted-local" ? "CORE_L03_PUBLIC_DUAL_TO_NATIVE_L01_OWNED_PROTOCOL_PORT" : "PAPER_C01_C07_C08_C09_C10_RECOVERY_ONLY_NOT_ASSISTED_TESTNET", referenceInstance: `owned-process-${port}`, realIdp: "NOT_RUN", realCookieCors: "NOT_RUN", probes, rows }, null, 2));
  201 |         await context.close();
  202 |         for (const s of streams)
  203 |             s.destroy();
  204 |         streams.clear();
  205 |         proxy.closeAllConnections();
  206 |         if (child?.exitCode === null) {
  207 |             child.kill();
  208 |             await new Promise(r => child.once("close", r));
  209 |         }
  210 |         await zone?.close();zone=undefined;
  211 |     });
  212 |     test.afterAll(async () => { proxy.closeAllConnections(); await new Promise<void>(r => proxy.close(() => r())); await rm(scratch, { recursive: true, force: true }); });
  213 | }
  214 | 
```