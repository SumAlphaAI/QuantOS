# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: frontend-g3.spec.ts >> G3 fixture 01 actual IPC Artifact to Lab Backtest Release approval target and Audit
- Location: tests/e2e/frontend-g3.spec.ts:12:39

# Error details

```
Error: reference startup timeout
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
  14 | let controlOrigin="";
  15 | let rows: Row[] = [], child: ChildProcess, port: number, scratch: string, drop = false, readonly = false, invalid = false, empty = false, listError = false, slow = false;
  16 | const streams = new Set<ServerResponse>();
  17 | const proxy = createServer({},async (req,res) => {
  18 |  const path = new URL(req.url!,origin).pathname, method = req.method!;
  19 |  for (const [k,v] of Object.entries({"access-control-allow-origin":terminal,"access-control-allow-credentials":"true","access-control-allow-headers":"content-type,x-csrf-token,x-request-id,idempotency-key,if-match","access-control-allow-methods":"GET,PUT,POST,OPTIONS","cache-control":"no-store"})) res.setHeader(k,v);
  20 |  if (method === "OPTIONS") {res.writeHead(204);res.end();return;}
  21 |  const chunks: Buffer[] = [];for await (const b of req) chunks.push(Buffer.from(b));const body = Buffer.concat(chunks);
  22 |  const row: Row = {method,path,status:0,source:"REFERENCE_BYTES",control:Boolean(req.headers["x-ui301-control"]),bodyHash:hash(body),version:req.headers["if-match"] as string | undefined,keyHash:req.headers["idempotency-key"] ? hash(String(req.headers["idempotency-key"])) : undefined};rows.push(row);
  23 |  if(method==="GET"&&path==="/v1/strategies"&&(empty||listError)){row.status=listError?503:200;row.source=listError?"SYNTHETIC_CATALOG_FAILURE":"SYNTHETIC_EMPTY_CATALOG";res.writeHead(row.status,{"content-type":"application/json"});res.end(JSON.stringify(listError?{code:"UNAVAILABLE",message:"private SQL",correlationId:"aaaaaaaa-1111-4111-8111-111111111111"}:{items:[]}));return;}
  24 | 
  25 |  if (invalid && method === "PUT") {row.status = 422;row.source = "SYNTHETIC_VALIDATION_REJECTION";res.writeHead(422,{"content-type":"application/json"});res.end(JSON.stringify({code:"INVALID_REQUEST",message:"private SQL must not display",correlationId:"aaaaaaaa-1111-4111-8111-111111111111"}));return;}
  26 |   const upstream = request({host:"127.0.0.1",port,path:req.url,method,headers:{...req.headers,cookie:`quantos_session=${row.control&&req.headers["x-ui301-session"]==="session-approver"||readonly ? "session-approver" : "session-current"}; quantos_csrf=${csrf}`,origin:terminal}},response => {
  27 |   row.status = response.statusCode!;
  28 |   if (path.endsWith("/stream")) {res.writeHead(row.status,{"content-type":"text/event-stream"});res.flushHeaders();streams.add(res);response.pipe(res);res.on("close",() => {streams.delete(res);response.destroy();});return;}
  29 |   const output: Buffer[] = [];response.on("data",b => output.push(Buffer.from(b)));response.on("end",() => {
  30 |    const bytes = Buffer.concat(output);
  31 |    row.responseHash = hash(bytes);
  32 |    if (drop && (method === "PUT" && row.status === 200 || method === "POST" && [201,202].includes(row.status))) {drop = false;row.source = "REFERENCE_COMMITTED_RESPONSE_DROPPED";res.writeHead(row.status,{"content-type":"application/json","content-length":bytes.length+1});res.write(bytes.subarray(0,5));setTimeout(() => res.destroy(),20);return;}
  33 |    res.writeHead(row.status,{"content-type":"application/json","content-length":bytes.length});if(slow&&path==="/v1/session")setTimeout(()=>res.end(bytes),800);else res.end(bytes);
  34 |   });
  35 |  });upstream.on("error",() => {if (!res.headersSent) res.writeHead(502);res.end();});res.on("close",() => upstream.destroy());upstream.end(body);
  36 | });
  37 | export const networkRows = () => rows;
  38 | export function fault(options: {drop?: boolean;readonly?: boolean;invalid?: boolean;empty?:boolean;listError?:boolean;slow?:boolean}) {drop = options.drop ?? false;readonly = options.readonly ?? false;invalid = options.invalid ?? false;empty=options.empty??false;listError=options.listError??false;slow=options.slow??false;}
  39 | export async function control(path: string,body?: unknown,version?: string,options:{method?:"GET"|"PUT"|"POST";session?:"session-current"|"session-approver"}={}): Promise<{status: number;body: Record<string,unknown>}> {
  40 |  const method=options.method??(body?"PUT":"GET"),write=method!=="GET";
  41 |  return new Promise((resolve,reject) => {const req = secureRequest(origin+path,{rejectUnauthorized:false,method,headers:{"x-ui301-control":"1","x-ui301-session":options.session??"session-current",...(write? {"content-type":"application/json",...(version?{"if-match":version}:{}),"idempotency-key":crypto.randomUUID(),"x-request-id":crypto.randomUUID(),"x-csrf-token":csrf} : {})}},res => {const parts: Buffer[] = [];res.on("data",b => parts.push(Buffer.from(b)));res.on("end",() => resolve({status:res.statusCode!,body:JSON.parse(Buffer.concat(parts).toString())}));});req.on("error",reject);req.end(body ? JSON.stringify(body) : undefined);});
  42 | }
  43 | export async function authorized(page: Page) {await expect(page.locator('[data-route-access="authorized"]')).toBeVisible();}
  44 | export async function openLab(page: Page,raw=true) {await page.goto("/strategies");await authorized(page);const link = page.getByRole("link",{name:/^打开 Lab/}).first();await expect(link).toBeVisible();const href = (await link.getAttribute("href"))!;await link.click();await authorized(page);if(raw)await page.getByRole("tab",{name:"全部文件 JSON",exact:true}).click();await expect(page.getByLabel(raw?"文件 JSON":"文件内容",{exact:true})).toBeVisible();await expect(page.getByRole("status").filter({hasText:"已保存 · objectVersion："})).toBeVisible();return href;}
  45 | export function installReferenceHooks(){
  46 | test.beforeAll(async () => {
  47 |  expect(process.env.DATABASE_URL).toBeUndefined();expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();scratch = await mkdtemp(join(tmpdir(),"quantos-ui301-"));execFileSync("openssl",["req","-x509","-newkey","rsa:2048","-nodes","-keyout",join(scratch,"key.pem"),"-out",join(scratch,"cert.pem"),"-days","1","-subj","/CN=127.0.0.1","-addext","subjectAltName=IP:127.0.0.1"],{stdio:"ignore"});proxy.setSecureContext({key:await readFile(join(scratch,"key.pem")),cert:await readFile(join(scratch,"cert.pem"))});await new Promise<void>(r => proxy.listen(4010,"127.0.0.1",r));
  48 | });
  49 | test.beforeEach(async ({context,page}) => {
  50 |  page.on("dialog",dialog => dialog.type() === "beforeunload" ? dialog.accept() : dialog.dismiss());
  51 |  rows = [];fault({});await context.addCookies([{name:"quantos_csrf",value:csrf,url:terminal}]);await context.route("**/*",route => ["localhost","127.0.0.1"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
  52 |  const reserve = reserveServer();await new Promise<void>(r => reserve.listen(0,"127.0.0.1",r));port = (reserve.address() as {port: number}).port;await new Promise<void>(r => reserve.close(() => r()));
  53 |  child = spawn(JSON.parse(await readFile(process.env.QUANTOS_G3_HOST_RECEIPT!,"utf8")).executable,["strategy::frontend_g3::browser_host","--exact","--ignored","--nocapture"],{env:{PATH:process.env.PATH,HOME:process.env.HOME,GITHUB_SHA:process.env.GITHUB_SHA,QUANTOS_G3_BROWSER_HOST:"1",QUANTOS_G3_ARTIFACTS:process.env.QUANTOS_G3_ARTIFACTS,QUANTOS_SKIP_ENV:"1",QUANTOS_BFF_MODE:"reference",QUANTOS_BFF_BIND:`127.0.0.1:${port}`,QUANTOS_BFF_PUBLIC_ORIGIN:origin},stdio:["ignore","pipe","pipe"]});
> 54 |  await new Promise<void>((done,reject) => {const timer = setTimeout(() => reject(Error("reference startup timeout")),15000);child.once("error",e => {clearTimeout(timer);reject(e);});child.stdout!.on("data",b => {for(const line of String(b).split("\n")){try{const status=JSON.parse(line);if(status.ready){controlOrigin=status.control;expect(status.fixtures).toBe(20);clearTimeout(timer);done();}}catch{/* Rust harness prefix is not JSON. */}}});});await page.bringToFront();
     |                                                                                  ^ Error: reference startup timeout
  55 | });
  56 | test.afterEach(async ({context,page},info) => {
  57 |  if (info.status !== "passed" && !page.isClosed()) {await writeFile(info.outputPath("page-state.txt"),await page.locator("main").innerText({timeout:1000}).catch(() => "unavailable"));await page.screenshot({path:info.outputPath("failure.png"),fullPage:true,timeout:5000}).catch(() => {});}
  58 |  await writeFile(info.outputPath("ui301.json"),JSON.stringify({schema:"quantos-ui301-browser/v1",scenario:info.title,artifactDocuments:process.env.QUANTOS_G3_ARTIFACTS,status:info.status,sourceCommit:process.env.GITHUB_SHA,binarySha256:hash(await readFile(JSON.parse(await readFile(process.env.QUANTOS_G3_HOST_RECEIPT!,"utf8")).executable)),identity:"EXPLICIT_REFERENCE_COOKIE_BRIDGE",cors:"LOOPBACK_PROXY_SUBSTITUTION",businessWrites:"LOCAL_REFERENCE_C05_DRAFT_STATIC_BACKTEST_RELEASE_SUBMISSION_WITH_C08_TEST_CONTROL",realIdp:"NOT_RUN",realCookieCors:"NOT_RUN",rows},null,2));
  59 |  await context.close();for (const s of streams) s.destroy();streams.clear();proxy.closeAllConnections();if (child?.exitCode === null) {child.kill();await new Promise(r => child.once("close",r));}
  60 | });
  61 | test.afterAll(async () => {proxy.closeAllConnections();await new Promise<void>(r => proxy.close(() => r()));await rm(scratch,{recursive:true,force:true});});
  62 | 
  63 | }
  64 | 
  65 | export async function advance(seconds:number){const r=await fetch(controlOrigin+"/advance",{method:"POST",headers:{"content-type":"application/json","x-g3-owned-control":"1"},body:JSON.stringify({seconds})});expect(r.status).toBe(204);}
  66 | export async function decide(approvalId:string,decision:"approve"|"reject"="approve",copies=1){const opts={method:"POST" as const,session:"session-approver" as const},mfa=await control('/v1/auth/mfa/challenges',{purpose:'security_change',code:'123456'},undefined,opts);expect(mfa.status).toBe(200);const step=await control('/v1/auth/reauth',{challengeRef:mfa.body.challengeRef},undefined,opts);expect(step.status).toBe(200);return Promise.all(Array.from({length:copies},()=>control(`/v1/approvals/${approvalId}/decisions`,{decision,mfaChallengeRef:mfa.body.challengeRef,reauthTokenRef:step.body.reauthTokenRef},'0',opts)));}
  67 | 
```