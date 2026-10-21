# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui102-current.spec.ts >> callback malformed refuses without token exchange; replay remains refused
- Location: tests/e2e/ui102-current.spec.ts:17:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('alert')
Expected: visible
Error: strict mode violation: getByRole('alert') resolved to 2 elements:
    1) <p role="alert" class="auth-lead">认证会话已失效，请重新登录。</p> aka getByText('认证会话已失效，请重新登录。')
    2) <div role="alert" aria-live="assertive" id="__next-route-announcer__"></div> aka locator('[id="__next-route-announcer__"]')

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('alert')

```

# Page snapshot

```yaml
- generic [active] [ref=f1e1]:
  - main [ref=f1e2]:
    - generic "当前语言" [ref=f1e3]: ◎ 简体中文 ⌄
    - generic [ref=f1e6]:
      - generic [ref=f1e7]:
        - emphasis [ref=f1e11]
        - generic [ref=f1e12]: SUMALPHA
      - generic [ref=f1e13]: ×
      - heading "登录失败" [level=1] [ref=f1e14]
      - alert [ref=f1e15]: 认证会话已失效，请重新登录。
      - link "返回登录" [ref=f1e16] [cursor=pointer]:
        - /url: /login
    - generic [ref=f1e17]:
      - link "系统状态" [ref=f1e18] [cursor=pointer]:
        - /url: /maintenance
      - link "隐私" [ref=f1e20] [cursor=pointer]:
        - /url: "#privacy"
      - link "安全" [ref=f1e22] [cursor=pointer]:
        - /url: "#security"
  - alert [ref=f1e23]
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | import { AxeBuilder } from "@axe-core/playwright";
  3  | const key = "quantos.auth.pending";
  4  | async function seed(page: import("@playwright/test").Page, overrides = {}) {
  5  |   await page.goto("/login");
  6  |   await page.evaluate(({ key, overrides }) => sessionStorage.setItem(key, JSON.stringify({ verifier: "v".repeat(64), state: "a".repeat(32), returnTo: "/command", issuedAt: Date.now(), ...overrides })), { key, overrides });
  7  | }
  8  | test("provider rejection consumes pending data and strips every callback parameter", async ({ page }) => {
  9  |   await seed(page); let calls = 0;
  10 |   await page.route("https://mock.idp.local/token", async route => { calls++; await route.abort(); });
  11 |   await page.goto("/auth/callback?error=access_denied&error_description=secret&code=private&state=private");
  12 |   await expect(page.getByRole("alert")).toContainText("登录未完成");
  13 |   expect(new URL(page.url()).search).toBe("");
  14 |   expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBeNull(); expect(calls).toBe(0);
  15 | });
  16 | for (const [name, overrides] of [["mismatch", {}], ["expired", { issuedAt: 0 }], ["malformed", { state: "", verifier: "" }]] as const) {
  17 |   test(`callback ${name} refuses without token exchange; replay remains refused`, async ({ page }) => {
  18 |     await seed(page, overrides); let calls = 0;
  19 |     await page.route("https://mock.idp.local/token", async route => { calls++; await route.abort(); });
  20 |     await page.goto("/auth/callback?code=secret&state=forged");
> 21 |     await expect(page.getByRole("alert")).toBeVisible();
     |                                           ^ Error: expect(locator).toBeVisible() failed
  22 |     expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBeNull();
  23 |     await page.goto("/auth/callback?code=replay&state=forged");
  24 |     await expect(page.getByRole("alert")).toContainText("已失效"); expect(calls).toBe(0);
  25 |     expect(new URL(page.url()).search).toBe("");
  26 |   });
  27 | }
  28 | test("valid mocked MFA callback routes through MFA without retaining PKCE or code", async ({ page }) => {
  29 |   await seed(page, { returnTo: "/orders?token=private" });
  30 |   await page.route("https://mock.idp.local/token", async route => route.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ subject: "fixture", expires_in: 300, mfa_required: true }) }));
  31 |   await page.goto(`/auth/callback?code=mock-code&state=${"a".repeat(32)}`);
  32 |   await expect(page).toHaveURL(/\/mfa\?return_to=%2Fcommand$/);
  33 |   expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBeNull();
  34 | });
  35 | test("MFA 401 returns to sanitized login after one attempt", async ({ page, context }) => {
  36 |   await context.addCookies([{ name: "quantos_csrf", value: "fixture", url: "http://localhost:3190" }]);
  37 |   let calls = 0;
  38 |   await page.route("http://localhost:4010/v1/auth/mfa/challenges", async route => {
  39 |     const headers = { "access-control-allow-origin": "http://localhost:3190", "access-control-allow-credentials": "true", "access-control-allow-headers": "content-type,x-csrf-token", "access-control-allow-methods": "POST,OPTIONS" };
  40 |     if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
  41 |     calls++; await route.fulfill({ status: 401, headers, contentType: "application/json", body: JSON.stringify({ code: "UNAUTHORIZED", message: "private account" }) });
  42 |   });
  43 |   await page.goto("/mfa?return_to=%2Forders%3Ftoken%3Dprivate");
  44 |   for (const [i, d] of [..."123456"].entries()) await page.getByLabel(`验证码第 ${i + 1} 位`).fill(d);
  45 |   await page.getByRole("button", { name: "验证并继续" }).click();
  46 |   await expect(page).toHaveURL(/\/login\?return_to=%2Fcommand$/); expect(calls).toBe(1);
  47 | });
  48 | test("recovery surfaces expose usable headings, safe navigation and recorded axe findings", async ({ page }, info) => {
  49 |   const scans = [];
  50 |   for (const path of ["/login", "/mfa", "/unauthorized", "/maintenance", "/offline"]) {
  51 |     await page.goto(path); await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  52 |     const result = await new AxeBuilder({ page }).analyze();
  53 |     scans.push({ path, violations: result.violations, incomplete: result.incomplete });
  54 |     expect(result.violations.filter(v => ["serious", "critical"].includes(v.impact ?? ""))).toEqual([]);
  55 |     if (["/login", "/mfa", "/offline"].includes(path)) await info.attach(path.slice(1) + ".png", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  56 |   }
  57 |   await info.attach("axe.json", { body: Buffer.from(JSON.stringify(scans, null, 2)), contentType: "application/json" });
  58 | });
  59 | 
```