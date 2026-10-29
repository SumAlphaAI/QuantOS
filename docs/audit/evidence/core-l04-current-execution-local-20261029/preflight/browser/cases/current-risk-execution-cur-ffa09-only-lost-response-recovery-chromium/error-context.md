# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: current-risk-execution.spec.ts >> current native ETH approval to explicit P11 execution and GET-only lost response recovery
- Location: tests/e2e/current-risk-execution.spec.ts:12:5

# Error details

```
TypeError: Cannot read properties of undefined (reading 'tenantId')
```

# Test source

```ts
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
  156 | export async function authorized(page: Page) { await expect(page.locator('[data-route-access="authorized"]')).toBeVisible(); }
  157 | export function installReferenceHooks(mode: "paper" | "shadow" | "assisted-local" | "assisted-mtls-local" = "paper", assistedEnabled = true, currentReviewExecutionEnabled = false) {
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
  176 |         zone=mode==="assisted-mtls-local"?await ownedZone(currentReviewExecutionEnabled):undefined;
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
  214 | /** Owner publication for the current valuation port; never a product HTTP upload. */
  215 | export async function publishOwnedValuation(ledger:Record<string,unknown>){
  216 |  if(!zone)throw Error('Owned mTLS zone required');
  217 |  const {createHmac}=await import('node:crypto'),{rename}=await import('node:fs/promises');
  218 |  const owner=JSON.parse((await readFile(join(zone.directory,'bff-owner.json'))).toString());
  219 |  const canonical=(v:unknown):string=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical((v as Record<string,unknown>)[k])).join(',')+'}':JSON.stringify(v);
> 220 |  const scope={tenantId:ledger.tenantId,workspaceId:ledger.workspaceId,accountId:ledger.accountId},at=new Date().toISOString();
      |                               ^ TypeError: Cannot read properties of undefined (reading 'tenantId')
  221 |  const value={schemaVersion:'quantos-native-valuation-input.v1',sourceId:'owned-reference-valuation:v1',version:1,scope,basis:'EMPTY_ORIGIN_PLUS_NATIVE_FILLS_NO_EXTERNAL_FLOWS',originLedgerHash:'sha256:'+hash(canonical({schemaVersion:'quantos-native-ledger-checkpoint.v1',scope,entries:[],anchor:{sequence:0,head:null}})),openingAt:owner.createdAt,cashSourceRef:'browser:owned-opening-cash',quoteCashAtOpening:'10000',realizedPnlBeforeOriginToday:'-5',quoteCurrency:'USDT',ledgerHash:ledger.ledgerHash,ledgerAnchor:ledger.anchor,asOf:at,validUntil:new Date(Date.parse(at)+30000).toISOString(),cashCoverageThrough:at,accountStatus:'active',accountStatusAt:at,statusSourceRef:'browser:owned-status',marks:(ledger.positions as {symbol:string;quantity:string}[]).filter(p=>p.quantity!=='0').map(p=>({symbol:p.symbol,price:'1100',sourceRef:'browser:independent-owned-mark',observedAt:at,quality:'normal'}))};
  222 |  const packet={value,signature:createHmac('sha256',Buffer.from(owner.keys[3])).update(canonical(['quantos-l04-durable/v1','valuation-input',value])).digest('hex')};
  223 |  const temp=join(zone.directory,'browser-valuation.tmp');await writeFile(temp,JSON.stringify(packet),{mode:0o600});await rename(temp,join(zone.directory,'valuation-input.json'));
  224 |  return{scope:'OWNER_AUTHENTICATED_REFERENCE_INPUT_NOT_REAL_MARKET',version:1};
  225 | }
  226 | 
```