# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui104-bff.spec.ts >> notifications persist only approved settings fields
- Location: tests/e2e/ui104-bff.spec.ts:34:5

# Error details

```
Error: expect(received).not.toHaveProperty(path)

Expected path: not "objectVersion"

Received value: "notifications-v7"
```

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/通知偏好已保存/)
Expected: visible
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText(/通知偏好已保存/)
  - Protocol error (Runtime.callFunctionOn): Internal server error, session closed.

```

```yaml
- alert
- link "跳至正文":
  - /url: "#_r_0_"
- banner:
  - button "折叠侧栏" [expanded]: SUMALPHA
  - text: ▣ Workspace 11111111… Account 11111111… SHADOW
  - textbox "全局搜索":
    - /placeholder: 搜索  ⌘K
  - button "通知，0 条未读": ♧
  - button "帮助": "?"
  - link "打开个人设置":
    - /url: /settings/profile
    - text: AN
- complementary "主导航":
  - navigation:
    - link "Audit":
      - /url: /audit
- main:
  - paragraph: Settings / notifications
  - heading "Notification settings" [level=1]
  - paragraph: 配置授权渠道、静默时段与关键安全提醒。
  - button "重新验证并保留草稿" [disabled]
  - link "关闭设置":
    - /url: /command
    - text: × 关闭
  - complementary "设置导航":
    - text: AN
    - strong: Alex Ning
    - text: alex.ning@sumalpha.ai Risk Approver member-018 · ● Active
    - navigation:
      - link "个人资料":
        - /url: /settings/profile
      - link "通知设置":
        - /url: /settings/notifications
      - link "安全与 MFA 3":
        - /url: /settings/security
        - text: 安全与 MFA
        - emphasis: "3"
      - link "Web Browser":
        - /url: /settings/browser
    - strong: ▣ Workspace 11111111…
    - text: 角色：Risk Approver 权限以服务端响应为准
  - group:
    - heading "通知矩阵" [level=2]
    - text: 浏览器权限：denied
    - status:
      - paragraph: 已降级为站内通知
      - text: 拒绝或不支持浏览器通知不会影响站内风险状态，也不会反复弹窗。
    - table "通知偏好矩阵":
      - row "通知类型 严重性 In-app Desktop Email Browser":
        - columnheader "通知类型"
        - columnheader "严重性"
        - columnheader "In-app"
        - columnheader "Desktop"
        - columnheader "Email"
        - columnheader "Browser"
      - row "Critical risk / Kill switch critical Critical risk / Kill switch In-app On Critical risk / Kill switch Desktop On Critical risk / Kill switch Email On Critical risk / Kill switch Browser Off":
        - cell "Critical risk / Kill switch"
        - cell "critical"
        - cell "Critical risk / Kill switch In-app On":
          - checkbox "Critical risk / Kill switch In-app" [checked] [disabled]
          - text: "On"
        - cell "Critical risk / Kill switch Desktop On":
          - checkbox "Critical risk / Kill switch Desktop" [checked] [disabled]
          - text: "On"
        - cell "Critical risk / Kill switch Email On":
          - checkbox "Critical risk / Kill switch Email" [checked] [disabled]
          - text: "On"
        - cell "Critical risk / Kill switch Browser Off":
          - checkbox "Critical risk / Kill switch Browser" [disabled]
          - text: "Off"
      - row "Approval expiring warning Approval expiring In-app On Approval expiring Desktop On Approval expiring Email On Approval expiring Browser Off":
        - cell "Approval expiring"
        - cell "warning"
        - cell "Approval expiring In-app On":
          - checkbox "Approval expiring In-app" [checked] [disabled]
          - text: "On"
        - cell "Approval expiring Desktop On":
          - checkbox "Approval expiring Desktop" [checked] [disabled]
          - text: "On"
        - cell "Approval expiring Email On":
          - checkbox "Approval expiring Email" [checked] [disabled]
          - text: "On"
        - cell "Approval expiring Browser Off":
          - checkbox "Approval expiring Browser" [disabled]
          - text: "Off"
      - row "Order rejected / partial fill warning Order rejected / partial fill In-app On Order rejected / partial fill Desktop On Order rejected / partial fill Email On Order rejected / partial fill Browser Off":
        - cell "Order rejected / partial fill"
        - cell "warning"
        - cell "Order rejected / partial fill In-app On":
          - checkbox "Order rejected / partial fill In-app" [checked] [disabled]
          - text: "On"
        - cell "Order rejected / partial fill Desktop On":
          - checkbox "Order rejected / partial fill Desktop" [checked] [disabled]
          - text: "On"
        - cell "Order rejected / partial fill Email On":
          - checkbox "Order rejected / partial fill Email" [checked] [disabled]
          - text: "On"
        - cell "Order rejected / partial fill Browser Off":
          - checkbox "Order rejected / partial fill Browser" [disabled]
          - text: "Off"
      - row "Incident assigned info Incident assigned In-app On Incident assigned Desktop Off Incident assigned Email On Incident assigned Browser Off":
        - cell "Incident assigned"
        - cell "info"
        - cell "Incident assigned In-app On":
          - checkbox "Incident assigned In-app" [checked] [disabled]
          - text: "On"
        - cell "Incident assigned Desktop Off":
          - checkbox "Incident assigned Desktop" [disabled]
          - text: "Off"
        - cell "Incident assigned Email On":
          - checkbox "Incident assigned Email" [checked] [disabled]
          - text: "On"
        - cell "Incident assigned Browser Off":
          - checkbox "Incident assigned Browser" [disabled]
          - text: "Off"
      - row "Research completed info Research completed In-app On Research completed Desktop Off Research completed Email On Research completed Browser Off":
        - cell "Research completed"
        - cell "info"
        - cell "Research completed In-app On":
          - checkbox "Research completed In-app" [checked] [disabled]
          - text: "On"
        - cell "Research completed Desktop Off":
          - checkbox "Research completed Desktop" [disabled]
          - text: "Off"
        - cell "Research completed Email On":
          - checkbox "Research completed Email" [checked] [disabled]
          - text: "On"
        - cell "Research completed Browser Off":
          - checkbox "Research completed Browser" [disabled]
          - text: "Off"
      - row "Report / export ready info Report / export ready In-app On Report / export ready Desktop Off Report / export ready Email On Report / export ready Browser Off":
        - cell "Report / export ready"
        - cell "info"
        - cell "Report / export ready In-app On":
          - checkbox "Report / export ready In-app" [checked] [disabled]
          - text: "On"
        - cell "Report / export ready Desktop Off":
          - checkbox "Report / export ready Desktop" [disabled]
          - text: "Off"
        - cell "Report / export ready Email On":
          - checkbox "Report / export ready Email" [checked] [disabled]
          - text: "On"
        - cell "Report / export ready Browser Off":
          - checkbox "Report / export ready Browser" [disabled]
          - text: "Off"
    - checkbox "启用静默时段" [disabled]
    - text: 启用静默时段 静默时段
    - textbox "静默开始时间" [disabled]: 22:00
    - text: –
    - textbox "静默结束时间" [disabled]: 07:00
    - checkbox "Critical 绕过静默" [checked] [disabled]
    - text: Critical 绕过静默 摘要频率
    - combobox "摘要频率" [disabled]:
      - option "关闭" [disabled]
      - option "Daily 08:00" [disabled] [selected]
      - option "Weekly" [disabled]
    - button "保存通知偏好" [disabled]
