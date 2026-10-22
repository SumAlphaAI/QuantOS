import { expect, test, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { writeFile } from "node:fs/promises";
const BFF = "http://localhost:4010";
const cors = { "access-control-allow-origin": "http://localhost:3190", "access-control-allow-credentials": "true", "access-control-allow-headers": "content-type,x-csrf-token", "access-control-allow-methods": "POST,OPTIONS" };
const accepted = { jobId: "11111111-2222-4333-8444-555555555555", status: "accepted", correlationId: "66666666-7777-4888-8999-000000000000", auditRef: "77777777-8888-4999-8aaa-111111111111" };
async function fillAccess(page: Page) {
  await page.getByLabel("组织 / 公司").fill("SumAlpha Research");
  await page.getByLabel("工作邮箱").fill("research@example.com");
  await page.getByLabel("使用场景 / 用途说明").fill("用于受控的 Paper 模式量化研究与策略验证流程。");
  await page.getByRole("checkbox").check();
}
async function digits(page: Page) { await page.getByLabel("验证码第 1 位").fill("123456"); }
async function mfaCookie(page: Page) { await page.context().addCookies([{ name: "quantos_csrf", value: "fixture", url: "http://localhost:3190" }]); }

test("C01 access double submit is single-flight and 202 retains audit correlation without granting access", async ({ page }) => {
  let calls = 0;
  await page.route(`${BFF}/v1/access-requests`, async route => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    calls++; const body = route.request().postDataJSON(); expect(body.expectedMode).toBe("shadow"); expect(body).not.toHaveProperty("consent"); expect(body).not.toHaveProperty("website");
    await route.fulfill({ status: 202, headers: cors, json: accepted });
  });
  await page.goto("/access-request"); await fillAccess(page); await page.getByLabel("预期模式").selectOption("shadow");
  await page.locator("form").evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
  await expect(page.getByRole("heading", { name: "申请已受理" })).toBeVisible();
  await expect(page.getByText(/不代表访问权限已经开通/)).toBeVisible(); await expect(page.getByText(accepted.correlationId)).toBeVisible(); expect(calls).toBe(1);
});
for (const status of [422, 429]) test(`access ${status} is neutral, preserves inputs and permits only explicit retry`, async ({ page }) => {
  let calls = 0;
  await page.route(`${BFF}/v1/access-requests`, async route => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    calls++; await route.fulfill({ status: calls > 1 ? 202 : status, headers: cors, json: calls > 1 ? accepted : { code: status === 429 ? "RATE_LIMITED" : "VALIDATION_FAILED", message: "private account exists", correlationId: accepted.correlationId, retryAfter: 1 } });
  });
  await page.goto("/access-request"); await fillAccess(page); await page.getByRole("button", { name: "提交申请", exact: true }).click();
  await expect(page.locator("main [role=alert]")).toBeVisible(); await expect(page.locator("main [role=alert]")).not.toContainText("private");
  await expect(page.getByLabel("工作邮箱")).toHaveValue("research@example.com");
  if (status === 429) await expect(page.getByRole("button", { name: /请等待/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: "提交申请", exact: true })).toBeEnabled(); expect(calls).toBe(1);
  await page.getByRole("button", { name: "提交申请", exact: true }).click(); await expect(page.getByRole("heading", { name: "申请已受理" })).toBeVisible(); expect(calls).toBe(2);
});
for (const kind of ["network", "malformed", "server"]) test(`access uncertain ${kind} response requires acknowledgement before resubmission`, async ({ page }) => {
  let calls = 0;
  await page.route(`${BFF}/v1/access-requests`, async route => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    calls++;
    if (calls > 1) return route.fulfill({ status: 202, headers: cors, json: accepted });
    if (kind === "network") return route.abort();
    await route.fulfill({ status: kind === "server" ? 503 : 202, headers: cors, json: { status: "accepted", message: "private account" } });
  });
  await page.goto("/access-request"); await fillAccess(page); await page.getByRole("button", { name: "提交申请", exact: true }).click();
  await expect(page.locator("main [role=alert]")).toContainText("结果未知"); await expect(page.getByRole("button", { name: "提交申请", exact: true })).toBeDisabled();
  expect(calls).toBe(1); await page.getByRole("button", { name: "已核查受理状态，允许重新提交" }).click();
  await expect(page.getByLabel("工作邮箱")).toHaveValue("research@example.com"); await page.getByRole("button", { name: "提交申请", exact: true }).click();
  await expect(page.getByRole("heading", { name: "申请已受理" })).toBeVisible(); expect(calls).toBe(2);
});
test("offline cancels a waiting access request and reconnect never replays it", async ({ page, context }) => {
  let calls = 0, release!: () => void;
  await page.route(`${BFF}/v1/access-requests`, async route => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    calls++; await new Promise<void>(resolve => { release = resolve; }); await route.fulfill({ status: 202, headers: cors, json: accepted }).catch(() => {});
  });
  await page.goto("/access-request"); await fillAccess(page); await page.getByRole("button", { name: "提交申请", exact: true }).click();
  await expect.poll(() => calls).toBe(1); await context.setOffline(true); await page.evaluate(() => dispatchEvent(new Event("offline")));
  await expect(page.locator("main [role=alert]")).toContainText("结果未知"); release(); await context.setOffline(false); await page.evaluate(() => dispatchEvent(new Event("online")));
  await expect(page.getByRole("button", { name: "提交申请", exact: true })).toBeDisabled(); expect(calls).toBe(1);
});
test("offline before submission blocks access and login but preserves draft for manual recovery", async ({ page, context }) => {
  let calls = 0; await page.route(`${BFF}/v1/access-requests`, async route => { calls++; await route.abort(); });
  await page.goto("/access-request"); await fillAccess(page); await context.setOffline(true); await page.evaluate(() => dispatchEvent(new Event("offline")));
  await expect(page.getByRole("button", { name: "离线，无法提交" })).toBeDisabled(); expect(calls).toBe(0);
  await context.setOffline(false); await page.evaluate(() => dispatchEvent(new Event("online")));
  await expect(page.getByRole("button", { name: "提交申请", exact: true })).toBeEnabled(); await expect(page.getByLabel("工作邮箱")).toHaveValue("research@example.com"); expect(calls).toBe(0);
  await page.goto("/login"); await context.setOffline(true); await page.evaluate(() => dispatchEvent(new Event("offline")));
  await expect(page.getByRole("button", { name: "使用组织账户继续" })).toBeDisabled();
});
test("MFA enforces server cooldown, clears code, and retries only on user action", async ({ page }) => {
  await mfaCookie(page); let calls = 0;
  await page.route(`${BFF}/v1/auth/mfa/challenges`, async route => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    calls++; await route.fulfill({ status: calls === 1 ? 429 : 200, headers: cors, json: calls === 1 ? { code: "RATE_LIMITED", message: "private account", correlationId: accepted.correlationId, retryAfter: 1 } : { challengeRef: accepted.jobId, status: "verified" } });
  });
  await page.goto("/mfa?return_to=%2Fauth%2Fcallback"); await digits(page); await page.getByRole("button", { name: "验证并继续" }).click();
  await expect(page.getByRole("button", { name: /请等待/ })).toBeDisabled(); await expect(page.getByLabel("验证码第 1 位")).toHaveValue("");
  await expect(page.getByRole("button", { name: "验证并继续" })).toBeEnabled(); expect(calls).toBe(1);
  await digits(page); await page.getByRole("button", { name: "验证并继续" }).click(); await expect(page).toHaveURL(/\/command$/); expect(calls).toBe(2);
});
test("MFA failed or expired challenge remains neutral and restart preserves a safe route", async ({ page }) => {
  await mfaCookie(page);
  await page.route(`${BFF}/v1/auth/mfa/challenges`, route => route.fulfill({ status: route.request().method() === "OPTIONS" ? 204 : 200, headers: cors, json: route.request().method() === "OPTIONS" ? undefined : { challengeRef: accepted.jobId, status: "failed" } }));
  await page.goto("/mfa?return_to=%2Fportfolio%2Fpositions"); await digits(page); await page.getByRole("button", { name: "验证并继续" }).click();
  await expect(page.locator("main [role=alert]")).toBeVisible(); await expect(page.getByRole("link", { name: "重新登录" })).toHaveAttribute("href", "/login?return_to=%2Fportfolio%2Fpositions");
  await expect(page.getByLabel("验证码第 1 位")).toHaveValue(""); await expect(page.getByLabel("验证码第 1 位")).toBeFocused();
});
test("offline safe recovery, concealed correlation and clipboard failure remain actionable", async ({ page }) => {
  await page.goto("/offline?return_to=https%3A%2F%2Fevil.example"); await page.getByRole("button", { name: "重新验证会话" }).click(); await expect(page).toHaveURL(/\/login\?return_to=%2Fcommand$/);
  await page.goto(`/unauthorized?correlation_id=${accepted.correlationId}`);
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw Error("denied"); } } }));
  await page.getByRole("button", { name: "复制关联 ID" }).click(); await expect(page.getByRole("status")).toContainText("手动复制");
  await page.getByRole("link", { name: "联系管理员" }).click(); await page.locator("#auth-support summary").click(); await expect(page.locator("#auth-support p")).toBeVisible();
  await page.goto("/unauthorized?correlation_id=private-account"); await expect(page.getByRole("button", { name: "复制关联 ID" })).toBeDisabled();
});

