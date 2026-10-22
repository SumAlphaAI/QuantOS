# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui-p12.spec.ts >> P12 UI only narrows export capability and never invents permission or progress
- Location: tests/e2e/ui-p12.spec.ts:18:5

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
  - heading "正在验证审计访问条件" [level=1]
  - paragraph: 正在验证会话、工作区和审计权限。
  - link "返回审计":
    - /url: /audit
- alert
```

# Test source

```ts
  1  | // Actual UI-507 routes and Rust reference bytes. Identity cookie / CORS are explicit local substitutes.
  2  | import {test,expect,type Page} from "@playwright/test";
  3  | import {spawn,execFileSync,type ChildProcess} from "node:child_process";
  4  | import {createServer as tcpServer} from "node:net";
  5  | import {createServer,request as httpsRequest} from "node:https";
  6  | import {request as httpRequest,type ServerResponse} from "node:http";
  7  | import {mkdtemp,readFile,writeFile,rm} from "node:fs/promises";
  8  | import {tmpdir} from "node:os";
  9  | import {resolve,join} from "node:path";
  10 | import {createHash} from "node:crypto";
  11 | export const origin="https://127.0.0.1:4010",terminal="http://localhost:3190",csrf="csrf-token-0000000000000001",correlation="aaaaaaaa-1111-4111-8111-111111111111";
  12 | const hash=(b:Buffer|string)=>createHash("sha256").update(b).digest("hex");
  13 | type Row={method:string;path:string;status:number;source:string;port:string;query?:string;keyHash?:string;bodyHash?:string;responseHash?:string;correlationId?:string;size?:number;sha256?:string};
  14 | let rows:Row[]=[],child:ChildProcess,port:number,scratch:string,identity="session-current",dropCreate=false,breakStream=false,readonlyAudit=false,slowSession=false,auditFailures=0;
  15 | const streams=new Set<ServerResponse>();
  16 | const proxy=createServer({},async(req,res)=>{
  17 |  const url=new URL(req.url!,origin),path=url.pathname,method=req.method!;
  18 |  for(const [k,v]of Object.entries({"access-control-allow-origin":terminal,"access-control-allow-credentials":"true","access-control-allow-headers":"content-type,x-csrf-token,x-request-id,idempotency-key,x-reauth-token-ref","access-control-allow-methods":"GET,POST,OPTIONS","cache-control":"no-store"}))res.setHeader(k,v);
  19 |  if(method==="OPTIONS"){res.writeHead(204);res.end();return;}
  20 |  const chunks:Buffer[]=[];for await(const b of req)chunks.push(Buffer.from(b));const body=Buffer.concat(chunks);
  21 |  if(path==="/v1/audit/events"&&auditFailures>0){auditFailures--;rows.push({method,path,status:503,source:"SYNTHETIC_AUDIT_503",port:"ACTUAL_BROWSER"});res.writeHead(503,{"content-type":"application/json"});res.end(JSON.stringify({code:"UNAVAILABLE",message:"Unavailable",correlationId:correlation}));return;}
  22 |  const row:Row={method,path:path.startsWith("/_bff/export-content/")?"/_bff/export-content/{ticket}/{signature}":path,status:0,source:"REFERENCE_BYTES",port:req.headers["x-ui-p12-control"]?"NODE_CONTROL":"ACTUAL_BROWSER",query:url.search,bodyHash:hash(body)};rows.push(row);
  23 |  if(req.headers["idempotency-key"])row.keyHash=hash(String(req.headers["idempotency-key"]));
  24 |  if(path.endsWith("/stream")&&breakStream){row.status=503;row.source="SYNTHETIC_STREAM_FAILURE";res.writeHead(503);res.end();return;}
  25 |  const upstream=httpRequest({host:"127.0.0.1",port,path:req.url,method,headers:{...req.headers,cookie:`quantos_session=${identity}; quantos_csrf=${csrf}`,origin:terminal}},response=>{
  26 |   row.status=response.statusCode!;row.correlationId=response.headers["x-correlation-id"] as string|undefined;
  27 |   if(path.endsWith("/stream")){res.writeHead(row.status,{"content-type":"text/event-stream"});res.flushHeaders();streams.add(res);response.pipe(res);res.on("close",()=>{streams.delete(res);response.destroy();});return;}
  28 |   const output:Buffer[]=[];response.on("data",b=>output.push(Buffer.from(b)));response.on("end",()=>{
  29 |    let bytes=Buffer.concat(output);if(readonlyAudit&&["/v1/session","/v1/context"].includes(path)&&row.status===200){const c=JSON.parse(bytes.toString());c.capabilities=c.capabilities.filter((v:string)=>v!=="audit:export");bytes=Buffer.from(JSON.stringify(c));row.source="SYNTHETIC_CAPABILITY_NARROWING";}row.responseHash=hash(bytes);
  30 |    if(path.endsWith("/download")&&row.status===200){const m=JSON.parse(bytes.toString());row.sha256=m.sha256;row.size=m.sizeBytes;}
  31 |    if(path==="/v1/exports"&&method==="POST"&&dropCreate){dropCreate=false;row.source="REFERENCE_COMMITTED_RESPONSE_DROPPED";res.writeHead(row.status,{"content-type":"application/json","content-length":bytes.length+1});res.write(bytes.subarray(0,5));setTimeout(()=>res.destroy(),20);return;}
  32 |    for(const[k,v]of Object.entries(response.headers))if(v!==undefined&&!["connection","transfer-encoding","access-control-allow-origin"].includes(k))res.setHeader(k,v);
  33 |    res.writeHead(row.status);if(slowSession&&path==="/v1/session"){row.source="REFERENCE_BYTES_DELAYED_800MS";setTimeout(()=>res.end(bytes),800);}else res.end(bytes);
  34 |   });
  35 |  });upstream.on("error",()=>{if(!res.headersSent)res.writeHead(502);res.end();});res.on("close",()=>upstream.destroy());upstream.end(body);
  36 | });
  37 | export async function call(path:string){return new Promise<{status:number;body:{items:Array<{eventId:string;kind:string;causationId?:string;payloadHash:string;redactionApplied:boolean}>}}>((resolve,reject)=>{const req=httpsRequest(origin+path,{rejectUnauthorized:false,headers:{"x-ui-p12-control":"1"}},res=>{const parts:Buffer[]=[];res.on("data",b=>parts.push(Buffer.from(b)));res.on("end",()=>resolve({status:res.statusCode!,body:JSON.parse(Buffer.concat(parts).toString())}));});req.on("error",reject);req.end();});}
