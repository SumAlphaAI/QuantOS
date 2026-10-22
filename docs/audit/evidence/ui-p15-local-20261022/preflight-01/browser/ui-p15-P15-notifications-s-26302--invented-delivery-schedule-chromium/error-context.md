# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui-p15.spec.ts >> P15 notifications support overnight quiet hours and no invented delivery schedule
- Location: tests/e2e/ui-p15.spec.ts:30:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.selectOption: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByLabel('摘要频率', { exact: true })

```

# Page snapshot

```yaml
- generic [ref=e1]:
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
        - link "Audit" [ref=e34] [cursor=pointer]:
          - /url: /audit
          - generic [ref=e35]: ▥
    - main [ref=e37]:
      - generic [ref=e38]:
        - generic [ref=e39]:
          - paragraph [ref=e40]: Settings / notifications
          - heading "Notification settings" [level=1] [ref=e41]
          - paragraph [ref=e42]: 配置授权渠道、静默时段与关键安全提醒。
        - generic [ref=e43]:
          - button "重新验证并保留草稿" [ref=e44] [cursor=pointer]
          - link "关闭设置" [ref=e45] [cursor=pointer]:
            - /url: /command
            - text: × 关闭
      - note [ref=e46]: 个人设置仅影响当前用户体验，不授予交易权限，也不改变风险规则。
      - generic [ref=e47]:
        - complementary "设置导航" [ref=e48]:
          - generic [ref=e49]:
            - generic [ref=e50]: AN
            - strong [ref=e51]: Alex Ning
            - generic [ref=e52]: alex.ning@sumalpha.ai
            - generic [ref=e53]: Risk Approver
            - generic [ref=e54]: member-018
          - navigation "设置分区" [ref=e55]:
            - link "个人资料" [ref=e56] [cursor=pointer]:
              - /url: /settings/profile
              - generic [ref=e57]: ♙
              - text: 个人资料
            - link "通知设置" [ref=e58] [cursor=pointer]:
              - /url: /settings/notifications
              - generic [ref=e59]: ♧
              - text: 通知设置
            - link "安全与 MFA" [ref=e60] [cursor=pointer]:
              - /url: /settings/security
              - generic [ref=e61]: ♢
              - text: 安全与 MFA
            - link "Web Browser" [ref=e62] [cursor=pointer]:
              - /url: /settings/browser
              - generic [ref=e63]: ◎
              - text: Web Browser
          - generic [ref=e64]:
            - strong [ref=e65]: ▣ Workspace 11111111…
            - generic [ref=e66]: 角色：Risk Approver
            - generic [ref=e67]: 权限以服务端响应为准
        - generic [ref=e68]:
          - group [ref=e69]:
            - generic [ref=e71]:
              - generic [ref=e72]:
                - heading "通知矩阵" [level=2] [ref=e73]
                - generic [ref=e74]: 浏览器权限：denied
                - button "请求浏览器通知权限" [ref=e75] [cursor=pointer]
              - status [ref=e76]:
                - paragraph [ref=e77]: 已降级为站内通知
                - generic [ref=e78]: 拒绝或不支持浏览器通知不会影响站内风险状态，也不会反复弹窗。
              - table "通知偏好矩阵" [ref=e79]:
                - row [ref=e80]:
                  - columnheader "通知类型" [ref=e81]
                  - columnheader "严重性" [ref=e82]
                  - columnheader "In-app" [ref=e83]
                  - columnheader "Desktop" [ref=e84]
                  - columnheader "Email" [ref=e85]
                  - columnheader "Browser" [ref=e86]
                - row [ref=e87]:
                  - cell "Critical risk / Kill switch" [ref=e88]
                  - cell "critical" [ref=e89]
                  - cell "Critical risk / Kill switch In-app On" [ref=e90]:
                    - generic [ref=e91] [cursor=pointer]:
                      - checkbox "Critical risk / Kill switch In-app" [checked] [ref=e92]
                      - generic [ref=e94]: "On"
                  - cell "Critical risk / Kill switch Desktop On" [ref=e95]:
                    - generic [ref=e96] [cursor=pointer]:
                      - checkbox "Critical risk / Kill switch Desktop" [checked] [ref=e97]
                      - generic [ref=e99]: "On"
                  - cell "Critical risk / Kill switch Email On" [ref=e100]:
                    - generic [ref=e101] [cursor=pointer]:
                      - checkbox "Critical risk / Kill switch Email" [checked] [ref=e102]
                      - generic [ref=e104]: "On"
                  - cell "Critical risk / Kill switch Browser Off" [ref=e105]:
                    - generic [ref=e106]:
                      - checkbox "Critical risk / Kill switch Browser" [disabled] [ref=e107]
                      - generic [ref=e109]: "Off"
                - row [ref=e110]:
                  - cell "Approval expiring" [ref=e111]
                  - cell "warning" [ref=e112]
                  - cell "Approval expiring In-app On" [ref=e113]:
                    - generic [ref=e114] [cursor=pointer]:
                      - checkbox "Approval expiring In-app" [checked] [ref=e115]
                      - generic [ref=e117]: "On"
                  - cell "Approval expiring Desktop On" [ref=e118]:
                    - generic [ref=e119] [cursor=pointer]:
                      - checkbox "Approval expiring Desktop" [checked] [ref=e120]
                      - generic [ref=e122]: "On"
                  - cell "Approval expiring Email On" [ref=e123]:
                    - generic [ref=e124] [cursor=pointer]:
                      - checkbox "Approval expiring Email" [checked] [ref=e125]
                      - generic [ref=e127]: "On"
                  - cell "Approval expiring Browser Off" [ref=e128]:
                    - generic [ref=e129]:
                      - checkbox "Approval expiring Browser" [disabled] [ref=e130]
                      - generic [ref=e132]: "Off"
                - row [ref=e133]:
                  - cell "Order rejected / partial fill" [ref=e134]
                  - cell "warning" [ref=e135]
                  - cell "Order rejected / partial fill In-app On" [ref=e136]:
                    - generic [ref=e137] [cursor=pointer]:
                      - checkbox "Order rejected / partial fill In-app" [checked] [ref=e138]
                      - generic [ref=e140]: "On"
                  - cell "Order rejected / partial fill Desktop On" [ref=e141]:
                    - generic [ref=e142] [cursor=pointer]:
                      - checkbox "Order rejected / partial fill Desktop" [checked] [ref=e143]
                      - generic [ref=e145]: "On"
                  - cell "Order rejected / partial fill Email On" [ref=e146]:
                    - generic [ref=e147] [cursor=pointer]:
                      - checkbox "Order rejected / partial fill Email" [checked] [ref=e148]
                      - generic [ref=e150]: "On"
                  - cell "Order rejected / partial fill Browser Off" [ref=e151]:
                    - generic [ref=e152]:
                      - checkbox "Order rejected / partial fill Browser" [disabled] [ref=e153]
                      - generic [ref=e155]: "Off"
                - row [ref=e156]:
                  - cell "Incident assigned" [ref=e157]
                  - cell "info" [ref=e158]
                  - cell "Incident assigned In-app On" [ref=e159]:
                    - generic [ref=e160] [cursor=pointer]:
                      - checkbox "Incident assigned In-app" [checked] [ref=e161]
                      - generic [ref=e163]: "On"
                  - cell "Incident assigned Desktop Off" [ref=e164]:
                    - generic [ref=e165] [cursor=pointer]:
                      - checkbox "Incident assigned Desktop" [ref=e166]
                      - generic [ref=e168]: "Off"
                  - cell "Incident assigned Email On" [ref=e169]:
                    - generic [ref=e170] [cursor=pointer]:
                      - checkbox "Incident assigned Email" [checked] [ref=e171]
                      - generic [ref=e173]: "On"
                  - cell "Incident assigned Browser Off" [ref=e174]:
                    - generic [ref=e175]:
                      - checkbox "Incident assigned Browser" [disabled] [ref=e176]
                      - generic [ref=e178]: "Off"
                - row [ref=e179]:
                  - cell "Research completed" [ref=e180]
                  - cell "info" [ref=e181]
                  - cell "Research completed In-app On" [ref=e182]:
                    - generic [ref=e183] [cursor=pointer]:
                      - checkbox "Research completed In-app" [checked] [ref=e184]
                      - generic [ref=e186]: "On"
                  - cell "Research completed Desktop Off" [ref=e187]:
                    - generic [ref=e188] [cursor=pointer]:
                      - checkbox "Research completed Desktop" [ref=e189]
                      - generic [ref=e191]: "Off"
                  - cell "Research completed Email On" [ref=e192]:
                    - generic [ref=e193] [cursor=pointer]:
                      - checkbox "Research completed Email" [checked] [ref=e194]
                      - generic [ref=e196]: "On"
                  - cell "Research completed Browser Off" [ref=e197]:
                    - generic [ref=e198]:
                      - checkbox "Research completed Browser" [disabled] [ref=e199]
                      - generic [ref=e201]: "Off"
                - row [ref=e202]:
                  - cell "Report / export ready" [ref=e203]
                  - cell "info" [ref=e204]
                  - cell "Report / export ready In-app On" [ref=e205]:
                    - generic [ref=e206] [cursor=pointer]:
                      - checkbox "Report / export ready In-app" [checked] [ref=e207]
                      - generic [ref=e209]: "On"
                  - cell "Report / export ready Desktop Off" [ref=e210]:
                    - generic [ref=e211] [cursor=pointer]:
                      - checkbox "Report / export ready Desktop" [ref=e212]
                      - generic [ref=e214]: "Off"
                  - cell "Report / export ready Email On" [ref=e215]:
                    - generic [ref=e216] [cursor=pointer]:
                      - checkbox "Report / export ready Email" [checked] [ref=e217]
                      - generic [ref=e219]: "On"
                  - cell "Report / export ready Browser Off" [ref=e220]:
                    - generic [ref=e221]:
                      - checkbox "Report / export ready Browser" [disabled] [ref=e222]
                      - generic [ref=e224]: "Off"
              - paragraph [ref=e225]: Desktop 为跨端偏好；当前 Web 不承诺原生通知投递。静默时段支持跨午夜，通知实际投递由服务端授权和策略决定。
              - generic [ref=e226]:
                - generic [ref=e227] [cursor=pointer]:
                  - checkbox "启用静默时段" [checked] [ref=e228]
                  - generic [ref=e230]: 启用静默时段
                - generic [ref=e231]:
                  - text: 静默时段
                  - textbox "静默开始时间" [ref=e232]: 23:30
                  - text: –
                  - textbox "静默结束时间" [active] [ref=e233]: 06:15
                - generic [ref=e234] [cursor=pointer]:
                  - checkbox "Critical 绕过静默" [checked] [ref=e235]
                  - generic [ref=e237]: Critical 绕过静默
                - generic [ref=e238]:
                  - text: 摘要频率
                  - combobox "摘要频率" [ref=e239]:
                    - option "关闭"
                    - option "每日摘要" [selected]
                    - option "Weekly"
                - button "保存通知偏好" [ref=e240] [cursor=pointer]
          - complementary "设置上下文" [ref=e241]:
            - generic [ref=e242]:
              - heading "设置与访问" [level=2] [ref=e243]
              - generic [ref=e244]:
                - term [ref=e245]: 当前角色
                - definition [ref=e246]: Risk Approver
                - term [ref=e247]: 编辑权限
                - definition [ref=e248]: 可保存个人设置
                - term [ref=e249]: 设置版本
                - definition [ref=e250]:
                  - code [ref=e251]: profile-v14
                - term [ref=e252]: 读取时间
                - definition [ref=e253]: 2026年10月22日 17:18
              - paragraph [ref=e254]: 个人偏好不会改变角色、风险规则或工作区访问权。
            - generic [ref=e255]:
              - heading "安全与通知" [level=2] [ref=e256]
              - navigation "相关设置" [ref=e257]:
                - link "安全中心与 MFA ›" [ref=e258] [cursor=pointer]:
                  - /url: /settings/security
                - link "通知偏好 ›" [ref=e259] [cursor=pointer]:
                  - /url: /settings/notifications
                - link "个人资料与区域 ›" [ref=e260] [cursor=pointer]:
                  - /url: /settings/profile
              - group [ref=e261]:
                - generic "键盘操作" [ref=e262] [cursor=pointer]
      - region "分区保存状态" [ref=e263]:
        - generic [ref=e264]:
          - text: 设置版本
          - code [ref=e265]: notifications-v7
        - status [ref=e266]: 未保存更改：有
        - generic [ref=e267]: 已读取服务端快照
        - button "重置未保存项" [ref=e268] [cursor=pointer]
        - button "保存当前分区" [ref=e269] [cursor=pointer]
      - group [ref=e270]:
        - generic "设置与安全操作说明" [ref=e271] [cursor=pointer]
    - contentinfo "连接状态" [ref=e272]:
      - generic [ref=e273]: 网络：可用
      - generic [ref=e274]: 设置快照；写操作单独验证
      - generic [ref=e275]: 读取完成：2026-10-22T09:18:42.072Z