- contentinfo "连接状态": 网络：可用 设置快照；写操作单独验证 读取完成：2026-10-21T04:22:38.359Z
```

# Test source

```ts
  1  | import { expect, test, type Page, type Request } from "@playwright/test";
  2  | import { AxeBuilder } from "@axe-core/playwright";
  3  | import { writeFile } from "node:fs/promises";
  4  | import { bff, bundle, context, id } from "./fixtures/ui104";
  5  | const accepted={status:"accepted",jobId:id,correlationId:id,auditRef:id};
  6  | async function boundary(page:Page, hook:(request:Request)=>{status?:number;data?:unknown}|undefined=()=>undefined){
  7  |   const data=bundle(), requests:Request[]=[];const cors={"access-control-allow-origin":"http://localhost:3190","access-control-allow-credentials":"true","access-control-allow-headers":"content-type,x-csrf-token,x-reauth-token-ref,idempotency-key,if-match,x-request-id","access-control-allow-methods":"GET,POST,PUT,DELETE,OPTIONS"};
  8  |   await page.context().addCookies([{name:"quantos_csrf",value:"csrf-fixture",url:"http://localhost:3190"}]);
  9  |   await page.route(`${bff}/**`,async route=>{
  10 |     const r=route.request();if(r.method()==="OPTIONS")return route.fulfill({status:204,headers:cors});requests.push(r);const path=new URL(r.url()).pathname,custom=hook(r);if(custom)return route.fulfill({status:custom.status??200,headers:cors,contentType:"application/json",body:JSON.stringify(custom.data)});
  11 |     let body:unknown;
  12 |     if(path==="/v1/session"||path==="/v1/context")body=context();
  13 |     else if(path==="/v1/auth/mfa/challenges"){expect(r.postDataJSON()).toEqual({purpose:"security_change",code:"123456"});body={status:"verified",challengeRef:id};}
  14 |     else if(path==="/v1/auth/reauth")body={reauthTokenRef:id,expiresAt:new Date(Date.now()+30000).toISOString()};
  15 |     else if(r.method()==="DELETE")return route.fulfill({status:202,headers:cors,contentType:"application/json",body:JSON.stringify(accepted)});
  16 |     else if(path==="/v1/settings/profile"){if(r.method()==="PUT"){const input=r.postDataJSON();for(const key of ["roleLabels","email","memberId","objectVersion"])expect(input).not.toHaveProperty(key);Object.assign(data.profile,input,{objectVersion:"profile-v15"});}body=data.profile;}
  17 |     else if(path==="/v1/settings/notification-preferences"){if(r.method()==="PUT"){const input=r.postDataJSON();expect(input).not.toHaveProperty("objectVersion");expect(input).not.toHaveProperty("browserPermission");Object.assign(data.notifications,input,{objectVersion:"notification-v8"});}body=data.notifications;}
  18 |     else if(path==="/v1/settings/security")body=data.security;
  19 |     else if(path==="/v1/settings/sessions")body=data.sessions;
  20 |     else if(path==="/v1/settings/trusted-devices")body=data.devices;
  21 |     else if(path==="/v1/settings/downloads")body={items:data.downloads};
  22 |     else if(path==="/v1/platform/browser-capabilities")body=data.browserPolicy;
  23 |     else if(path===data.downloads[0]?.downloadPath)body={exportId:data.downloads[0].downloadId,downloadUrl:`${bff}/_bff/export-content/${data.downloads[0].downloadId}/${"a".repeat(64)}`,expiresAt:new Date(Date.now()+30000).toISOString(),sha256:"b".repeat(64),sizeBytes:5,mediaType:"text/csv",watermarked:true,retentionUntil:"2099-01-01T00:00:00Z",auditRef:id};
  24 |     else if(path.startsWith("/_bff/export-content/"))return route.fulfill({headers:{...cors,"content-disposition":"attachment; filename=proof.csv"},contentType:"text/csv",body:"proof"});
  25 |     else throw Error("Unexpected scoped path "+path);
  26 |     return route.fulfill({headers:cors,contentType:"application/json",body:JSON.stringify(body)});
  27 |   });return{data,requests};
  28 | }
  29 | const writes=(r:Request[])=>r.filter(x=>["PUT","POST","DELETE"].includes(x.method()));
  30 | async function dialog(page:Page){await page.getByRole("button",{name:"撤销会话",exact:true}).first().click();await expect(page.getByRole("button",{name:"取消",exact:true})).toBeFocused();await page.getByLabel(/输入“REVOKE sess-12de-remote”/).fill("REVOKE sess-12de-remote");await page.getByLabel("MFA 验证码").fill("123456");}
  31 | test("static settings HTML is guarded before any profile is rendered",async({request})=>{for(const section of ["profile","security","notifications","browser"]){const html=await(await request.get(`/settings/${section}`)).text();expect(html).toContain('data-settings-guard="checking"');expect(html).not.toContain("alex.ning@sumalpha.ai");expect(html).not.toContain('data-smoke="route-/settings/');}});
  32 | test("profile save uses actual context, CSRF/CAS and a real accepted response",async({page})=>{const t=await boundary(page);await page.goto("/settings/profile");await expect(page.locator(".q-workspace-mode")).toHaveText("SHADOW");await page.getByLabel("显示名称",{exact:true}).fill("Changed display");await page.getByRole("button",{name:"保存个人资料"}).click();await expect(page.getByText(/个人资料已保存/)).toBeVisible();const req=writes(t.requests)[0]!;expect(req.headers()["if-match"]).toBe("profile-v14");expect(req.headers()["x-csrf-token"]).toBe("csrf-fixture");await page.reload();await expect(page.getByLabel("显示名称",{exact:true})).toHaveValue("Changed display");});
  33 | test("409 keeps draft and needs explicit rebase plus another save",async({page})=>{let first=true;const t=await boundary(page,r=>{if(r.method()==="PUT"&&first){first=false;return{status:409,data:{code:"VERSION_CONFLICT",message:"internal",correlationId:id,currentVersion:"server-v99"}};}});await page.goto("/settings/profile");await page.getByLabel("显示名称",{exact:true}).fill("Keep draft");await page.getByRole("button",{name:"保存个人资料"}).click();await expect(page.getByText(/版本冲突；草稿已保留/)).toBeVisible();await expect(page.getByLabel("显示名称",{exact:true})).toHaveValue("Keep draft");t.data.profile.objectVersion="server-v99";await page.getByRole("button",{name:"加载最新版本并保留草稿"}).click();await expect(page.getByText(/最新版本已读取/)).toBeVisible();expect(writes(t.requests)).toHaveLength(1);await page.getByRole("button",{name:"保存个人资料"}).click();await expect(page.getByText(/个人资料已保存/)).toBeVisible();expect(writes(t.requests)[1]!.headers()["if-match"]).toBe("server-v99");});
