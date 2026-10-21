# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui104-bff.spec.ts >> read-only profile needs no unrelated downloads and cannot save
- Location: tests/e2e/ui104-bff.spec.ts:42:5

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 0
+ Received  + 1

  Array [
    "/v1/session",
+   "/v1/session",
    "/v1/context",
    "/v1/settings/profile",
  ]
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
      - navigation
    - main [ref=e23]:
      - generic [ref=e24]:
        - generic [ref=e25]:
          - paragraph [ref=e26]: Settings / profile
          - heading "Profile & Settings" [level=1] [ref=e27]
          - paragraph [ref=e28]: 管理个人资料、显示偏好与区域设置。
        - generic [ref=e29]:
          - button "重新验证并保留草稿" [ref=e30] [cursor=pointer]
          - link "关闭设置" [ref=e31] [cursor=pointer]:
            - /url: /command
            - text: × 关闭
      - generic [ref=e32]:
        - complementary "设置导航" [ref=e33]:
          - generic [ref=e34]:
            - generic [ref=e35]: AN
            - strong [ref=e36]: Alex Ning
            - generic [ref=e37]: alex.ning@sumalpha.ai
            - generic [ref=e38]: Risk Approver
            - generic [ref=e39]: member-018 · ● Active
          - navigation [ref=e40]:
            - link "个人资料" [ref=e41] [cursor=pointer]:
              - /url: /settings/profile
              - generic [ref=e42]: ♙
              - text: 个人资料
            - link "通知设置" [ref=e43] [cursor=pointer]:
              - /url: /settings/notifications
              - generic [ref=e44]: ♧
              - text: 通知设置
            - link [ref=e45] [cursor=pointer]:
              - /url: /settings/security
              - generic [ref=e46]: ♢
              - text: 安全与 MFA
              - emphasis [ref=e47]: "3"
            - link "Web Browser" [ref=e48] [cursor=pointer]:
              - /url: /settings/browser
              - generic [ref=e49]: ◎
              - text: Web Browser
          - generic [ref=e50]:
            - strong [ref=e51]: ▣ Workspace 11111111…
            - generic [ref=e52]: 角色：Risk Approver
            - generic [ref=e53]: 权限以服务端响应为准
        - group [ref=e55]:
          - generic [ref=e56]:
            - generic [ref=e57]:
              - heading "个人资料" [level=2] [ref=e58]
              - generic [ref=e59]:
                - generic [ref=e60]:
                  - text: 显示名称
                  - textbox "显示名称" [disabled] [ref=e61]: Alex Ning
                - generic [ref=e62]:
                  - text: 电子邮件
                  - textbox "电子邮件" [disabled] [ref=e63]: alex.ning@sumalpha.ai
                - generic [ref=e64]:
                  - text: 职位
                  - textbox "职位" [disabled] [ref=e65]: Risk Approver
                - generic [ref=e66]:
                  - text: 团队
                  - textbox "团队" [disabled] [ref=e67]: Risk & Governance
              - paragraph [ref=e68]: ⓘ 电子邮件由身份提供商或管理员管理；资料保存不会更改角色与权限。已验证：是
              - generic [ref=e69]:
                - button "保存个人资料" [disabled] [ref=e70]
                - button "撤销编辑" [disabled] [ref=e71]
            - generic [ref=e72]:
              - heading "显示与区域" [level=2] [ref=e73]
              - generic [ref=e74]:
                - generic [ref=e75]:
                  - text: 语言
                  - combobox "语言" [disabled] [ref=e76]:
                    - option "简体中文" [disabled] [selected]
                    - option "English" [disabled]
                - generic [ref=e77]:
                  - text: 数字格式
                  - combobox "数字格式" [disabled] [ref=e78]:
                    - option "1,234.56" [disabled] [selected]
                    - option "1 234,56" [disabled]
                - generic [ref=e79]:
                  - text: 时区
                  - combobox "时区" [disabled] [ref=e80]:
                    - option "Asia/Shanghai" [disabled] [selected]
                    - option "UTC" [disabled]
                - generic [ref=e81]:
                  - text: 默认页面
                  - combobox "默认页面" [disabled] [ref=e82]:
                    - option "Command Center" [disabled] [selected]
                    - option "Research" [disabled]
                    - option "Portfolio" [disabled]
                    - option "Markets" [disabled]
                - generic [ref=e83]:
                  - text: 主题
                  - combobox "主题" [disabled] [ref=e84]:
                    - option "深色" [disabled] [selected]
                    - option "浅色" [disabled]
                    - option "系统" [disabled]
                - generic [ref=e85]:
                  - text: 密度
                  - combobox "密度" [disabled] [ref=e86]:
                    - option "紧凑" [disabled] [selected]
                    - option "舒适" [disabled]
              - generic [ref=e87]:
                - generic [ref=e88] [cursor=pointer]:
                  - checkbox "高对比度" [disabled]
                  - generic [ref=e90]: 高对比度
                - generic [ref=e91] [cursor=pointer]:
                  - checkbox "减少动画" [disabled]
                  - generic [ref=e93]: 减少动画
    - contentinfo "连接状态" [ref=e94]:
      - generic [ref=e95]: 网络：可用
      - generic [ref=e96]: 设置快照；写操作单独验证
      - generic [ref=e97]: 读取完成：2026-10-21T04:18:26.616Z
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
  41 | test("four settings pages fit1440/390/CSS zoom and record axe without promoting native checks",async({page},info)=>{await boundary(page);const scans=[];for(const section of ["profile","notifications","security","browser"]){await page.setViewportSize({width:1440,height:900});await page.goto(`/settings/${section}`);await expect(page.locator(`[data-ui104-section="${section}"]`)).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);const a=await new AxeBuilder({page}).analyze();scans.push({section,violations:a.violations,incomplete:a.incomplete});expect(a.violations.filter(v=>["serious","critical"].includes(v.impact??"")),section).toEqual([]);const png=info.outputPath(section+".png");await page.screenshot({path:png,fullPage:true});await info.attach(section+".png",{path:png,contentType:"image/png"});await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);if(section==="security")await expect(page.locator(".settings-high-risk").first()).toBeHidden();await page.evaluate(()=>{document.documentElement.style.zoom="2";});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);}const p=info.outputPath("axe.json");await writeFile(p,JSON.stringify(scans,null,2));await info.attach("axe.json",{path:p,contentType:"application/json"});});
