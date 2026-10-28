# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: g8-current.spec.ts >> G8 current P10 P11 show actual server-closed conditions with no assisted entry or writes
- Location: tests/e2e/g8-current.spec.ts:6:5

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
  43  |     slow?: boolean;
  44  |     streamForbidden?: boolean;
  45  |     stateRows?: boolean;
  46  |     largeDecimal?: boolean;
  47  |     dropPath?: string;
  48  |     nonJsonPath?: string;
  49  |     refusal?: 401 | 403;
  50  | } = {};
  51  | const streams = new Set<ServerResponse>();
  52  | let probes: string[] = [];
  53  | export function probe(label: string) { probes.push(label); }
  54  | export const networkRows = () => rows;
  55  | export function fault(next: typeof flags) { flags = next; }
  56  | const proxy = createServer({}, async (req, res) => {
  57  |     const u = new URL(req.url!, origin), path = u.pathname, method = req.method!;
  58  |     for (const [k, v] of Object.entries({ 'access-control-allow-origin': terminal, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': 'content-type,x-csrf-token,x-request-id,idempotency-key,if-match', 'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS', 'cache-control': 'no-store', 'access-control-expose-headers': 'x-stream-id' }))
  59  |         res.setHeader(k, v);
  60  |     if (method === 'OPTIONS') {
  61  |         res.writeHead(204);
  62  |         res.end();
  63  |         return;
  64  |     }
  65  |     const chunks: Buffer[] = [];
  66  |     for await (const b of req)
  67  |         chunks.push(Buffer.from(b));
  68  |     const body = Buffer.concat(chunks);
  69  |     const row: Row = { query: Object.fromEntries([...u.searchParams].map(([k, v]) => [k, k === 'ticket' ? 'sha256:' + hash(v) : v])), method, path, status: 0, source: 'REFERENCE_BYTES', control: Boolean(req.headers['x-frontend-g8-control']), bodyHash: hash(body), version: req.headers['if-match'] as string | undefined, keyHash: req.headers['idempotency-key'] ? hash(String(req.headers['idempotency-key'])) : undefined };
  70  |     rows.push(row);
  71  |     if (!row.control && ['POST', 'PUT', 'DELETE'].includes(method) && path.startsWith('/v1/admin/') && (flags.rateLimit || flags.conflict)) {
  72  |         row.source = 'SYNTHETIC_HTTP_REFUSAL';
  73  |         row.status = flags.rateLimit ? 429 : 409;
  74  |         const bytes = Buffer.from(JSON.stringify({ code: flags.rateLimit ? 'RATE_LIMITED' : 'VERSION_CONFLICT', message: 'private SQL secret', correlationId: 'aaaaaaaa-1111-4111-8111-111111111111', ...flags.rateLimit ? { retryAfter: 1 } : {} }));
  75  |         row.responseHash = hash(bytes);
  76  |         res.writeHead(row.status, { 'content-type': 'application/json', 'content-length': bytes.length });
  77  |         res.end(bytes);
  78  |         return;
  79  |     }
  80  |     if (!row.control && flags.nonJsonPath && path === flags.nonJsonPath) {
  81  |         row.source = 'SYNTHETIC_NON_JSON_AUTHORITY_REFUSAL';
  82  |         row.status = flags.refusal ?? 403;
  83  |         res.writeHead(row.status, { 'content-type': 'text/html' });
  84  |         res.end('<html>private gateway rejection</html>');
  85  |         return;
  86  |     }
  87  |     const upstream = request({ host: '127.0.0.1', port, path: req.url, method, headers: { ...req.headers, cookie: `quantos_session=${row.control ? String(req.headers['x-frontend-g8-session']) : flags.readonly ? 'session-approver' : activeSession}; quantos_csrf=${csrf}`, origin: terminal } }, response => {
  88  |         row.status = response.statusCode!;
  89  |         if (path === '/v1/settings/sessions/stream') {
  90  |             res.writeHead(row.status, { 'content-type': 'text/event-stream' });
  91  |             res.flushHeaders();
  92  |             streams.add(res);
  93  |             response.pipe(res);
  94  |             res.on('close', () => { streams.delete(res); response.destroy(); });
  95  |             return;
  96  |         }
  97  |         const output: Buffer[] = [];
  98  |         response.on('data', b => output.push(Buffer.from(b)));
  99  |         response.on('end', () => {
  100 |             let bytes = Buffer.concat(output);
  101 |             if (row.status === 200 && !row.control && flags.foreign && path === '/v1/alerts') {
  102 |                 const v = JSON.parse(bytes.toString());
  103 |                 v.items[0].accountId = 'aaaaaaaa-1111-4111-8111-111111111111';
  104 |                 bytes = Buffer.from(JSON.stringify(v));
  105 |                 row.source = 'SYNTHETIC_FOREIGN_ACCOUNT';
  106 |             }
  107 |             row.responseHash = hash(bytes);
  108 |             if (!row.control && method !== 'GET' && !path.startsWith('/v1/auth/') && [200, 201, 202].includes(row.status)) {
  109 |                 const v = JSON.parse(bytes.toString());
  110 |                 receipts.push(v);
  111 |             }
  112 |             if ((flags.dropPath === path || flags.drop && path.startsWith('/v1/admin/')) && ['POST', 'PUT', 'DELETE'].includes(method) && [200, 201, 202].includes(row.status)) {
  113 |                 flags.drop = false;
  114 |                 delete flags.dropPath;
  115 |                 row.source = 'REFERENCE_COMMITTED_RESPONSE_DROPPED';
  116 |                 res.writeHead(row.status, { 'content-type': 'application/json', 'content-length': bytes.length + 1 });
  117 |                 res.write(bytes.subarray(0, 5));
  118 |                 setTimeout(() => res.destroy(), 20);
  119 |                 return;
  120 |             }
  121 |             res.writeHead(row.status, { 'content-type': path.endsWith('/stream') ? 'text/event-stream' : 'application/json', 'content-length': bytes.length, ...(response.headers['x-stream-id'] ? { 'x-stream-id': response.headers['x-stream-id'] } : {}) });
  122 |             res.end(bytes);
  123 |         });
  124 |     });
  125 |     upstream.on('error', () => {
  126 |         if (!res.headersSent)
  127 |             res.writeHead(502);
  128 |         res.end();
  129 |     });
  130 |     res.on('close', () => upstream.destroy());
  131 |     upstream.end(body);
  132 | });
  133 | export async function control(path: string, body?: unknown, version?: string, options: {
  134 |     method?: "GET" | "PUT" | "POST" | "DELETE";
  135 |     session?: "session-current" | "session-viewer" | "session-owner" | "session-approver";
  136 | } = {}): Promise<{
  137 |     status: number;
  138 |     body: Record<string, unknown>;
  139 | }> {
  140 |     const method = options.method ?? (body ? "PUT" : "GET"), write = method !== "GET";
  141 |     return new Promise((resolve, reject) => { const req = secureRequest(origin + path, { rejectUnauthorized: false, method, headers: { "x-frontend-g8-control": "1", "x-frontend-g8-session": options.session ?? "session-owner", ...(write ? { "content-type": "application/json", ...(version ? { "if-match": version } : {}), "idempotency-key": crypto.randomUUID(), "x-request-id": crypto.randomUUID(), "x-csrf-token": csrf } : {}) } }, res => { const parts: Buffer[] = []; res.on("data", b => parts.push(Buffer.from(b))); res.on("end", () => resolve({ status: res.statusCode!, body: Buffer.concat(parts).length ? JSON.parse(Buffer.concat(parts).toString()) : {} })); }); req.on("error", reject); req.end(body ? JSON.stringify(body) : undefined); });
  142 | }
> 143 | export async function authorized(page: Page) { await expect(page.locator('[data-route-access="authorized"]')).toBeVisible(); }
      |                                                                                                               ^ Error: expect(locator).toBeVisible() failed
  144 | export function installReferenceHooks(mode: "paper" | "shadow" | "assisted-local" | "assisted-mtls-local" = "paper", assistedEnabled = true) {
  145 |     test.beforeAll(async () => {
  146 |         expect(process.env.DATABASE_URL).toBeUndefined();
  147 |         expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
  148 |         scratch = await mkdtemp(join(tmpdir(), "quantos-frontend-g8-"));
  149 |         execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", join(scratch, "key.pem"), "-out", join(scratch, "cert.pem"), "-days", "1", "-subj", "/CN=127.0.0.1", "-addext", "subjectAltName=IP:127.0.0.1"], { stdio: "ignore" });
  150 |         proxy.setSecureContext({ key: await readFile(join(scratch, "key.pem")), cert: await readFile(join(scratch, "cert.pem")) });
  151 |         await new Promise<void>(r => proxy.listen(4010, "127.0.0.1", r));
  152 |     });
  153 |     test.beforeEach(async ({ context, page }) => {
  154 |         page.on("dialog", dialog => dialog.type() === "beforeunload" ? dialog.accept() : dialog.dismiss());
  155 |         await page.emulateMedia({ colorScheme: "dark" });
  156 |         rows = [];
  157 |         receipts.length = 0;
  158 |         activeSession = 'session-current';
  159 |         probes = [];
  160 |         fault({});
  161 |         await context.addCookies([{ name: "quantos_csrf", value: csrf, url: terminal }]);
  162 |         await context.route("**/*", route => ["localhost", "127.0.0.1"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
  163 |         const reserve = reserveServer();
  164 |         await new Promise<void>(r => reserve.listen(0, "127.0.0.1", r));
  165 |         port = (reserve.address() as {
  166 |             port: number;
  167 |         }).port;
  168 |         await new Promise<void>(r => reserve.close(() => r()));
  169 |         zone=mode==="assisted-mtls-local"?await ownedZone():undefined;
  170 |         child = spawn(resolve("target/debug/bff-gateway"), [], { env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, ...(zone?{QUANTOS_BFF_OWNED_MTLS_DIRECTORY:zone.directory}:{}), GITHUB_SHA: process.env.GITHUB_SHA, QUANTOS_SKIP_ENV: "1", QUANTOS_BFF_MODE: "reference", QUANTOS_BFF_REFERENCE_CONTEXT: mode, QUANTOS_BFF_OWNED_ASSISTED: (mode === "assisted-local" || mode === "assisted-mtls-local") && assistedEnabled ? "enabled" : "off", QUANTOS_BFF_BIND: `127.0.0.1:${port}`, QUANTOS_BFF_PUBLIC_ORIGIN: origin }, stdio: ["ignore", "pipe", "pipe"] });
  171 |         await new Promise<void>((done, reject) => {
  172 |             const timer = setTimeout(() => reject(Error("reference startup timeout")), 15000);
  173 |             child.once("error", e => { clearTimeout(timer); reject(e); });
  174 |             child.stdout!.on("data", b => {
  175 |                 if (String(b).includes('"ready":true')) {
  176 |                     clearTimeout(timer);
  177 |                     done();
  178 |                 }
  179 |             });
  180 |         });
  181 |         await page.bringToFront();
  182 |     });
  183 |     test.afterEach(async ({ context, page }, info) => {
  184 |         if (info.status !== "passed" && !page.isClosed()) {
  185 |             await writeFile(info.outputPath("page-state.txt"), await page.locator("main").innerText({ timeout: 1000 }).catch(() => "unavailable"));
  186 |             await page.screenshot({ path: info.outputPath("failure.png"), fullPage: true, timeout: 5000 }).catch(() => { });
  187 |         }
  188 |         await writeFile(info.outputPath("frontend-g8.json"), JSON.stringify({ schema: "quantos-frontend-g8-browser/v1", scenario: info.title, status: info.status, sourceCommit: process.env.GITHUB_SHA, binarySha256: hash(await readFile("target/debug/bff-gateway")), identity: "EXPLICIT_REFERENCE_COOKIE_BRIDGE", cors: "LOOPBACK_PROXY_SUBSTITUTION", mode, businessWrites: mode === "assisted-mtls-local" ? "CORE_L4_PUBLIC_UI_TO_ACTUAL_L02_MTLS_OWNED_PROTOCOL" : mode === "assisted-local" ? "CORE_L03_PUBLIC_DUAL_TO_NATIVE_L01_OWNED_PROTOCOL_PORT" : "PAPER_C01_C07_C08_C09_C10_RECOVERY_ONLY_NOT_ASSISTED_TESTNET", referenceInstance: `owned-process-${port}`, realIdp: "NOT_RUN", realCookieCors: "NOT_RUN", probes, rows }, null, 2));
  189 |         await context.close();
  190 |         for (const s of streams)
  191 |             s.destroy();
  192 |         streams.clear();
  193 |         proxy.closeAllConnections();
  194 |         if (child?.exitCode === null) {
  195 |             child.kill();
  196 |             await new Promise(r => child.once("close", r));
  197 |         }
  198 |         await zone?.close();zone=undefined;
  199 |     });
  200 |     test.afterAll(async () => { proxy.closeAllConnections(); await new Promise<void>(r => proxy.close(() => r())); await rm(scratch, { recursive: true, force: true }); });
  201 | }
  202 | 
```