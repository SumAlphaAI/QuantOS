// Actual UI-507 routes and Rust reference bytes. Identity cookie / CORS are explicit local substitutes.
import {test,expect,type Page} from "@playwright/test";
import {spawn,execFileSync,type ChildProcess} from "node:child_process";
import {createServer as tcpServer} from "node:net";
import {createServer,request as httpsRequest} from "node:https";
import {request as httpRequest,type ServerResponse} from "node:http";
import {mkdtemp,readFile,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {resolve,join} from "node:path";
import {createHash} from "node:crypto";
const origin="https://127.0.0.1:4010",terminal="http://localhost:3190",csrf="csrf-token-0000000000000001",correlation="aaaaaaaa-1111-4111-8111-111111111111";
const hash=(b:Buffer|string)=>createHash("sha256").update(b).digest("hex");
type Row={method:string;path:string;status:number;source:string;port:string;query?:string;keyHash?:string;bodyHash?:string;responseHash?:string;correlationId?:string;size?:number;sha256?:string};
let rows:Row[]=[],child:ChildProcess,port:number,scratch:string,identity="session-current",dropCreate=false,breakStream=false;
const streams=new Set<ServerResponse>();
const proxy=createServer({},async(req,res)=>{
 const url=new URL(req.url!,origin),path=url.pathname,method=req.method!;
 for(const [k,v]of Object.entries({"access-control-allow-origin":terminal,"access-control-allow-credentials":"true","access-control-allow-headers":"content-type,x-csrf-token,x-request-id,idempotency-key,x-reauth-token-ref","access-control-allow-methods":"GET,POST,OPTIONS","cache-control":"no-store"}))res.setHeader(k,v);
 if(method==="OPTIONS"){res.writeHead(204);res.end();return;}
 const chunks:Buffer[]=[];for await(const b of req)chunks.push(Buffer.from(b));const body=Buffer.concat(chunks);
 const row:Row={method,path:path.startsWith("/_bff/export-content/")?"/_bff/export-content/{ticket}/{signature}":path,status:0,source:"REFERENCE_BYTES",port:req.headers["x-ui507-control"]?"NODE_CONTROL":"ACTUAL_BROWSER",query:url.search,bodyHash:hash(body)};rows.push(row);
 if(req.headers["idempotency-key"])row.keyHash=hash(String(req.headers["idempotency-key"]));
 if(path.endsWith("/stream")&&breakStream){row.status=503;row.source="SYNTHETIC_STREAM_FAILURE";res.writeHead(503);res.end();return;}
 const upstream=httpRequest({host:"127.0.0.1",port,path:req.url,method,headers:{...req.headers,cookie:`quantos_session=${identity}; quantos_csrf=${csrf}`,origin:terminal}},response=>{
  row.status=response.statusCode!;row.correlationId=response.headers["x-correlation-id"] as string|undefined;
  if(path.endsWith("/stream")){res.writeHead(row.status,{"content-type":"text/event-stream"});res.flushHeaders();streams.add(res);response.pipe(res);res.on("close",()=>{streams.delete(res);response.destroy();});return;}
  const output:Buffer[]=[];response.on("data",b=>output.push(Buffer.from(b)));response.on("end",()=>{
   const bytes=Buffer.concat(output);row.responseHash=hash(bytes);
   if(path.endsWith("/download")&&row.status===200){const m=JSON.parse(bytes.toString());row.sha256=m.sha256;row.size=m.sizeBytes;}
   if(path==="/v1/exports"&&method==="POST"&&dropCreate){dropCreate=false;row.source="REFERENCE_COMMITTED_RESPONSE_DROPPED";res.writeHead(row.status,{"content-type":"application/json","content-length":bytes.length+1});res.write(bytes.subarray(0,5));setTimeout(()=>res.destroy(),20);return;}
   for(const[k,v]of Object.entries(response.headers))if(v!==undefined&&!["connection","transfer-encoding","access-control-allow-origin"].includes(k))res.setHeader(k,v);
   res.writeHead(row.status);res.end(bytes);
  });
 });upstream.on("error",()=>{if(!res.headersSent)res.writeHead(502);res.end();});res.on("close",()=>upstream.destroy());upstream.end(body);
});
async function call(path:string){return new Promise<{status:number;body:{items:Array<{eventId:string;kind:string;causationId?:string;payloadHash:string;redactionApplied:boolean}>}}>((resolve,reject)=>{const req=httpsRequest(origin+path,{rejectUnauthorized:false,headers:{"x-ui507-control":"1"}},res=>{const parts:Buffer[]=[];res.on("data",b=>parts.push(Buffer.from(b)));res.on("end",()=>resolve({status:res.statusCode!,body:JSON.parse(Buffer.concat(parts).toString())}));});req.on("error",reject);req.end();});}
async function authorized(page:Page){await expect(page.locator('[data-route-access="authorized"]')).toBeVisible();}
async function create(page:Page){await page.getByLabel("导出 Correlation IDs（逗号分隔）").fill(correlation);await page.getByLabel("导出理由",{exact:true}).fill("UI507 controlled audit export");await page.getByLabel("水印",{exact:true}).fill("UI507 restricted copy");await page.getByLabel("MFA 验证码").fill("123456");await page.getByRole("button",{name:"确认创建导出",exact:true}).click();await expect(page.locator("[data-export-status]")).toHaveAttribute("data-export-status","queued");}
const exportWrites=()=>rows.filter(r=>r.path==="/v1/exports"&&r.method==="POST");
test.beforeAll(async()=>{
 expect(process.env.DATABASE_URL).toBeUndefined();expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();scratch=await mkdtemp(join(tmpdir(),"quantos-ui507-"));execFileSync("openssl",["req","-x509","-newkey","rsa:2048","-nodes","-keyout",join(scratch,"key.pem"),"-out",join(scratch,"cert.pem"),"-days","1","-subj","/CN=127.0.0.1","-addext","subjectAltName=IP:127.0.0.1"],{stdio:"ignore"});proxy.setSecureContext({key:await readFile(join(scratch,"key.pem")),cert:await readFile(join(scratch,"cert.pem"))});await new Promise<void>(r=>proxy.listen(4010,"127.0.0.1",r));
});
test.beforeEach(async({context,page})=>{
 rows=[];identity="session-current";dropCreate=false;breakStream=false;
 await context.addCookies([{name:"quantos_csrf",value:csrf,url:terminal}]);await context.route("**/*",route=>["localhost","127.0.0.1"].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());
 const reserved=tcpServer();await new Promise<void>(r=>reserved.listen(0,"127.0.0.1",r));port=(reserved.address()as{port:number}).port;await new Promise<void>(r=>reserved.close(()=>r()));
 child=spawn(resolve("target/debug/bff-gateway"),[],{env:{PATH:process.env.PATH,HOME:process.env.HOME,QUANTOS_SKIP_ENV:"1",QUANTOS_BFF_MODE:"reference",QUANTOS_BFF_BIND:`127.0.0.1:${port}`,QUANTOS_BFF_PUBLIC_ORIGIN:origin},stdio:["ignore","pipe","pipe"]});await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error("reference startup timeout")),15000);child.once("error",e=>{clearTimeout(timer);reject(e);});child.stdout!.on("data",b=>{if(String(b).includes('"ready":true')){clearTimeout(timer);resolve();}});});await page.bringToFront();
});
test.afterEach(async({context},info)=>{
 await context.close();for(const s of streams)s.destroy();streams.clear();proxy.closeAllConnections();if(child?.exitCode===null){child.kill();await new Promise(r=>child.once("close",r));}
 const file=info.outputPath("ui507.json");await writeFile(file,JSON.stringify({schema:"quantos-ui507-browser/v1",scenario:info.title,status:info.status,sourceCommit:process.env.GITHUB_SHA,binarySha256:hash(await readFile("target/debug/bff-gateway")),identity:"EXPLICIT_REFERENCE_COOKIE_BRIDGE",cors:"LOOPBACK_PROXY_SUBSTITUTION",actualExportCreation:"BROWSER_MFA_REAUTH_CREATE",realIdp:"NOT_RUN",realCookieCors:"NOT_RUN",firefox:"BLOCKED_ENVIRONMENT",webKitAttachment:"BLOCKED_ENVIRONMENT_TEST_INTERCEPTION",rows},null,2));await info.attach("ui507",{path:file,contentType:"application/json"});
});
test.afterAll(async()=>{proxy.closeAllConnections();await new Promise<void>(r=>proxy.close(()=>r()));await rm(scratch,{recursive:true,force:true});});
test("Audit search, causation chain, UI-created export, attachment and correlated audit",async({page})=>{
 await page.goto("/audit");await authorized(page);await expect(page.getByRole("table",{name:"审计事件"})).toBeVisible();await page.getByLabel("Correlation ID",{exact:true}).fill(correlation);await page.getByLabel("每页条数").selectOption("5");await page.getByRole("button",{name:"搜索",exact:true}).click();await expect(page.getByText("本页 5 条记录",{exact:true})).toBeVisible();await page.getByRole("button",{name:"下一页事件",exact:true}).click();await expect(page.getByText("本页 3 条记录",{exact:true})).toBeVisible();expect(rows.some(r=>r.path==="/v1/audit/events"&&r.query?.includes("cursor="))).toBe(true);await expect(page.getByRole("button",{name:"查看因果链",exact:true}).first()).toBeVisible();await page.getByRole("button",{name:"查看因果链",exact:true}).first().click();await expect(page.getByText("当前授权范围内链完整",{exact:true})).toBeVisible();await expect(page.getByRole("region",{name:"因果证据链"}).locator("li")).toHaveCount(8);
 await create(page);expect(exportWrites()).toHaveLength(1);await expect(page.getByLabel("MFA 验证码")).toHaveValue("");expect(rows.filter(r=>r.path.endsWith("/download"))).toHaveLength(0);await expect(page.getByRole("button",{name:"申请短时下载",exact:true})).toBeDisabled();await page.getByRole("button",{name:"查询作业状态",exact:true}).click();await expect(page.locator('[data-export-status="ready"]')).toBeVisible();
 const received=page.waitForEvent("download");await page.getByRole("button",{name:"申请短时下载",exact:true}).click();const download=await received;expect(await download.failure()).toBeNull();const bytes=await readFile((await download.path())!);expect(bytes.toString()).toContain("QuantOS restricted copy "+hash("UI507 restricted copy").slice(0,12));const metadata=rows.find(r=>r.path.endsWith("/download"))!;expect(hash(bytes)).toBe(metadata.sha256);expect(bytes.length).toBe(metadata.size);expect(rows.find(r=>r.path.startsWith("/_bff/export-content/"))?.responseHash).toBe(metadata.sha256);await expect(page.getByRole("status")).toContainText("已交给浏览器接收");expect(await page.locator('a[href*="/_bff/export-content/"]').count()).toBe(0);expect(await page.evaluate(()=>JSON.stringify([localStorage,sessionStorage]))).not.toContain("/_bff/export-content/");
 await page.getByRole("link",{name:"查看导出审计链",exact:true}).click();await authorized(page);await expect(page.getByText("当前授权范围内链完整",{exact:true})).toBeVisible();const audit=await call("/v1/audit/events?kind=export.created");expect(audit.status).toBe(200);expect(audit.body.items).toHaveLength(1);const consumed=await call("/v1/audit/events?kind=export.download_consumed");expect(consumed.body.items).toHaveLength(1);
 await page.screenshot({path:test.info().outputPath("audit-chain.png"),fullPage:true});
});
test("cancel uses MFA and accepted response stays non-downloadable",async({page})=>{
 await page.goto("/exports");await authorized(page);await create(page);await page.getByLabel("MFA 验证码").fill("123456");await page.getByRole("button",{name:"确认取消导出（使用 MFA）",exact:true}).click();await expect(page.locator('[data-export-status="cancelled"]')).toBeVisible();await page.getByRole("button",{name:"查询作业状态",exact:true}).click();await expect(page.locator('[data-export-status="cancelled"]')).toBeVisible();await expect(page.getByRole("button",{name:"申请短时下载",exact:true})).toBeDisabled();expect(rows.filter(r=>r.path.endsWith("/download"))).toHaveLength(0);expect((await call("/v1/audit/events?kind=export.cancelled")).body.items).toHaveLength(1);
});
test("lost create response requires explicit identical-intent retry with same key",async({page})=>{
 await page.goto("/exports");await authorized(page);dropCreate=true;await page.getByLabel("导出 Correlation IDs（逗号分隔）").fill(correlation);await page.getByLabel("导出理由",{exact:true}).fill("UI507 unknown outcome export");await page.getByLabel("水印",{exact:true}).fill("UI507 restricted copy");await page.getByLabel("MFA 验证码").fill("123456");await page.getByRole("button",{name:"确认创建导出",exact:true}).click();await expect(page.getByRole("status")).toContainText("请求结果未知");await page.waitForTimeout(200);expect(exportWrites()).toHaveLength(1);await expect(page.getByLabel("导出理由",{exact:true})).toBeDisabled();await page.getByLabel("MFA 验证码").fill("123456");await page.getByRole("button",{name:"确认创建导出",exact:true}).click();await expect(page.locator('[data-export-status="queued"]')).toBeVisible();expect(exportWrites()).toHaveLength(2);expect(exportWrites()[0].keyHash).toBe(exportWrites()[1].keyHash);expect(exportWrites()[0].bodyHash).toBe(exportWrites()[1].bodyHash);expect((await call("/v1/audit/events?kind=export.created")).body.items).toHaveLength(1);
});
test("stream disconnect and offline clear private UI; fresh recovery never replays writes",async({page,context})=>{
 await page.goto("/audit");await authorized(page);await expect(page.getByRole("table",{name:"审计事件"})).toBeVisible();await page.getByLabel("导出理由",{exact:true}).fill("Discard this private draft");breakStream=true;for(const s of streams)s.destroy();await expect(page.locator('[data-route-access="invalidated"]')).toBeVisible();await expect(page.getByRole("table")).toHaveCount(0);breakStream=false;await page.getByRole("button",{name:"重新验证访问条件",exact:true}).click();await authorized(page);await expect(page.getByLabel("导出理由",{exact:true})).toHaveValue("");await context.setOffline(true);await expect(page.locator('[data-route-access="invalidated"]')).toBeVisible();await context.setOffline(false);await page.getByRole("button",{name:"重新验证访问条件",exact:true}).click();await authorized(page);expect(exportWrites()).toHaveLength(0);
});
test("actual denied identity and concealed missing export never expose audit data",async({page})=>{
 identity="session-viewer";await page.goto("/audit");await expect(page).toHaveURL(/\/unauthorized$/);expect(rows.some(r=>r.path==="/v1/audit/events")).toBe(false);identity="session-current";await page.goto("/exports?exportId=99999999-1111-4111-8111-111111111111");await expect(page).toHaveURL(/\/unauthorized$/);expect(rows.some(r=>r.status===404&&r.path.includes("/exports/"))).toBe(true);expect(exportWrites()).toHaveLength(0);await page.goto("/exports?exportId=eeeeeeee-1111-4111-8111-111111111111");await authorized(page);await expect(page.locator('[data-export-status="expired"]')).toBeVisible();await expect(page.getByRole("button",{name:"申请短时下载",exact:true})).toBeDisabled();identity="invalid-session";await page.goto("/audit");await expect(page).toHaveURL(/\/login\?return_to=/);expect(rows.some(r=>r.path==="/v1/session"&&r.status===401)).toBe(true);
});
test("mobile audit search remains usable and has no horizontal page overflow",async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto("/audit");await authorized(page);await expect(page.getByRole("table",{name:"审计事件"})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.getByLabel("事件类型",{exact:true}).fill("does.not.exist");await page.getByRole("button",{name:"搜索",exact:true}).click();await expect(page.getByText("没有匹配的审计记录。",{exact:true})).toBeVisible();await page.screenshot({path:test.info().outputPath("audit-mobile.png"),fullPage:true});
});