> 34 | test("notifications persist only approved settings fields",async({page})=>{const t=await boundary(page);await page.goto("/settings/notifications");await page.getByRole("checkbox",{name:"启用静默时段",exact:true}).uncheck();await page.getByRole("button",{name:"保存通知偏好"}).click();await expect(page.getByText(/通知偏好已保存/)).toBeVisible();expect(writes(t.requests)[0]!.postDataJSON().quietHoursEnabled).toBe(false);});
     |                                                                                                                                                                                                                                                                                                                         ^ Error: expect(locator).toBeVisible() failed
  35 | test("security confirmation really sends MFA/reauth/delete and 202 keeps the resource pending",async({page})=>{const t=await boundary(page);await page.goto("/settings/security");await dialog(page);await page.getByRole("button",{name:"确认撤销会话",exact:true}).click();await expect(page.getByText(/会话撤销已受理/)).toBeVisible();await expect(page.getByRole("button",{name:"撤销处理中",exact:true})).toBeVisible();expect(writes(t.requests).map(r=>r.method())).toEqual(["POST","POST","DELETE"]);expect(writes(t.requests)[2]!.headers()["x-reauth-token-ref"]).toBe(id);await expect(page.locator(".settings-list-row code").filter({hasText:"sess-12de-remote"})).toBeVisible();});
  36 | test("MFA refusal never reaches reauth or delete and preserves a safe failure",async({page})=>{const t=await boundary(page,r=>new URL(r.url()).pathname.endsWith("/challenges")?{status:429,data:{code:"RATE_LIMITED",message:"private-account",correlationId:id,retryAfter:60}}:undefined);await page.goto("/settings/security");await dialog(page);await page.getByRole("button",{name:"确认撤销会话",exact:true}).click();await expect(page.getByRole("dialog")).toBeVisible();await expect(page.getByRole("dialog")).not.toContainText("private-account");expect(writes(t.requests)).toHaveLength(1);});
  37 | test("offline recovery keeps unsaved drafts and requires explicit revalidation",async({page,context:c})=>{const t=await boundary(page);await page.goto("/settings/profile");await page.getByLabel("显示名称",{exact:true}).fill("Offline draft");await c.setOffline(true);await page.evaluate(()=>dispatchEvent(new Event("offline")));await expect(page.getByRole("button",{name:"保存个人资料"})).toBeDisabled();await c.setOffline(false);await page.evaluate(()=>dispatchEvent(new Event("online")));await expect(page.getByRole("button",{name:"保存个人资料"})).toBeDisabled();expect(writes(t.requests)).toHaveLength(0);await page.getByRole("button",{name:"重新验证并保留草稿"}).click();await expect(page.getByRole("button",{name:"保存个人资料"})).toBeEnabled();await expect(page.getByLabel("显示名称",{exact:true})).toHaveValue("Offline draft");});
  38 | test("downloads mint no lease on load and consume a fresh lease only on click",async({page})=>{const t=await boundary(page);await page.goto("/settings/browser");await expect(page.getByRole("heading",{name:/最近下载记录/})).toBeVisible();expect(t.requests.some(r=>r.url().includes("/v1/exports/"))).toBe(false);const download=page.waitForEvent("download");await page.getByRole("button",{name:"下载",exact:true}).first().click();expect((await download).suggestedFilename()).toBe("proof.csv");expect(t.requests.filter(r=>r.url().includes("/v1/exports/"))).toHaveLength(1);});
  39 | test("denied native notification permission is requested only once and falls back",async({page})=>{await page.addInitScript(()=>{let count=0;Object.defineProperty(window,"Notification",{value:{permission:"default",requestPermission:async()=>{count++;(window.Notification as unknown as {permission:string}).permission="denied";return"denied";}}});Object.defineProperty(window,"ui104Prompts",{get:()=>count});});await boundary(page);await page.goto("/settings/browser");const button=page.getByRole("button",{name:"请求浏览器通知权限"});await button.click();await button.click();expect(await page.evaluate(()=>(window as unknown as{ui104Prompts:number}).ui104Prompts)).toBe(1);await expect(page.locator(".toast").filter({hasText:"不会重复弹窗"})).toBeVisible();});
  40 | for(const status of [401,403,404])test(`settings HTTP ${status} refuses before private read`,async({page})=>{const t=await boundary(page,r=>new URL(r.url()).pathname==="/v1/session"?{status,data:{code:"REFUSED",message:"private-detail"}}:undefined);await page.goto("/settings/profile");await expect(page).toHaveURL(status===401?/\/login\?return_to=/:/\/unauthorized$/);expect(t.requests).toHaveLength(1);await expect(page.locator("body")).not.toContainText("private-detail");});
  41 | test("four settings pages fit1440/390/CSS zoom and record axe without promoting native checks",async({page},info)=>{await boundary(page);const scans=[];for(const section of ["profile","notifications","security","browser"]){await page.setViewportSize({width:1440,height:900});await page.goto(`/settings/${section}`);await expect(page.locator(`[data-ui104-section="${section}"]`)).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);const a=await new AxeBuilder({page}).analyze();scans.push({section,violations:a.violations,incomplete:a.incomplete});expect(a.violations.filter(v=>["serious","critical"].includes(v.impact??"")),section).toEqual([]);const png=info.outputPath(section+".png");await page.screenshot({path:png,fullPage:true});await info.attach(section+".png",{path:png,contentType:"image/png"});await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);if(section==="security")await expect(page.locator(".settings-high-risk").first()).toBeHidden();await page.evaluate(()=>{document.documentElement.style.zoom="2";});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);}const p=info.outputPath("axe.json");await writeFile(p,JSON.stringify(scans,null,2));await info.attach("axe.json",{path:p,contentType:"application/json"});});
  42 | test("read-only profile needs no unrelated downloads and cannot save",async({page})=>{const t=await boundary(page,r=>new URL(r.url()).pathname==="/v1/context"?{data:{...context(),capabilities:["settings.read"]}}:undefined);await page.goto("/settings/profile");await expect(page.getByRole("button",{name:"保存个人资料"})).toBeDisabled();expect(t.requests.map(r=>new URL(r.url()).pathname)).toEqual(["/v1/session","/v1/context","/v1/settings/profile"]);});
  43 | test("failed revalidation retains unsaved draft as read-only and explicit recovery restores editing",async({page})=>{let refused=false;await boundary(page,r=>refused&&new URL(r.url()).pathname==="/v1/settings/profile"?{status:503,data:{code:"UNAVAILABLE",message:"private"}}:undefined);await page.goto("/settings/profile");await page.getByLabel("显示名称",{exact:true}).fill("Preserved on read error");refused=true;await page.getByRole("button",{name:"重新验证并保留草稿"}).click();await expect(page.getByRole("button",{name:"保存个人资料"})).toBeDisabled();await expect(page.getByLabel("显示名称",{exact:true})).toHaveValue("Preserved on read error");refused=false;await page.getByRole("button",{name:"重新验证并保留草稿"}).click();await expect(page.getByRole("button",{name:"保存个人资料"})).toBeEnabled();await expect(page.getByLabel("显示名称",{exact:true})).toHaveValue("Preserved on read error");});
  44 | test("clipboard rejection shows manual copy and never claims success",async({page})=>{await page.addInitScript(()=>Object.defineProperty(navigator,"clipboard",{value:{writeText:async()=>{throw Error("blocked");}}}));await boundary(page);await page.goto("/settings/browser");await page.getByRole("button",{name:"复制深链"}).click();await expect(page.locator(".toast")).toContainText("手动复制");await expect(page.locator(".toast")).not.toContainText("已复制");await expect(page.locator(".toast")).not.toContainText(context().accountId);});
  45 | test("foreign download lease is refused before navigation",async({page})=>{await boundary(page,r=>new URL(r.url()).pathname.startsWith("/v1/exports/")?{data:{exportId:bundle().downloads[0]!.downloadId,downloadUrl:`https://foreign.invalid/_bff/export-content/${bundle().downloads[0]!.downloadId}/${"a".repeat(64)}`,expiresAt:new Date(Date.now()+30000).toISOString(),sha256:"b".repeat(64),sizeBytes:5,mediaType:"text/csv",watermarked:true,retentionUntil:"2099-01-01T00:00:00Z",auditRef:id}}:undefined);await page.goto("/settings/browser");await page.getByRole("button",{name:"下载",exact:true}).first().click();await expect(page.locator(".toast")).toContainText("请求未完成");await expect(page).toHaveURL(/\/settings\/browser$/);});
  46 | 
```