for (const theme of ["dark", "light"] as const) {
  test(`P01 five pages ${theme} responsive keyboard and axe`, async ({ page }, info) => {
    await page.emulateMedia({ colorScheme: theme }); const scans = [];
    for (const path of ["/login", "/mfa", "/access-request", "/unauthorized", "/offline"]) {
      await page.setViewportSize({ width: 1440, height: 900 }); await page.goto(path); await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const result = await new AxeBuilder({ page }).analyze(); scans.push({ path, violations: result.violations, incomplete: result.incomplete }); expect(result.violations).toEqual([]);
      await page.setViewportSize({ width: 390, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
      await page.evaluate(() => { document.documentElement.style.zoom = "2"; }); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
      await page.keyboard.press("Tab"); expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe("BODY");
      const screenshot = info.outputPath(`${path.slice(1)}-${theme}-390-csszoom2.png`); await page.screenshot({ path: screenshot, fullPage: true }); await info.attach(path.slice(1), { path: screenshot, contentType: "image/png" });
      await page.evaluate(() => { document.documentElement.style.zoom = "1"; });
    }
    const file = info.outputPath(`axe-${theme}.json`); await writeFile(file, JSON.stringify(scans, null, 2)); await info.attach("axe", { path: file, contentType: "application/json" });
  });
  test(`P01 visual baselines ${theme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    for (const path of ["/login", "/mfa", "/access-request", "/unauthorized", "/offline"]) { await page.goto(path); await expect(page.getByRole("heading", { level: 1 })).toBeVisible(); await expect(page).toHaveScreenshot(`p01-${path.slice(1)}-${theme}.png`, { fullPage: true, maxDiffPixelRatio: 0.005 }); }
  });
}
