# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui104-bff.spec.ts >> denied native notification permission is requested only once and falls back
- Location: tests/e2e/ui104-bff.spec.ts:39:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator:  getByText(/不会重复弹窗/).first()
Expected: visible
Received: hidden
Timeout:  5000ms

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText(/不会重复弹窗/).first()
    14 × locator resolved to <p>请使用地址栏的网站权限设置；拒绝后本页不会重复弹窗。</p>
       - unexpected value "hidden"

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
  - paragraph: Settings / browser
  - heading "Browser settings" [level=1]
  - paragraph: 查看浏览器通知、下载、存储、深链与响应式限制。
  - button "重新验证并保留草稿"
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
    - heading "♧ 浏览器通知 denied" [level=2]
    - paragraph: 允许通知后，我们只会推送你有权查看的高优先级事件。
    - term: Permission source
    - definition: Browser API
    - term: Availability
    - definition: Supported
    - term: Fallback
    - definition: 页面内通知已启用
    - button "请求浏览器通知权限"
    - group: 修改网站通知权限
    - paragraph: 只会在你点击后调用浏览器权限；拒绝后不会重复弹窗。
    - heading "⌄ 最近下载记录" [level=2]
    - region "最近下载记录":
      - strong: Audit export 00917
      - text: JSON-CSV
      - time: 2026年8月15日 08:42
      - text: ready
      - button "下载"
      - strong: Performance report
      - text: PDF
      - time: 2026年8月14日 17:23
      - text: downloaded
      - button "下载" [disabled]
      - strong: Snapshot metadata
      - text: Parquet
      - time: 2026年8月10日 10:11
      - text: expired
      - button "下载" [disabled]
    - status:
      - paragraph: 下载安全说明
      - text: 文件仅通过 BFF 短时签名 URL 提供；链接过期、越权或已撤销时必须重新生成，下载会写入审计。
    - heading "▱ 会话与站点存储" [level=2]
    - list:
      - listitem: Auth session 由身份服务管理
      - listitem: Cookies 会话由 BFF 管理
      - listitem: Local storage 仅用户偏好
      - listitem: IndexedDB 可用
      - listitem: Secrets/tokens 不保存长期密钥
    - paragraph: 领域秘密不会存储在浏览器；离线状态只读。
    - heading "⌁ 授权深链" [level=2]
    - code: https://app.sumalpha.ai/auth/callback
    - list:
      - listitem: ✓ Resource reference only
      - listitem: ✓ no account data
      - listitem: ✓ authorization rechecked
      - listitem: ✓ route does not grant access
    - button "复制深链"
    - button "在新标签页验证"
    - heading "响应式与操作限制" [level=2]
    - text: Desktop 1440px
    - strong: 完整工作区，受 RBAC 控制
    - text: Mobile 390px
    - strong: 只读状态卡片
    - status:
      - paragraph: 小屏只读规则
      - text: 小于 768px 时隐藏审批、撤销会话、撤销设备、下单和其他高风险主操作；请使用桌面浏览器完成。
    - complementary:
      - heading "Browser 状态" [level=2]
      - paragraph: ♢ 能力已读取；实际可用性见检测结果
      - term: kind
      - definition: web
      - term: authFlow
      - definition: browser_redirect
      - term: notifications
      - definition: browser
      - term: localFileImport
      - definition: "false"
      - term: downloadsViaBff
      - definition: "true"
      - heading "兼容性检测" [level=3]
      - paragraph: Chrome 151 · Windows
      - paragraph: "✓ WebSocket: Supported"
      - paragraph: "✓ SSE: Supported"
      - paragraph: "△ Notifications: Limited"
      - paragraph: "✓ Clipboard: Supported"
      - paragraph: "✓ Download: Supported"
      - paragraph: "✓ Service worker: Supported"
      - paragraph: "✓ IndexedDB: Supported"
      - paragraph: "✓ Passkey: Supported"
      - heading "网页端限制" [level=3]
      - list:
        - listitem: 无原生多窗口恢复
        - listitem: 无系统文件关联
        - listitem: 无离线领域操作
        - listitem: 下载仅通过 BFF 签名 URL
  - status:
    - text: 通知不可请求或已有决定；保留站内通知，不会重复弹窗。
    - button "关闭通知": ×
