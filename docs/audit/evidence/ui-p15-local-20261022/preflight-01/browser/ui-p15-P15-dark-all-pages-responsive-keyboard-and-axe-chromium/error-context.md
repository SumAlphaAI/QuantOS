# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui-p15.spec.ts >> P15 dark all pages responsive keyboard and axe
- Location: tests/e2e/ui-p15.spec.ts:67:53

# Error details

```
Error: dark/security/390

expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 80

- Array []
+ Array [
+   Object {
+     "description": "Ensure elements that have scrollable content are accessible by keyboard in Safari",
+     "help": "Scrollable region must have keyboard access",
+     "helpUrl": "https://dequeuniversity.com/rules/axe/4.13/scrollable-region-focusable?application=playwright",
+     "id": "scrollable-region-focusable",
+     "impact": "serious",
+     "nodes": Array [
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": null,
+             "id": "focusable-content",
+             "impact": "serious",
+             "message": "Element should have focusable content",
+             "relatedNodes": Array [],
+           },
+           Object {
+             "data": null,
+             "id": "focusable-element",
+             "impact": "serious",
+             "message": "Element should be focusable",
+             "relatedNodes": Array [],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element should have focusable content
+   Element should be focusable",
+         "html": "<div class=\"settings-list-table\">",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".span-two.settings-card:nth-child(2) > .settings-list-table",
+         ],
+       },
+       Object {
+         "all": Array [],
+         "any": Array [
+           Object {
+             "data": null,
+             "id": "focusable-content",
+             "impact": "serious",
+             "message": "Element should have focusable content",
+             "relatedNodes": Array [],
+           },
+           Object {
+             "data": null,
+             "id": "focusable-element",
+             "impact": "serious",
+             "message": "Element should be focusable",
+             "relatedNodes": Array [],
+           },
+         ],
+         "failureSummary": "Fix any of the following:
+   Element should have focusable content
+   Element should be focusable",
+         "html": "<div class=\"settings-list-table devices\">",
+         "impact": "serious",
+         "none": Array [],
+         "target": Array [
+           ".devices",
+         ],
+       },
+     ],
+     "tags": Array [
+       "cat.keyboard",
+       "wcag2a",
+       "wcag211",
+       "wcag213",
+       "TTv5",
+       "TT4.a",
+       "EN-301-549",
+       "EN-9.2.1.1",
+       "EN-9.2.1.3",
+       "RGAAv4",
+       "RGAA-7.3.2",
+     ],
+   },
+ ]
```

# Page snapshot

