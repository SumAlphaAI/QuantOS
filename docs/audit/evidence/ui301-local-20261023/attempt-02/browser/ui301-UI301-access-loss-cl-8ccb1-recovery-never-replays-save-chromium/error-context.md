# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui301.spec.ts >> UI301 access loss clears draft; explicit recovery never replays save
- Location: tests/e2e/ui301.spec.ts:27:5

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
  - heading "访问条件已变化" [level=1]
  - paragraph: 内存草稿已清除。恢复后先读取服务端版本；不会重放保存。离开前未确认的保存结果须重新核对。
  - button "重新验证访问条件"
  - link "返回 Command":
    - /url: /command
- alert
```

# Test source

```ts
  1  | // Actual C05 reference BFF bytes through a loopback TLS/CORS and identity substitute.
  2  | import {test,expect,type Page} from "@playwright/test";
  3  | import {spawn,execFileSync,type ChildProcess} from "node:child_process";
  4  | import {createServer as reserveServer} from "node:net";
  5  | import {createServer,request as secureRequest} from "node:https";
  6  | import {request,type ServerResponse} from "node:http";
  7  | import {mkdtemp,readFile,writeFile,rm} from "node:fs/promises";
  8  | import {tmpdir} from "node:os";
  9  | import {resolve,join} from "node:path";
  10 | import {createHash} from "node:crypto";
  11 | const origin = "https://127.0.0.1:4010", terminal = "http://localhost:3190", csrf = "csrf-token-0000000000000001";
  12 | const hash = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
  13 | type Row = {method: string;path: string;status: number;source: string;control: boolean;keyHash?: string;bodyHash: string;version?: string;responseHash?: string};
  14 | let rows: Row[] = [], child: ChildProcess, port: number, scratch: string, drop = false, readonly = false, invalid = false;
  15 | const streams = new Set<ServerResponse>();
  16 | const proxy = createServer({},async (req,res) => {
  17 |  const path = new URL(req.url!,origin).pathname, method = req.method!;
  18 |  for (const [k,v] of Object.entries({"access-control-allow-origin":terminal,"access-control-allow-credentials":"true","access-control-allow-headers":"content-type,x-csrf-token,x-request-id,idempotency-key,if-match","access-control-allow-methods":"GET,PUT,OPTIONS","cache-control":"no-store"})) res.setHeader(k,v);
  19 |  if (method === "OPTIONS") {res.writeHead(204);res.end();return;}
  20 |  const chunks: Buffer[] = [];for await (const b of req) chunks.push(Buffer.from(b));const body = Buffer.concat(chunks);
  21 |  const row: Row = {method,path,status:0,source:"REFERENCE_BYTES",control:Boolean(req.headers["x-ui301-control"]),bodyHash:hash(body),version:req.headers["if-match"] as string | undefined,keyHash:req.headers["idempotency-key"] ? hash(String(req.headers["idempotency-key"])) : undefined};rows.push(row);
  22 |  if (invalid && method === "PUT") {row.status = 422;row.source = "SYNTHETIC_VALIDATION_REJECTION";res.writeHead(422,{"content-type":"application/json"});res.end(JSON.stringify({code:"INVALID_REQUEST",message:"private SQL must not display",correlationId:"aaaaaaaa-1111-4111-8111-111111111111"}));return;}
  23 |  const upstream = request({host:"127.0.0.1",port,path:req.url,method,headers:{...req.headers,cookie:`quantos_session=session-current; quantos_csrf=${csrf}`,origin:terminal}},response => {
  24 |   row.status = response.statusCode!;
  25 |   if (path.endsWith("/stream")) {res.writeHead(row.status,{"content-type":"text/event-stream"});res.flushHeaders();streams.add(res);response.pipe(res);res.on("close",() => {streams.delete(res);response.destroy();});return;}
  26 |   const output: Buffer[] = [];response.on("data",b => output.push(Buffer.from(b)));response.on("end",() => {
  27 |    let bytes = Buffer.concat(output);
  28 |    if (readonly && ["/v1/session","/v1/context"].includes(path) && row.status === 200) {const c = JSON.parse(bytes.toString());c.capabilities = c.capabilities.filter((v: string) => v !== "strategy.write");bytes = Buffer.from(JSON.stringify(c));row.source = "SYNTHETIC_CAPABILITY_NARROWING";}
  29 |    row.responseHash = hash(bytes);
  30 |    if (drop && method === "PUT" && row.status === 200) {drop = false;row.source = "REFERENCE_COMMITTED_RESPONSE_DROPPED";res.writeHead(200,{"content-type":"application/json","content-length":bytes.length+1});res.write(bytes.subarray(0,5));setTimeout(() => res.destroy(),20);return;}
  31 |    res.writeHead(row.status,{"content-type":"application/json","content-length":bytes.length});res.end(bytes);
  32 |   });
  33 |  });upstream.on("error",() => {if (!res.headersSent) res.writeHead(502);res.end();});res.on("close",() => upstream.destroy());upstream.end(body);
  34 | });
  35 | export const networkRows = () => rows;
  36 | export function fault(options: {drop?: boolean;readonly?: boolean;invalid?: boolean}) {drop = options.drop ?? false;readonly = options.readonly ?? false;invalid = options.invalid ?? false;}
  37 | export async function control(path: string,body?: unknown,version?: string): Promise<{status: number;body: Record<string,unknown>}> {
  38 |  return new Promise((resolve,reject) => {const req = secureRequest(origin+path,{rejectUnauthorized:false,method:body ? "PUT" : "GET",headers:{"x-ui301-control":"1",...(body ? {"content-type":"application/json","if-match":version!,"idempotency-key":crypto.randomUUID(),"x-request-id":crypto.randomUUID(),"x-csrf-token":csrf} : {})}},res => {const parts: Buffer[] = [];res.on("data",b => parts.push(Buffer.from(b)));res.on("end",() => resolve({status:res.statusCode!,body:JSON.parse(Buffer.concat(parts).toString())}));});req.on("error",reject);req.end(body ? JSON.stringify(body) : undefined);});
  39 | }
