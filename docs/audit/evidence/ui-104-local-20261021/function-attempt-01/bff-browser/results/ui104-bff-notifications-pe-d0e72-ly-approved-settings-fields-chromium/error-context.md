# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui104-bff.spec.ts >> notifications persist only approved settings fields
- Location: tests/e2e/ui104-bff.spec.ts:34:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.uncheck: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('checkbox', { name: '启用静默时段', exact: true })
    - locator resolved to <input checked type="checkbox" aria-label="启用静默时段"/>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <b>启用静默时段</b> intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <b>启用静默时段</b> intercepts pointer events
    - retrying click action
      - waiting 100ms
    58 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <b>启用静默时段</b> intercepts pointer events
     - retrying click action
       - waiting 500ms

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - alert [ref=e2]
  - generic [ref=e4]:
    - link "跳至正文" [ref=e5] [cursor=pointer]:
      - /url: "#_r_0_"
    - banner [ref=e6]:
      - button "折叠侧栏" [expanded] [ref=e7] [cursor=pointer]:
        - emphasis [ref=e11]
        - generic [ref=e12]: SUMALPHA
      - generic "当前主工作区（只读）：11111111-1111-4111-8111-111111111111" [ref=e13] [cursor=pointer]: ▣ Workspace 11111111…
      - generic "11111111-1111-4111-8111-111111111111" [ref=e14] [cursor=pointer]: Account 11111111…
      - generic [ref=e15]: SHADOW
      - generic [ref=e16]:
        - generic [ref=e17]: ⌕
        - textbox "全局搜索" [ref=e18]:
          - /placeholder: 搜索  ⌘K
      - button "通知，0 条未读" [ref=e19] [cursor=pointer]: ♧
      - button "帮助" [ref=e20] [cursor=pointer]: "?"
      - link "打开个人设置" [ref=e21] [cursor=pointer]:
        - /url: /settings/profile
        - text: AN
    - complementary "主导航" [ref=e22]:
      - navigation [ref=e23]:
        - link "Audit" [ref=e24] [cursor=pointer]:
          - /url: /audit
          - generic [ref=e25]: ▥
    - main [ref=e27]:
      - generic [ref=e28]:
        - generic [ref=e29]:
          - paragraph [ref=e30]: Settings / notifications
          - heading "Notification settings" [level=1] [ref=e31]
          - paragraph [ref=e32]: 配置授权渠道、静默时段与关键安全提醒。
        - generic [ref=e33]:
          - button "重新验证并保留草稿" [ref=e34] [cursor=pointer]
          - link "关闭设置" [ref=e35] [cursor=pointer]:
            - /url: /command
            - text: × 关闭
      - generic [ref=e36]:
        - complementary "设置导航" [ref=e37]:
          - generic [ref=e38]:
            - generic [ref=e39]: AN
            - strong [ref=e40]: Alex Ning
            - generic [ref=e41]: alex.ning@sumalpha.ai
            - generic [ref=e42]: Risk Approver
            - generic [ref=e43]: member-018 · ● Active
          - navigation [ref=e44]:
            - link "个人资料" [ref=e45] [cursor=pointer]:
              - /url: /settings/profile
              - generic [ref=e46]: ♙
              - text: 个人资料
            - link "通知设置" [ref=e47] [cursor=pointer]:
              - /url: /settings/notifications
              - generic [ref=e48]: ♧
              - text: 通知设置
            - link [ref=e49] [cursor=pointer]:
              - /url: /settings/security
              - generic [ref=e50]: ♢
              - text: 安全与 MFA
              - emphasis [ref=e51]: "3"
            - link "Web Browser" [ref=e52] [cursor=pointer]:
              - /url: /settings/browser
              - generic [ref=e53]: ◎
              - text: Web Browser
          - generic [ref=e54]:
            - strong [ref=e55]: ▣ Workspace 11111111…
            - generic [ref=e56]: 角色：Risk Approver
            - generic [ref=e57]: 权限以服务端响应为准
        - group [ref=e59]:
          - generic [ref=e61]:
            - generic [ref=e62]:
              - heading "通知矩阵" [level=2] [ref=e63]
              - generic [ref=e64]: 浏览器权限：denied
            - status [ref=e65]:
              - paragraph [ref=e66]: 已降级为站内通知
              - generic [ref=e67]: 拒绝或不支持浏览器通知不会影响站内风险状态，也不会反复弹窗。
            - table "通知偏好矩阵" [ref=e68]:
              - row [ref=e69]:
                - columnheader "通知类型" [ref=e70]
                - columnheader "严重性" [ref=e71]
                - columnheader "In-app" [ref=e72]
                - columnheader "Desktop" [ref=e73]
                - columnheader "Email" [ref=e74]
                - columnheader "Browser" [ref=e75]
              - row [ref=e76]:
                - cell "Critical risk / Kill switch" [ref=e77]
                - cell "critical" [ref=e78]
                - cell "Critical risk / Kill switch In-app On" [ref=e79]:
                  - generic [ref=e80] [cursor=pointer]:
                    - checkbox "Critical risk / Kill switch In-app" [checked]
                    - generic [ref=e82]: "On"
                - cell "Critical risk / Kill switch Desktop On" [ref=e83]:
                  - generic [ref=e84] [cursor=pointer]:
                    - checkbox "Critical risk / Kill switch Desktop" [checked]
                    - generic [ref=e86]: "On"
                - cell "Critical risk / Kill switch Email On" [ref=e87]:
                  - generic [ref=e88] [cursor=pointer]:
                    - checkbox "Critical risk / Kill switch Email" [checked]
                    - generic [ref=e90]: "On"
                - cell "Critical risk / Kill switch Browser Off" [ref=e91]:
                  - generic [ref=e92]:
                    - checkbox "Critical risk / Kill switch Browser" [disabled]
                    - generic [ref=e94]: "Off"
              - row [ref=e95]:
                - cell "Approval expiring" [ref=e96]
                - cell "warning" [ref=e97]
                - cell "Approval expiring In-app On" [ref=e98]:
                  - generic [ref=e99] [cursor=pointer]:
                    - checkbox "Approval expiring In-app" [checked]
                    - generic [ref=e101]: "On"
                - cell "Approval expiring Desktop On" [ref=e102]:
                  - generic [ref=e103] [cursor=pointer]:
                    - checkbox "Approval expiring Desktop" [checked]
                    - generic [ref=e105]: "On"
                - cell "Approval expiring Email On" [ref=e106]:
                  - generic [ref=e107] [cursor=pointer]:
                    - checkbox "Approval expiring Email" [checked]
                    - generic [ref=e109]: "On"
                - cell "Approval expiring Browser Off" [ref=e110]:
                  - generic [ref=e111]:
                    - checkbox "Approval expiring Browser" [disabled]
                    - generic [ref=e113]: "Off"
              - row [ref=e114]:
                - cell "Order rejected / partial fill" [ref=e115]
                - cell "warning" [ref=e116]
                - cell "Order rejected / partial fill In-app On" [ref=e117]:
                  - generic [ref=e118] [cursor=pointer]:
                    - checkbox "Order rejected / partial fill In-app" [checked]
                    - generic [ref=e120]: "On"
                - cell "Order rejected / partial fill Desktop On" [ref=e121]:
                  - generic [ref=e122] [cursor=pointer]:
                    - checkbox "Order rejected / partial fill Desktop" [checked]
                    - generic [ref=e124]: "On"
                - cell "Order rejected / partial fill Email On" [ref=e125]:
                  - generic [ref=e126] [cursor=pointer]:
                    - checkbox "Order rejected / partial fill Email" [checked]
                    - generic [ref=e128]: "On"
                - cell "Order rejected / partial fill Browser Off" [ref=e129]:
                  - generic [ref=e130]:
                    - checkbox "Order rejected / partial fill Browser" [disabled]
                    - generic [ref=e132]: "Off"
              - row [ref=e133]:
                - cell "Incident assigned" [ref=e134]
                - cell "info" [ref=e135]
                - cell "Incident assigned In-app On" [ref=e136]:
                  - generic [ref=e137] [cursor=pointer]:
                    - checkbox "Incident assigned In-app" [checked]
                    - generic [ref=e139]: "On"
                - cell "Incident assigned Desktop Off" [ref=e140]:
                  - generic [ref=e141] [cursor=pointer]:
                    - checkbox "Incident assigned Desktop"
                    - generic [ref=e143]: "Off"
                - cell "Incident assigned Email On" [ref=e144]:
                  - generic [ref=e145] [cursor=pointer]:
                    - checkbox "Incident assigned Email" [checked]
                    - generic [ref=e147]: "On"
                - cell "Incident assigned Browser Off" [ref=e148]:
                  - generic [ref=e149]:
                    - checkbox "Incident assigned Browser" [disabled]
                    - generic [ref=e151]: "Off"
              - row [ref=e152]:
                - cell "Research completed" [ref=e153]
                - cell "info" [ref=e154]
                - cell "Research completed In-app On" [ref=e155]:
                  - generic [ref=e156] [cursor=pointer]:
                    - checkbox "Research completed In-app" [checked]
                    - generic [ref=e158]: "On"
                - cell "Research completed Desktop Off" [ref=e159]:
                  - generic [ref=e160] [cursor=pointer]:
                    - checkbox "Research completed Desktop"
                    - generic [ref=e162]: "Off"
                - cell "Research completed Email On" [ref=e163]:
                  - generic [ref=e164] [cursor=pointer]:
                    - checkbox "Research completed Email" [checked]
                    - generic [ref=e166]: "On"
                - cell "Research completed Browser Off" [ref=e167]:
                  - generic [ref=e168]:
                    - checkbox "Research completed Browser" [disabled]
                    - generic [ref=e170]: "Off"
              - row [ref=e171]:
                - cell "Report / export ready" [ref=e172]
                - cell "info" [ref=e173]
                - cell "Report / export ready In-app On" [ref=e174]:
                  - generic [ref=e175] [cursor=pointer]:
                    - checkbox "Report / export ready In-app" [checked]
                    - generic [ref=e177]: "On"
                - cell "Report / export ready Desktop Off" [ref=e178]:
                  - generic [ref=e179] [cursor=pointer]:
                    - checkbox "Report / export ready Desktop"
                    - generic [ref=e181]: "Off"
                - cell "Report / export ready Email On" [ref=e182]:
                  - generic [ref=e183] [cursor=pointer]:
                    - checkbox "Report / export ready Email" [checked]
                    - generic [ref=e185]: "On"
                - cell "Report / export ready Browser Off" [ref=e186]:
                  - generic [ref=e187]:
                    - checkbox "Report / export ready Browser" [disabled]
                    - generic [ref=e189]: "Off"
            - generic [ref=e190]:
              - generic [ref=e191] [cursor=pointer]:
                - checkbox "启用静默时段" [checked]
                - generic [ref=e193]: 启用静默时段
              - generic [ref=e194]:
                - text: 静默时段
                - textbox "静默开始时间" [ref=e195]: 22:00
                - text: –
                - textbox "静默结束时间" [ref=e196]: 07:00
              - generic [ref=e197] [cursor=pointer]:
                - checkbox "Critical 绕过静默" [checked]
                - generic [ref=e199]: Critical 绕过静默
              - generic [ref=e200]:
                - text: 摘要频率
                - combobox "摘要频率" [ref=e201]:
                  - option "关闭"
                  - option "Daily 08:00" [selected]
                  - option "Weekly"
              - button "保存通知偏好" [ref=e202] [cursor=pointer]
    - contentinfo "连接状态" [ref=e203]:
      - generic [ref=e204]: 网络：可用
      - generic [ref=e205]: 设置快照；写操作单独验证
      - generic [ref=e206]: 读取完成：2026-10-21T04:17:41.305Z
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
     |                                                                                                                                                                                                                ^ Error: locator.uncheck: Test timeout of 30000ms exceeded.
  35 | test("security confirmation really sends MFA/reauth/delete and 202 keeps the resource pending",async({page})=>{const t=await boundary(page);await page.goto("/settings/security");await dialog(page);await page.getByRole("button",{name:"确认撤销会话",exact:true}).click();await expect(page.getByText(/会话撤销已受理/)).toBeVisible();await expect(page.getByRole("button",{name:"撤销处理中",exact:true})).toBeVisible();expect(writes(t.requests).map(r=>r.method())).toEqual(["POST","POST","DELETE"]);expect(writes(t.requests)[2]!.headers()["x-reauth-token-ref"]).toBe(id);await expect(page.getByText("sess-12de-remote",{exact:true})).toBeVisible();});
  36 | test("MFA refusal never reaches reauth or delete and preserves a safe failure",async({page})=>{const t=await boundary(page,r=>new URL(r.url()).pathname.endsWith("/challenges")?{status:429,data:{code:"RATE_LIMITED",message:"private-account",correlationId:id,retryAfter:60}}:undefined);await page.goto("/settings/security");await dialog(page);await page.getByRole("button",{name:"确认撤销会话",exact:true}).click();await expect(page.getByRole("dialog")).toBeVisible();await expect(page.getByRole("dialog")).not.toContainText("private-account");expect(writes(t.requests)).toHaveLength(1);});
  37 | test("offline recovery keeps unsaved drafts and requires explicit revalidation",async({page,context:c})=>{const t=await boundary(page);await page.goto("/settings/profile");await page.getByLabel("显示名称",{exact:true}).fill("Offline draft");await c.setOffline(true);await page.evaluate(()=>dispatchEvent(new Event("offline")));await expect(page.getByRole("button",{name:"保存个人资料"})).toBeDisabled();await c.setOffline(false);await page.evaluate(()=>dispatchEvent(new Event("online")));await expect(page.getByRole("button",{name:"保存个人资料"})).toBeDisabled();expect(writes(t.requests)).toHaveLength(0);await page.getByRole("button",{name:"重新验证并保留草稿"}).click();await expect(page.getByRole("button",{name:"保存个人资料"})).toBeEnabled();await expect(page.getByLabel("显示名称",{exact:true})).toHaveValue("Offline draft");});
  38 | test("downloads mint no lease on load and consume a fresh lease only on click",async({page})=>{const t=await boundary(page);await page.goto("/settings/browser");await expect(page.getByRole("heading",{name:/最近下载记录/})).toBeVisible();expect(t.requests.some(r=>r.url().includes("/v1/exports/"))).toBe(false);const download=page.waitForEvent("download");await page.getByRole("button",{name:"下载",exact:true}).first().click();expect((await download).suggestedFilename()).toBe("proof.csv");expect(t.requests.filter(r=>r.url().includes("/v1/exports/"))).toHaveLength(1);});
  39 | test("denied native notification permission is requested only once and falls back",async({page})=>{await page.addInitScript(()=>{let count=0;Object.defineProperty(window,"Notification",{value:{permission:"default",requestPermission:async()=>{count++;(window.Notification as unknown as {permission:string}).permission="denied";return"denied";}}});Object.defineProperty(window,"ui104Prompts",{get:()=>count});});await boundary(page);await page.goto("/settings/browser");const button=page.getByRole("button",{name:"请求浏览器通知权限"});await button.click();await button.click();expect(await page.evaluate(()=>(window as unknown as{ui104Prompts:number}).ui104Prompts)).toBe(1);await expect(page.getByText(/不会重复弹窗/).first()).toBeVisible();});
  40 | for(const status of [401,403,404])test(`settings HTTP ${status} refuses before private read`,async({page})=>{const t=await boundary(page,r=>new URL(r.url()).pathname==="/v1/session"?{status,data:{code:"REFUSED",message:"private-detail"}}:undefined);await page.goto("/settings/profile");await expect(page).toHaveURL(status===401?/\/login\?return_to=/:/\/unauthorized$/);expect(t.requests).toHaveLength(1);await expect(page.locator("body")).not.toContainText("private-detail");});
  41 | test("four settings pages fit1440/390/CSS zoom and record axe without promoting native checks",async({page},info)=>{await boundary(page);const scans=[];for(const section of ["profile","notifications","security","browser"]){await page.setViewportSize({width:1440,height:900});await page.goto(`/settings/${section}`);await expect(page.locator(`[data-ui104-section="${section}"]`)).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);const a=await new AxeBuilder({page}).analyze();scans.push({section,violations:a.violations,incomplete:a.incomplete});expect(a.violations.filter(v=>["serious","critical"].includes(v.impact??"")),section).toEqual([]);const png=info.outputPath(section+".png");await page.screenshot({path:png,fullPage:true});await info.attach(section+".png",{path:png,contentType:"image/png"});await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);if(section==="security")await expect(page.locator(".settings-high-risk").first()).toBeHidden();await page.evaluate(()=>{document.documentElement.style.zoom="2";});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);}const p=info.outputPath("axe.json");await writeFile(p,JSON.stringify(scans,null,2));await info.attach("axe.json",{path:p,contentType:"application/json"});});
  42 | test("read-only profile needs no unrelated downloads and cannot save",async({page})=>{const t=await boundary(page,r=>new URL(r.url()).pathname==="/v1/context"?{data:{...context(),capabilities:["settings.read"]}}:undefined);await page.goto("/settings/profile");await expect(page.getByRole("button",{name:"保存个人资料"})).toBeDisabled();expect(t.requests.map(r=>new URL(r.url()).pathname)).toEqual(["/v1/session","/v1/context","/v1/settings/profile"]);});
  43 | test("failed revalidation retains unsaved draft as read-only and explicit recovery restores editing",async({page})=>{let refused=false;await boundary(page,r=>refused&&new URL(r.url()).pathname==="/v1/settings/profile"?{status:503,data:{code:"UNAVAILABLE",message:"private"}}:undefined);await page.goto("/settings/profile");await page.getByLabel("显示名称",{exact:true}).fill("Preserved on read error");refused=true;await page.getByRole("button",{name:"重新验证并保留草稿"}).click();await expect(page.getByRole("button",{name:"保存个人资料"})).toBeDisabled();await expect(page.getByLabel("显示名称",{exact:true})).toHaveValue("Preserved on read error");refused=false;await page.getByRole("button",{name:"重新验证并保留草稿"}).click();await expect(page.getByRole("button",{name:"保存个人资料"})).toBeEnabled();await expect(page.getByLabel("显示名称",{exact:true})).toHaveValue("Preserved on read error");});
  44 | test("clipboard rejection shows manual copy and never claims success",async({page})=>{await page.addInitScript(()=>Object.defineProperty(navigator,"clipboard",{value:{writeText:async()=>{throw Error("blocked");}}}));await boundary(page);await page.goto("/settings/browser");await page.getByRole("button",{name:"复制深链"}).click();await expect(page.locator(".toast")).toContainText("手动复制");await expect(page.locator(".toast")).not.toContainText("已复制");await expect(page.locator(".toast")).not.toContainText(context().accountId);});
  45 | test("foreign download lease is refused before navigation",async({page})=>{await boundary(page,r=>new URL(r.url()).pathname.startsWith("/v1/exports/")?{data:{exportId:bundle().downloads[0]!.downloadId,downloadUrl:`https://foreign.invalid/_bff/export-content/${bundle().downloads[0]!.downloadId}/${"a".repeat(64)}`,expiresAt:new Date(Date.now()+30000).toISOString(),sha256:"b".repeat(64),sizeBytes:5,mediaType:"text/csv",watermarked:true,retentionUntil:"2099-01-01T00:00:00Z",auditRef:id}}:undefined);await page.goto("/settings/browser");await page.getByRole("button",{name:"下载",exact:true}).first().click();await expect(page.locator(".toast")).toContainText("请求未完成");await expect(page).toHaveURL(/\/settings\/browser$/);});
  46 | 
```