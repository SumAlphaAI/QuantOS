# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui507.spec.ts >> Audit search, causation chain, UI-created export, attachment and correlated audit
- Location: tests/e2e/ui507.spec.ts:54:5

# Error details

```
Error: expect(received).toContain(expected) // indexOf

Expected substring: "UI507 restricted copy"
Received string:    "{\"redactionPolicy\":\"audit-v1\",\"watermark\":\"QuantOS restricted copy 9ec25df9c923\"}
{\"actor\":\"quantos-service\",\"auditRef\":\"01a1641b-4072-72c0-a121-3b2c057cef20\",\"correlationId\":\"aaaaaaaa-1111-4111-8111-111111111111\",\"eventId\":\"00000000-0000-4000-8000-000000000001\",\"kind\":\"snapshot.captured\",\"objectRef\":\"snapshot\",\"occurredAt\":\"2026-09-16T10:00:00Z\",\"payloadHash\":\"sha256:e804b507fff4e3ab2a76d239994ba6b4e55ba7b4bd6fb0ef590f30385602cead\",\"redactedPayload\":{\"account\":\"acct-…xxx\",\"redactionSummary\":\"[REDACTED]\"},\"redactionApplied\":true,\"retentionUntil\":\"2027-09-16T10:00:00Z\",\"route\":\"/data-snapshots/snapshot-1\",\"sequence\":1}
{\"actor\":\"quantos-service\",\"auditRef\":\"01a1641b-4072-72c0-a121-3b3ccb5d91c4\",\"causationId\":\"00000000-0000-4000-8000-000000000001\",\"correlationId\":\"aaaaaaaa-1111-4111-8111-111111111111\",\"eventId\":\"00000000-0000-4000-8000-000000000002\",\"kind\":\"release.created\",\"objectRef\":\"release\",\"occurredAt\":\"2026-09-16T10:00:01Z\",\"payloadHash\":\"sha256:e804b507fff4e3ab2a76d239994ba6b4e55ba7b4bd6fb0ef590f30385602cead\",\"redactedPayload\":{\"account\":\"acct-…xxx\",\"redactionSummary\":\"[REDACTED]\"},\"redactionApplied\":true,\"retentionUntil\":\"2027-09-16T10:00:00Z\",\"route\":\"/releases/release-1\",\"sequence\":2}
{\"actor\":\"quantos-service\",\"auditRef\":\"01a1641b-4072-72c0-a121-3b4bd90bc04b\",\"causationId\":\"00000000-0000-4000-8000-000000000002\",\"correlationId\":\"aaaaaaaa-1111-4111-8111-111111111111\",\"eventId\":\"00000000-0000-4000-8000-000000000003\",\"kind\":\"proposal.created\",\"objectRef\":\"proposal\",\"occurredAt\":\"2026-09-16T10:00:02Z\",\"payloadHash\":\"sha256:e804b507fff4e3ab2a76d239994ba6b4e55ba7b4bd6fb0ef590f30385602cead\",\"redactedPayload\":{\"account\":\"acct-…xxx\",\"redactionSummary\":\"[REDACTED]\"},\"redactionApplied\":true,\"retentionUntil\":\"2027-09-16T10:00:00Z\",\"route\":\"/proposals/proposal-1\",\"sequence\":3}
{\"actor\":\"quantos-service\",\"auditRef\":\"01a1641b-4072-72c0-a121-3b53776c6afc\",\"causationId\":\"00000000-0000-4000-8000-000000000003\",\"correlationId\":\"aaaaaaaa-1111-4111-8111-111111111111\",\"eventId\":\"00000000-0000-4000-8000-000000000004\",\"kind\":\"risk.decided\",\"objectRef\":\"risk-decision\",\"occurredAt\":\"2026-09-16T10:00:03Z\",\"payloadHash\":\"sha256:e804b507fff4e3ab2a76d239994ba6b4e55ba7b4bd6fb0ef590f30385602cead\",\"redactedPayload\":{\"account\":\"acct-…xxx\",\"redactionSummary\":\"[REDACTED]\"},\"redactionApplied\":true,\"retentionUntil\":\"2027-09-16T10:00:00Z\",\"route\":\"/approvals/approval-1\",\"sequence\":4}
{\"actor\":\"quantos-service\",\"auditRef\":\"01a1641b-4072-72c0-a121-3b6dad76e96d\",\"causationId\":\"00000000-0000-4000-8000-000000000004\",\"correlationId\":\"aaaaaaaa-1111-4111-8111-111111111111\",\"eventId\":\"00000000-0000-4000-8000-000000000005\",\"kind\":\"approval.granted\",\"objectRef\":\"approval\",\"occurredAt\":\"2026-09-16T10:00:04Z\",\"payloadHash\":\"sha256:e804b507fff4e3ab2a76d239994ba6b4e55ba7b4bd6fb0ef590f30385602cead\",\"redactedPayload\":{\"account\":\"acct-…xxx\",\"redactionSummary\":\"[REDACTED]\"},\"redactionApplied\":true,\"retentionUntil\":\"2027-09-16T10:00:00Z\",\"route\":\"/approvals/approval-1\",\"sequence\":5}
{\"actor\":\"quantos-service\",\"auditRef\":\"01a1641b-4072-72c0-a121-3b7e4f9fed32\",\"causationId\":\"00000000-0000-4000-8000-000000000005\",\"correlationId\":\"aaaaaaaa-1111-4111-8111-111111111111\",\"eventId\":\"00000000-0000-4000-8000-000000000006\",\"kind\":\"command.issued\",\"objectRef\":\"command\",\"occurredAt\":\"2026-09-16T10:00:05Z\",\"payloadHash\":\"sha256:e804b507fff4e3ab2a76d239994ba6b4e55ba7b4bd6fb0ef590f30385602cead\",\"redactedPayload\":{\"account\":\"acct-…xxx\",\"redactionSummary\":\"[REDACTED]\"},\"redactionApplied\":true,\"retentionUntil\":\"2027-09-16T10:00:00Z\",\"route\":\"/orders/order-1\",\"sequence\":6}
{\"actor\":\"quantos-service\",\"auditRef\":\"01a1641b-4072-72c0-a121-3b88ef9f1a5d\",\"causationId\":\"00000000-0000-4000-8000-000000000006\",\"correlationId\":\"aaaaaaaa-1111-4111-8111-111111111111\",\"eventId\":\"00000000-0000-4000-8000-000000000007\",\"kind\":\"order.accepted\",\"objectRef\":\"order\",\"occurredAt\":\"2026-09-16T10:00:06Z\",\"payloadHash\":\"sha256:e804b507fff4e3ab2a76d239994ba6b4e55ba7b4bd6fb0ef590f30385602cead\",\"redactedPayload\":{\"account\":\"acct-…xxx\",\"redactionSummary\":\"[REDACTED]\"},\"redactionApplied\":true,\"retentionUntil\":\"2027-09-16T10:00:00Z\",\"route\":\"/orders/order-1\",\"sequence\":7}
{\"actor\":\"quantos-service\",\"auditRef\":\"01a1641b-4072-72c0-a121-3b989c82a38c\",\"causationId\":\"00000000-0000-4000-8000-000000000007\",\"correlationId\":\"aaaaaaaa-1111-4111-8111-111111111111\",\"eventId\":\"00000000-0000-4000-8000-000000000008\",\"kind\":\"fill.recorded\",\"objectRef\":\"fill\",\"occurredAt\":\"2026-09-16T10:00:07Z\",\"payloadHash\":\"sha256:e804b507fff4e3ab2a76d239994ba6b4e55ba7b4bd6fb0ef590f30385602cead\",\"redactedPayload\":{\"account\":\"acct-…xxx\",\"redactionSummary\":\"[REDACTED]\"},\"redactionApplied\":true,\"retentionUntil\":\"2027-09-16T10:00:00Z\",\"route\":\"/orders/order-1\",\"sequence\":8}
"
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
  11 | const origin="https://127.0.0.1:4010",terminal="http://localhost:3190",csrf="csrf-token-0000000000000001",correlation="aaaaaaaa-1111-4111-8111-111111111111";
  12 | const hash=(b:Buffer|string)=>createHash("sha256").update(b).digest("hex");
  13 | type Row={method:string;path:string;status:number;source:string;port:string;query?:string;keyHash?:string;bodyHash?:string;responseHash?:string;correlationId?:string;size?:number;sha256?:string};
  14 | let rows:Row[]=[],child:ChildProcess,port:number,scratch:string,identity="session-current",dropCreate=false,breakStream=false;
  15 | const streams=new Set<ServerResponse>();
  16 | const proxy=createServer({},async(req,res)=>{
  17 |  const url=new URL(req.url!,origin),path=url.pathname,method=req.method!;
  18 |  for(const [k,v]of Object.entries({"access-control-allow-origin":terminal,"access-control-allow-credentials":"true","access-control-allow-headers":"content-type,x-csrf-token,x-request-id,idempotency-key,x-reauth-token-ref","access-control-allow-methods":"GET,POST,OPTIONS","cache-control":"no-store"}))res.setHeader(k,v);
  19 |  if(method==="OPTIONS"){res.writeHead(204);res.end();return;}
  20 |  const chunks:Buffer[]=[];for await(const b of req)chunks.push(Buffer.from(b));const body=Buffer.concat(chunks);
  21 |  const row:Row={method,path:path.startsWith("/_bff/export-content/")?"/_bff/export-content/{ticket}/{signature}":path,status:0,source:"REFERENCE_BYTES",port:req.headers["x-ui507-control"]?"NODE_CONTROL":"ACTUAL_BROWSER",query:url.search,bodyHash:hash(body)};rows.push(row);
  22 |  if(req.headers["idempotency-key"])row.keyHash=hash(String(req.headers["idempotency-key"]));
  23 |  if(path.endsWith("/stream")&&breakStream){row.status=503;row.source="SYNTHETIC_STREAM_FAILURE";res.writeHead(503);res.end();return;}
  24 |  const upstream=httpRequest({host:"127.0.0.1",port,path:req.url,method,headers:{...req.headers,cookie:`quantos_session=${identity}; quantos_csrf=${csrf}`,origin:terminal}},response=>{
  25 |   row.status=response.statusCode!;row.correlationId=response.headers["x-correlation-id"] as string|undefined;
  26 |   if(path.endsWith("/stream")){res.writeHead(row.status,{"content-type":"text/event-stream"});res.flushHeaders();streams.add(res);response.pipe(res);res.on("close",()=>{streams.delete(res);response.destroy();});return;}
  27 |   const output:Buffer[]=[];response.on("data",b=>output.push(Buffer.from(b)));response.on("end",()=>{
  28 |    const bytes=Buffer.concat(output);row.responseHash=hash(bytes);
  29 |    if(path.endsWith("/download")&&row.status===200){const m=JSON.parse(bytes.toString());row.sha256=m.sha256;row.size=m.sizeBytes;}
  30 |    if(path==="/v1/exports"&&method==="POST"&&dropCreate){dropCreate=false;row.source="REFERENCE_COMMITTED_RESPONSE_DROPPED";res.writeHead(row.status,{"content-type":"application/json","content-length":bytes.length+1});res.write(bytes.subarray(0,5));setTimeout(()=>res.destroy(),20);return;}
  31 |    for(const[k,v]of Object.entries(response.headers))if(v!==undefined&&!["connection","transfer-encoding","access-control-allow-origin"].includes(k))res.setHeader(k,v);
  32 |    res.writeHead(row.status);res.end(bytes);
  33 |   });
  34 |  });upstream.on("error",()=>{if(!res.headersSent)res.writeHead(502);res.end();});res.on("close",()=>upstream.destroy());upstream.end(body);
  35 | });
  36 | async function call(path:string){return new Promise<{status:number;body:{items:Array<{eventId:string;kind:string;causationId?:string;payloadHash:string;redactionApplied:boolean}>}}>((resolve,reject)=>{const req=httpsRequest(origin+path,{rejectUnauthorized:false,headers:{"x-ui507-control":"1"}},res=>{const parts:Buffer[]=[];res.on("data",b=>parts.push(Buffer.from(b)));res.on("end",()=>resolve({status:res.statusCode!,body:JSON.parse(Buffer.concat(parts).toString())}));});req.on("error",reject);req.end();});}
  37 | async function authorized(page:Page){await expect(page.locator('[data-route-access="authorized"]')).toBeVisible();}
  38 | async function create(page:Page){await page.getByLabel("导出 Correlation IDs（逗号分隔）").fill(correlation);await page.getByLabel("导出理由",{exact:true}).fill("UI507 controlled audit export");await page.getByLabel("水印",{exact:true}).fill("UI507 restricted copy");await page.getByLabel("MFA 验证码").fill("123456");await page.getByRole("button",{name:"确认创建导出",exact:true}).click();await expect(page.locator("[data-export-status]")).toHaveAttribute("data-export-status","queued");}
  39 | const exportWrites=()=>rows.filter(r=>r.path==="/v1/exports"&&r.method==="POST");
  40 | test.beforeAll(async()=>{
  41 |  expect(process.env.DATABASE_URL).toBeUndefined();expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();scratch=await mkdtemp(join(tmpdir(),"quantos-ui507-"));execFileSync("openssl",["req","-x509","-newkey","rsa:2048","-nodes","-keyout",join(scratch,"key.pem"),"-out",join(scratch,"cert.pem"),"-days","1","-subj","/CN=127.0.0.1","-addext","subjectAltName=IP:127.0.0.1"],{stdio:"ignore"});proxy.setSecureContext({key:await readFile(join(scratch,"key.pem")),cert:await readFile(join(scratch,"cert.pem"))});await new Promise<void>(r=>proxy.listen(4010,"127.0.0.1",r));
  42 | });
  43 | test.beforeEach(async({context,page})=>{
  44 |  rows=[];identity="session-current";dropCreate=false;breakStream=false;
  45 |  await context.addCookies([{name:"quantos_csrf",value:csrf,url:terminal}]);await context.route("**/*",route=>["localhost","127.0.0.1"].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());
  46 |  const reserved=tcpServer();await new Promise<void>(r=>reserved.listen(0,"127.0.0.1",r));port=(reserved.address()as{port:number}).port;await new Promise<void>(r=>reserved.close(()=>r()));
  47 |  child=spawn(resolve("target/debug/bff-gateway"),[],{env:{PATH:process.env.PATH,HOME:process.env.HOME,QUANTOS_SKIP_ENV:"1",QUANTOS_BFF_MODE:"reference",QUANTOS_BFF_BIND:`127.0.0.1:${port}`,QUANTOS_BFF_PUBLIC_ORIGIN:origin},stdio:["ignore","pipe","pipe"]});await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error("reference startup timeout")),15000);child.once("error",e=>{clearTimeout(timer);reject(e);});child.stdout!.on("data",b=>{if(String(b).includes('"ready":true')){clearTimeout(timer);resolve();}});});await page.bringToFront();
  48 | });
  49 | test.afterEach(async({context},info)=>{
  50 |  await context.close();for(const s of streams)s.destroy();streams.clear();proxy.closeAllConnections();if(child?.exitCode===null){child.kill();await new Promise(r=>child.once("close",r));}
  51 |  const file=info.outputPath("ui507.json");await writeFile(file,JSON.stringify({schema:"quantos-ui507-browser/v1",scenario:info.title,status:info.status,sourceCommit:process.env.GITHUB_SHA,binarySha256:hash(await readFile("target/debug/bff-gateway")),identity:"EXPLICIT_REFERENCE_COOKIE_BRIDGE",cors:"LOOPBACK_PROXY_SUBSTITUTION",actualExportCreation:"BROWSER_MFA_REAUTH_CREATE",realIdp:"NOT_RUN",realCookieCors:"NOT_RUN",firefox:"BLOCKED_ENVIRONMENT",webKitAttachment:"BLOCKED_ENVIRONMENT_TEST_INTERCEPTION",rows},null,2));await info.attach("ui507",{path:file,contentType:"application/json"});
  52 | });
  53 | test.afterAll(async()=>{proxy.closeAllConnections();await new Promise<void>(r=>proxy.close(()=>r()));await rm(scratch,{recursive:true,force:true});});
  54 | test("Audit search, causation chain, UI-created export, attachment and correlated audit",async({page})=>{
  55 |  await page.goto("/audit");await authorized(page);await expect(page.getByRole("table",{name:"审计事件"})).toBeVisible();await page.getByLabel("Correlation ID",{exact:true}).fill(correlation);await page.getByRole("button",{name:"搜索",exact:true}).click();await expect(page.getByRole("status")).toHaveText("");await expect(page.getByRole("button",{name:"查看因果链",exact:true}).first()).toBeVisible();await page.getByRole("button",{name:"查看因果链",exact:true}).first().click();await expect(page.getByText("当前授权范围内链完整",{exact:true})).toBeVisible();await expect(page.getByRole("region",{name:"因果证据链"}).locator("li")).toHaveCount(8);
  56 |  await create(page);expect(exportWrites()).toHaveLength(1);await expect(page.getByLabel("MFA 验证码")).toHaveValue("");expect(rows.filter(r=>r.path.endsWith("/download"))).toHaveLength(0);await expect(page.getByRole("button",{name:"申请短时下载",exact:true})).toBeDisabled();await page.getByRole("button",{name:"查询作业状态",exact:true}).click();await expect(page.locator('[data-export-status="ready"]')).toBeVisible();
> 57 |  const received=page.waitForEvent("download");await page.getByRole("button",{name:"申请短时下载",exact:true}).click();const download=await received;expect(await download.failure()).toBeNull();const bytes=await readFile((await download.path())!);expect(bytes.toString()).toContain("UI507 restricted copy");const metadata=rows.find(r=>r.path.endsWith("/download"))!;expect(hash(bytes)).toBe(metadata.sha256);expect(bytes.length).toBe(metadata.size);expect(rows.find(r=>r.path.startsWith("/_bff/export-content/"))?.responseHash).toBe(metadata.sha256);await expect(page.getByRole("status")).toContainText("已交给浏览器接收");expect(await page.locator('a[href*="/_bff/export-content/"]').count()).toBe(0);expect(await page.evaluate(()=>JSON.stringify([localStorage,sessionStorage]))).not.toContain("/_bff/export-content/");
     |                                                                                                                                                                                                                                                                         ^ Error: expect(received).toContain(expected) // indexOf
  58 |  await page.getByRole("link",{name:"查看导出审计链",exact:true}).click();await authorized(page);await expect(page.getByText("当前授权范围内链完整",{exact:true})).toBeVisible();const audit=await call("/v1/audit/events?kind=export.created");expect(audit.status).toBe(200);expect(audit.body.items).toHaveLength(1);const consumed=await call("/v1/audit/events?kind=export.download_consumed");expect(consumed.body.items).toHaveLength(1);
  59 |  await page.screenshot({path:test.info().outputPath("audit-chain.png"),fullPage:true});
  60 | });
  61 | test("cancel uses MFA and accepted response stays non-downloadable",async({page})=>{
  62 |  await page.goto("/exports");await authorized(page);await create(page);await page.getByLabel("MFA 验证码").fill("123456");await page.getByRole("button",{name:"确认取消导出（使用 MFA）",exact:true}).click();await expect(page.locator('[data-export-status="cancelled"]')).toBeVisible();await page.getByRole("button",{name:"查询作业状态",exact:true}).click();await expect(page.locator('[data-export-status="cancelled"]')).toBeVisible();await expect(page.getByRole("button",{name:"申请短时下载",exact:true})).toBeDisabled();expect(rows.filter(r=>r.path.endsWith("/download"))).toHaveLength(0);expect((await call("/v1/audit/events?kind=export.cancelled")).body.items).toHaveLength(1);
  63 | });
  64 | test("lost create response requires explicit identical-intent retry with same key",async({page})=>{
  65 |  await page.goto("/exports");await authorized(page);dropCreate=true;await page.getByLabel("导出 Correlation IDs（逗号分隔）").fill(correlation);await page.getByLabel("导出理由",{exact:true}).fill("UI507 unknown outcome export");await page.getByLabel("水印",{exact:true}).fill("UI507 restricted copy");await page.getByLabel("MFA 验证码").fill("123456");await page.getByRole("button",{name:"确认创建导出",exact:true}).click();await expect(page.getByRole("status")).toContainText("请求结果未知");await page.waitForTimeout(200);expect(exportWrites()).toHaveLength(1);await expect(page.getByLabel("导出理由",{exact:true})).toBeDisabled();await page.getByLabel("MFA 验证码").fill("123456");await page.getByRole("button",{name:"确认创建导出",exact:true}).click();await expect(page.locator('[data-export-status="queued"]')).toBeVisible();expect(exportWrites()).toHaveLength(2);expect(exportWrites()[0].keyHash).toBe(exportWrites()[1].keyHash);expect(exportWrites()[0].bodyHash).toBe(exportWrites()[1].bodyHash);expect((await call("/v1/audit/events?kind=export.created")).body.items).toHaveLength(1);
  66 | });
  67 | test("stream disconnect and offline clear private UI; fresh recovery never replays writes",async({page,context})=>{
  68 |  await page.goto("/audit");await authorized(page);await expect(page.getByRole("table",{name:"审计事件"})).toBeVisible();await page.getByLabel("导出理由",{exact:true}).fill("Discard this private draft");breakStream=true;for(const s of streams)s.destroy();await expect(page.locator('[data-route-access="invalidated"]')).toBeVisible();await expect(page.getByRole("table")).toHaveCount(0);breakStream=false;await page.getByRole("button",{name:"重新验证访问条件",exact:true}).click();await authorized(page);await expect(page.getByLabel("导出理由",{exact:true})).toHaveValue("");await context.setOffline(true);await expect(page.locator('[data-route-access="invalidated"]')).toBeVisible();await context.setOffline(false);await page.getByRole("button",{name:"重新验证访问条件",exact:true}).click();await authorized(page);expect(exportWrites()).toHaveLength(0);
  69 | });
  70 | test("actual denied identity and concealed missing export never expose audit data",async({page})=>{
  71 |  identity="session-viewer";await page.goto("/audit");await expect(page).toHaveURL(/\/unauthorized$/);expect(rows.some(r=>r.path==="/v1/audit/events")).toBe(false);identity="session-current";await page.goto("/exports?exportId=99999999-1111-4111-8111-111111111111");await expect(page).toHaveURL(/\/unauthorized$/);expect(rows.some(r=>r.status===404&&r.path.includes("/exports/"))).toBe(true);expect(exportWrites()).toHaveLength(0);
  72 | });
  73 | test("mobile audit search remains usable and has no horizontal page overflow",async({page})=>{
  74 |  await page.setViewportSize({width:390,height:844});await page.goto("/audit");await authorized(page);await expect(page.getByRole("table",{name:"审计事件"})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.getByLabel("事件类型",{exact:true}).fill("does.not.exist");await page.getByRole("button",{name:"搜索",exact:true}).click();await expect(page.getByText("没有匹配的审计记录。",{exact:true})).toBeVisible();await page.screenshot({path:test.info().outputPath("audit-mobile.png"),fullPage:true});
  75 | });
  76 | 
```