> 42 | test("read-only profile needs no unrelated downloads and cannot save",async({page})=>{const t=await boundary(page,r=>new URL(r.url()).pathname==="/v1/context"?{data:{...context(),capabilities:["settings.read"]}}:undefined);await page.goto("/settings/profile");await expect(page.getByRole("button",{name:"保存个人资料"})).toBeDisabled();expect(t.requests.map(r=>new URL(r.url()).pathname)).toEqual(["/v1/session","/v1/context","/v1/settings/profile"]);});
     |                                                                                                                                                                                                                                                                                                                                                                                                ^ Error: expect(received).toEqual(expected) // deep equality
  43 | test("failed revalidation retains unsaved draft as read-only and explicit recovery restores editing",async({page})=>{let refused=false;await boundary(page,r=>refused&&new URL(r.url()).pathname==="/v1/settings/profile"?{status:503,data:{code:"UNAVAILABLE",message:"private"}}:undefined);await page.goto("/settings/profile");await page.getByLabel("显示名称",{exact:true}).fill("Preserved on read error");refused=true;await page.getByRole("button",{name:"重新验证并保留草稿"}).click();await expect(page.getByRole("button",{name:"保存个人资料"})).toBeDisabled();await expect(page.getByLabel("显示名称",{exact:true})).toHaveValue("Preserved on read error");refused=false;await page.getByRole("button",{name:"重新验证并保留草稿"}).click();await expect(page.getByRole("button",{name:"保存个人资料"})).toBeEnabled();await expect(page.getByLabel("显示名称",{exact:true})).toHaveValue("Preserved on read error");});
  44 | test("clipboard rejection shows manual copy and never claims success",async({page})=>{await page.addInitScript(()=>Object.defineProperty(navigator,"clipboard",{value:{writeText:async()=>{throw Error("blocked");}}}));await boundary(page);await page.goto("/settings/browser");await page.getByRole("button",{name:"复制深链"}).click();await expect(page.locator(".toast")).toContainText("手动复制");await expect(page.locator(".toast")).not.toContainText("已复制");await expect(page.locator(".toast")).not.toContainText(context().accountId);});
  45 | test("foreign download lease is refused before navigation",async({page})=>{await boundary(page,r=>new URL(r.url()).pathname.startsWith("/v1/exports/")?{data:{exportId:bundle().downloads[0]!.downloadId,downloadUrl:`https://foreign.invalid/_bff/export-content/${bundle().downloads[0]!.downloadId}/${"a".repeat(64)}`,expiresAt:new Date(Date.now()+30000).toISOString(),sha256:"b".repeat(64),sizeBytes:5,mediaType:"text/csv",watermarked:true,retentionUntil:"2099-01-01T00:00:00Z",auditRef:id}}:undefined);await page.goto("/settings/browser");await page.getByRole("button",{name:"下载",exact:true}).first().click();await expect(page.locator(".toast")).toContainText("请求未完成");await expect(page).toHaveURL(/\/settings\/browser$/);});
  46 | 
```