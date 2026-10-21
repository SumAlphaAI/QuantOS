# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui104-bff.spec.ts >> four settings pages fit1440/390/CSS zoom and record axe without promoting native checks
- Location: tests/e2e/ui104-bff.spec.ts:41:5

# Error details

```
Error: expect(received).toBeLessThanOrEqual(expected)

Expected: <= 390
Received:    761
```

# Page snapshot

```yaml
- generic [active] [ref=f1e1]:
  - alert [ref=f1e2]
  - generic [ref=f1e4]:
    - link "跳至正文" [ref=f1e5] [cursor=pointer]:
      - /url: "#_r_0_"
    - banner [ref=f1e6]:
      - button "折叠侧栏" [expanded] [ref=f1e7] [cursor=pointer]:
        - emphasis [ref=f1e11]
      - generic [ref=f1e12]: SHADOW
      - button "通知，0 条未读" [ref=f1e13] [cursor=pointer]: ♧
      - link "打开个人设置" [ref=f1e14] [cursor=pointer]:
        - /url: /settings/profile
        - text: AN
    - main [ref=f1e15]:
      - generic [ref=f1e16]:
        - generic [ref=f1e17]:
          - paragraph [ref=f1e18]: Settings / notifications
          - heading "Notification settings" [level=1] [ref=f1e19]
          - paragraph [ref=f1e20]: 配置授权渠道、静默时段与关键安全提醒。
        - generic [ref=f1e21]:
          - button "重新验证并保留草稿" [ref=f1e22] [cursor=pointer]
          - link "关闭设置" [ref=f1e23] [cursor=pointer]:
            - /url: /command
            - text: × 关闭
      - generic [ref=f1e24]:
        - complementary "设置导航" [ref=f1e25]:
          - navigation [ref=f1e26]:
            - link "个人资料" [ref=f1e27] [cursor=pointer]:
              - /url: /settings/profile
              - generic [ref=f1e28]: ♙
              - text: 个人资料
            - link "通知设置" [ref=f1e29] [cursor=pointer]:
              - /url: /settings/notifications
              - generic [ref=f1e30]: ♧
              - text: 通知设置
            - link "安全与 MFA" [ref=f1e31] [cursor=pointer]:
              - /url: /settings/security
              - generic [ref=f1e32]: ♢
              - text: 安全与 MFA
            - link "Web Browser" [ref=f1e33] [cursor=pointer]:
              - /url: /settings/browser
              - generic [ref=f1e34]: ◎
              - text: Web Browser
        - group [ref=f1e36]:
          - generic [ref=f1e38]:
            - generic [ref=f1e39]:
              - heading "通知矩阵" [level=2] [ref=f1e40]
              - generic [ref=f1e41]: 浏览器权限：denied
            - status [ref=f1e42]:
              - paragraph [ref=f1e43]: 已降级为站内通知
              - generic [ref=f1e44]: 拒绝或不支持浏览器通知不会影响站内风险状态，也不会反复弹窗。
            - table "通知偏好矩阵" [ref=f1e45]:
              - row [ref=f1e46]:
                - columnheader "通知类型" [ref=f1e47]
                - columnheader "严重性" [ref=f1e48]
                - columnheader "In-app" [ref=f1e49]
                - columnheader "Desktop" [ref=f1e50]
                - columnheader "Email" [ref=f1e51]
                - columnheader "Browser" [ref=f1e52]
              - row [ref=f1e53]:
                - cell "Critical risk / Kill switch" [ref=f1e54]
                - cell "critical" [ref=f1e55]
                - cell "Critical risk / Kill switch In-app On" [ref=f1e56]:
                  - generic [ref=f1e57] [cursor=pointer]:
                    - checkbox "Critical risk / Kill switch In-app" [checked]
                    - generic [ref=f1e59]: "On"
                - cell "Critical risk / Kill switch Desktop On" [ref=f1e60]:
                  - generic [ref=f1e61] [cursor=pointer]:
                    - checkbox "Critical risk / Kill switch Desktop" [checked]
                    - generic [ref=f1e63]: "On"
                - cell "Critical risk / Kill switch Email On" [ref=f1e64]:
                  - generic [ref=f1e65] [cursor=pointer]:
                    - checkbox "Critical risk / Kill switch Email" [checked]
                    - generic [ref=f1e67]: "On"
                - cell "Critical risk / Kill switch Browser Off" [ref=f1e68]:
                  - generic [ref=f1e69]:
                    - checkbox "Critical risk / Kill switch Browser" [disabled]
                    - generic [ref=f1e71]: "Off"
              - row [ref=f1e72]:
                - cell "Approval expiring" [ref=f1e73]
                - cell "warning" [ref=f1e74]
                - cell "Approval expiring In-app On" [ref=f1e75]:
                  - generic [ref=f1e76] [cursor=pointer]:
                    - checkbox "Approval expiring In-app" [checked]
                    - generic [ref=f1e78]: "On"
                - cell "Approval expiring Desktop On" [ref=f1e79]:
                  - generic [ref=f1e80] [cursor=pointer]:
                    - checkbox "Approval expiring Desktop" [checked]
                    - generic [ref=f1e82]: "On"
                - cell "Approval expiring Email On" [ref=f1e83]:
                  - generic [ref=f1e84] [cursor=pointer]:
                    - checkbox "Approval expiring Email" [checked]
                    - generic [ref=f1e86]: "On"
                - cell "Approval expiring Browser Off" [ref=f1e87]:
                  - generic [ref=f1e88]:
                    - checkbox "Approval expiring Browser" [disabled]
                    - generic [ref=f1e90]: "Off"
              - row [ref=f1e91]:
                - cell "Order rejected / partial fill" [ref=f1e92]
                - cell "warning" [ref=f1e93]
                - cell "Order rejected / partial fill In-app On" [ref=f1e94]:
                  - generic [ref=f1e95] [cursor=pointer]:
                    - checkbox "Order rejected / partial fill In-app" [checked]
                    - generic [ref=f1e97]: "On"
                - cell "Order rejected / partial fill Desktop On" [ref=f1e98]:
                  - generic [ref=f1e99] [cursor=pointer]:
                    - checkbox "Order rejected / partial fill Desktop" [checked]
                    - generic [ref=f1e101]: "On"
                - cell "Order rejected / partial fill Email On" [ref=f1e102]:
                  - generic [ref=f1e103] [cursor=pointer]:
                    - checkbox "Order rejected / partial fill Email" [checked]
                    - generic [ref=f1e105]: "On"
                - cell "Order rejected / partial fill Browser Off" [ref=f1e106]:
                  - generic [ref=f1e107]:
                    - checkbox "Order rejected / partial fill Browser" [disabled]
                    - generic [ref=f1e109]: "Off"
              - row [ref=f1e110]:
                - cell "Incident assigned" [ref=f1e111]
                - cell "info" [ref=f1e112]
                - cell "Incident assigned In-app On" [ref=f1e113]:
                  - generic [ref=f1e114] [cursor=pointer]:
                    - checkbox "Incident assigned In-app" [checked]
                    - generic [ref=f1e116]: "On"
                - cell "Incident assigned Desktop Off" [ref=f1e117]:
                  - generic [ref=f1e118] [cursor=pointer]:
                    - checkbox "Incident assigned Desktop"
                    - generic [ref=f1e120]: "Off"
                - cell "Incident assigned Email On" [ref=f1e121]:
                  - generic [ref=f1e122] [cursor=pointer]:
                    - checkbox "Incident assigned Email" [checked]
                    - generic [ref=f1e124]: "On"
                - cell "Incident assigned Browser Off" [ref=f1e125]:
                  - generic [ref=f1e126]:
                    - checkbox "Incident assigned Browser" [disabled]
                    - generic [ref=f1e128]: "Off"
              - row [ref=f1e129]:
                - cell "Research completed" [ref=f1e130]
                - cell "info" [ref=f1e131]
                - cell "Research completed In-app On" [ref=f1e132]:
                  - generic [ref=f1e133] [cursor=pointer]:
                    - checkbox "Research completed In-app" [checked]
                    - generic [ref=f1e135]: "On"
                - cell "Research completed Desktop Off" [ref=f1e136]:
                  - generic [ref=f1e137] [cursor=pointer]:
                    - checkbox "Research completed Desktop"
                    - generic [ref=f1e139]: "Off"
                - cell "Research completed Email On" [ref=f1e140]:
                  - generic [ref=f1e141] [cursor=pointer]:
                    - checkbox "Research completed Email" [checked]
                    - generic [ref=f1e143]: "On"
                - cell "Research completed Browser Off" [ref=f1e144]:
                  - generic [ref=f1e145]:
                    - checkbox "Research completed Browser" [disabled]
                    - generic [ref=f1e147]: "Off"
              - row [ref=f1e148]:
                - cell "Report / export ready" [ref=f1e149]
                - cell "info" [ref=f1e150]
                - cell "Report / export ready In-app On" [ref=f1e151]:
                  - generic [ref=f1e152] [cursor=pointer]:
                    - checkbox "Report / export ready In-app" [checked]
                    - generic [ref=f1e154]: "On"
                - cell "Report / export ready Desktop Off" [ref=f1e155]:
                  - generic [ref=f1e156] [cursor=pointer]:
                    - checkbox "Report / export ready Desktop"
                    - generic [ref=f1e158]: "Off"
                - cell "Report / export ready Email On" [ref=f1e159]:
                  - generic [ref=f1e160] [cursor=pointer]:
                    - checkbox "Report / export ready Email" [checked]
                    - generic [ref=f1e162]: "On"
                - cell "Report / export ready Browser Off" [ref=f1e163]:
                  - generic [ref=f1e164]:
                    - checkbox "Report / export ready Browser" [disabled]
                    - generic [ref=f1e166]: "Off"
            - generic [ref=f1e167]:
              - generic [ref=f1e168] [cursor=pointer]:
                - checkbox "启用静默时段" [checked]
                - generic [ref=f1e170]: 启用静默时段
              - generic [ref=f1e171]:
                - text: 静默时段
                - textbox "静默开始时间" [ref=f1e172]: 22:00
                - text: –
                - textbox "静默结束时间" [ref=f1e173]: 07:00
              - generic [ref=f1e174] [cursor=pointer]:
                - checkbox "Critical 绕过静默" [checked]
                - generic [ref=f1e176]: Critical 绕过静默
              - generic [ref=f1e177]:
                - text: 摘要频率
                - combobox "摘要频率" [ref=f1e178]:
                  - option "关闭"
                  - option "Daily 08:00" [selected]
                  - option "Weekly"
              - button "保存通知偏好" [ref=f1e179] [cursor=pointer]
    - contentinfo "连接状态" [ref=f1e180]:
      - generic [ref=f1e181]: 网络：可用
      - generic [ref=f1e182]: 设置快照；写操作单独验证
      - generic [ref=f1e183]: 读取完成：2026-10-21T04:18:25.424Z
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
  34 | test("notifications persist only approved settings fields",async({page})=>{const t=await boundary(page);await page.goto("/settings/notifications");await page.getByRole("checkbox",{name:"启用静默时段",exact:true}).uncheck();await page.getByRole("button",{name:"保存通知偏好"}).click();await expect(page.getByText(/通知偏好已保存/)).toBeVisible();expect(writes(t.requests)[0]!.postDataJSON().quietHoursEnabled).toBe(false);});
  35 | test("security confirmation really sends MFA/reauth/delete and 202 keeps the resource pending",async({page})=>{const t=await boundary(page);await page.goto("/settings/security");await dialog(page);await page.getByRole("button",{name:"确认撤销会话",exact:true}).click();await expect(page.getByText(/会话撤销已受理/)).toBeVisible();await expect(page.getByRole("button",{name:"撤销处理中",exact:true})).toBeVisible();expect(writes(t.requests).map(r=>r.method())).toEqual(["POST","POST","DELETE"]);expect(writes(t.requests)[2]!.headers()["x-reauth-token-ref"]).toBe(id);await expect(page.getByText("sess-12de-remote",{exact:true})).toBeVisible();});
  36 | test("MFA refusal never reaches reauth or delete and preserves a safe failure",async({page})=>{const t=await boundary(page,r=>new URL(r.url()).pathname.endsWith("/challenges")?{status:429,data:{code:"RATE_LIMITED",message:"private-account",correlationId:id,retryAfter:60}}:undefined);await page.goto("/settings/security");await dialog(page);await page.getByRole("button",{name:"确认撤销会话",exact:true}).click();await expect(page.getByRole("dialog")).toBeVisible();await expect(page.getByRole("dialog")).not.toContainText("private-account");expect(writes(t.requests)).toHaveLength(1);});
  37 | test("offline recovery keeps unsaved drafts and requires explicit revalidation",async({page,context:c})=>{const t=await boundary(page);await page.goto("/settings/profile");await page.getByLabel("显示名称",{exact:true}).fill("Offline draft");await c.setOffline(true);await page.evaluate(()=>dispatchEvent(new Event("offline")));await expect(page.getByRole("button",{name:"保存个人资料"})).toBeDisabled();await c.setOffline(false);await page.evaluate(()=>dispatchEvent(new Event("online")));await expect(page.getByRole("button",{name:"保存个人资料"})).toBeDisabled();expect(writes(t.requests)).toHaveLength(0);await page.getByRole("button",{name:"重新验证并保留草稿"}).click();await expect(page.getByRole("button",{name:"保存个人资料"})).toBeEnabled();await expect(page.getByLabel("显示名称",{exact:true})).toHaveValue("Offline draft");});
  38 | test("downloads mint no lease on load and consume a fresh lease only on click",async({page})=>{const t=await boundary(page);await page.goto("/settings/browser");await expect(page.getByRole("heading",{name:/最近下载记录/})).toBeVisible();expect(t.requests.some(r=>r.url().includes("/v1/exports/"))).toBe(false);const download=page.waitForEvent("download");await page.getByRole("button",{name:"下载",exact:true}).first().click();expect((await download).suggestedFilename()).toBe("proof.csv");expect(t.requests.filter(r=>r.url().includes("/v1/exports/"))).toHaveLength(1);});
  39 | test("denied native notification permission is requested only once and falls back",async({page})=>{await page.addInitScript(()=>{let count=0;Object.defineProperty(window,"Notification",{value:{permission:"default",requestPermission:async()=>{count++;(window.Notification as unknown as {permission:string}).permission="denied";return"denied";}}});Object.defineProperty(window,"ui104Prompts",{get:()=>count});});await boundary(page);await page.goto("/settings/browser");const button=page.getByRole("button",{name:"请求浏览器通知权限"});await button.click();await button.click();expect(await page.evaluate(()=>(window as unknown as{ui104Prompts:number}).ui104Prompts)).toBe(1);await expect(page.getByText(/不会重复弹窗/).first()).toBeVisible();});
  40 | for(const status of [401,403,404])test(`settings HTTP ${status} refuses before private read`,async({page})=>{const t=await boundary(page,r=>new URL(r.url()).pathname==="/v1/session"?{status,data:{code:"REFUSED",message:"private-detail"}}:undefined);await page.goto("/settings/profile");await expect(page).toHaveURL(status===401?/\/login\?return_to=/:/\/unauthorized$/);expect(t.requests).toHaveLength(1);await expect(page.locator("body")).not.toContainText("private-detail");});
> 41 | test("four settings pages fit1440/390/CSS zoom and record axe without promoting native checks",async({page},info)=>{await boundary(page);const scans=[];for(const section of ["profile","notifications","security","browser"]){await page.setViewportSize({width:1440,height:900});await page.goto(`/settings/${section}`);await expect(page.locator(`[data-ui104-section="${section}"]`)).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);const a=await new AxeBuilder({page}).analyze();scans.push({section,violations:a.violations,incomplete:a.incomplete});expect(a.violations.filter(v=>["serious","critical"].includes(v.impact??"")),section).toEqual([]);const png=info.outputPath(section+".png");await page.screenshot({path:png,fullPage:true});await info.attach(section+".png",{path:png,contentType:"image/png"});await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);if(section==="security")await expect(page.locator(".settings-high-risk").first()).toBeHidden();await page.evaluate(()=>{document.documentElement.style.zoom="2";});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);}const p=info.outputPath("axe.json");await writeFile(p,JSON.stringify(scans,null,2));await info.attach("axe.json",{path:p,contentType:"application/json"});});
     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         ^ Error: expect(received).toBeLessThanOrEqual(expected)
  42 | test("read-only profile needs no unrelated downloads and cannot save",async({page})=>{const t=await boundary(page,r=>new URL(r.url()).pathname==="/v1/context"?{data:{...context(),capabilities:["settings.read"]}}:undefined);await page.goto("/settings/profile");await expect(page.getByRole("button",{name:"保存个人资料"})).toBeDisabled();expect(t.requests.map(r=>new URL(r.url()).pathname)).toEqual(["/v1/session","/v1/context","/v1/settings/profile"]);});
  43 | test("failed revalidation retains unsaved draft as read-only and explicit recovery restores editing",async({page})=>{let refused=false;await boundary(page,r=>refused&&new URL(r.url()).pathname==="/v1/settings/profile"?{status:503,data:{code:"UNAVAILABLE",message:"private"}}:undefined);await page.goto("/settings/profile");await page.getByLabel("显示名称",{exact:true}).fill("Preserved on read error");refused=true;await page.getByRole("button",{name:"重新验证并保留草稿"}).click();await expect(page.getByRole("button",{name:"保存个人资料"})).toBeDisabled();await expect(page.getByLabel("显示名称",{exact:true})).toHaveValue("Preserved on read error");refused=false;await page.getByRole("button",{name:"重新验证并保留草稿"}).click();await expect(page.getByRole("button",{name:"保存个人资料"})).toBeEnabled();await expect(page.getByLabel("显示名称",{exact:true})).toHaveValue("Preserved on read error");});
  44 | test("clipboard rejection shows manual copy and never claims success",async({page})=>{await page.addInitScript(()=>Object.defineProperty(navigator,"clipboard",{value:{writeText:async()=>{throw Error("blocked");}}}));await boundary(page);await page.goto("/settings/browser");await page.getByRole("button",{name:"复制深链"}).click();await expect(page.locator(".toast")).toContainText("手动复制");await expect(page.locator(".toast")).not.toContainText("已复制");await expect(page.locator(".toast")).not.toContainText(context().accountId);});
  45 | test("foreign download lease is refused before navigation",async({page})=>{await boundary(page,r=>new URL(r.url()).pathname.startsWith("/v1/exports/")?{data:{exportId:bundle().downloads[0]!.downloadId,downloadUrl:`https://foreign.invalid/_bff/export-content/${bundle().downloads[0]!.downloadId}/${"a".repeat(64)}`,expiresAt:new Date(Date.now()+30000).toISOString(),sha256:"b".repeat(64),sizeBytes:5,mediaType:"text/csv",watermarked:true,retentionUntil:"2099-01-01T00:00:00Z",auditRef:id}}:undefined);await page.goto("/settings/browser");await page.getByRole("button",{name:"下载",exact:true}).first().click();await expect(page.locator(".toast")).toContainText("请求未完成");await expect(page).toHaveURL(/\/settings\/browser$/);});
  46 | 
```