```

# Test source

```ts
  1  | import { expect, test, type Page } from "@playwright/test";
  2  | import { AxeBuilder } from "@axe-core/playwright";
  3  | import { writeFile } from "node:fs/promises";
  4  | import { boundary, writes, now, id, context } from "./fixtures/ui-p15";
  5  | test.beforeEach(async ({ page }) => { await page.clock.install({ time: now }); });
  6  | async function securityDialog(page: Page, button: string, phrase: string) {
  7  |   await page.getByRole("button", { name: button, exact: true }).first().click();
  8  |   await expect(page.getByRole("button", { name: "取消", exact: true })).toBeFocused();
  9  |   await page.getByLabel(new RegExp(`输入“${phrase}”`)).fill(phrase);
  10 |   await page.getByLabel("MFA 验证码").fill("123456");
  11 | }
  12 | test("P15 profile and region save only whitelisted facts using actual version, then survive reload", async ({ page }) => {
  13 |   const t = await boundary(page); await page.goto("/settings/profile");
  14 |   await expect(page.getByRole("region", { name: "分区保存状态" })).toContainText("未保存更改：无");
  15 |   await page.getByLabel("显示名称", { exact: true }).fill("P15 Saved Member"); await page.getByLabel("时间显示", { exact: true }).selectOption("local"); await page.getByLabel("时区", { exact: true }).selectOption("America/New_York");
  16 |   await page.getByRole("button", { name: "保存当前分区" }).click(); await expect(page.locator(".toast")).toContainText("个人资料已保存");
  17 |   expect(writes(t.requests)).toHaveLength(1); expect(writes(t.requests)[0].postDataJSON()).toMatchObject({ timeDisplay: "local", timezone: "America/New_York" }); expect(writes(t.requests)[0].headers()["if-match"]).toBe("profile-v14");
  18 |   await page.reload(); await expect(page.getByLabel("显示名称", { exact: true })).toHaveValue("P15 Saved Member"); await expect(page.getByLabel("时间显示", { exact: true })).toHaveValue("local");
  19 | });
  20 | test("P15 theme, contrast and density preview reset without storing business or identity state", async ({ page }) => {
  21 |   const t = await boundary(page); await page.goto("/settings/profile");
  22 |   await page.getByLabel("主题", { exact: true }).selectOption("light"); await expect(page.locator('.quantos-theme[data-quantos-theme="light"]').first()).toBeVisible();
  23 |   await page.getByRole("checkbox", { name: "高对比度", exact: true }).check(); await page.getByRole("checkbox", { name: "减少动画", exact: true }).check(); await page.getByLabel("密度", { exact: true }).selectOption("comfortable");
  24 |   await expect(page.locator('[data-ui-p15]')).toHaveClass(/p15-high-contrast/); await page.getByRole("button", { name: "重置未保存项" }).click(); await expect(page.getByLabel("主题", { exact: true })).toHaveValue("dark"); expect(writes(t.requests)).toHaveLength(0);
  25 |   expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  26 | });
  27 | test("P15 empty invalid draft survives explicit refresh and never sends a mutation", async ({ page }) => {
  28 |   const t = await boundary(page); await page.goto("/settings/profile"); await page.getByLabel("显示名称", { exact: true }).fill(""); await page.getByRole("button", { name: "重新验证并保留草稿" }).click(); await expect(page.getByLabel("显示名称", { exact: true })).toHaveValue(""); await page.getByRole("button", { name: "保存个人资料" }).click(); await expect(page.locator(".toast")).toContainText("请求未完成"); expect(writes(t.requests)).toHaveLength(0);
  29 | });
  30 | test("P15 notifications support overnight quiet hours and no invented delivery schedule", async ({ page }) => {
> 31 |   const t = await boundary(page); await page.goto("/settings/notifications"); await page.getByLabel("静默开始时间").fill("23:30"); await page.getByLabel("静默结束时间").fill("06:15"); await page.getByLabel("摘要频率", { exact: true }).selectOption("weekly"); await page.getByRole("button", { name: "保存通知偏好" }).click(); await expect(page.locator(".toast")).toContainText("通知偏好已保存"); expect(writes(t.requests)[0].postDataJSON()).toMatchObject({ quietHoursStart: "23:30", quietHoursEnd: "06:15", digestFrequency: "weekly" }); expect(writes(t.requests)[0].postDataJSON()).not.toHaveProperty("browserPermission");
     |                                                                                                                                                                                                                            ^ Error: locator.selectOption: Test timeout of 30000ms exceeded.
  32 | });
  33 | test("P15 notification conflict rebases metadata only and needs another explicit save", async ({ page }) => {
  34 |   let first = true; const t = await boundary(page, r => r.method() === "PUT" && first ? (first = false, { status: 409, data: { code: "VERSION_CONFLICT", message: "private", currentVersion: "notification-current", correlationId: id } }) : undefined);
  35 |   await page.goto("/settings/notifications"); await page.getByLabel("静默开始时间").fill("21:30"); await page.getByRole("button", { name: "保存通知偏好" }).click(); t.data.notifications.objectVersion = "notification-current"; await page.getByRole("button", { name: "加载最新版本并保留草稿" }).click(); await expect(page.getByLabel("静默开始时间")).toHaveValue("21:30"); expect(writes(t.requests)).toHaveLength(1); await page.getByRole("button", { name: "保存通知偏好" }).click(); await expect(page.locator(".toast")).toContainText("通知偏好已保存"); expect(writes(t.requests)[1].headers()["if-match"]).toBe("notification-current");
  36 | });
  37 | test("P15 uncertain notification response retains draft and the identical idempotency key", async ({ page }) => {
  38 |   let first = true; const t = await boundary(page, r => r.method() === "PUT" && first ? (first = false, { abort: true }) : undefined); await page.goto("/settings/notifications"); await page.getByLabel("静默开始时间").fill("21:00"); await page.getByRole("button", { name: "保存通知偏好" }).click(); await expect(page.locator(".toast")).toContainText("请求结果未知"); await expect(page.getByLabel("静默开始时间")).toHaveValue("21:00"); await page.getByRole("button", { name: "保存通知偏好" }).click(); await expect(page.locator(".toast")).toContainText("通知偏好已保存"); const rows = writes(t.requests); expect(rows).toHaveLength(2); expect(rows[0].headers()["idempotency-key"]).toBe(rows[1].headers()["idempotency-key"]);
  39 | });
  40 | test("P15 readonly contexts cannot write or request native notification permission", async ({ page }) => {
  41 |   const t = await boundary(page, r => new URL(r.url()).pathname === "/v1/context" ? { data: { ...context(), capabilities: ["settings.read"] } } : undefined); await page.goto("/settings/notifications"); await expect(page.getByRole("button", { name: "保存通知偏好" })).toBeDisabled(); await expect(page.getByRole("button", { name: "请求浏览器通知权限" })).toBeDisabled(); expect(writes(t.requests)).toHaveLength(0);
  42 | });
  43 | test("P15 browser notification prompt requires a click and denial never prompts twice", async ({ page }) => {
  44 |   await page.addInitScript(() => { let count = 0; const api = { permission: "default", requestPermission: async () => { count++; api.permission = "denied"; return "denied"; } }; Object.defineProperty(window, "Notification", { value: api }); Object.defineProperty(window, "p15Prompts", { get: () => count }); });
  45 |   await boundary(page); await page.goto("/settings/notifications"); await expect(page.getByRole("heading", { name: "Notification settings" })).toBeVisible(); expect(await page.evaluate(() => (window as unknown as { p15Prompts: number }).p15Prompts)).toBe(0);
  46 |   await page.getByRole("button", { name: "请求浏览器通知权限" }).click(); await page.getByRole("button", { name: "请求浏览器通知权限" }).click(); expect(await page.evaluate(() => (window as unknown as { p15Prompts: number }).p15Prompts)).toBe(1); await expect(page.locator(".toast")).toContainText("不会重复弹窗");
  47 | });
  48 | test("P15 security reauthentication is real C01 verification without DELETE or persistent token", async ({ page }) => {
  49 |   const t = await boundary(page); await page.goto("/settings/security"); await securityDialog(page, "重新验证身份", "VERIFY SECURITY"); await page.getByRole("button", { name: "确认重新验证", exact: true }).click(); await expect(page.locator(".toast")).toContainText("近期身份验证已完成"); expect(writes(t.requests).map(r => new URL(r.url()).pathname)).toEqual(["/v1/auth/mfa/challenges", "/v1/auth/reauth"]); expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]); await expect(page.getByRole("dialog")).toHaveCount(0);
  50 | });
  51 | for (const [kind, button, target] of [["device", "撤销信任", "device-iphone"], ["factor", "撤销 MFA 因素", "factor-authenticator"]]) test(`P15 ${kind} revoke is pending after 202 and cannot be repeated`, async ({ page }) => {
  52 |   const t = await boundary(page); await page.goto("/settings/security"); await securityDialog(page, button, `REVOKE ${target}`); await page.getByRole("button", { name: kind === "device" ? "确认撤销信任" : "确认撤销 MFA 因素", exact: true }).click(); await expect(page.locator(".toast")).toContainText("已受理"); await expect(page.getByRole("button", { name: "撤销处理中", exact: true })).toBeDisabled(); expect(writes(t.requests).map(r => r.method())).toEqual(["POST", "POST", "DELETE"]);
  53 | });
  54 | test("P15 security cancellation and narrow resize cannot start a security request", async ({ page }) => {
  55 |   const t = await boundary(page); await page.goto("/settings/security"); await page.getByRole("button", { name: "重新验证身份", exact: true }).click(); await page.keyboard.press("Escape"); await expect(page.getByRole("dialog")).toHaveCount(0); await page.getByRole("button", { name: "重新验证身份", exact: true }).click(); await page.setViewportSize({ width: 390, height: 844 }); await expect(page.getByRole("dialog")).toHaveCount(0); await expect(page.getByRole("button", { name: "重新验证身份", exact: true })).toBeHidden(); expect(writes(t.requests)).toHaveLength(0);
  56 | });
  57 | test("P15 429 blocks writes and never leaks provider detail or automatically replays", async ({ page }) => {
  58 |   let first = true; const t = await boundary(page, r => r.method() === "PUT" && first ? (first = false, { status: 429, data: { code: "RATE_LIMITED", message: "private-provider-detail", retryAfter: 5, correlationId: id } }) : undefined);
  59 |   await page.goto("/settings/profile"); await page.getByLabel("显示名称", { exact: true }).fill("Rate draft"); await page.getByRole("button", { name: "保存个人资料" }).click(); await expect(page.getByRole("button", { name: "保存个人资料" })).toBeDisabled(); await expect(page.locator("body")).not.toContainText("private-provider-detail"); expect(writes(t.requests)).toHaveLength(1); await page.clock.fastForward(6000); await expect(page.getByRole("button", { name: "保存个人资料" })).toBeEnabled(); expect(writes(t.requests)).toHaveLength(1); await page.getByRole("button", { name: "保存个人资料" }).click(); await expect(page.locator(".toast")).toContainText("个人资料已保存");
  60 | });
  61 | test("P15 earlier session expiry clears private state and rereads session before new data", async ({ page }) => {
  62 |   let reads = 0; const t = await boundary(page, r => new URL(r.url()).pathname === "/v1/session" ? (++reads > 1 ? { status: 401, data: { code: "UNAUTHENTICATED", message: "refused", correlationId: id } } : { data: { ...context(), expiresAt: new Date(now.getTime() + 3000).toISOString() } }) : undefined); await page.goto("/settings/profile"); await expect(page.getByLabel("显示名称", { exact: true })).toBeVisible(); await page.clock.fastForward(3500); await expect(page).toHaveURL(/\/login\?return_to=/); expect(t.requests.filter(r => new URL(r.url()).pathname === "/v1/settings/profile")).toHaveLength(1);
  63 | });
  64 | test("P15 missing fields and foreign member success cannot publish fake saved state", async ({ page }) => {
  65 |   const t = await boundary(page, r => r.method() === "PUT" ? { data: { ...t.data.profile, memberId: "foreign-member" } } : undefined); await page.goto("/settings/profile"); await page.getByRole("button", { name: "保存个人资料" }).click(); await expect(page).toHaveURL(/\/unauthorized$/); await expect(page.locator("body")).not.toContainText("个人资料已保存");
  66 | });
  67 | for (const theme of ["dark", "light"] as const) test(`P15 ${theme} all pages responsive keyboard and axe`, async ({ page }, info) => {
  68 |   await boundary(page, () => undefined, theme); const scans = [];
  69 |   for (const section of ["profile", "notifications", "security"]) for (const width of [1440, 1024, 390]) {
  70 |     await page.setViewportSize({ width, height: 900 }); await page.goto(`/settings/${section}`); await expect(page.locator(`[data-ui-p15="${section}"]`)).toBeVisible(); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  71 |     await page.getByRole("link", { name: "关闭设置" }).focus(); await expect(page.getByRole("link", { name: "关闭设置" })).toBeFocused();
  72 |     const a = await new AxeBuilder({ page }).analyze(); scans.push({ section, width, violations: a.violations, incomplete: a.incomplete }); expect(a.violations, `${theme}/${section}/${width}`).toEqual([]);
  73 |     const png = info.outputPath(`${section}-${theme}-${width}.png`); await page.screenshot({ path: png, fullPage: true }); await info.attach(`${section}-${width}`, { path: png, contentType: "image/png" });
  74 |     if (width === 390) { await page.evaluate(() => { document.documentElement.style.zoom = "2"; }); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width); if (section === "security") await expect(page.locator(".settings-high-risk").first()).toBeHidden(); }
  75 |   }
  76 |   const path = info.outputPath(`axe-${theme}.json`); await writeFile(path, JSON.stringify(scans, null, 2)); await info.attach(`axe-${theme}`, { path, contentType: "application/json" });
  77 | });
  78 | for (const theme of ["dark", "light"] as const) test(`P15 visual baseline ${theme}`, async ({ page }) => {
  79 |   await page.clock.pauseAt(now); await boundary(page, () => undefined, theme); for (const section of ["profile", "notifications", "security"]) { await page.goto(`/settings/${section}`); await expect(page.locator(`[data-ui-p15="${section}"]`)).toBeVisible(); await expect(page).toHaveScreenshot(`p15-${section}-${theme}.png`, { fullPage: true, maxDiffPixelRatio: .005 }); }
  80 | });
  81 | 
```