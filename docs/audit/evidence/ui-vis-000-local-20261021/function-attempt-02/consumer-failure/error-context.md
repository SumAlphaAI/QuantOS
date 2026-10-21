# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui104-settings.spec.ts >> UI-104 profile, security, notifications and browser settings >> 390px and 200% zoom hide high-risk settings actions without page overflow
- Location: tests/e2e/ui104-settings.spec.ts:51:7

# Error details

```
Error: expect(received).toBeLessThanOrEqual(expected)

Expected: <= 390
Received:    409
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - link "跳至正文" [ref=e4] [cursor=pointer]:
      - /url: "#_R_2npfivb_"
    - banner [ref=e5]:
      - button "折叠侧栏" [expanded] [ref=e6] [cursor=pointer]:
        - emphasis [ref=e10]
      - generic [ref=e11]: PAPER
      - button "通知，3 条未读" [ref=e12] [cursor=pointer]:
        - text: ♧
        - generic [ref=e13]: "3"
      - link "打开个人设置" [ref=e14] [cursor=pointer]:
        - /url: /settings/profile
        - text: AN
    - main [ref=e15]:
      - generic [ref=e16]:
        - generic [ref=e17]:
          - paragraph [ref=e18]: Settings / security
          - heading "Security & MFA" [level=1] [ref=e19]
          - paragraph [ref=e20]: 管理 MFA、活跃会话、可信设备与安全操作。
        - generic [ref=e21]:
          - button "查看安全审计" [ref=e22] [cursor=pointer]
          - button "快捷键" [ref=e23] [cursor=pointer]
          - button "关闭设置" [ref=e24] [cursor=pointer]: × 关闭
      - status [ref=e25]: C17 Local Mock · 页面数据来自 OpenAPI 1.2.0 同源 fixture；本地参考 provider 已实现，staging BFF 签署待完成。
      - generic [ref=e26]:
        - complementary "设置导航" [ref=e27]:
          - navigation [ref=e28]:
            - link "个人资料" [ref=e29] [cursor=pointer]:
              - /url: /settings/profile
              - generic [ref=e30]: ♙
              - text: 个人资料
            - link "通知设置" [ref=e31] [cursor=pointer]:
              - /url: /settings/notifications
              - generic [ref=e32]: ♧
              - text: 通知设置
            - link "安全与 MFA" [ref=e33] [cursor=pointer]:
              - /url: /settings/security
              - generic [ref=e34]: ♢
              - text: 安全与 MFA
            - link "Web Browser" [ref=e35] [cursor=pointer]:
              - /url: /settings/browser
              - generic [ref=e36]: ◎
              - text: Web Browser
        - group [ref=e38]:
          - generic [ref=e39]:
            - generic [ref=e40]:
              - generic [ref=e41]:
                - heading "安全中心" [level=2] [ref=e42]
                - paragraph [ref=e43]: Security posture · strong
              - strong [ref=e44]: ♢ 92
              - generic [ref=e45]:
                - term [ref=e46]: MFA
                - definition [ref=e47]: 已启用
                - term [ref=e48]: 主要方式
                - definition [ref=e49]: passkey
                - term [ref=e50]: 恢复代码
                - definition [ref=e51]: 8 remaining
                - term [ref=e52]: 上次验证
                - definition [ref=e53]: 2026年8月10日 18:54
              - generic [ref=e54]:
                - button "添加 Passkey" [ref=e55] [cursor=pointer]
                - button "管理 MFA" [ref=e56] [cursor=pointer]
              - paragraph [ref=e57]: △ 安全变更需要近期登录验证。
            - generic [ref=e58]:
              - heading "活动会话 3" [level=2] [ref=e59]
              - generic [ref=e60]:
                - generic [ref=e61]:
                  - generic [ref=e62]: 设备与浏览器
                  - generic [ref=e63]: 位置
                  - generic [ref=e64]: 最后活动
                  - generic [ref=e65]: 会话 ID / IP
                  - generic [ref=e66]: 状态
                - generic [ref=e67]:
                  - strong [ref=e68]:
                    - text: QuantOS Web
                    - generic [ref=e69]: Chrome · macOS
                  - generic [ref=e70]: Shanghai
                  - time [ref=e71]: 2026年8月15日 11:18
                  - code [ref=e72]:
                    - text: sess-8f3a-current
                    - generic [ref=e73]: 203.0.113.xxx
                  - generic [ref=e74]: ● 当前
                - generic [ref=e75]:
                  - strong [ref=e76]:
                    - text: Chrome 139
                    - generic [ref=e77]: macOS
                  - generic [ref=e78]: Shanghai
                  - time [ref=e79]: 2026年8月15日 09:18
                  - code [ref=e80]:
                    - text: sess-12de-remote
                    - generic [ref=e81]: 203.0.113.xxx
                - generic [ref=e82]:
                  - strong [ref=e83]:
                    - text: Safari
                    - generic [ref=e84]: iPhone
                  - generic [ref=e85]: Hangzhou
                  - time [ref=e86]: 2026年8月13日 11:18
                  - code [ref=e87]:
                    - text: sess-4c7e-mobile
                    - generic [ref=e88]: 203.0.113.xxx
            - generic [ref=e89]:
              - heading "可信设备 2" [level=2] [ref=e90]
              - generic [ref=e91]:
                - generic [ref=e92]:
                  - strong [ref=e93]: MacBook Pro
                  - generic [ref=e94]: passkey
                  - time [ref=e95]: 信任至 2026年9月9日 08:00
                  - generic [ref=e96]: ● 当前
                - generic [ref=e97]:
                  - strong [ref=e98]: iPhone 16
                  - generic [ref=e99]: biometric
                  - time [ref=e100]: 信任至 2026年8月24日 08:00
            - generic [ref=e101]:
              - heading "安全操作" [level=2] [ref=e102]
              - generic [ref=e103]:
                - button "下载恢复代码" [ref=e104] [cursor=pointer]
                - button "重新验证身份" [ref=e105] [cursor=pointer]
                - button "查看登录活动" [ref=e106] [cursor=pointer]
                - generic [ref=e107]: "Correlation ID: 1af2d9e0-f311-4ce2-8ff9-9ec76d13c311"
    - contentinfo "连接状态" [ref=e108]:
      - generic [ref=e109]: "● Connection: Live"
      - generic [ref=e110]: "● Realtime: Connected"
      - generic [ref=e111]: ● Settings synced
      - generic [ref=e112]: Session protected
      - generic [ref=e113]: Last sync 11:34:42
  - alert [ref=e114]
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | import { AxeBuilder } from "@axe-core/playwright";
  3  | 
  4  | // 视觉基线按平台入库（<name>-<project>-<platform>.png）；本平台基线缺失时测试失败，
  5  | // 由 QA 在对应平台 runner 生成并提交基线（同 command.spec.ts，见 docs/execution/PRE-06-summary.md 遗留项 3）
  6  | 
  7  | test.describe("UI-104 profile, security, notifications and browser settings", () => {
  8  |   test("P15/P17 routes render the shared settings workspace", async ({ page }) => {
  9  |     const routes = [
  10 |       ["/settings/profile", "Profile & Settings"],
  11 |       ["/settings/notifications", "Notification settings"],
  12 |       ["/settings/security", "Security & MFA"],
  13 |       ["/settings/browser", "Browser settings"],
  14 |     ] as const;
  15 |     for (const [route, heading] of routes) {
  16 |       await page.goto(route);
  17 |       await expect(page.locator(`[data-smoke="route-${route}"]`)).toBeVisible();
  18 |       await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  19 |       await expect(page.getByText(/C17 Local Mock/)).toBeVisible();
  20 |     }
  21 |   });
  22 | 
  23 |   test("browser notification denial degrades without blocking in-app alerts", async ({ page }) => {
  24 |     await page.goto("/settings/notifications");
  25 |     await expect(page.getByRole("status").filter({ hasText: "已降级为站内通知" })).toBeVisible();
  26 |     const browserToggles = page.getByRole("cell").filter({ has: page.getByRole("checkbox", { disabled: true }) });
  27 |     await expect(browserToggles.first()).toBeVisible();
  28 |   });
  29 | 
  30 |   test("scrollable browser download history is keyboard focusable", async ({ page }) => {
  31 |     await page.goto("/settings/browser");
  32 |     const downloads = page.getByRole("region", { name: "最近下载记录" });
  33 |     await downloads.focus();
  34 |     await expect(downloads).toBeFocused();
  35 |   });
  36 | 
  37 |   test("session revocation requires phrase and six-digit MFA, with cancel focused first", async ({ page }) => {
  38 |     await page.goto("/settings/security");
  39 |     await page.getByRole("button", { name: "撤销会话" }).first().click();
  40 |     await expect(page.getByRole("dialog", { name: "撤销活动会话" })).toBeVisible();
  41 |     await expect(page.getByRole("button", { name: "取消" })).toBeFocused();
  42 |     const confirm = page.getByRole("button", { name: "确认撤销会话" });
  43 |     await expect(confirm).toBeDisabled();
  44 |     await page.getByLabel(/输入“REVOKE sess-12de-remote”/).fill("REVOKE sess-12de-remote");
  45 |     await page.getByLabel("MFA 验证码").fill("123456");
  46 |     await expect(confirm).toBeEnabled();
  47 |     await confirm.click();
  48 |     await expect(page.getByText(/会话撤销已受理/)).toBeVisible();
  49 |   });
  50 | 
  51 |   test("390px and 200% zoom hide high-risk settings actions without page overflow", async ({ page }) => {
  52 |     await page.setViewportSize({ width: 390, height: 844 });
  53 |     await page.goto("/settings/security");
  54 |     await expect(page.getByRole("heading", { name: "Security & MFA" })).toBeVisible();
  55 |     await expect(page.locator(".settings-high-risk").first()).toBeHidden();
  56 |     expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  57 |     await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
  58 |     await expect(page.locator(".settings-high-risk").first()).toBeHidden();
> 59 |     expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
     |                                                                             ^ Error: expect(received).toBeLessThanOrEqual(expected)
  60 |   });
  61 | 
  62 |   test("offline mode freezes profile and notification writes", async ({ page, context }) => {
  63 |     await page.goto("/settings/profile");
  64 |     await context.setOffline(true);
  65 |     await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  66 |     await expect(page.getByRole("button", { name: "保存个人资料" })).toBeDisabled();
  67 |     await expect(page.getByText(/恢复连接后不会自动重放保存或撤销操作/)).toBeVisible();
  68 |     await context.setOffline(false);
  69 |   });
  70 | 
  71 |   test("profile, security and browser pages have no serious or critical axe violations", async ({ page }) => {
  72 |     for (const route of ["/settings/profile", "/settings/security", "/settings/browser"]) {
  73 |       await page.goto(route);
  74 |       const results = await new AxeBuilder({ page }).analyze();
  75 |       expect(results.violations.filter((entry) => ["critical", "serious"].includes(entry.impact ?? "")), route).toEqual([]);
  76 |     }
  77 |   });
  78 | 
  79 |   test("P15 security and P17 browser 1440 dark visual baselines", async ({ page }) => {
  80 |     const snapshots = ["ui104-security-1440-dark", "ui104-browser-1440-dark"];
  81 |     await page.goto("/settings/security");
  82 |     await expect(page.getByRole("heading", { name: "Security & MFA" })).toBeVisible();
  83 |     await expect(page).toHaveScreenshot(`${snapshots[0]}.png`, { fullPage: true, maxDiffPixelRatio: 0.005 });
  84 |     await page.goto("/settings/browser");
  85 |     await expect(page.getByRole("heading", { name: "Browser settings" })).toBeVisible();
  86 |     await expect(page).toHaveScreenshot(`${snapshots[1]}.png`, { fullPage: true, maxDiffPixelRatio: 0.005 });
  87 |   });
  88 | });
  89 | 
```