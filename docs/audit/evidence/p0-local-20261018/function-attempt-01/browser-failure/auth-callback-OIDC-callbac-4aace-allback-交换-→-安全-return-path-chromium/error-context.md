# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth-callback.spec.ts >> OIDC callback PoC >> 完整流：login → PKCE authorize → callback 交换 → 安全 return path
- Location: tests/e2e/auth-callback.spec.ts:40:7

# Error details

```
Error: page.waitForURL: net::ERR_CONNECTION_REFUSED
=========================== logs ===========================
waiting for navigation until "load"
============================================================
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | 
  3  | /**
  4  |  * OIDC callback PoC E2E（G0 #4）：以 Playwright route 拦截 mock IdP。
  5  |  * 验证：PKCE 参数 → 302 回跳 → state 校验 → code_verifier 交换 → 安全 return path；
  6  |  * URL 全程不含 token/code（关联 ACC-P01-S1/S4、ACC-FLOW-08）。
  7  |  */
  8  | const IDP = "https://mock.idp.local";
  9  | 
  10 | function mockIdp(page: import("@playwright/test").Page, captured: { tokenBody?: string }) {
  11 |   return Promise.all([
  12 |     page.route(`${IDP}/authorize**`, async (route) => {
  13 |       const url = new URL(route.request().url());
  14 |       expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  15 |       expect(url.searchParams.get("code_challenge")).toBeTruthy();
  16 |       const redirectUri = url.searchParams.get("redirect_uri")!;
  17 |       const state = url.searchParams.get("state")!;
  18 |       // 模拟 IdP 认证成功回跳。WebKit 不允许 route.fulfill 使用 302 状态，
  19 |       // 统一用 200 + meta refresh/script 重定向（三浏览器行为一致）。
  20 |       const target = `${redirectUri}?code=mock-auth-code&state=${encodeURIComponent(state)}`;
  21 |       await route.fulfill({
  22 |         status: 200,
  23 |         contentType: "text/html",
  24 |         body: `<!doctype html><html><head><meta http-equiv="refresh" content="0;url=${target}"></head><body><script>location.replace(${JSON.stringify(target)});</script></body></html>`,
  25 |       });
  26 |     }),
  27 |     page.route(`${IDP}/token`, async (route) => {
  28 |       captured.tokenBody = route.request().postData() ?? "";
  29 |       await route.fulfill({
  30 |         status: 200,
  31 |         contentType: "application/json",
  32 |         headers: { "access-control-allow-origin": "*" },
  33 |         body: JSON.stringify({ subject: "e2e-user", expires_in: 300 }),
  34 |       });
  35 |     }),
  36 |   ]);
  37 | }
  38 | 
  39 | test.describe("OIDC callback PoC", () => {
  40 |   test("完整流：login → PKCE authorize → callback 交换 → 安全 return path", async ({ page }) => {
  41 |     const captured: { tokenBody?: string } = {};
  42 |     await mockIdp(page, captured);
  43 | 
  44 |     await page.goto("/login?return_to=/command");
  45 |     await page.getByRole("button", { name: /使用组织账户继续/ }).click();
  46 | 
> 47 |     await page.waitForURL((url) => url.pathname === "/command", { timeout: 10_000 });
     |                ^ Error: page.waitForURL: net::ERR_CONNECTION_REFUSED
  48 |     // token 交换真实发生且携带 code_verifier
  49 |     expect(captured.tokenBody).toContain("code_verifier=");
  50 |     expect(captured.tokenBody).toContain("grant_type=authorization_code");
  51 |     // URL 不含 code/token
  52 |     expect(page.url()).not.toContain("code=");
  53 |     expect(page.url()).not.toContain("token");
  54 |   });
  55 | 
  56 |   test("跨站 return_to 被消毒回退到 /command", async ({ page }) => {
  57 |     const captured: { tokenBody?: string } = {};
  58 |     await mockIdp(page, captured);
  59 |     await page.goto("/login?return_to=https://evil.example/steal");
  60 |     await page.getByRole("button", { name: /使用组织账户继续/ }).click();
  61 |     await page.waitForURL((url) => url.origin === "http://localhost:3190" && url.pathname === "/command", {
  62 |       timeout: 10_000,
  63 |     });
  64 |   });
  65 | 
  66 |   test("state 不匹配：不发起 token 交换并显示安全错误", async ({ page }) => {
  67 |     let tokenCalled = false;
  68 |     await page.route(`${IDP}/token`, async (route) => {
  69 |       tokenCalled = true;
  70 |       await route.fulfill({ status: 200, body: "{}" });
  71 |     });
  72 |     // 无 sessionStorage pending 直接访问 callback（等效 state 不匹配/会话失效）
  73 |     await page.goto("/auth/callback?code=x&state=forged");
  74 |     await expect(page.locator('main [role="alert"]')).toBeVisible();
  75 |     expect(tokenCalled).toBe(false);
  76 |   });
  77 | 
  78 |   test("IdP 返回 error：不发起交换，错误提示不含敏感细节", async ({ page }) => {
  79 |     let tokenCalled = false;
  80 |     await page.route(`${IDP}/token`, async (route) => {
  81 |       tokenCalled = true;
  82 |       await route.fulfill({ status: 200, body: "{}" });
  83 |     });
  84 |     await page.goto("/auth/callback?error=access_denied&error_description=internal-secret");
  85 |     await expect(page.locator('main [role="alert"]')).toBeVisible();
  86 |     await expect(page.locator('main [role="alert"]')).not.toContainText("internal-secret");
  87 |     expect(tokenCalled).toBe(false);
  88 |   });
  89 | });
  90 | 
```