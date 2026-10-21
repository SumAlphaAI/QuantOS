import { expect, test } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
const key = "quantos.auth.pending";
async function seed(page: import("@playwright/test").Page, overrides = {}) {
  await page.goto("/login");
  await page.evaluate(({ key, overrides }) => sessionStorage.setItem(key, JSON.stringify({ verifier: "v".repeat(64), state: "a".repeat(32), returnTo: "/command", issuedAt: Date.now(), ...overrides })), { key, overrides });
}
test("provider rejection consumes pending data and strips every callback parameter", async ({ page }) => {
  await seed(page); let calls = 0;
  await page.route("https://mock.idp.local/token", async route => { calls++; await route.abort(); });
  await page.goto("/auth/callback?error=access_denied&error_description=secret&code=private&state=private");
  await expect(page.getByRole("alert")).toContainText("登录未完成");
  expect(new URL(page.url()).search).toBe("");
  expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBeNull(); expect(calls).toBe(0);
});
for (const [name, overrides] of [["mismatch", {}], ["expired", { issuedAt: 0 }], ["malformed", { state: "", verifier: "" }]] as const) {
  test(`callback ${name} refuses without token exchange; replay remains refused`, async ({ page }) => {
    await seed(page, overrides); let calls = 0;
    await page.route("https://mock.idp.local/token", async route => { calls++; await route.abort(); });
    await page.goto("/auth/callback?code=secret&state=forged");
    await expect(page.getByRole("alert")).toBeVisible();
    expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBeNull();
    await page.goto("/auth/callback?code=replay&state=forged");
    await expect(page.getByRole("alert")).toContainText("已失效"); expect(calls).toBe(0);
    expect(new URL(page.url()).search).toBe("");
  });
}
test("valid mocked MFA callback routes through MFA without retaining PKCE or code", async ({ page }) => {
  await seed(page, { returnTo: "/orders?token=private" });
  await page.route("https://mock.idp.local/token", async route => route.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ subject: "fixture", expires_in: 300, mfa_required: true }) }));
  await page.goto(`/auth/callback?code=mock-code&state=${"a".repeat(32)}`);
  await expect(page).toHaveURL(/\/mfa\?return_to=%2Fcommand$/);
  expect(await page.evaluate(key => sessionStorage.getItem(key), key)).toBeNull();
});
test("MFA 401 returns to sanitized login after one attempt", async ({ page, context }) => {
  await context.addCookies([{ name: "quantos_csrf", value: "fixture", url: "http://localhost:3190" }]);
  let calls = 0;
  await page.route("http://localhost:4010/v1/auth/mfa/challenges", async route => {
    const headers = { "access-control-allow-origin": "http://localhost:3190", "access-control-allow-credentials": "true", "access-control-allow-headers": "content-type,x-csrf-token", "access-control-allow-methods": "POST,OPTIONS" };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    calls++; await route.fulfill({ status: 401, headers, contentType: "application/json", body: JSON.stringify({ code: "UNAUTHORIZED", message: "private account" }) });
  });
  await page.goto("/mfa?return_to=%2Forders%3Ftoken%3Dprivate");
  for (const [i, d] of [..."123456"].entries()) await page.getByLabel(`验证码第 ${i + 1} 位`).fill(d);
  await page.getByRole("button", { name: "验证并继续" }).click();
  await expect(page).toHaveURL(/\/login\?return_to=%2Fcommand$/); expect(calls).toBe(1);
});
test("recovery surfaces expose usable headings, safe navigation and recorded axe findings", async ({ page }, info) => {
  const scans = [];
  for (const path of ["/login", "/mfa", "/unauthorized", "/maintenance", "/offline"]) {
    await page.goto(path); await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const result = await new AxeBuilder({ page }).analyze();
    scans.push({ path, violations: result.violations, incomplete: result.incomplete });
    expect(result.violations.filter(v => ["serious", "critical"].includes(v.impact ?? ""))).toEqual([]);
    if (["/login", "/mfa", "/offline"].includes(path)) await info.attach(path.slice(1) + ".png", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  }
  await info.attach("axe.json", { body: Buffer.from(JSON.stringify(scans, null, 2)), contentType: "application/json" });
});
