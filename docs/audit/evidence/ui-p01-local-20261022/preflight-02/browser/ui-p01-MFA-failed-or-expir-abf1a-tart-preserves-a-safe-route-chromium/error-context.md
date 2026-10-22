# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui-p01.spec.ts >> MFA failed or expired challenge remains neutral and restart preserves a safe route
- Location: tests/e2e/ui-p01.spec.ts:87:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('alert')
Expected: visible
Error: strict mode violation: getByRole('alert') resolved to 2 elements:
    1) <p role="alert" class="auth-error">验证码无效或已失效，请重新获取后再试。</p> aka getByText('验证码无效或已失效，请重新获取后再试。')
    2) <div role="alert" aria-live="assertive" id="__next-route-announcer__"></div> aka locator('[id="__next-route-announcer__"]')

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('alert')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e2]:
    - generic "当前语言" [ref=e3]: ◎ 简体中文
    - generic [ref=e6]:
      - generic [ref=e7]:
        - emphasis [ref=e11]
        - generic [ref=e12]: SUMALPHA
      - generic [ref=e13]: ♢
      - heading "完成身份验证" [level=1] [ref=e14]
      - paragraph [ref=e15]: 请输入你的六位验证码以继续。
      - generic [ref=e16]:
        - generic [ref=e17]:
          - textbox "验证码第 1 位" [ref=e18]
          - textbox "验证码第 2 位" [ref=e19]
          - textbox "验证码第 3 位" [ref=e20]
          - textbox "验证码第 4 位" [ref=e21]
          - textbox "验证码第 5 位" [ref=e22]
          - textbox "验证码第 6 位" [ref=e23]
        - button "验证并继续" [ref=e24] [cursor=pointer]
      - alert [ref=e25]: 验证码无效或已失效，请重新获取后再试。
      - link "重新登录" [ref=e26] [cursor=pointer]:
        - /url: /login?return_to=%2Fportfolio%2Fpositions
      - paragraph [ref=e27]: ⓘ 为保护账户安全，请勿向他人泄露验证码。验证码有效期与重试限制以身份服务的实际响应为准。
    - generic [ref=e28]:
      - link "系统状态" [ref=e29] [cursor=pointer]:
        - /url: /maintenance
      - group [ref=e31]:
        - generic "隐私" [ref=e32] [cursor=pointer]
      - group [ref=e34]:
        - generic "安全" [ref=e35] [cursor=pointer]
      - group [ref=e37]:
        - generic "需要帮助？" [ref=e38] [cursor=pointer]
  - alert [ref=e39]
