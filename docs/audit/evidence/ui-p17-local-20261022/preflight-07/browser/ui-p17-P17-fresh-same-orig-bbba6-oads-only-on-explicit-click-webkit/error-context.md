# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui-p17.spec.ts >> P17 fresh same origin signed ticket downloads only on explicit click
- Location: tests/e2e/ui-p17.spec.ts:25:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.waitForEvent: Test timeout of 30000ms exceeded.
=========================== logs ===========================
waiting for event "download"
============================================================
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - alert [ref=e2]
  - generic [ref=e4]:
    - link "跳至正文" [ref=e5]:
      - /url: "#_r_0_"
    - banner [ref=e6]:
      - button "折叠侧栏" [expanded] [ref=e7] [cursor=pointer]:
        - emphasis [ref=e11]
        - generic [ref=e12]: SUMALPHA
      - generic "当前主工作区（只读）：11111111-1111-4111-8111-111111111111" [ref=e13] [cursor=pointer]: ▣ Workspace 11111111…
      - generic "11111111-1111-4111-8111-111111111111" [ref=e14] [cursor=pointer]: Account 11111111…
      - generic [ref=e15]: PAPER
      - status "Unavailable" [ref=e18]:
        - generic [ref=e19]: ■
      - status "Unknown / upgrade required" [ref=e23]:
        - generic [ref=e24]: ▲
      - generic [ref=e26]:
        - generic [ref=e27]: ⌕
        - textbox "全局搜索" [disabled] [ref=e28]:
          - /placeholder: 搜索  ⌘K
      - button "通知" [disabled] [ref=e29] [cursor=pointer]: ♧
      - link "帮助" [ref=e30] [cursor=pointer]:
        - /url: "#settings-help"
        - text: "?"
      - link "打开个人设置" [ref=e31] [cursor=pointer]:
        - /url: /settings/profile
        - text: AN
    - complementary "主导航" [ref=e32]:
      - navigation [ref=e33]:
        - link "Command" [ref=e34]:
          - /url: /command
          - generic [ref=e35]: ⌂
        - link "Research" [ref=e37]:
          - /url: /research
          - generic [ref=e38]: ◉
        - link "Strategy" [ref=e40]:
          - /url: /strategies
          - generic [ref=e41]: ↗
        - link "Trade" [ref=e43]:
          - /url: /trade
          - generic [ref=e44]: ⇄
        - link "Proposals" [ref=e46]:
          - /url: /proposals
          - generic [ref=e47]: ▤
        - link "Approvals" [ref=e49]:
          - /url: /approvals
          - generic [ref=e50]: ✓
        - link "Orders" [ref=e52]:
          - /url: /orders
          - generic [ref=e53]: ▣
        - link "Audit" [ref=e55]:
          - /url: /audit
          - generic [ref=e56]: ▥
        - link "Operations" [ref=e58]:
          - /url: /operations
          - generic [ref=e59]: ≋
    - main [ref=e61]:
      - generic [ref=e62]:
        - generic [ref=e63]:
          - paragraph [ref=e64]: Settings / browser
          - heading "Browser settings" [level=1] [ref=e65]
          - paragraph [ref=e66]: 查看浏览器通知、下载、存储、深链与响应式限制。
        - generic [ref=e67]:
          - button "重新验证并保留草稿" [ref=e68] [cursor=pointer]
          - link "关闭设置" [ref=e69]:
            - /url: /command
            - text: × 关闭
      - generic [ref=e70]:
        - complementary "设置导航" [ref=e71]:
          - generic [ref=e72]:
            - generic [ref=e73]: AN
            - strong [ref=e74]: Alex Ning
            - generic [ref=e75]: alex.ning@sumalpha.ai
            - generic [ref=e76]: Risk Approver
            - generic [ref=e77]: member-018
          - navigation "设置分区" [ref=e78]:
            - link "个人资料" [ref=e79]:
              - /url: /settings/profile
              - generic [ref=e80]: ♙
              - text: 个人资料
            - link "通知设置" [ref=e81]:
              - /url: /settings/notifications
              - generic [ref=e82]: ♧
              - text: 通知设置
            - link "安全与 MFA" [ref=e83]:
              - /url: /settings/security
              - generic [ref=e84]: ♢
              - text: 安全与 MFA
            - link "Web Browser" [ref=e85]:
              - /url: /settings/browser
              - generic [ref=e86]: ◎
              - text: Web Browser
          - generic [ref=e87]:
            - strong [ref=e88]: ▣ Workspace 11111111…
            - generic [ref=e89]: 角色：Risk Approver
            - generic [ref=e90]: 权限以服务端响应为准
        - group [ref=e92]:
          - generic [ref=e93]:
            - generic [ref=e94]:
              - heading "♧ 浏览器通知 default" [level=2] [ref=e95]:
                - text: ♧ 浏览器通知
                - generic [ref=e96]: default
              - paragraph [ref=e97]: 原生权限由浏览器决定；业务通知仍受服务端策略与当前授权约束。
              - generic [ref=e98]:
                - term [ref=e99]: Permission source
                - definition [ref=e100]: Browser API · 当前采样
                - term [ref=e101]: 服务端渠道策略
                - definition [ref=e102]: browser
                - term [ref=e103]: Fallback
                - definition [ref=e104]: 保留站内通知；实际投递未验证
              - generic [ref=e105]:
                - button "请求浏览器通知权限" [ref=e106] [cursor=pointer]
                - group [ref=e107]:
                  - generic "修改网站通知权限" [ref=e108]
            - generic [ref=e109]:
              - heading "⌄ 最近下载记录 已读取 3 条" [level=2] [ref=e110]:
                - text: ⌄ 最近下载记录
                - generic [ref=e111]: 已读取 3 条
              - generic [ref=e112]:
                - text: 筛选已读取记录
                - combobox "筛选已读取记录" [ref=e113]:
                  - option "全部状态" [selected]
                  - option "ready"
                  - option "preparing"
                  - option "downloaded"
                  - option "failed"
                  - option "expired"
              - region "最近下载记录" [ref=e114]:
                - generic [ref=e115]:
                  - strong [ref=e116]: Audit export 00917
                  - generic [ref=e117]: JSON-CSV
                  - time [ref=e118]: 2026/8/15 08:42 Asia/Shanghai · 2026/8/15 00:42 UTC
                  - generic [ref=e119]: ready
                  - button "下载" [ref=e120] [cursor=pointer]
                - generic [ref=e121]:
                  - strong [ref=e122]: Performance report
                  - generic [ref=e123]: PDF
                  - time [ref=e124]: 2026/8/14 17:23 Asia/Shanghai · 2026/8/14 09:23 UTC
                  - generic [ref=e125]: downloaded
                  - button "下载" [disabled] [ref=e126]
                - generic [ref=e127]:
                  - strong [ref=e128]: Snapshot metadata
                  - generic [ref=e129]: Parquet
                  - time [ref=e130]: 2026/8/10 10:11 Asia/Shanghai · 2026/8/10 02:11 UTC
                  - generic [ref=e131]: expired
                  - button "下载" [disabled] [ref=e132]
              - paragraph [ref=e133]: 本次历史读取结束。
              - status [ref=e134]:
                - paragraph [ref=e135]: 下载安全说明
                - generic [ref=e136]: 仅在点击时申请 BFF 短链；文件过期或请求被拒绝时不会打开链接。最多读取 5 页 / 500 条；历史不保存签名 URL。
            - generic [ref=e137]:
              - heading "▱ 会话与站点存储" [level=2] [ref=e138]
              - generic [ref=e139]:
                - term [ref=e140]: Origin storage estimate
                - definition [ref=e141]: 0.0 MiB / 1000.0 MiB
                - term [ref=e142]: Service worker 控制
                - definition [ref=e143]: 未检测到当前控制器
                - term [ref=e144]: Cookies / Session
                - definition [ref=e145]: 由 BFF 管理；HttpOnly / Secure / SameSite 未在本页验证
              - paragraph [ref=e146]: 估算涵盖整个站点，可能变化；本页不扫描存储内容或认证秘密。
              - generic [ref=e147]:
                - link "清理本地布局偏好 ↓" [ref=e148]:
                  - /url: "#layout-cleanup"
                - link "查看活跃会话 ›" [ref=e149]:
                  - /url: /settings/security
              - paragraph [ref=e150]: 仅移除 quantos.command.layout.v1；不清除 Cookie、会话、IndexedDB 或业务记录。
            - generic [ref=e151]:
              - heading "⌁ 授权深链" [level=2] [ref=e152]
              - code [ref=e153]: https://app.sumalpha.ai/auth/callback
              - paragraph [ref=e154]: 服务端声明的回调方案。复制与验证按钮仅使用本站 /auth/deep-link 路由，资源访问重新鉴权。
              - generic [ref=e155]:
                - button "复制深链" [ref=e156] [cursor=pointer]
                - link "在新标签页验证" [ref=e157]:
                  - /url: /auth/deep-link?return_to=%2Fsettings%2Fbrowser
            - generic [ref=e158]:
              - heading "响应式与操作限制" [level=2] [ref=e159]
              - generic [ref=e160]:
                - generic [ref=e161]:
                  - text: Desktop 1440px
                  - strong [ref=e162]: 完整工作区 · RBAC
                - generic [ref=e163]:
                  - text: Mobile 390px
                  - strong [ref=e164]: 状态与只读信息
              - paragraph [ref=e165]: 布局示意；实际设备与原生 200% 缩放仍待验收。当前采样宽度：1440px。
              - status [ref=e166]:
                - paragraph [ref=e167]: 小屏只读规则
                - generic [ref=e168]: 小于 768px 时隐藏审批、撤销会话、撤销设备、下单和其他高风险主操作；普通浏览器权限不授予业务权限。
            - complementary [ref=e169]:
              - heading "Browser 状态" [level=2] [ref=e170]
              - paragraph [ref=e171]: 服务端策略声明 · 非运行时验证
              - generic [ref=e172]:
                - generic [ref=e173]:
                  - term [ref=e174]: kind
                  - definition [ref=e175]: web
                - generic [ref=e176]:
                  - term [ref=e177]: authFlow
                  - definition [ref=e178]: browser_redirect
                - generic [ref=e179]:
                  - term [ref=e180]: notifications
                  - definition [ref=e181]: browser
                - generic [ref=e182]:
                  - term [ref=e183]: localFileImport
                  - definition [ref=e184]: "false"
                - generic [ref=e185]:
                  - term [ref=e186]: downloadsViaBff
                  - definition [ref=e187]: "true"
              - heading "兼容性检测" [level=3] [ref=e188]
              - paragraph [ref=e189]: Safari 26 · macOS
              - button "重新检测兼容性" [ref=e190] [cursor=pointer]
              - paragraph [ref=e191]: 检测 API 是否存在；不代表连接、授权或投递成功。
              - paragraph [ref=e192]: "✓ WebSocket: API available"
              - paragraph [ref=e193]: "✓ SSE: API available"
              - paragraph [ref=e194]: "✓ Notifications API: API available"
              - paragraph [ref=e195]: "✓ Clipboard: API available"
              - paragraph [ref=e196]: "✓ Download: API available"
              - paragraph [ref=e197]: "✓ Service worker API: API available"
              - paragraph [ref=e198]: "✓ Storage estimate: API available"
              - paragraph [ref=e199]: "✓ IndexedDB API: API available"
              - paragraph [ref=e200]: "✓ Passkey API: API available"
              - heading "隐私与索引" [level=3] [ref=e201]
              - paragraph [ref=e202]: Secure context：是
              - paragraph [ref=e203]: robots meta：noindex, nofollow
              - paragraph [ref=e204]: CSP / SRI / 日志脱敏：待目标环境验证
              - heading "网页端限制" [level=3] [ref=e205]
              - list [ref=e206]:
                - listitem [ref=e207]: 无原生多窗口恢复
                - listitem [ref=e208]: 无系统文件关联
                - listitem [ref=e209]: 无离线领域操作或本地文件导入
                - listitem [ref=e210]: 不检测硬件交易能力
              - group [ref=e211]:
                - generic "检测与权限说明" [ref=e212]
            - button "清理布局确认" [ref=e214] [cursor=pointer]
    - contentinfo "连接状态" [ref=e215]:
      - generic [ref=e216]: 网络：可用
      - generic [ref=e217]: 设置快照；写操作单独验证
      - generic [ref=e218]: 读取完成：2026-10-22T09:18:42.101Z
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | import { AxeBuilder } from "@axe-core/playwright";
  3  | import { writeFile } from "node:fs/promises";
  4  | import { boundary, now, id, context, bff } from "./fixtures/ui-p17";
  5  | test.beforeEach(async({page})=>{await page.clock.install({time:now});});
  6  | test("P17 actual estimate and explicit rescan do not request permission or connect",async({page})=>{
  7  |   await page.addInitScript(()=>{Object.defineProperty(navigator,"storage",{value:{estimate:async()=>({usage:1048576,quota:8388608})}});let calls=0;Object.defineProperty(window,"Notification",{value:{permission:"default",requestPermission:async()=>{calls++;return "granted";}}});Object.defineProperty(window,"nativePrompts",{get:()=>calls});});
  8  |   const t=await boundary(page);await page.goto("/settings/browser");await expect(page.getByTestId("storage-estimate")).toHaveText("1.0 MiB / 8.0 MiB");await page.getByRole("button",{name:"重新检测兼容性"}).click();expect(await page.evaluate(()=>(window as unknown as {nativePrompts:number}).nativePrompts)).toBe(0);expect(t.requests.every(r=>r.method()==="GET")).toBe(true);expect(t.requests.some(r=>new URL(r.url()).pathname.endsWith("/download"))).toBe(false);await expect(page.locator("body")).toContainText("CSP / SRI / 日志脱敏：待目标环境验证");
  9  | });
  10 | test("P17 native denial prompts once and retains in app fallback",async({page})=>{
  11 |  await page.addInitScript(()=>{let count=0;const api={permission:"default",requestPermission:async()=>{count++;api.permission="denied";return "denied";}};Object.defineProperty(window,"Notification",{value:api});Object.defineProperty(window,"nativePrompts",{get:()=>count});});await boundary(page);await page.goto("/settings/browser");const button=page.getByRole("button",{name:"请求浏览器通知权限"});await button.click();await expect(button).toBeDisabled();await page.getByRole("button",{name:"重新检测兼容性"}).click();expect(await page.evaluate(()=>(window as unknown as {nativePrompts:number}).nativePrompts)).toBe(1);await expect(page.locator(".toast")).toContainText("不会重复请求");
  12 | });
  13 | test("P17 allowlisted cleanup confirms cancel keyboard and preserves all unrelated storage",async({page})=>{
  14 |  await page.addInitScript(()=>{localStorage.setItem("quantos.command.layout.v1","layout");localStorage.setItem("unrelated","keep");sessionStorage.setItem("session-state","keep");});const t=await boundary(page);await page.goto("/settings/browser");const trigger=page.getByRole("button",{name:"清理布局确认"});await trigger.click();await expect(page.getByRole("button",{name:"取消",exact:true})).toBeFocused();await page.keyboard.press("Escape");await expect(page.getByRole("dialog")).toHaveCount(0);expect(await page.evaluate(()=>localStorage.getItem("quantos.command.layout.v1"))).toBe("layout");await trigger.click();await page.getByLabel('输入“CLEAR LOCAL LAYOUT”').fill("CLEAR LOCAL LAYOUT");await page.getByRole("button",{name:"确认清理布局",exact:true}).click();await expect(page.locator(".toast")).toContainText("已清理");expect(await page.evaluate(()=>[localStorage.getItem("quantos.command.layout.v1"),localStorage.getItem("unrelated"),sessionStorage.getItem("session-state")])).toEqual([null,"keep","keep"]);expect(t.requests.every(r=>r.method()==="GET")).toBe(true);
  15 | });
  16 | test("P17 unknown estimate never displays invented healthy storage",async({page})=>{await page.addInitScript(()=>Object.defineProperty(navigator,"storage",{value:{estimate:async()=>{throw Error("denied");}}}));await boundary(page);await page.goto("/settings/browser");await expect(page.getByTestId("storage-estimate")).toHaveText("未知 / 未完成");});
  17 | test("P17 cursor pagination and filter preserve bounded owned records",async({page})=>{
  18 |  let pages=0;const t=await boundary(page,(r,data)=>new URL(r.url()).pathname==="/v1/settings/downloads"?{data:new URL(r.url()).searchParams.has("cursor")?(pages++,{items:[{...data.downloads[0],downloadId:id,objectLabel:"Next owned page",downloadPath:`/v1/exports/${id}/download`}]}):{items:data.downloads,nextCursor:"page-2"}}:undefined);await page.goto("/settings/browser");await page.getByRole("button",{name:"加载更多下载记录"}).click();await expect(page.getByRole("region",{name:"最近下载记录"})).toContainText("Next owned page");expect(pages).toBe(1);await expect(page.getByRole("button",{name:"加载更多下载记录"})).toHaveCount(0);await page.getByLabel("筛选已读取记录").selectOption("expired");await expect(page.getByRole("region",{name:"最近下载记录"})).not.toContainText("Next owned page");expect(t.requests.every(r=>r.method()==="GET")).toBe(true);
  19 | });
  20 | test("P17 current expiry disables download without issuing a lease",async({page})=>{const t=await boundary(page,(r,data)=>new URL(r.url()).pathname==="/v1/settings/downloads"?{data:{items:[{...data.downloads[0],expiresAt:new Date(now.getTime()+2000).toISOString()}]}}:undefined);await page.goto("/settings/browser");const button=page.getByRole("button",{name:"下载",exact:true});await expect(button).toBeEnabled();await page.clock.fastForward(2500);await expect(button).toBeDisabled();expect(t.requests.some(r=>new URL(r.url()).pathname.endsWith("/download"))).toBe(false);});
  21 | test("P17 clipboard refusal exposes safe manual route and safe new tab",async({page})=>{await page.addInitScript(()=>Object.defineProperty(navigator,"clipboard",{value:{writeText:async()=>{throw Error();}}}));await boundary(page);await page.goto("/settings/browser");await page.getByRole("button",{name:"复制深链"}).click();await expect(page.locator(".toast")).toContainText("http://localhost:3190/auth/deep-link?return_to=%2Fsettings%2Fbrowser");const link=page.getByRole("link",{name:"在新标签页验证"});await expect(link).toHaveAttribute("rel","noopener noreferrer");await expect(link).toHaveAttribute("href","/auth/deep-link?return_to=%2Fsettings%2Fbrowser");});
  22 | test("P17 offline reconnect requires explicit revalidation and never replays",async({page})=>{const t=await boundary(page);await page.goto("/settings/browser");await page.evaluate(()=>{Object.defineProperty(navigator,"onLine",{value:false,configurable:true});window.dispatchEvent(new Event("offline"));});await expect(page.getByRole("button",{name:"复制深链"})).toBeDisabled();await page.evaluate(()=>{Object.defineProperty(navigator,"onLine",{value:true,configurable:true});window.dispatchEvent(new Event("online"));});await expect(page.getByRole("button",{name:"复制深链"})).toBeDisabled();await page.getByRole("button",{name:"重新验证并保留草稿"}).click();await expect(page.getByRole("button",{name:"复制深链"})).toBeEnabled();expect(t.requests.every(r=>r.method()==="GET")).toBe(true);});
  23 | test("P17 scope denial occurs before private browser reads",async({page})=>{const t=await boundary(page,r=>new URL(r.url()).pathname==="/v1/context"?{data:{...context(),capabilities:[]}}:undefined);await page.goto("/settings/browser");await expect(page).toHaveURL(/\/unauthorized$/);expect(t.requests.map(r=>new URL(r.url()).pathname)).toEqual(["/v1/session","/v1/context"]);});
  24 | test("P17 lease 401 returns to login and never displays provider details",async({page})=>{await boundary(page,r=>new URL(r.url()).pathname.endsWith("/download")?{status:401,data:{code:"UNAUTHENTICATED",message:"private-details",correlationId:id}}:undefined);await page.goto("/settings/browser");await page.getByRole("button",{name:"下载",exact:true}).and(page.locator("button:not(:disabled)")).first().click();await expect(page).toHaveURL(/\/login\?return_to=/);await expect(page.locator("body")).not.toContainText("private-details");});