> 38 | export async function authorized(page:Page){await expect(page.locator('[data-route-access="authorized"]')).toBeVisible();}
     |                                                                                                            ^ Error: expect(locator).toBeVisible() failed
  39 | export async function create(page:Page){await page.getByLabel("导出 Correlation IDs（逗号分隔）").fill(correlation);await page.getByLabel("导出理由",{exact:true}).fill("P12 controlled audit export");await page.getByLabel("水印",{exact:true}).fill("P12 restricted copy");await page.getByLabel("MFA 验证码").fill("123456");await page.getByRole("button",{name:"确认创建导出",exact:true}).click();await expect(page.locator("[data-export-status]")).toHaveAttribute("data-export-status","queued");}
  40 | export const exportWrites=()=>rows.filter(r=>r.path==="/v1/exports"&&r.method==="POST");
  41 | test.beforeAll(async()=>{
  42 |  expect(process.env.DATABASE_URL).toBeUndefined();expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();scratch=await mkdtemp(join(tmpdir(),"quantos-ui-p12-"));execFileSync("openssl",["req","-x509","-newkey","rsa:2048","-nodes","-keyout",join(scratch,"key.pem"),"-out",join(scratch,"cert.pem"),"-days","1","-subj","/CN=127.0.0.1","-addext","subjectAltName=IP:127.0.0.1"],{stdio:"ignore"});proxy.setSecureContext({key:await readFile(join(scratch,"key.pem")),cert:await readFile(join(scratch,"cert.pem"))});await new Promise<void>(r=>proxy.listen(4010,"127.0.0.1",r));
  43 | });
  44 | test.beforeEach(async({context,page})=>{
  45 |  rows=[];identity="session-current";dropCreate=false;breakStream=false;readonlyAudit=false;slowSession=false;auditFailures=0;
  46 |  await context.addCookies([{name:"quantos_csrf",value:csrf,url:terminal}]);await context.route("**/*",route=>["localhost","127.0.0.1"].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());
  47 |  const reserved=tcpServer();await new Promise<void>(r=>reserved.listen(0,"127.0.0.1",r));port=(reserved.address()as{port:number}).port;await new Promise<void>(r=>reserved.close(()=>r()));
  48 |  child=spawn(resolve("target/debug/bff-gateway"),[],{env:{PATH:process.env.PATH,HOME:process.env.HOME,QUANTOS_SKIP_ENV:"1",QUANTOS_BFF_MODE:"reference",QUANTOS_BFF_BIND:`127.0.0.1:${port}`,QUANTOS_BFF_PUBLIC_ORIGIN:origin},stdio:["ignore","pipe","pipe"]});await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error("reference startup timeout")),15000);child.once("error",e=>{clearTimeout(timer);reject(e);});child.stdout!.on("data",b=>{if(String(b).includes('"ready":true')){clearTimeout(timer);resolve();}});});await page.bringToFront();
  49 | });
  50 | test.afterEach(async({context},info)=>{
  51 |  await context.close();for(const s of streams)s.destroy();streams.clear();proxy.closeAllConnections();if(child?.exitCode===null){child.kill();await new Promise(r=>child.once("close",r));}
  52 |  const file=info.outputPath("ui-p12.json");await writeFile(file,JSON.stringify({schema:"quantos-ui-p12-browser/v1",scenario:info.title,status:info.status,sourceCommit:process.env.GITHUB_SHA,binarySha256:hash(await readFile("target/debug/bff-gateway")),identity:"EXPLICIT_REFERENCE_COOKIE_BRIDGE",cors:"LOOPBACK_PROXY_SUBSTITUTION",actualExportCreation:"BROWSER_MFA_REAUTH_CREATE",realIdp:"NOT_RUN",realCookieCors:"NOT_RUN",firefox:"BLOCKED_ENVIRONMENT",webKitAttachment:"BLOCKED_ENVIRONMENT_TEST_INTERCEPTION",rows},null,2));await info.attach("ui-p12",{path:file,contentType:"application/json"});
  53 | });
  54 | test.afterAll(async()=>{proxy.closeAllConnections();await new Promise<void>(r=>proxy.close(()=>r()));await rm(scratch,{recursive:true,force:true});});
  55 | 
  56 | export const networkRows=()=>rows;
  57 | export function fault(options:{readonly?:boolean;slow?:boolean;auditFailures?:number;dropCreate?:boolean}){readonlyAudit=options.readonly??false;slowSession=options.slow??false;auditFailures=options.auditFailures??0;dropCreate=options.dropCreate??false;}
  58 | 
```