```

# Test source

```ts
  1   | import { expect, test, type Page } from "@playwright/test";
  2   | import { AxeBuilder } from "@axe-core/playwright";
  3   | import { writeFile } from "node:fs/promises";
  4   | const BFF = "http://localhost:4010";
  5   | const cors = { "access-control-allow-origin": "http://localhost:3190", "access-control-allow-credentials": "true", "access-control-allow-headers": "content-type,x-csrf-token", "access-control-allow-methods": "POST,OPTIONS" };
  6   | const accepted = { jobId: "11111111-2222-4333-8444-555555555555", status: "accepted", correlationId: "66666666-7777-4888-8999-000000000000", auditRef: "77777777-8888-4999-8aaa-111111111111" };
  7   | async function fillAccess(page: Page) {
  8   |   await page.getByLabel("组织 / 公司").fill("SumAlpha Research");
  9   |   await page.getByLabel("工作邮箱").fill("research@example.com");
  10  |   await page.getByLabel("使用场景 / 用途说明").fill("用于受控的 Paper 模式量化研究与策略验证流程。");
  11  |   await page.getByRole("checkbox").check();
  12  | }
  13  | async function digits(page: Page) { await page.getByLabel("验证码第 1 位").fill("123456"); }
  14  | async function mfaCookie(page: Page) { await page.context().addCookies([{ name: "quantos_csrf", value: "fixture", url: "http://localhost:3190" }]); }
  15  | 
  16  | test("C01 access double submit is single-flight and 202 retains audit correlation without granting access", async ({ page }) => {
  17  |   let calls = 0;
  18  |   await page.route(`${BFF}/v1/access-requests`, async route => {
  19  |     if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
  20  |     calls++; const body = route.request().postDataJSON(); expect(body.expectedMode).toBe("shadow"); expect(body).not.toHaveProperty("consent"); expect(body).not.toHaveProperty("website");
  21  |     await route.fulfill({ status: 202, headers: cors, json: accepted });
  22  |   });
  23  |   await page.goto("/access-request"); await fillAccess(page); await page.getByLabel("预期模式").selectOption("shadow");
  24  |   await page.locator("form").evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
  25  |   await expect(page.getByRole("heading", { name: "申请已受理" })).toBeVisible();
  26  |   await expect(page.getByText(/不代表访问权限已经开通/)).toBeVisible(); await expect(page.getByText(accepted.correlationId)).toBeVisible(); expect(calls).toBe(1);
  27  | });
  28  | for (const status of [422, 429]) test(`access ${status} is neutral, preserves inputs and permits only explicit retry`, async ({ page }) => {
  29  |   let calls = 0;
  30  |   await page.route(`${BFF}/v1/access-requests`, async route => {
  31  |     if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
  32  |     calls++; await route.fulfill({ status: calls > 1 ? 202 : status, headers: cors, json: calls > 1 ? accepted : { code: status === 429 ? "RATE_LIMITED" : "VALIDATION_FAILED", message: "private account exists", correlationId: accepted.correlationId, retryAfter: 1 } });
  33  |   });
  34  |   await page.goto("/access-request"); await fillAccess(page); await page.getByRole("button", { name: "提交申请", exact: true }).click();
  35  |   await expect(page.getByRole("alert")).toBeVisible(); await expect(page.getByRole("alert")).not.toContainText("private");
  36  |   await expect(page.getByLabel("工作邮箱")).toHaveValue("research@example.com");
  37  |   if (status === 429) await expect(page.getByRole("button", { name: /请等待/ })).toBeDisabled();
  38  |   await expect(page.getByRole("button", { name: "提交申请", exact: true })).toBeEnabled(); expect(calls).toBe(1);
  39  |   await page.getByRole("button", { name: "提交申请", exact: true }).click(); await expect(page.getByRole("heading", { name: "申请已受理" })).toBeVisible(); expect(calls).toBe(2);
  40  | });
  41  | for (const kind of ["network", "malformed", "server"]) test(`access uncertain ${kind} response requires acknowledgement before resubmission`, async ({ page }) => {
  42  |   let calls = 0;
  43  |   await page.route(`${BFF}/v1/access-requests`, async route => {
  44  |     if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
  45  |     calls++;
  46  |     if (calls > 1) return route.fulfill({ status: 202, headers: cors, json: accepted });
  47  |     if (kind === "network") return route.abort();
  48  |     await route.fulfill({ status: kind === "server" ? 503 : 202, headers: cors, json: { status: "accepted", message: "private account" } });
  49  |   });
  50  |   await page.goto("/access-request"); await fillAccess(page); await page.getByRole("button", { name: "提交申请", exact: true }).click();
  51  |   await expect(page.getByRole("alert")).toContainText("结果未知"); await expect(page.getByRole("button", { name: "提交申请", exact: true })).toBeDisabled();
  52  |   expect(calls).toBe(1); await page.getByRole("button", { name: "已核查受理状态，允许重新提交" }).click();
  53  |   await expect(page.getByLabel("工作邮箱")).toHaveValue("research@example.com"); await page.getByRole("button", { name: "提交申请", exact: true }).click();
  54  |   await expect(page.getByRole("heading", { name: "申请已受理" })).toBeVisible(); expect(calls).toBe(2);
  55  | });
  56  | test("offline cancels a waiting access request and reconnect never replays it", async ({ page, context }) => {
  57  |   let calls = 0, release!: () => void;
  58  |   await page.route(`${BFF}/v1/access-requests`, async route => {
  59  |     if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
  60  |     calls++; await new Promise<void>(resolve => { release = resolve; }); await route.fulfill({ status: 202, headers: cors, json: accepted }).catch(() => {});
  61  |   });
  62  |   await page.goto("/access-request"); await fillAccess(page); await page.getByRole("button", { name: "提交申请", exact: true }).click();
  63  |   await expect.poll(() => calls).toBe(1); await context.setOffline(true); await page.evaluate(() => dispatchEvent(new Event("offline")));
  64  |   await expect(page.getByRole("alert")).toContainText("结果未知"); release(); await context.setOffline(false); await page.evaluate(() => dispatchEvent(new Event("online")));
  65  |   await expect(page.getByRole("button", { name: "提交申请", exact: true })).toBeDisabled(); expect(calls).toBe(1);
  66  | });
  67  | test("offline before submission blocks access and login but preserves draft for manual recovery", async ({ page, context }) => {
  68  |   let calls = 0; await page.route(`${BFF}/v1/access-requests`, async route => { calls++; await route.abort(); });
  69  |   await page.goto("/access-request"); await fillAccess(page); await context.setOffline(true); await page.evaluate(() => dispatchEvent(new Event("offline")));
  70  |   await expect(page.getByRole("button", { name: "离线，无法提交" })).toBeDisabled(); expect(calls).toBe(0);
  71  |   await context.setOffline(false); await page.evaluate(() => dispatchEvent(new Event("online")));
  72  |   await expect(page.getByRole("button", { name: "提交申请", exact: true })).toBeEnabled(); await expect(page.getByLabel("工作邮箱")).toHaveValue("research@example.com"); expect(calls).toBe(0);
  73  |   await page.goto("/login"); await context.setOffline(true); await page.evaluate(() => dispatchEvent(new Event("offline")));
  74  |   await expect(page.getByRole("button", { name: "使用组织账户继续" })).toBeDisabled();
  75  | });
  76  | test("MFA enforces server cooldown, clears code, and retries only on user action", async ({ page }) => {
  77  |   await mfaCookie(page); let calls = 0;
  78  |   await page.route(`${BFF}/v1/auth/mfa/challenges`, async route => {
  79  |     if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
  80  |     calls++; await route.fulfill({ status: calls === 1 ? 429 : 200, headers: cors, json: calls === 1 ? { code: "RATE_LIMITED", message: "private account", correlationId: accepted.correlationId, retryAfter: 1 } : { challengeRef: accepted.jobId, status: "verified" } });
  81  |   });
  82  |   await page.goto("/mfa?return_to=%2Fauth%2Fcallback"); await digits(page); await page.getByRole("button", { name: "验证并继续" }).click();
  83  |   await expect(page.getByRole("button", { name: /请等待/ })).toBeDisabled(); await expect(page.getByLabel("验证码第 1 位")).toHaveValue("");
  84  |   await expect(page.getByRole("button", { name: "验证并继续" })).toBeEnabled(); expect(calls).toBe(1);
  85  |   await digits(page); await page.getByRole("button", { name: "验证并继续" }).click(); await expect(page).toHaveURL(/\/command$/); expect(calls).toBe(2);
  86  | });
  87  | test("MFA failed or expired challenge remains neutral and restart preserves a safe route", async ({ page }) => {
  88  |   await mfaCookie(page);
  89  |   await page.route(`${BFF}/v1/auth/mfa/challenges`, route => route.fulfill({ status: route.request().method() === "OPTIONS" ? 204 : 200, headers: cors, json: route.request().method() === "OPTIONS" ? undefined : { challengeRef: accepted.jobId, status: "failed" } }));
  90  |   await page.goto("/mfa?return_to=%2Fportfolio%2Fpositions"); await digits(page); await page.getByRole("button", { name: "验证并继续" }).click();
> 91  |   await expect(page.getByRole("alert")).toBeVisible(); await expect(page.getByRole("link", { name: "重新登录" })).toHaveAttribute("href", "/login?return_to=%2Fportfolio%2Fpositions");
      |                                         ^ Error: expect(locator).toBeVisible() failed
  92  |   await expect(page.getByLabel("验证码第 1 位")).toHaveValue("");
  93  | });
  94  | test("offline safe recovery, concealed correlation and clipboard failure remain actionable", async ({ page }) => {
  95  |   await page.goto("/offline?return_to=https%3A%2F%2Fevil.example"); await page.getByRole("button", { name: "重新验证会话" }).click(); await expect(page).toHaveURL(/\/login\?return_to=%2Fcommand$/);
  96  |   await page.goto(`/unauthorized?correlation_id=${accepted.correlationId}`);
  97  |   await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw Error("denied"); } } }));
  98  |   await page.getByRole("button", { name: "复制关联 ID" }).click(); await expect(page.getByRole("status")).toContainText("手动复制");
  99  |   await page.getByRole("link", { name: "联系管理员" }).click(); await page.locator("#auth-support summary").click(); await expect(page.locator("#auth-support p")).toBeVisible();
  100 |   await page.goto("/unauthorized?correlation_id=private-account"); await expect(page.getByRole("button", { name: "复制关联 ID" })).toBeDisabled();
  101 | });
  102 | 
  103 | for (const theme of ["dark", "light"] as const) {
  104 |   test(`P01 five pages ${theme} responsive keyboard and axe`, async ({ page }, info) => {
  105 |     await page.emulateMedia({ colorScheme: theme }); const scans = [];
  106 |     for (const path of ["/login", "/mfa", "/access-request", "/unauthorized", "/offline"]) {
  107 |       await page.setViewportSize({ width: 1440, height: 900 }); await page.goto(path); await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  108 |       const result = await new AxeBuilder({ page }).analyze(); scans.push({ path, violations: result.violations, incomplete: result.incomplete }); expect(result.violations).toEqual([]);
  109 |       await page.setViewportSize({ width: 390, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  110 |       await page.evaluate(() => { document.documentElement.style.zoom = "2"; }); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  111 |       await page.keyboard.press("Tab"); expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe("BODY");
  112 |       const screenshot = info.outputPath(`${path.slice(1)}-${theme}-390-csszoom2.png`); await page.screenshot({ path: screenshot, fullPage: true }); await info.attach(path.slice(1), { path: screenshot, contentType: "image/png" });
  113 |       await page.evaluate(() => { document.documentElement.style.zoom = "1"; });
  114 |     }
  115 |     const file = info.outputPath(`axe-${theme}.json`); await writeFile(file, JSON.stringify(scans, null, 2)); await info.attach("axe", { path: file, contentType: "application/json" });
  116 |   });
  117 |   test(`P01 visual baselines ${theme}`, async ({ page }) => {
  118 |     await page.emulateMedia({ colorScheme: theme });
  119 |     for (const path of ["/login", "/mfa", "/access-request", "/unauthorized", "/offline"]) { await page.goto(path); await expect(page.getByRole("heading", { level: 1 })).toBeVisible(); await expect(page).toHaveScreenshot(`p01-${path.slice(1)}-${theme}.png`, { fullPage: true, maxDiffPixelRatio: 0.005 }); }
  120 |   });
  121 | }
  122 | 
```