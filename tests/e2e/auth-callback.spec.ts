import { expect, test } from "@playwright/test";

/**
 * OIDC callback PoC E2E（G0 #4）：以 Playwright route 拦截 mock IdP。
 * 验证：PKCE 参数 → 302 回跳 → state 校验 → code_verifier 交换 → 安全 return path；
 * URL 全程不含 token/code（关联 ACC-P01-S1/S4、ACC-FLOW-08）。
 */
const IDP = "https://mock.idp.local";

function mockIdp(page: import("@playwright/test").Page, captured: { tokenBody?: string }) {
  return Promise.all([
    page.route(`${IDP}/authorize**`, async (route) => {
      const url = new URL(route.request().url());
      expect(url.searchParams.get("code_challenge_method")).toBe("S256");
      expect(url.searchParams.get("code_challenge")).toBeTruthy();
      const redirectUri = url.searchParams.get("redirect_uri")!;
      const state = url.searchParams.get("state")!;
      // 模拟 IdP 认证成功回跳。WebKit 不允许 route.fulfill 使用 302 状态，
      // 统一用 200 + meta refresh/script 重定向（三浏览器行为一致）。
      const target = `${redirectUri}?code=mock-auth-code&state=${encodeURIComponent(state)}`;
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: `<!doctype html><html><head><meta http-equiv="refresh" content="0;url=${target}"></head><body><script>location.replace(${JSON.stringify(target)});</script></body></html>`,
      });
    }),
    page.route(`${IDP}/token`, async (route) => {
      captured.tokenBody = route.request().postData() ?? "";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify({ subject: "e2e-user", expires_in: 300 }),
      });
    }),
  ]);
}

test.describe("OIDC callback PoC", () => {
  test("完整流：login → PKCE authorize → callback 交换 → 安全 return path", async ({ page }) => {
    const captured: { tokenBody?: string } = {};
    await mockIdp(page, captured);

    await page.goto("/login?return_to=/command");
    await page.getByRole("button", { name: /使用组织账户继续/ }).click();

    await page.waitForURL((url) => url.pathname === "/command", { timeout: 10_000 });
    // token 交换真实发生且携带 code_verifier
    expect(captured.tokenBody).toContain("code_verifier=");
    expect(captured.tokenBody).toContain("grant_type=authorization_code");
    // URL 不含 code/token
    expect(page.url()).not.toContain("code=");
    expect(page.url()).not.toContain("token");
  });

  test("跨站 return_to 被消毒回退到 /command", async ({ page }) => {
    const captured: { tokenBody?: string } = {};
    await mockIdp(page, captured);
    await page.goto("/login?return_to=https://evil.example/steal");
    await page.getByRole("button", { name: /使用组织账户继续/ }).click();
    await page.waitForURL((url) => url.origin === "http://localhost:3190" && url.pathname === "/command", {
      timeout: 10_000,
    });
  });

  test("state 不匹配：不发起 token 交换并显示安全错误", async ({ page }) => {
    let tokenCalled = false;
    await page.route(`${IDP}/token`, async (route) => {
      tokenCalled = true;
      await route.fulfill({ status: 200, body: "{}" });
    });
    // 无 sessionStorage pending 直接访问 callback（等效 state 不匹配/会话失效）
    await page.goto("/auth/callback?code=x&state=forged");
    await expect(page.locator('main [role="alert"]')).toBeVisible();
    expect(tokenCalled).toBe(false);
  });

  test("IdP 返回 error：不发起交换，错误提示不含敏感细节", async ({ page }) => {
    let tokenCalled = false;
    await page.route(`${IDP}/token`, async (route) => {
      tokenCalled = true;
      await route.fulfill({ status: 200, body: "{}" });
    });
    await page.goto("/auth/callback?error=access_denied&error_description=internal-secret");
    await expect(page.locator('main [role="alert"]')).toBeVisible();
    await expect(page.locator('main [role="alert"]')).not.toContainText("internal-secret");
    expect(tokenCalled).toBe(false);
  });
});