> 40 | export async function authorized(page: Page) {await expect(page.locator('[data-route-access="authorized"]')).toBeVisible();}
     |                                                                                                              ^ Error: expect(locator).toBeVisible() failed
  41 | export async function openLab(page: Page) {await page.goto("/strategies");await authorized(page);const link = page.getByRole("link",{name:"打开 Lab"}).first();await expect(link).toBeVisible();const href = (await link.getAttribute("href"))!;await link.click();await authorized(page);await expect(page.getByLabel("文件 JSON",{exact:true})).toBeVisible();return href;}
  42 | test.beforeAll(async () => {
  43 |  expect(process.env.DATABASE_URL).toBeUndefined();expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();scratch = await mkdtemp(join(tmpdir(),"quantos-ui301-"));execFileSync("openssl",["req","-x509","-newkey","rsa:2048","-nodes","-keyout",join(scratch,"key.pem"),"-out",join(scratch,"cert.pem"),"-days","1","-subj","/CN=127.0.0.1","-addext","subjectAltName=IP:127.0.0.1"],{stdio:"ignore"});proxy.setSecureContext({key:await readFile(join(scratch,"key.pem")),cert:await readFile(join(scratch,"cert.pem"))});await new Promise<void>(r => proxy.listen(4010,"127.0.0.1",r));
  44 | });
  45 | test.beforeEach(async ({context,page}) => {
  46 |  page.on("dialog",dialog => dialog.type() === "beforeunload" ? dialog.accept() : dialog.dismiss());
  47 |  rows = [];fault({});await context.addCookies([{name:"quantos_csrf",value:csrf,url:terminal}]);await context.route("**/*",route => ["localhost","127.0.0.1"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
  48 |  const reserve = reserveServer();await new Promise<void>(r => reserve.listen(0,"127.0.0.1",r));port = (reserve.address() as {port: number}).port;await new Promise<void>(r => reserve.close(() => r()));
  49 |  child = spawn(resolve("target/debug/bff-gateway"),[],{env:{PATH:process.env.PATH,HOME:process.env.HOME,GITHUB_SHA:process.env.GITHUB_SHA,QUANTOS_SKIP_ENV:"1",QUANTOS_BFF_MODE:"reference",QUANTOS_BFF_BIND:`127.0.0.1:${port}`,QUANTOS_BFF_PUBLIC_ORIGIN:origin},stdio:["ignore","pipe","pipe"]});
  50 |  await new Promise<void>((done,reject) => {const timer = setTimeout(() => reject(Error("reference startup timeout")),15000);child.once("error",e => {clearTimeout(timer);reject(e);});child.stdout!.on("data",b => {if (String(b).includes('"ready":true')) {clearTimeout(timer);done();}});});await page.bringToFront();
  51 | });
  52 | test.afterEach(async ({context,page},info) => {
  53 |  if (info.status !== "passed" && !page.isClosed()) {await writeFile(info.outputPath("page-state.txt"),await page.locator("main").innerText({timeout:1000}).catch(() => "unavailable"));await page.screenshot({path:info.outputPath("failure.png"),fullPage:true,timeout:5000}).catch(() => {});}
  54 |  await writeFile(info.outputPath("ui301.json"),JSON.stringify({schema:"quantos-ui301-browser/v1",scenario:info.title,status:info.status,sourceCommit:process.env.GITHUB_SHA,binarySha256:hash(await readFile("target/debug/bff-gateway")),identity:"EXPLICIT_REFERENCE_COOKIE_BRIDGE",cors:"LOOPBACK_PROXY_SUBSTITUTION",businessWrites:"LOCAL_REFERENCE_C05_DRAFT_ONLY",realIdp:"NOT_RUN",realCookieCors:"NOT_RUN",rows},null,2));
  55 |  await context.close();for (const s of streams) s.destroy();streams.clear();proxy.closeAllConnections();if (child?.exitCode === null) {child.kill();await new Promise(r => child.once("close",r));}
  56 | });
  57 | test.afterAll(async () => {proxy.closeAllConnections();await new Promise<void>(r => proxy.close(() => r()));await rm(scratch,{recursive:true,force:true});});
  58 | 
```