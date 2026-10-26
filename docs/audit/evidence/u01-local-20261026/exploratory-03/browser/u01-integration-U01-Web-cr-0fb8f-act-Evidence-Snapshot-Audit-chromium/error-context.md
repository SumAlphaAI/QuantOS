# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: u01-integration.spec.ts >> U01 Web create streams actual R03 RD-Agent output and resolves Artifact Evidence Snapshot Audit
- Location: tests/e2e/u01-integration.spec.ts:17:5

# Error details

```
SyntaxError: Unexpected end of JSON input
```

# Test source

```ts
  1  | // U01 actual reference C03/C04 bytes plus R03/RD-Agent; explicit identity/TLS/CORS substitutions.
  2  | import {test,expect,type Page} from "@playwright/test";
  3  | import {spawn,execFileSync,type ChildProcess} from "node:child_process";
  4  | import {createServer as reserveServer} from "node:net";
  5  | import {createServer,request as secureRequest} from "node:https";
  6  | import {request,type ServerResponse} from "node:http";
  7  | import {mkdtemp,readFile,writeFile,rm} from "node:fs/promises";
  8  | import {tmpdir} from "node:os";
  9  | import {join} from "node:path";
  10 | import {createHash} from "node:crypto";
  11 | const origin = "https://127.0.0.1:4010", terminal = "http://localhost:3190", csrf = "csrf-token-0000000000000001";
  12 | const hash = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
  13 | type Row = {method: string;path: string;status: number;source: string;control: boolean;keyHash?: string;bodyHash: string;version?: string;responseHash?: string};
  14 | let snapshot="";
  15 | export function snapshotId(){return snapshot;}
  16 | let controlOrigin="",hostLogs="",clockControls:unknown[]=[];
  17 | let rows: Row[] = [], child: ChildProcess, port: number, scratch: string, drop = false, readonly = false, invalid = false, empty = false, listError = false, slow = false;
  18 | const streams = new Set<ServerResponse>();
  19 | const proxy = createServer({},async (req,res) => {
  20 |  const path = new URL(req.url!,origin).pathname, method = req.method!;
  21 |  for (const [k,v] of Object.entries({"access-control-allow-origin":terminal,"access-control-allow-credentials":"true","access-control-allow-headers":"content-type,x-csrf-token,x-request-id,idempotency-key,if-match","access-control-allow-methods":"GET,PUT,POST,OPTIONS","cache-control":"no-store"})) res.setHeader(k,v);
  22 |  if (method === "OPTIONS") {res.writeHead(204);res.end();return;}
  23 |  const chunks: Buffer[] = [];for await (const b of req) chunks.push(Buffer.from(b));const body = Buffer.concat(chunks);
  24 |  const row: Row = {method,path,status:0,source:"REFERENCE_BYTES",control:Boolean(req.headers["x-u01-control"]),bodyHash:hash(body),version:req.headers["if-match"] as string | undefined,keyHash:req.headers["idempotency-key"] ? hash(String(req.headers["idempotency-key"])) : undefined};rows.push(row);
  25 |  if(method==="GET"&&path==="/v1/strategies"&&(empty||listError)){row.status=listError?503:200;row.source=listError?"SYNTHETIC_CATALOG_FAILURE":"SYNTHETIC_EMPTY_CATALOG";res.writeHead(row.status,{"content-type":"application/json"});res.end(JSON.stringify(listError?{code:"UNAVAILABLE",message:"private SQL",correlationId:"aaaaaaaa-1111-4111-8111-111111111111"}:{items:[]}));return;}
  26 | 
  27 |  if (invalid && method === "PUT") {row.status = 422;row.source = "SYNTHETIC_VALIDATION_REJECTION";res.writeHead(422,{"content-type":"application/json"});res.end(JSON.stringify({code:"INVALID_REQUEST",message:"private SQL must not display",correlationId:"aaaaaaaa-1111-4111-8111-111111111111"}));return;}
  28 |   const upstream = request({host:"127.0.0.1",port,path:req.url,method,headers:{...req.headers,cookie:`quantos_session=${row.control&&req.headers["x-u01-session"]==="session-approver"||readonly ? "session-approver" : "session-current"}; quantos_csrf=${csrf}`,origin:terminal}},response => {
  29 |   row.status = response.statusCode!;
  30 |   if (path.endsWith("/stream")) {res.writeHead(row.status,{"content-type":"text/event-stream"});res.flushHeaders();streams.add(res);response.pipe(res);res.on("close",() => {streams.delete(res);response.destroy();});return;}
  31 |   const output: Buffer[] = [];response.on("data",b => output.push(Buffer.from(b)));response.on("end",() => {
  32 |    const bytes = Buffer.concat(output);
  33 |    row.responseHash = hash(bytes);
  34 |    if (drop && (method === "PUT" && row.status === 200 || method === "POST" && [201,202].includes(row.status))) {drop = false;row.source = "REFERENCE_COMMITTED_RESPONSE_DROPPED";res.writeHead(row.status,{"content-type":"application/json","content-length":bytes.length+1});res.write(bytes.subarray(0,5));setTimeout(() => res.destroy(),20);return;}
  35 |    res.writeHead(row.status,{"content-type":"application/json","content-length":bytes.length});if(slow&&path==="/v1/session")setTimeout(()=>res.end(bytes),800);else res.end(bytes);
  36 |   });
  37 |  });upstream.on("error",() => {if (!res.headersSent) res.writeHead(502);res.end();});res.on("close",() => upstream.destroy());upstream.end(body);
  38 | });
  39 | export const networkRows = () => rows;
  40 | export function fault(options: {drop?: boolean;readonly?: boolean;invalid?: boolean;empty?:boolean;listError?:boolean;slow?:boolean}) {drop = options.drop ?? false;readonly = options.readonly ?? false;invalid = options.invalid ?? false;empty=options.empty??false;listError=options.listError??false;slow=options.slow??false;}
  41 | export async function control(path: string,body?: unknown,version?: string,options:{method?:"GET"|"PUT"|"POST";session?:"session-current"|"session-approver"}={}): Promise<{status: number;body: Record<string,unknown>}> {
  42 |  const method=options.method??(body?"PUT":"GET"),write=method!=="GET";
> 43 |  return new Promise((resolve,reject) => {const req = secureRequest(origin+path,{rejectUnauthorized:false,method,headers:{"x-u01-control":"1","x-u01-session":options.session??"session-current",...(write? {"content-type":"application/json",...(version?{"if-match":version}:{}),"idempotency-key":crypto.randomUUID(),"x-request-id":crypto.randomUUID(),"x-csrf-token":csrf} : {})}},res => {const parts: Buffer[] = [];res.on("data",b => parts.push(Buffer.from(b)));res.on("end",() => resolve({status:res.statusCode!,body:JSON.parse(Buffer.concat(parts).toString())}));});req.on("error",reject);req.end(body ? JSON.stringify(body) : undefined);});
     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         ^ SyntaxError: Unexpected end of JSON input
  44 | }
  45 | export async function authorized(page: Page) {await expect(page.locator('[data-route-access="authorized"]')).toBeVisible();}
  46 | export function installReferenceHooks(){
  47 | test.beforeAll(async () => {
  48 |  expect(process.env.DATABASE_URL).toBeUndefined();expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();scratch = await mkdtemp(join(tmpdir(),"quantos-u01-"));execFileSync("openssl",["req","-x509","-newkey","rsa:2048","-nodes","-keyout",join(scratch,"key.pem"),"-out",join(scratch,"cert.pem"),"-days","1","-subj","/CN=127.0.0.1","-addext","subjectAltName=IP:127.0.0.1"],{stdio:"ignore"});proxy.setSecureContext({key:await readFile(join(scratch,"key.pem")),cert:await readFile(join(scratch,"cert.pem"))});await new Promise<void>(r => proxy.listen(4010,"127.0.0.1",r));
  49 | });
  50 | test.beforeEach(async ({context,page}) => {
  51 |  page.on("dialog",dialog => dialog.type() === "beforeunload" ? dialog.accept() : dialog.dismiss());
  52 |  rows = [];snapshot="";hostLogs="";clockControls=[];fault({});await context.addCookies([{name:"quantos_csrf",value:csrf,url:terminal}]);await context.route("**/*",route => ["localhost","127.0.0.1"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
  53 |  const reserve = reserveServer();await new Promise<void>(r => reserve.listen(0,"127.0.0.1",r));port = (reserve.address() as {port: number}).port;await new Promise<void>(r => reserve.close(() => r()));
  54 |  child = spawn(JSON.parse(await readFile(process.env.QUANTOS_U01_HOST_RECEIPT!,"utf8")).executable,["u01::browser_host","--exact","--ignored","--nocapture"],{env:{PATH:process.env.PATH,HOME:process.env.HOME,GITHUB_SHA:process.env.GITHUB_SHA,QUANTOS_U01_HOST:"1",QUANTOS_SKIP_ENV:"1",QUANTOS_BFF_MODE:"reference",QUANTOS_BFF_BIND:`127.0.0.1:${port}`,QUANTOS_BFF_PUBLIC_ORIGIN:origin},detached:true,stdio:["ignore","pipe","pipe"]});
  55 |  await new Promise<void>((done,reject)=>{let buffer="";const timer=setTimeout(()=>reject(Error("reference startup timeout")),15000);child.once("error",e=>{clearTimeout(timer);reject(e);});child.once("exit",code=>{clearTimeout(timer);reject(Error(`reference exited ${code}: ${hostLogs.slice(-2000)}`));});child.stderr!.on("data",b=>{hostLogs+=String(b);});child.stdout!.on("data",b=>{hostLogs+=String(b);buffer+=String(b);let i;while((i=buffer.indexOf("\n"))>=0){const line=buffer.slice(0,i);buffer=buffer.slice(i+1);let status;try{status=JSON.parse(line);}catch{continue;}if(status.ready){snapshot=status.snapshotId;controlOrigin=status.control;clearTimeout(timer);done();}}});});await page.bringToFront();
  56 | });
  57 | test.afterEach(async ({context,page},info) => {
  58 |  if (info.status !== "passed" && !page.isClosed()) {await writeFile(info.outputPath("page-state.txt"),await page.locator("main").innerText({timeout:1000}).catch(() => "unavailable"));await page.screenshot({path:info.outputPath("failure.png"),fullPage:true,timeout:5000}).catch(() => {});}
  59 |  await writeFile(info.outputPath("u01-network.json"),JSON.stringify({schema:"quantos-u01-browser/v1",scenario:info.title,ownedClockControls:clockControls,status:info.status,sourceCommit:process.env.GITHUB_SHA,binarySha256:hash(await readFile(JSON.parse(await readFile(process.env.QUANTOS_U01_HOST_RECEIPT!,"utf8")).executable)),identity:"EXPLICIT_REFERENCE_COOKIE_BRIDGE",cors:"LOOPBACK_PROXY_SUBSTITUTION",businessWrites:"REFERENCE_C03_INTENT_TO_ACTUAL_R03_RD_AGENT_OWNED_MEMORY",realIdp:"NOT_RUN",realCookieCors:"NOT_RUN",rows},null,2));
  60 |  await writeFile(info.outputPath("u01-host.log"),hostLogs);await context.close();for (const s of streams) s.destroy();streams.clear();proxy.closeAllConnections();if (child?.exitCode === null) {process.kill(-child.pid!,"SIGTERM");await new Promise(r => child.once("close",r));}
  61 | });
  62 | test.afterAll(async () => {proxy.closeAllConnections();await new Promise<void>(r => proxy.close(() => r()));await rm(scratch,{recursive:true,force:true});});
  63 | 
  64 | }
  65 | 
  66 | export async function executeWorker(){const r=await fetch(controlOrigin+"/execute",{method:"POST",headers:{"x-u01-owned-control":"1"}});expect(r.status).toBe(200);return await r.json();}
  67 | 
```