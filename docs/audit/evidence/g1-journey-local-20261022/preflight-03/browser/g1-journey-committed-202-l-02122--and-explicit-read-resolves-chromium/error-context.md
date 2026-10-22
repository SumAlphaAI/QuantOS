# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: g1-journey.spec.ts >> committed 202 lost response never replays DELETE and explicit read resolves
- Location: tests/e2e/g1-journey.spec.ts:97:5

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('.toast')
Expected substring: "请求结果未知"
Received string:    "会话撤销已受理；记录暂不移除，请重新读取核验最终状态。×"
Timeout: 5000ms

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for locator('.toast')
    13 × locator resolved to <div class="toast" role="status">…</div>
       - unexpected value "会话撤销已受理；记录暂不移除，请重新读取核验最终状态。×"

```

```yaml
- status:
  - text: 会话撤销已受理；记录暂不移除，请重新读取核验最终状态。
  - button "关闭通知": ×
```

# Test source

```ts
  1   | // Real browser routes + Rust reference, with explicit loopback IdP/session ports.
  2   | // No route.fulfill, URL rewriting, live credentials or target service calls.
  3   | import {test, expect, type Page} from "@playwright/test";
  4   | import {spawn, execFileSync, type ChildProcess} from "node:child_process";
  5   | import {createServer as tcpServer} from "node:net";
  6   | import {createServer, request as httpsRequest} from "node:https";
  7   | import {request as httpRequest, type ServerResponse} from "node:http";
  8   | import {mkdtemp, readFile, writeFile, rm} from "node:fs/promises";
  9   | import {tmpdir} from "node:os";
  10  | import {resolve, join} from "node:path";
  11  | import {createHash} from "node:crypto";
  12  | const origin="https://127.0.0.1:4010", terminal="http://localhost:3190",csrf="csrf-token-0000000000000001";
  13  | const hash=(b:string|Buffer)=>"sha256:"+createHash("sha256").update(b).digest("hex");
  14  | const canonical=(v:unknown):string=>JSON.stringify(v,(_,x)=>x&&typeof x==="object"&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
  15  | type Row={method:string;path:string;status:number;source:string;port:string;requestSha256?:string;responseSha256?:string;requestId?:string;correlationId?:string;idempotencySha256?:string;version?:string};
  16  | let child:ChildProcess,port:number,scratch:string,rows:Row[],streams:Set<ServerResponse>,established:boolean,identity:string,challenge:string,codeUsed:boolean;
  17  | let dropProfile=false,dropDelete=false,rateProfile=false,breakStream=false;
  18  | let checks:Array<Record<string,unknown>>;
  19  | const proxy=createServer({},async(req,res)=>{
  20  |  const url=new URL(req.url!,origin),path=url.pathname,method=req.method!;
  21  |  const cors={"access-control-allow-origin":terminal,"access-control-allow-credentials":"true","access-control-allow-headers":"content-type,x-csrf-token,x-request-id,idempotency-key,if-match,x-reauth-token-ref","access-control-allow-methods":"GET,POST,PUT,DELETE,OPTIONS","access-control-expose-headers":"x-correlation-id,etag","cache-control":"no-store"};
  22  |  for(const [k,v]of Object.entries(cors))res.setHeader(k,v);
  23  |  if(method==="OPTIONS"){res.writeHead(204);res.end();return;}
  24  |  const parts:Buffer[]=[];for await(const b of req)parts.push(Buffer.from(b));const input=Buffer.concat(parts);
  25  |  const row:Row={method,path:path.startsWith("/_bff/export-content/")?"/_bff/export-content/{ticket}/{signature}":path,status:0,source:"REFERENCE_BYTE_FOR_BYTE",port:req.headers["x-g1-control"]?"NODE_CONTROL_PORT":"ACTUAL_BROWSER",...(input.length?{requestSha256:hash(input)}:{})};rows.push(row);
  26  |  if(req.headers["x-request-id"])row.requestId=String(req.headers["x-request-id"]);
  27  |  if(req.headers["idempotency-key"])row.idempotencySha256=hash(String(req.headers["idempotency-key"]));
  28  |  if(req.headers["if-match"])row.version=String(req.headers["if-match"]);
  29  |  const send=(status:number,body:unknown,source:string)=>{const bytes=Buffer.from(JSON.stringify(body));Object.assign(row,{status,source,responseSha256:hash(bytes)});res.writeHead(status,{"content-type":"application/json"});res.end(bytes);};
  30  |  if(path==="/authorize"){
  31  |   row.source="SYNTHETIC_LOOPBACK_IDP";row.status=302;
  32  |   if(url.searchParams.get("redirect_uri")!==terminal+"/auth/callback"||url.searchParams.get("code_challenge_method")!=="S256"){send(400,{},row.source);return;}
  33  |   challenge=url.searchParams.get("code_challenge")!;codeUsed=false;const callback=new URL(terminal+"/auth/callback");callback.searchParams.set("code","local-one-use-code");callback.searchParams.set("state",url.searchParams.get("state")!);res.writeHead(302,{location:callback.href});res.end();return;
  34  |  }
  35  |  if(path==="/token"){
  36  |   const body=new URLSearchParams(input.toString()),proof=createHash("sha256").update(body.get("code_verifier")??"").digest("base64url");
  37  |   const valid=!codeUsed&&body.get("code")==="local-one-use-code"&&proof===challenge;codeUsed=true;
  38  |   send(valid?200:400,valid?{subject:"local-reference-user",access_token:"local-reference-token",expires_in:300,mfa_required:false}:{},"SYNTHETIC_LOOPBACK_IDP_PKCE_CHECK");return;
  39  |  }
  40  |  if(path==="/v1/auth/session"){
  41  |   const valid=codeUsed&&req.headers.authorization==="Bearer local-reference-token";established=valid;identity="session-current";
  42  |   row.source="SYNTHETIC_REFERENCE_SESSION_ESTABLISHMENT";row.status=valid?204:401;res.writeHead(row.status);res.end();return;
  43  |  }
  44  |  if(path.endsWith("/stream")&&breakStream){send(503,{},"SYNTHETIC_STREAM_DISCONNECT");return;}
  45  |  if(method==="PUT"&&path==="/v1/settings/profile"&&rateProfile){rateProfile=false;send(429,{code:"RATE_LIMITED",message:"Please retry later",correlationId:crypto.randomUUID(),retryAfter:2},"SYNTHETIC_429_BEFORE_FORWARD");return;}
  46  |  const selected=established?identity:"invalid-session";
  47  |  const upstream=httpRequest({host:"127.0.0.1",port,path:req.url,method,headers:{...req.headers,cookie:`quantos_session=${selected}; quantos_csrf=${csrf}`,origin:terminal}},response=>{
  48  |   row.status=response.statusCode!;row.correlationId=response.headers["x-correlation-id"] as string|undefined;
  49  |   if(path.endsWith("/stream")){res.writeHead(row.status,{"content-type":"text/event-stream"});res.flushHeaders();streams.add(res);response.pipe(res);res.on("close",()=>{streams.delete(res);response.destroy();});return;}
  50  |   const chunks:Buffer[]=[];response.on("data",b=>chunks.push(Buffer.from(b)));response.on("end",()=>{
  51  |    const bytes=Buffer.concat(chunks);row.responseSha256=hash(bytes);
  52  |    if((dropProfile&&path==="/v1/settings/profile"&&method==="PUT")||(dropDelete&&method==="DELETE")){
  53  |     dropProfile=false;dropDelete=false;row.source="REFERENCE_COMMITTED_RESPONSE_DROPPED";res.destroy();return;
  54  |    }
  55  |    for(const [k,v]of Object.entries(response.headers))if(v!==undefined&&!["connection","transfer-encoding","access-control-allow-origin"].includes(k))res.setHeader(k,v);
  56  |    res.writeHead(row.status);res.end(bytes);
  57  |   });
  58  |  });upstream.on("error",()=>{if(!res.headersSent)res.writeHead(502);res.end();});res.on("close",()=>upstream.destroy());upstream.end(input);
  59  | });
  60  | async function call(path:string,method="GET",body?:unknown,extra:Record<string,string>={}):Promise<{status:number;body:Record<string,unknown> & {items:Array<Record<string,unknown>>;challengeRef:string;reauthTokenRef:string;exportId:string;objectVersion:string};bytes:Buffer}>{ // generated operation payloads are asserted below
  61  |  return new Promise((resolve,reject)=>{const req=httpsRequest(origin+path,{method,rejectUnauthorized:false,headers:{"content-type":"application/json","x-g1-control":"1","x-csrf-token":csrf,"x-request-id":crypto.randomUUID(),...extra}},res=>{const chunks:Buffer[]=[];res.on("data",b=>chunks.push(Buffer.from(b)));res.on("end",()=>{const bytes=Buffer.concat(chunks);let body;try{body=JSON.parse(bytes.toString());}catch{body=undefined;}resolve({status:res.statusCode!,body,bytes});});});req.on("error",reject);if(body!==undefined)req.write(JSON.stringify(body));req.end();});
  62  | }
  63  | async function login(page:Page){await page.goto("/login");await page.getByRole("button",{name:"使用组织账户继续",exact:true}).click();await expect(page).toHaveURL(/\/command$/);await authorized(page);expect(await page.evaluate(()=>sessionStorage.getItem("quantos.auth.pending"))).toBeNull();expect(rows.some(r=>r.path==="/token"&&r.status===200)).toBe(true);expect(rows.some(r=>r.path==="/v1/auth/session"&&r.status===204)).toBe(true);}
  64  | async function authorized(page:Page){await expect(page.locator('[data-route-access="authorized"]')).toBeVisible();}
  65  | async function securityDialog(page:Page,code="123456"){await page.getByRole("button",{name:"撤销会话",exact:true}).click();await page.getByLabel(/输入“REVOKE session-remote”/).fill("REVOKE session-remote");await page.getByLabel("MFA 验证码").fill(code);}
  66  | async function seedExport(){const c=await call("/v1/auth/mfa/challenges","POST",{purpose:"security_change",code:"123456"});expect(c.status).toBe(200);const g=await call("/v1/auth/reauth","POST",{challengeRef:c.body.challengeRef});expect(g.status).toBe(200);const r=await call("/v1/exports","POST",{scope:{correlationIds:["aaaaaaaa-1111-4111-8111-111111111111"]},format:"jsonl",reason:"Local journey controlled export",watermark:"Journey controlled copy",retentionDays:7},{"x-reauth-token-ref":g.body.reauthTokenRef,"idempotency-key":crypto.randomUUID()});expect(r.status).toBe(202);return r.body.exportId as string;}
  67  | async function audit(kind:string,correlation?:string){const q=new URLSearchParams({kind,pageSize:"200",...(correlation?{correlationId:correlation}:{})});const r=await call("/v1/audit/events?"+q);expect(r.status).toBe(200);const items=r.body.items as Array<Record<string,unknown>>;for(const item of items){expect(item.payloadHash).toBe(hash(canonical(item.redactedPayload)));expect(item.redactionApplied).toBe(true);expect(item.kind).toBe(kind);}return items;}
  68  | test.beforeAll(async()=>{expect(process.env.DATABASE_URL).toBeUndefined();expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();scratch=await mkdtemp(join(tmpdir(),"quantos-g1-journey-"));execFileSync("openssl",["req","-x509","-newkey","rsa:2048","-nodes","-keyout",join(scratch,"key.pem"),"-out",join(scratch,"cert.pem"),"-days","1","-subj","/CN=127.0.0.1","-addext","subjectAltName=IP:127.0.0.1"],{stdio:"ignore"});proxy.setSecureContext({key:await readFile(join(scratch,"key.pem")),cert:await readFile(join(scratch,"cert.pem"))});await new Promise<void>(r=>proxy.listen(4010,"127.0.0.1",r));});
  69  | test.beforeEach(async({context,page})=>{
  70  |  rows=[];checks=[];streams=new Set();established=false;identity="session-current";challenge="";codeUsed=false;dropProfile=false;dropDelete=false;rateProfile=false;breakStream=false;
  71  |  await context.addCookies([{name:"quantos_csrf",value:csrf,url:terminal}]);await context.route("**/*",route=>{const u=new URL(route.request().url());return ["localhost","127.0.0.1"].includes(u.hostname)?route.continue():route.abort();});
  72  |  const reserved=tcpServer();await new Promise<void>(r=>reserved.listen(0,"127.0.0.1",r));port=(reserved.address()as{port:number}).port;await new Promise<void>(r=>reserved.close(()=>r()));
  73  |  child=spawn(resolve("target/debug/bff-gateway"),[],{env:{PATH:process.env.PATH,HOME:process.env.HOME,QUANTOS_SKIP_ENV:"1",QUANTOS_BFF_MODE:"reference",QUANTOS_BFF_BIND:`127.0.0.1:${port}`,QUANTOS_BFF_PUBLIC_ORIGIN:origin},stdio:["ignore","pipe","pipe"]});
  74  |  await new Promise<void>((resolve,reject)=>{const t=setTimeout(()=>reject(Error("reference startup timeout")),15000);child.once("error",e=>{clearTimeout(t);reject(e);});child.stdout!.on("data",b=>{if(String(b).includes('"ready":true')){clearTimeout(t);resolve();}});});await page.bringToFront();
  75  | });
  76  | test.afterEach(async({context},info)=>{await context.close();for(const s of streams)s.destroy();proxy.closeAllConnections();if(child?.exitCode===null){child.kill();await new Promise(r=>child.once("close",r));}const path=info.outputPath("journey.json");await writeFile(path,JSON.stringify({schema:"quantos-g1-journey-browser/v1",scenario:info.title,mode:"ACTUAL_ROUTES_RUST_REFERENCE_EXPLICIT_PORT_SUBSTITUTIONS",sourceCommit:process.env.G1_JOURNEY_SOURCE,binarySha256:hash(await readFile("target/debug/bff-gateway")),topology:"HTTPS_LOOPBACK_ORIGINAL_PROVIDER_BYTES_NO_URL_REWRITE",idpSession:"SYNTHETIC_LOOPBACK_PKCE_AND_SESSION_BRIDGE",exportCreation:"NODE_CONTROL_PORT_NO_EXPORT_UI",realIdp:"NOT_RUN",realCookieCors:"NOT_RUN",targetDatabaseStorage:"NOT_RUN",firefox:"BLOCKED_ENVIRONMENT",webKitAttachment:"BLOCKED_ENVIRONMENT_TEST_INTERCEPTION",checks,rows},null,2));await info.attach("journey",{path,contentType:"application/json"});});
  77  | test.afterAll(async()=>{proxy.closeAllConnections();await new Promise<void>(r=>proxy.close(()=>r()));await rm(scratch,{recursive:true,force:true});});
  78  | test("login to Command to P15 to P17 real attachment and correlated audit journey",async({page})=>{
  79  |  await login(page);await page.goto("/settings/profile");await authorized(page);await page.getByLabel("显示名称",{exact:true}).fill("Journey confirmed profile");await page.getByRole("button",{name:"保存个人资料",exact:true}).click();await expect(page.locator(".toast")).toContainText("个人资料已保存");
  80  |  const save=rows.find(r=>r.path==="/v1/settings/profile"&&r.method==="PUT")!;const profileAudit=await audit("profile.save",save.correlationId);expect(profileAudit).toHaveLength(1);
  81  |  await page.getByRole("link",{name:"通知设置",exact:true}).click();await authorized(page);await page.getByRole("checkbox",{name:"启用静默时段",exact:true}).check();await page.getByRole("button",{name:"保存通知偏好",exact:true}).click();await expect(page.locator(".toast")).toContainText("通知偏好已保存");const notification=rows.find(r=>r.path==="/v1/settings/notification-preferences"&&r.method==="PUT")!;expect(await audit("notification_preferences.save",notification.correlationId)).toHaveLength(1);
  82  |  await page.getByRole("link",{name:"安全与 MFA",exact:true}).click();await authorized(page);await securityDialog(page);await page.getByRole("button",{name:"确认撤销会话",exact:true}).click();await expect(page.locator(".toast")).toContainText("会话撤销已受理");await expect(page.getByRole("button",{name:"撤销处理中",exact:true})).toBeVisible();await expect(page.locator(".settings-list-row code").filter({hasText:"session-remote"})).toBeVisible();const revoked=rows.find(r=>r.method==="DELETE")!;expect(revoked.status).toBe(202);expect(await audit("session.revoke",revoked.correlationId)).toHaveLength(1);await page.getByRole("button",{name:"重新验证并保留草稿",exact:true}).click();await expect(page.locator(".settings-list-row code").filter({hasText:"session-remote"})).toHaveCount(0);
  83  |  const exportId=await seedExport();await page.getByRole("link",{name:"Web Browser",exact:true}).click();await authorized(page);await expect(page.getByRole("region",{name:"最近下载记录"})).toBeVisible();expect(rows.filter(r=>r.path.endsWith("/download"))).toHaveLength(0);
  84  |  const history=await call("/v1/settings/downloads");const record=history.body.items.find(r=>r.downloadId===exportId)!;expect(record.status).toBe("ready");expect(record.downloadUrl).toBeUndefined();
  85  |  const received=page.waitForEvent("download");await page.getByRole("button",{name:"下载",exact:true}).filter({visible:true}).first().click();const download=await received;expect(await download.failure()).toBeNull();const bytes=await readFile((await download.path())!);expect(bytes.toString()).toContain("QuantOS restricted copy");expect(download.suggestedFilename()).toBe("quantos-audit-export");
  86  |  const consumed=await audit("export.download_consumed");expect(consumed).toHaveLength(1);const all=await call("/v1/audit/events?pageSize=200");expect(all.bytes.toString()).not.toContain("/_bff/export-content/");expect(all.bytes.toString()).not.toContain("Journey confirmed profile");expect(all.bytes.toString()).not.toContain("local-reference-token");
  87  |  checks.push({id:"complete-local-port-substituted-journey",status:"PASS",profileCorrelation:save.correlationId,notificationCorrelation:notification.correlationId,revokeCorrelation:revoked.correlationId,exportId,contentSha256:hash(bytes),bytes:bytes.length,acceptedIsNotFinal:true,historyContainsLease:false});
  88  | });
  89  | test("real CAS conflict preserves draft and requires explicit rebase and save",async({page})=>{
  90  |  await login(page);await page.goto("/settings/profile");await authorized(page);await page.getByLabel("显示名称",{exact:true}).fill("Keep conflict draft");const profile=await call("/v1/settings/profile");const {objectVersion,memberId,email,emailVerified,roleLabels,...input}=profile.body;void memberId;void email;void emailVerified;void roleLabels;
  91  |  expect((await call("/v1/settings/profile","PUT",{...input,displayName:"Concurrent reference writer"},{"if-match":objectVersion,"idempotency-key":crypto.randomUUID()})).status).toBe(200);
  92  |  await page.getByRole("button",{name:"保存个人资料",exact:true}).click();await expect(page.locator(".toast")).toContainText("版本冲突");await expect(page.getByLabel("显示名称",{exact:true})).toHaveValue("Keep conflict draft");expect(rows.filter(r=>r.method==="PUT").map(r=>r.status)).toEqual([200,409]);await page.getByRole("button",{name:"加载最新版本并保留草稿",exact:true}).click();await expect(page.locator(".toast")).toContainText("最新版本已读取");expect(rows.filter(r=>r.method==="PUT")).toHaveLength(2);await page.getByRole("button",{name:"保存个人资料",exact:true}).click();await expect(page.locator(".toast")).toContainText("个人资料已保存");expect((await audit("profile.save"))).toHaveLength(2);checks.push({id:"cas-rebase",status:"PASS"});
  93  | });
  94  | test("committed save with lost response explicitly retries same intent once",async({page})=>{
  95  |  await login(page);await page.goto("/settings/profile");await authorized(page);dropProfile=true;await page.getByLabel("显示名称",{exact:true}).fill("Unknown outcome profile");await page.getByRole("button",{name:"保存个人资料",exact:true}).click();await expect(page.locator(".toast")).toContainText("请求结果未知");await page.waitForTimeout(300);let writes=rows.filter(r=>r.method==="PUT");expect(writes).toHaveLength(1);expect(writes[0].source).toBe("REFERENCE_COMMITTED_RESPONSE_DROPPED");await expect(page.getByLabel("显示名称",{exact:true})).toHaveValue("Unknown outcome profile");await page.getByRole("button",{name:"保存个人资料",exact:true}).click();await expect(page.locator(".toast")).toContainText("个人资料已保存");writes=rows.filter(r=>r.method==="PUT");expect(writes).toHaveLength(2);for(const key of ["idempotencySha256","requestSha256","version"]as const)expect(writes[0][key]).toBe(writes[1][key]);const read=await call("/v1/settings/profile");expect(read.body.objectVersion).toBe("profile-v2");expect(await audit("profile.save")).toHaveLength(1);checks.push({id:"unknown-save-exact-intent-no-auto-replay",status:"PASS"});
  96  | });
  97  | test("committed 202 lost response never replays DELETE and explicit read resolves",async({page})=>{
> 98  |  await login(page);await page.goto("/settings/security");await authorized(page);dropDelete=true;await securityDialog(page);await page.getByRole("button",{name:"确认撤销会话",exact:true}).click();await expect(page.locator(".toast")).toContainText("请求结果未知");await expect(page.locator(".settings-list-row code").filter({hasText:"session-remote"})).toBeVisible();await page.getByRole("button",{name:"取消",exact:true}).click();await page.waitForTimeout(300);expect(rows.filter(r=>r.method==="DELETE")).toHaveLength(1);await page.getByRole("button",{name:"重新验证并保留草稿",exact:true}).click();await expect(page.locator(".settings-list-row code").filter({hasText:"session-remote"})).toHaveCount(0);expect(await audit("session.revoke")).toHaveLength(1);checks.push({id:"unknown-202-read-fact-no-delete-replay",status:"PASS"});
      |                                                                                                                                                                                                                                   ^ Error: expect(locator).toContainText(expected) failed
  99  | });
  100 | test("synthetic bounded 429 blocks save until user explicitly retries real provider",async({page})=>{
  101 |  await login(page);await page.goto("/settings/profile");await authorized(page);rateProfile=true;await page.getByLabel("显示名称",{exact:true}).fill("Rate limited draft");await page.getByRole("button",{name:"保存个人资料",exact:true}).click();await expect(page.getByRole("button",{name:"保存个人资料",exact:true})).toBeDisabled();await page.waitForTimeout(2600);expect(rows.filter(r=>r.method==="PUT")).toHaveLength(1);await expect(page.getByRole("button",{name:"保存个人资料",exact:true})).toBeEnabled();await page.getByRole("button",{name:"保存个人资料",exact:true}).click();await expect(page.locator(".toast")).toContainText("个人资料已保存");const writes=rows.filter(r=>r.method==="PUT");expect(writes.map(r=>r.status)).toEqual([429,200]);expect(writes[0].idempotencySha256).toBe(writes[1].idempotencySha256);expect(await audit("profile.save")).toHaveLength(1);checks.push({id:"synthetic-429-explicit-resume",status:"PASS"});
  102 | });
  103 | test("actual reference MFA 429 never reaches reauth or DELETE",async({page})=>{
  104 |  await login(page);await page.goto("/settings/security");await authorized(page);await securityDialog(page,"000000");for(let i=0;i<5;i++){await page.getByRole("button",{name:"确认撤销会话",exact:true}).click();await expect.poll(()=>rows.filter(r=>r.path==="/v1/auth/mfa/challenges").length).toBe(i+1);await expect(page.locator(".toast")).toBeVisible();await expect(page.getByRole("button",{name:"确认撤销会话",exact:true})).toBeEnabled();}expect(rows.filter(r=>r.path==="/v1/auth/mfa/challenges").map(r=>r.status)).toEqual([200,200,200,200,429]);expect(rows.some(r=>r.path==="/v1/auth/reauth"||r.method==="DELETE")).toBe(false);await page.waitForTimeout(250);expect(rows.filter(r=>r.path==="/v1/auth/mfa/challenges")).toHaveLength(5);checks.push({id:"actual-mfa-429",status:"PASS",cooldownExpiry:"NOT_RUN_60_SECOND_REFERENCE_WINDOW"});
  105 | });
  106 | test("actual provider 403 on changed fixture identity clears private UI",async({page})=>{
  107 |  await login(page);await page.goto("/settings/profile");await authorized(page);identity="session-viewer";await page.getByLabel("显示名称",{exact:true}).fill("Denied write");await page.getByRole("button",{name:"保存个人资料",exact:true}).click();await expect(page).toHaveURL(/\/unauthorized$/);const writes=rows.filter(r=>r.method==="PUT");expect(writes).toHaveLength(1);expect(writes[0].status).toBe(403);expect(writes[0].source).toBe("REFERENCE_BYTE_FOR_BYTE");checks.push({id:"actual-403-fixture-identity-change",status:"PASS"});
  108 | });
  109 | test("actual provider 401 requires new local login before cross-page recovery",async({page})=>{
  110 |  await login(page);identity="invalid-session";await page.goto("/settings/profile");await expect(page).toHaveURL(/\/login\?return_to=/);expect(rows.some(r=>r.path==="/v1/session"&&r.status===401)).toBe(true);await login(page);await page.goto("/settings/browser");await authorized(page);expect(rows.filter(r=>r.method==="PUT"||r.method==="DELETE")).toHaveLength(0);checks.push({id:"actual-401-explicit-local-login",status:"PASS"});
  111 | });
  112 | test("disconnect and offline cross-page recovery do not replay writes",async({page,context})=>{
  113 |  await login(page);await page.goto("/settings/profile");await authorized(page);await page.getByLabel("显示名称",{exact:true}).fill("Discard private draft");breakStream=true;for(const s of streams)s.destroy();await expect(page.locator('[data-route-access="invalidated"]')).toBeVisible();await expect(page.getByLabel("显示名称",{exact:true})).toHaveCount(0);await page.waitForTimeout(250);breakStream=false;await page.getByRole("button",{name:"重新验证访问条件",exact:true}).click();await authorized(page);await expect(page.getByLabel("显示名称",{exact:true})).not.toHaveValue("Discard private draft");await context.setOffline(true);await expect(page.locator('[data-route-access="invalidated"]')).toBeVisible();await context.setOffline(false);await page.getByRole("button",{name:"重新验证访问条件",exact:true}).click();await authorized(page);await page.goto("/command");await authorized(page);expect(rows.filter(r=>r.method==="PUT"||r.method==="DELETE")).toHaveLength(0);checks.push({id:"disconnect-offline-fresh-cross-page-read",status:"PASS"});
  114 | });
  115 | test("tampered callback state consumes pending auth and never establishes server session",async({page})=>{
  116 |  let callbackUrl="";await page.route(origin+"/authorize**",route=>{const u=new URL(route.request().url());const callback=new URL(terminal+"/auth/callback");callback.searchParams.set("code","local-one-use-code");callback.searchParams.set("state",u.searchParams.get("state")+"bad");callbackUrl=callback.href;return route.abort();});
  117 |  await page.goto("/login");await page.getByRole("button",{name:"使用组织账户继续",exact:true}).click();await expect.poll(()=>callbackUrl).not.toBe("");await page.goto(callbackUrl);await expect(page.getByRole("heading",{name:"登录失败",exact:true})).toBeVisible();expect(await page.evaluate(()=>sessionStorage.getItem("quantos.auth.pending"))).toBeNull();expect(rows.some(r=>r.path==="/token"||r.path==="/v1/auth/session")).toBe(false);checks.push({id:"tampered-state-no-session",status:"PASS",fault:"SYNTHETIC_CALLBACK_NAVIGATION"});
  118 | });
  119 | 
```