> 25 | test("P17 fresh same origin signed ticket downloads only on explicit click",async({page})=>{let mints=0;await boundary(page,(r,data)=>new URL(r.url()).pathname.endsWith("/download")?(mints++,{data:{exportId:data.downloads[0].downloadId,downloadUrl:`${bff}/_bff/export-content/${id}/${"a".repeat(64)}`,expiresAt:new Date(now.getTime()+30000).toISOString(),sha256:"b".repeat(64),sizeBytes:4,mediaType:"text/csv",watermarked:true,retentionUntil:data.downloads[0].expiresAt,auditRef:id}}):undefined);await page.route(`${bff}/_bff/export-content/**`,route=>route.fulfill({contentType:"application/octet-stream",headers:{"access-control-allow-origin":"http://localhost:3190","content-length":"4","content-disposition":"attachment; filename=p17.csv"},body:"a,b\n"}));await page.goto("/settings/browser");expect(mints).toBe(0);const download=page.waitForEvent("download");await page.getByRole("button",{name:"下载",exact:true}).and(page.locator("button:not(:disabled)")).first().click();expect((await download).suggestedFilename()).toBe("p17.csv");expect(mints).toBe(1);});
     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        ^ Error: page.waitForEvent: Test timeout of 30000ms exceeded.
  26 | for(const theme of ["dark","light"] as const)test(`P17 ${theme} responsive keyboard and axe`,async({page},info)=>{await boundary(page,()=>undefined,theme);const scans=[];for(const width of [1440,1024,390]){await page.setViewportSize({width,height:900});await page.goto("/settings/browser");await expect(page.locator("[data-ui-p17]")).toBeVisible();await expect(page.getByRole("button",{name:"重新检测兼容性"})).toBeEnabled();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);await page.getByRole("region",{name:"最近下载记录"}).focus();await expect(page.getByRole("region",{name:"最近下载记录"})).toBeFocused();const r=await new AxeBuilder({page}).analyze();scans.push({width,violations:r.violations,incomplete:r.incomplete});expect(r.violations).toEqual([]);}await page.evaluate(()=>document.documentElement.style.zoom="2");expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);const path=info.outputPath(`axe-${theme}.json`);await writeFile(path,JSON.stringify(scans,null,2));await info.attach("axe",{path,contentType:"application/json"});});
  27 | for(const theme of ["dark","light"] as const)test(`P17 visual baseline ${theme}`,async({page})=>{await boundary(page,()=>undefined,theme);await page.addInitScript(()=>Object.defineProperty(navigator,"storage",{value:{estimate:async()=>({usage:1048576,quota:8388608})}}));await page.setViewportSize({width:1440,height:1000});await page.goto("/settings/browser");await expect(page.getByRole("button",{name:"重新检测兼容性"})).toBeEnabled();await expect(page).toHaveScreenshot(`p17-browser-1440-${theme}.png`,{fullPage:true,maxDiffPixelRatio:0.005});});
  28 | 
```