```yaml
- generic [ref=f8e1]:
  - alert [ref=f8e2]
  - generic [ref=f8e4]:
    - link "跳至正文" [ref=f8e5] [cursor=pointer]:
      - /url: "#_r_0_"
    - banner [ref=f8e6]:
      - button "折叠侧栏" [expanded] [ref=f8e7] [cursor=pointer]:
        - emphasis [ref=f8e11]
      - generic [ref=f8e12]: SHADOW
      - button "通知" [disabled] [ref=f8e13] [cursor=pointer]: ♧
      - link "打开个人设置" [ref=f8e14] [cursor=pointer]:
        - /url: /settings/profile
        - text: AN
    - main [ref=f8e15]:
      - generic [ref=f8e16]:
        - generic [ref=f8e17]:
          - paragraph [ref=f8e18]: Settings / security
          - heading "Security & MFA" [level=1] [ref=f8e19]
          - paragraph [ref=f8e20]: 管理 MFA、活跃会话、可信设备与安全操作。
        - generic [ref=f8e21]:
          - button "重新验证并保留草稿" [ref=f8e22] [cursor=pointer]
          - link "关闭设置" [active] [ref=f8e23] [cursor=pointer]:
            - /url: /command
            - text: × 关闭
      - note [ref=f8e24]: 个人设置仅影响当前用户体验，不授予交易权限，也不改变风险规则。
      - generic [ref=f8e25]:
        - complementary "设置导航" [ref=f8e26]:
          - navigation "设置分区" [ref=f8e27]:
            - link "个人资料" [ref=f8e28] [cursor=pointer]:
              - /url: /settings/profile
              - generic [ref=f8e29]: ♙
              - text: 个人资料
            - link "通知设置" [ref=f8e30] [cursor=pointer]:
              - /url: /settings/notifications
              - generic [ref=f8e31]: ♧
              - text: 通知设置
            - link "安全与 MFA" [ref=f8e32] [cursor=pointer]:
              - /url: /settings/security
              - generic [ref=f8e33]: ♢
              - text: 安全与 MFA
            - link "Web Browser" [ref=f8e34] [cursor=pointer]:
              - /url: /settings/browser
              - generic [ref=f8e35]: ◎
              - text: Web Browser
        - group [ref=f8e37]:
          - generic [ref=f8e38]:
            - generic [ref=f8e39]:
              - generic [ref=f8e40]:
                - heading "安全中心" [level=2] [ref=f8e41]
                - paragraph [ref=f8e42]: Security posture · strong
              - strong [ref=f8e43]: ♢ 92
              - generic [ref=f8e44]:
                - term [ref=f8e45]: MFA
                - definition [ref=f8e46]: 已启用
                - term [ref=f8e47]: 主要方式
                - definition [ref=f8e48]: passkey
                - term [ref=f8e49]: 恢复代码
                - definition [ref=f8e50]: 8 remaining
                - term [ref=f8e51]: 上次验证
                - definition [ref=f8e52]: 2026年8月10日 18:54
              - link "身份因素与恢复代码管理说明" [ref=f8e54] [cursor=pointer]:
                - /url: "#settings-identity-help"
              - paragraph [ref=f8e55]: △ 安全变更需要近期登录验证。
              - generic [ref=f8e56]: MacBook Pro · passkey
              - generic [ref=f8e58]: Authenticator app · authenticator
            - generic [ref=f8e60]:
              - heading "活动会话 3" [level=2] [ref=f8e61]
              - generic [ref=f8e62]:
                - generic [ref=f8e63]:
                  - generic [ref=f8e64]: 设备与浏览器
                  - generic [ref=f8e65]: 位置
                  - generic [ref=f8e66]: 最后活动
                  - generic [ref=f8e67]: 会话 ID / IP
                  - generic [ref=f8e68]: 状态
                - generic [ref=f8e69]:
                  - strong [ref=f8e70]:
                    - text: QuantOS Web
                    - generic [ref=f8e71]: Chrome · macOS
                  - generic [ref=f8e72]: Shanghai
                  - time [ref=f8e73]: 2026年8月15日 11:18
                  - code [ref=f8e74]:
                    - text: sess-8f3a-current
                    - generic [ref=f8e75]: 203.0.113.xxx
                  - generic [ref=f8e76]: ● 当前
                - generic [ref=f8e77]:
                  - strong [ref=f8e78]:
                    - text: Chrome 139
                    - generic [ref=f8e79]: macOS
                  - generic [ref=f8e80]: Shanghai
                  - time [ref=f8e81]: 2026年8月15日 09:18
                  - code [ref=f8e82]:
                    - text: sess-12de-remote
                    - generic [ref=f8e83]: 203.0.113.xxx
                - generic [ref=f8e84]:
                  - strong [ref=f8e85]:
                    - text: Safari
                    - generic [ref=f8e86]: iPhone
                  - generic [ref=f8e87]: Hangzhou
                  - time [ref=f8e88]: 2026年8月13日 11:18
                  - code [ref=f8e89]:
                    - text: sess-4c7e-mobile
                    - generic [ref=f8e90]: 203.0.113.xxx
            - generic [ref=f8e91]:
              - heading "可信设备 2" [level=2] [ref=f8e92]
              - generic [ref=f8e93]:
                - generic [ref=f8e94]:
                  - strong [ref=f8e95]: MacBook Pro
                  - generic [ref=f8e96]: passkey
                  - time [ref=f8e97]: 信任至 2026年9月9日 08:00
                  - generic [ref=f8e98]: ● 当前
                - generic [ref=f8e99]:
                  - strong [ref=f8e100]: iPhone 16
                  - generic [ref=f8e101]: biometric
                  - time [ref=f8e102]: 信任至 2026年8月24日 08:00
            - generic [ref=f8e103]:
              - heading "安全操作" [level=2] [ref=f8e104]
              - generic [ref=f8e105]:
                - link "查看安全审计" [ref=f8e106] [cursor=pointer]:
                  - /url: /audit
                - link "身份服务管理说明" [ref=f8e107] [cursor=pointer]:
                  - /url: "#settings-identity-help"
                - generic [ref=f8e108]: "Correlation ID: 1af2d9e0-f311-4ce2-8ff9-9ec76d13c311"
              - group [ref=f8e109]:
                - generic "新增 MFA、恢复代码及密码管理" [ref=f8e110] [cursor=pointer]
      - region "分区保存状态" [ref=f8e111]:
        - generic [ref=f8e112]:
          - text: 设置版本
          - code [ref=f8e113]: profile-v14
        - status [ref=f8e114]: 未保存更改：无
        - generic [ref=f8e115]: 已读取服务端快照
      - group [ref=f8e116]:
        - generic "设置与安全操作说明" [ref=f8e117] [cursor=pointer]
    - contentinfo "连接状态" [ref=f8e118]:
      - generic [ref=f8e119]: 网络：可用
      - generic [ref=f8e120]: 设置快照；写操作单独验证
      - generic [ref=f8e121]: 读取完成：2026-10-22T09:18:48.560Z
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
  31 |   const t = await boundary(page); await page.goto("/settings/notifications"); await page.getByLabel("静默开始时间").fill("23:30"); await page.getByLabel("静默结束时间").fill("06:15"); await page.getByLabel("摘要频率", { exact: true }).selectOption("weekly"); await page.getByRole("button", { name: "保存通知偏好" }).click(); await expect(page.locator(".toast")).toContainText("通知偏好已保存"); expect(writes(t.requests)[0].postDataJSON()).toMatchObject({ quietHoursStart: "23:30", quietHoursEnd: "06:15", digestFrequency: "weekly" }); expect(writes(t.requests)[0].postDataJSON()).not.toHaveProperty("browserPermission");
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
> 72 |     const a = await new AxeBuilder({ page }).analyze(); scans.push({ section, width, violations: a.violations, incomplete: a.incomplete }); expect(a.violations, `${theme}/${section}/${width}`).toEqual([]);
     |                                                                                                                                                                                                  ^ Error: dark/security/390
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