- contentinfo "连接状态": 网络：可用 设置快照；写操作单独验证 读取完成：2026-10-21T04:18:18.008Z
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
> 39 | test("denied native notification permission is requested only once and falls back",async({page})=>{await page.addInitScript(()=>{let count=0;Object.defineProperty(window,"Notification",{value:{permission:"default",requestPermission:async()=>{count++;(window.Notification as unknown as {permission:string}).permission="denied";return"denied";}}});Object.defineProperty(window,"ui104Prompts",{get:()=>count});});await boundary(page);await page.goto("/settings/browser");const button=page.getByRole("button",{name:"请求浏览器通知权限"});await button.click();await button.click();expect(await page.evaluate(()=>(window as unknown as{ui104Prompts:number}).ui104Prompts)).toBe(1);await expect(page.getByText(/不会重复弹窗/).first()).toBeVisible();});
     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         ^ Error: expect(locator).toBeVisible() failed
  40 | for(const status of [401,403,404])test(`settings HTTP ${status} refuses before private read`,async({page})=>{const t=await boundary(page,r=>new URL(r.url()).pathname==="/v1/session"?{status,data:{code:"REFUSED",message:"private-detail"}}:undefined);await page.goto("/settings/profile");await expect(page).toHaveURL(status===401?/\/login\?return_to=/:/\/unauthorized$/);expect(t.requests).toHaveLength(1);await expect(page.locator("body")).not.toContainText("private-detail");});
  41 | test("four settings pages fit1440/390/CSS zoom and record axe without promoting native checks",async({page},info)=>{await boundary(page);const scans=[];for(const section of ["profile","notifications","security","browser"]){await page.setViewportSize({width:1440,height:900});await page.goto(`/settings/${section}`);await expect(page.locator(`[data-ui104-section="${section}"]`)).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);const a=await new AxeBuilder({page}).analyze();scans.push({section,violations:a.violations,incomplete:a.incomplete});expect(a.violations.filter(v=>["serious","critical"].includes(v.impact??"")),section).toEqual([]);const png=info.outputPath(section+".png");await page.screenshot({path:png,fullPage:true});await info.attach(section+".png",{path:png,contentType:"image/png"});await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);if(section==="security")await expect(page.locator(".settings-high-risk").first()).toBeHidden();await page.evaluate(()=>{document.documentElement.style.zoom="2";});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);}const p=info.outputPath("axe.json");await writeFile(p,JSON.stringify(scans,null,2));await info.attach("axe.json",{path:p,contentType:"application/json"});});
  42 | test("read-only profile needs no unrelated downloads and cannot save",async({page})=>{const t=await boundary(page,r=>new URL(r.url()).pathname==="/v1/context"?{data:{...context(),capabilities:["settings.read"]}}:undefined);await page.goto("/settings/profile");await expect(page.getByRole("button",{name:"保存个人资料"})).toBeDisabled();expect(t.requests.map(r=>new URL(r.url()).pathname)).toEqual(["/v1/session","/v1/context","/v1/settings/profile"]);});
  43 | test("failed revalidation retains unsaved draft as read-only and explicit recovery restores editing",async({page})=>{let refused=false;await boundary(page,r=>refused&&new URL(r.url()).pathname==="/v1/settings/profile"?{status:503,data:{code:"UNAVAILABLE",message:"private"}}:undefined);await page.goto("/settings/profile");await page.getByLabel("显示名称",{exact:true}).fill("Preserved on read error");refused=true;await page.getByRole("button",{name:"重新验证并保留草稿"}).click();await expect(page.getByRole("button",{name:"保存个人资料"})).toBeDisabled();await expect(page.getByLabel("显示名称",{exact:true})).toHaveValue("Preserved on read error");refused=false;await page.getByRole("button",{name:"重新验证并保留草稿"}).click();await expect(page.getByRole("button",{name:"保存个人资料"})).toBeEnabled();await expect(page.getByLabel("显示名称",{exact:true})).toHaveValue("Preserved on read error");});
  44 | test("clipboard rejection shows manual copy and never claims success",async({page})=>{await page.addInitScript(()=>Object.defineProperty(navigator,"clipboard",{value:{writeText:async()=>{throw Error("blocked");}}}));await boundary(page);await page.goto("/settings/browser");await page.getByRole("button",{name:"复制深链"}).click();await expect(page.locator(".toast")).toContainText("手动复制");await expect(page.locator(".toast")).not.toContainText("已复制");await expect(page.locator(".toast")).not.toContainText(context().accountId);});
  45 | test("foreign download lease is refused before navigation",async({page})=>{await boundary(page,r=>new URL(r.url()).pathname.startsWith("/v1/exports/")?{data:{exportId:bundle().downloads[0]!.downloadId,downloadUrl:`https://foreign.invalid/_bff/export-content/${bundle().downloads[0]!.downloadId}/${"a".repeat(64)}`,expiresAt:new Date(Date.now()+30000).toISOString(),sha256:"b".repeat(64),sizeBytes:5,mediaType:"text/csv",watermarked:true,retentionUntil:"2099-01-01T00:00:00Z",auditRef:id}}:undefined);await page.goto("/settings/browser");await page.getByRole("button",{name:"下载",exact:true}).first().click();await expect(page.locator(".toast")).toContainText("请求未完成");await expect(page).toHaveURL(/\/settings\/browser$/);});
  46 | 
```