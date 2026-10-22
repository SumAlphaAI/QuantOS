import {expect, test} from "@playwright/test";
import {spawn, type ChildProcess} from "node:child_process";
import {createServer as tcpServer} from "node:net";
import {createServer, request as httpRequest, type ServerResponse} from "node:http";
import {writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {resolve} from "node:path";
const hash=(b: string|Buffer)=>"sha256:"+createHash("sha256").update(b).digest("hex");
const csrf="csrf-token-0000000000000001";
let child:ChildProcess, targetPort:number;
let rows:Array<{method:string;path:string;status:number;responseSha256?:string;source:string}>;
let streams:Set<ServerResponse>,holdPath:string|undefined,releaseHold: (()=>void)|undefined,held=false,scopeChange=false,denyWrite=false,breakStream=false,shortSummary=false;
const proxy=createServer((req,res)=>{
 const path=new URL(req.url!,"http://localhost:4010").pathname,method=req.method!;
 res.setHeader("access-control-allow-origin","http://localhost:3190");res.setHeader("access-control-allow-credentials","true");res.setHeader("access-control-allow-headers","content-type,x-csrf-token,x-request-id,idempotency-key,if-match,x-reauth-token-ref");res.setHeader("access-control-allow-methods","GET,PUT,POST,DELETE,OPTIONS");
 if(method==="OPTIONS"){res.writeHead(204);res.end();return;}
 if(path.endsWith("/stream")&&breakStream){rows.push({method,path,status:503,source:"SYNTHETIC_DISCONNECT"});res.writeHead(503);res.end();return;}
 if(denyWrite&&method==="PUT"){const bytes=Buffer.from(JSON.stringify({code:"FORBIDDEN",message:"denied",correlationId:"aaaaaaaa-1111-4111-8111-111111111111"}));rows.push({method,path,status:403,responseSha256:hash(bytes),source:"SYNTHETIC_WRITE_REFUSAL_BEFORE_FORWARD"});res.writeHead(403,{"content-type":"application/json","cache-control":"no-store"});res.end(bytes);return;}
 const upstream=httpRequest({host:"127.0.0.1",port:targetPort,path:req.url,method,headers:{...req.headers,cookie:`quantos_session=session-current; quantos_csrf=${csrf}`}},response=>{
  const row={method,path,status:response.statusCode!,source:"REFERENCE_BYTE_FOR_BYTE",responseSha256:undefined as string|undefined};rows.push(row);
  if(path.endsWith("/stream")){res.writeHead(response.statusCode!,{"content-type":"text/event-stream","cache-control":"no-store"});res.flushHeaders();streams.add(res);response.pipe(res);res.on("close",()=>{streams.delete(res);response.destroy();});return;}
  const parts:Buffer[]=[];response.on("data",b=>parts.push(Buffer.from(b)));response.on("end",()=>{
   let bytes=Buffer.concat(parts);if(scopeChange&&path==="/v1/context"&&response.statusCode===200){const body=JSON.parse(bytes.toString());body.capabilities=body.capabilities.filter((c:string)=>c!=="settings.read"&&c!=="ops.read");bytes=Buffer.from(JSON.stringify(body));row.source="SYNTHETIC_C01_SCOPE_CHANGE";}

   if(shortSummary&&path==="/v1/command/summary"&&response.statusCode===200){const body=JSON.parse(bytes.toString());body.expiresAt=new Date(Date.now()+1200).toISOString();bytes=Buffer.from(JSON.stringify(body));row.source="SYNTHETIC_EARLIEST_RESOURCE_DEADLINE";}

   row.responseSha256=hash(bytes);const finish=()=>{if(!res.destroyed){res.writeHead(row.status,{"content-type":"application/json","cache-control":"no-store"});res.end(bytes);}};
   if(holdPath===path){held=true;releaseHold=finish;}else finish();
  });
 });upstream.on("error",()=>{if(!res.headersSent)res.writeHead(502);res.end();});res.on("close",()=>upstream.destroy());req.pipe(upstream);
});
test.beforeAll(async()=>{await new Promise<void>(r=>proxy.listen(4010,"127.0.0.1",r));});
test.beforeEach(async({context})=>{
 await context.addCookies([{name:"quantos_csrf",value:csrf,url:"http://localhost:3190"}]);
 rows=[];streams=new Set();holdPath=undefined;releaseHold=undefined;held=false;scopeChange=false;denyWrite=false;breakStream=false;shortSummary=false;
 const server=tcpServer();await new Promise<void>(r=>server.listen(0,"127.0.0.1",r));targetPort=(server.address()as{port:number}).port;await new Promise<void>(r=>server.close(()=>r()));
 child=spawn(resolve("target/debug/bff-gateway"),[],{env:{PATH:process.env.PATH,HOME:process.env.HOME,QUANTOS_SKIP_ENV:"1",QUANTOS_BFF_MODE:"reference",QUANTOS_BFF_BIND:`127.0.0.1:${targetPort}`},stdio:["ignore","pipe","pipe"]});
 await new Promise<void>((resolve,reject)=>{const t=setTimeout(()=>reject(Error("reference startup timeout")),15000);child.once("error",e=>{clearTimeout(t);reject(e);});child.stdout!.on("data",b=>{if(String(b).includes('"ready":true')){clearTimeout(t);resolve();}});});
});
test.afterEach(async({page},info)=>{
 if(!page.isClosed())await page.close();
 for(const res of streams)res.destroy();proxy.closeAllConnections();releaseHold?.();
 if(child?.exitCode===null){child.kill();await new Promise(r=>child.once("close",r));}
 const path=info.outputPath("route-recovery.json");await writeFile(path,JSON.stringify({schema:"quantos-g1-route-browser/v1",scenario:info.title,mode:"ACTUAL_ROUTES_LOCAL_REFERENCE_WITH_EXPLICIT_FAULTS",realIdp:"NOT_RUN",targetDatabaseStorage:"NOT_RUN",browserCookieCors:"NOT_RUN_FIXTURE_IDENTITY_BRIDGE",firefox:"BLOCKED_ENVIRONMENT",webKitAttachment:"BLOCKED_ENVIRONMENT_TEST_INTERCEPTION",rows},null,2));await info.attach("route-recovery",{path,contentType:"application/json"});
});
test.afterAll(async()=>{proxy.closeAllConnections();await new Promise<void>(r=>proxy.close(()=>r()));});
async function logout(){const r=await fetch(`http://127.0.0.1:${targetPort}/v1/auth/logout`,{method:"POST",headers:{cookie:`quantos_session=session-current; quantos_csrf=${csrf}`,origin:"http://localhost:3190","x-csrf-token":csrf,"x-request-id":crypto.randomUUID()}});expect(r.status).toBe(204);}
for(const route of ["/command","/settings/profile","/settings/browser"])test(`actual SSE logout clears ${route} and stops private activity`,async({page})=>{
 await page.goto(route);await expect(page.locator('[data-route-access="authorized"]')).toBeVisible();expect(rows.some(r=>r.path.endsWith("/stream")&&r.status===200)).toBe(true);
 await logout();await expect(page).toHaveURL(/\/(login|unauthorized)/);await expect(page.locator('[data-route-access="authorized"]')).toHaveCount(0);
 const count=rows.length;await page.waitForTimeout(400);expect(rows.length).toBe(count);expect(rows.filter(r=>r.method!=="GET")).toEqual([]);
});
for(const route of ["/command","/settings/profile"])test(`stream disconnect clears ${route}; explicit recovery rereads without writes`,async({page})=>{
 await page.goto(route);await expect(page.locator('[data-route-access="authorized"]')).toBeVisible();
 breakStream=true;for(const res of streams)res.destroy();await expect(page.locator('[data-route-access="invalidated"]')).toBeVisible();await expect(page.locator('[data-route-access="authorized"]')).toHaveCount(0);
 const count=rows.length;await page.waitForTimeout(300);expect(rows.length).toBe(count);breakStream=false;
 await page.getByRole("button",{name:"重新验证访问条件",exact:true}).click();await expect(page.locator('[data-route-access="authorized"]')).toBeVisible();
 expect(rows.filter(r=>r.path==="/v1/session").length).toBeGreaterThanOrEqual(4);expect(rows.every(r=>r.method==="GET")).toBe(true);
});
for(const route of ["/command","/settings/profile"])test(`silent scope change is refused on actual ${route} within the bounded C01 lease`,async({page})=>{
 await page.goto(route);await expect(page.locator('[data-route-access="authorized"]')).toBeVisible();scopeChange=true;
 await expect(page).toHaveURL(/\/unauthorized/,{timeout:9000});await expect(page.locator('[data-route-access="authorized"]')).toHaveCount(0);expect(rows.some(r=>r.source==="SYNTHETIC_C01_SCOPE_CHANGE")).toBe(true);
});
test("Settings ordinary revalidation preserves drafts; revoked late read never restores private state",async({page})=>{
 await page.goto("/settings/profile");await expect(page.locator('[data-route-access="authorized"]')).toBeVisible();
 await page.getByLabel("显示名称",{exact:true}).fill("Unsaved recovery draft");await page.getByRole("button",{name:"重新验证并保留草稿"}).click();await expect(page.getByLabel("显示名称",{exact:true})).toHaveValue("Unsaved recovery draft");
 holdPath="/v1/settings/profile";await page.getByRole("button",{name:"重新验证并保留草稿"}).click();await expect.poll(()=>held).toBe(true);await logout();await expect(page).toHaveURL(/\/(login|unauthorized)/);releaseHold?.();await page.waitForTimeout(200);await expect(page.getByLabel("显示名称",{exact:true})).toHaveCount(0);
});
test("offline and online never replay a Settings save; explicit read recovery starts clean",async({page,context})=>{
 await page.goto("/settings/profile");await expect(page.locator('[data-route-access="authorized"]')).toBeVisible();await page.getByLabel("显示名称",{exact:true}).fill("Never replay this draft");
 await context.setOffline(true);await expect(page.locator('[data-route-access="invalidated"]')).toBeVisible();await expect(page.getByLabel("显示名称",{exact:true})).toHaveCount(0);await context.setOffline(false);
 await page.waitForTimeout(250);expect(rows.every(r=>r.method==="GET")).toBe(true);await page.getByRole("button",{name:"重新验证访问条件",exact:true}).click();await expect(page.locator('[data-route-access="authorized"]')).toBeVisible();await expect(page.getByLabel("显示名称",{exact:true})).not.toHaveValue("Never replay this draft");
});
test("a write 403 clears Settings without claiming success or automatic retry",async({page})=>{
 await page.goto("/settings/profile");await expect(page.locator('[data-route-access="authorized"]')).toBeVisible();denyWrite=true;await page.getByLabel("显示名称",{exact:true}).fill("Denied changed name");await page.getByRole("button",{name:"保存个人资料",exact:true}).click();
 await expect(page).toHaveURL(/\/unauthorized/);expect(rows.filter(r=>r.method==="PUT")).toHaveLength(1);await page.waitForTimeout(200);expect(rows.filter(r=>r.method==="PUT")).toHaveLength(1);
});
test("hidden tab clears its private projection; returning requires fresh validation",async({page})=>{
 await page.goto("/command");await expect(page.locator('[data-route-access="authorized"]')).toBeVisible();
 // Explicit browser lifecycle fault, not a claim about OS background scheduling.
 await page.evaluate(()=>{Object.defineProperty(document,"hidden",{value:true,configurable:true});document.dispatchEvent(new Event("visibilitychange"));});
 await expect(page.locator('[data-route-access="invalidated"]')).toBeVisible();await page.evaluate(()=>Object.defineProperty(document,"hidden",{value:false,configurable:true}));
 await page.getByRole("button",{name:"重新验证访问条件",exact:true}).click();await expect(page.locator('[data-route-access="authorized"]')).toBeVisible();
});
test("real BroadcastChannel invalidation from another tab cannot grant access",async({page,context})=>{
 await page.goto("/command");await expect(page.locator('[data-route-access="authorized"]')).toBeVisible();
 const other=await context.newPage();await other.goto("/login");await page.bringToFront();
 if(await page.locator('[data-route-access="invalidated"]').count()){await page.getByRole("button",{name:"重新验证访问条件",exact:true}).click();await expect(page.locator('[data-route-access="authorized"]')).toBeVisible();}
 await other.evaluate(()=>{const c=new BroadcastChannel("quantos.auth.invalidate.v1");c.postMessage({version:1,type:"permissions_granted"});c.close();});await page.waitForTimeout(100);await expect(page.locator('[data-route-access="authorized"]')).toBeVisible();
 await other.evaluate(()=>{const c=new BroadcastChannel("quantos.auth.invalidate.v1");c.postMessage({version:1,type:"context"});c.close();});await expect(page.locator('[data-route-access="invalidated"]')).toBeVisible();await expect(page.locator('[data-route-access="authorized"]')).toHaveCount(0);await other.close();
});

test("late initial Command projection cannot publish after server logout",async({page})=>{
 holdPath="/v1/command/summary";let published=false;await page.exposeFunction("recordPrivatePublication",()=>{published=true;});
 await page.addInitScript(()=>{new MutationObserver(()=>{if(document.querySelector('[data-route-access="authorized"]'))void (window as unknown as {recordPrivatePublication:()=>Promise<void>}).recordPrivatePublication();}).observe(document,{subtree:true,childList:true,attributes:true});});
 await page.goto("/command");await expect.poll(()=>held).toBe(true);await logout();releaseHold?.();await expect(page).toHaveURL(/\/(login|unauthorized)/);expect(published).toBe(false);
});
test("earliest Command resource deadline clears the actual projection before any revalidation",async({page})=>{
 shortSummary=true;await page.goto("/command");await expect(page.locator('[data-route-access="authorized"]')).toBeVisible();
 await expect(page.locator('[data-route-access="invalidated"][data-access-loss="expired"]')).toBeVisible({timeout:3000});await expect(page.locator('[data-route-access="authorized"]')).toHaveCount(0);expect(rows.filter(r=>r.path==="/v1/session")).toHaveLength(2);
});
test("real login initiation broadcasts session invalidation to another authorized tab",async({page,context})=>{
 await page.goto("/command");await expect(page.locator('[data-route-access="authorized"]')).toBeVisible();const other=await context.newPage();await other.route("https://mock.idp.local/**",route=>route.abort());await other.goto("/login");await page.bringToFront();
 if(await page.locator('[data-route-access="invalidated"]').count()){await page.getByRole("button",{name:"重新验证访问条件",exact:true}).click();await expect(page.locator('[data-route-access="authorized"]')).toBeVisible();}
 await other.evaluate(()=>{(document.querySelector("button.auth-primary") as HTMLButtonElement).click();});await expect(page).toHaveURL(/\/login/);await expect(page.locator('[data-route-access="authorized"]')).toHaveCount(0);await other.close();
});
