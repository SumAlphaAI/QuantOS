import { expect, test, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { writeFile } from "node:fs/promises";
import { boundary, writes, now, id, context } from "./fixtures/ui-p15";
test.beforeEach(async ({ page }) => { await page.clock.install({ time: now }); });
async function securityDialog(page: Page, button: string, phrase: string) {
  await page.getByRole("button", { name: button, exact: true }).and(page.locator("button:not(:disabled)")).first().click();
  await expect(page.getByRole("button", { name: "取消", exact: true })).toBeFocused();
  await page.getByLabel(new RegExp(`输入“${phrase}”`)).fill(phrase);
  await page.getByLabel("MFA 验证码").fill("123456");
}
test("P15 profile and region save only whitelisted facts using actual version, then survive reload", async ({ page }) => {
  const t = await boundary(page); await page.goto("/settings/profile");
  await expect(page.getByRole("region", { name: "分区保存状态" })).toContainText("未保存更改：无"); await expect(page.getByRole("complementary", { name: "主导航" })).toBeVisible(); await expect(page.getByRole("complementary", { name: "主导航" }).locator(".nav-badge")).toHaveCount(0);
  await page.getByLabel("显示名称", { exact: true }).fill("P15 Saved Member"); await page.getByLabel("时间显示", { exact: true }).selectOption("local"); await page.getByLabel("时区", { exact: true }).selectOption("America/New_York");
  await page.getByRole("button", { name: "保存当前分区" }).click(); await expect(page.locator(".toast")).toContainText("个人资料已保存");
  expect(writes(t.requests)).toHaveLength(1); expect(writes(t.requests)[0].postDataJSON()).toMatchObject({ timeDisplay: "local", timezone: "America/New_York" }); expect(writes(t.requests)[0].headers()["if-match"]).toBe("profile-v14");
  await page.reload(); await expect(page.getByLabel("显示名称", { exact: true })).toHaveValue("P15 Saved Member"); await expect(page.getByLabel("时间显示", { exact: true })).toHaveValue("local");
});
test("P15 theme, contrast and density preview reset without storing business or identity state", async ({ page }) => {
  const t = await boundary(page); await page.goto("/settings/profile");
  await page.getByLabel("主题", { exact: true }).selectOption("light"); await expect(page.locator('.quantos-theme[data-quantos-theme="light"]').first()).toBeVisible();
  await page.getByRole("checkbox", { name: "高对比度", exact: true }).check(); await page.getByRole("checkbox", { name: "减少动画", exact: true }).check(); await page.getByLabel("密度", { exact: true }).selectOption("comfortable");
  await expect(page.locator('[data-ui-p15]')).toHaveClass(/p15-high-contrast/); await page.getByRole("button", { name: "重置未保存项" }).click(); await expect(page.getByLabel("主题", { exact: true })).toHaveValue("dark"); expect(writes(t.requests)).toHaveLength(0);
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
});
test("P15 empty invalid draft survives explicit refresh and never sends a mutation", async ({ page }) => {
  const t = await boundary(page); await page.goto("/settings/profile"); await page.getByLabel("显示名称", { exact: true }).fill(""); await page.getByRole("button", { name: "重新验证并保留草稿" }).click(); await expect(page.getByLabel("显示名称", { exact: true })).toHaveValue(""); await page.getByRole("button", { name: "保存个人资料" }).click(); await expect(page.locator(".toast")).toContainText("请求未完成"); expect(writes(t.requests)).toHaveLength(0);
});
test("P15 notifications support overnight quiet hours and no invented delivery schedule", async ({ page }) => {
  const t = await boundary(page); await page.goto("/settings/notifications"); await page.getByLabel("静默开始时间").fill("23:30"); await page.getByLabel("静默结束时间").fill("06:15"); await page.getByLabel("摘要频率", { exact: true }).selectOption("weekly"); await page.getByRole("button", { name: "保存通知偏好" }).click(); await expect(page.locator(".toast")).toContainText("通知偏好已保存"); expect(writes(t.requests)[0].postDataJSON()).toMatchObject({ quietHoursStart: "23:30", quietHoursEnd: "06:15", digestFrequency: "weekly" }); expect(writes(t.requests)[0].postDataJSON()).not.toHaveProperty("browserPermission");
});
test("P15 notification conflict rebases metadata only and needs another explicit save", async ({ page }) => {
  let first = true; const t = await boundary(page, r => r.method() === "PUT" && first ? (first = false, { status: 409, data: { code: "VERSION_CONFLICT", message: "private", currentVersion: "notification-current", correlationId: id } }) : undefined);
  await page.goto("/settings/notifications"); await page.getByLabel("静默开始时间").fill("21:30"); await page.getByRole("button", { name: "保存通知偏好" }).click(); t.data.notifications.objectVersion = "notification-current"; await page.getByRole("button", { name: "加载最新版本并保留草稿" }).click(); await expect(page.getByLabel("静默开始时间")).toHaveValue("21:30"); expect(writes(t.requests)).toHaveLength(1); await page.getByRole("button", { name: "保存通知偏好" }).click(); await expect(page.locator(".toast")).toContainText("通知偏好已保存"); expect(writes(t.requests)[1].headers()["if-match"]).toBe("notification-current");
});
test("P15 uncertain notification response retains draft and the identical idempotency key", async ({ page }) => {
  let first = true; const t = await boundary(page, r => r.method() === "PUT" && first ? (first = false, { abort: true }) : undefined); await page.goto("/settings/notifications"); await page.getByLabel("静默开始时间").fill("21:00"); await page.getByRole("button", { name: "保存通知偏好" }).click(); await expect(page.locator(".toast")).toContainText("请求结果未知"); await expect(page.getByLabel("静默开始时间")).toHaveValue("21:00"); await page.getByRole("button", { name: "保存通知偏好" }).click(); await expect(page.locator(".toast")).toContainText("通知偏好已保存"); const rows = writes(t.requests); expect(rows).toHaveLength(2); expect(rows[0].headers()["idempotency-key"]).toBe(rows[1].headers()["idempotency-key"]);
});
test("P15 readonly contexts cannot write or request native notification permission", async ({ page }) => {
  const t = await boundary(page, r => new URL(r.url()).pathname === "/v1/context" ? { data: { ...context(), capabilities: ["settings.read"] } } : undefined); await page.goto("/settings/notifications"); await expect(page.getByRole("button", { name: "保存通知偏好" })).toBeDisabled(); await expect(page.getByRole("button", { name: "请求浏览器通知权限" })).toBeDisabled(); expect(writes(t.requests)).toHaveLength(0);
});
test("P15 browser notification prompt requires a click and denial never prompts twice", async ({ page }) => {
  await page.addInitScript(() => { let count = 0; const api = { permission: "default", requestPermission: async () => { count++; api.permission = "denied"; return "denied"; } }; Object.defineProperty(window, "Notification", { value: api }); Object.defineProperty(window, "p15Prompts", { get: () => count }); });
  await boundary(page); await page.goto("/settings/notifications"); await expect(page.getByRole("heading", { name: "Notification settings" })).toBeVisible(); expect(await page.evaluate(() => (window as unknown as { p15Prompts: number }).p15Prompts)).toBe(0);
  await page.getByRole("button", { name: "请求浏览器通知权限" }).click(); await page.getByRole("button", { name: "请求浏览器通知权限" }).click(); expect(await page.evaluate(() => (window as unknown as { p15Prompts: number }).p15Prompts)).toBe(1); await expect(page.locator(".toast")).toContainText("不会重复弹窗");
});
test("P15 security reauthentication is real C01 verification without DELETE or persistent token", async ({ page }) => {
  const t = await boundary(page); await page.goto("/settings/security"); await securityDialog(page, "重新验证身份", "VERIFY SECURITY"); await page.getByRole("button", { name: "确认重新验证", exact: true }).click(); await expect(page.locator(".toast")).toContainText("近期身份验证已完成"); expect(writes(t.requests).map(r => new URL(r.url()).pathname)).toEqual(["/v1/auth/mfa/challenges", "/v1/auth/reauth"]); expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]); await expect(page.getByRole("dialog")).toHaveCount(0);
});
for (const [kind, button, target] of [["device", "撤销信任", "device-iphone"], ["factor", "撤销 MFA 因素", "factor-authenticator"]]) test(`P15 ${kind} revoke is pending after 202 and cannot be repeated`, async ({ page }) => {
  const t = await boundary(page); await page.goto("/settings/security"); await securityDialog(page, button, `REVOKE ${target}`); await page.getByRole("button", { name: kind === "device" ? "确认撤销信任" : "确认撤销 MFA 因素", exact: true }).click(); await expect(page.locator(".toast")).toContainText("已受理"); await expect(page.getByRole("button", { name: "撤销处理中", exact: true })).toBeDisabled(); expect(writes(t.requests).map(r => r.method())).toEqual(["POST", "POST", "DELETE"]);
});
test("P15 security cancellation and narrow resize cannot start a security request", async ({ page }) => {
  const t = await boundary(page); await page.goto("/settings/security"); await page.getByRole("button", { name: "重新验证身份", exact: true }).click(); await page.keyboard.press("Escape"); await expect(page.getByRole("dialog")).toHaveCount(0); await page.getByRole("button", { name: "重新验证身份", exact: true }).click(); await page.setViewportSize({ width: 390, height: 844 }); await expect(page.getByRole("dialog")).toHaveCount(0); await expect(page.getByRole("button", { name: "重新验证身份", exact: true })).toBeHidden(); expect(writes(t.requests)).toHaveLength(0);
});
test("P15 429 blocks writes and never leaks provider detail or automatically replays", async ({ page }) => {
  let first = true; const t = await boundary(page, r => r.method() === "PUT" && first ? (first = false, { status: 429, data: { code: "RATE_LIMITED", message: "private-provider-detail", retryAfter: 5, correlationId: id } }) : undefined);
  await page.goto("/settings/profile"); await page.getByLabel("显示名称", { exact: true }).fill("Rate draft"); await page.getByRole("button", { name: "保存个人资料" }).click(); await expect(page.getByRole("button", { name: "保存个人资料" })).toBeDisabled(); await expect(page.locator("body")).not.toContainText("private-provider-detail"); expect(writes(t.requests)).toHaveLength(1); await page.clock.fastForward(6000); await expect(page.getByRole("button", { name: "保存个人资料" })).toBeEnabled(); expect(writes(t.requests)).toHaveLength(1); await page.getByRole("button", { name: "保存个人资料" }).click(); await expect(page.locator(".toast")).toContainText("个人资料已保存");
});
test("P15 earlier session expiry clears private state and rereads session before new data", async ({ page }) => {
  let reads = 0; const t = await boundary(page, r => new URL(r.url()).pathname === "/v1/session" ? (++reads > 1 ? { status: 401, data: { code: "UNAUTHENTICATED", message: "refused", correlationId: id } } : { data: { ...context(), expiresAt: new Date(now.getTime() + 3000).toISOString() } }) : undefined); await page.goto("/settings/profile"); await expect(page.getByLabel("显示名称", { exact: true })).toBeVisible(); await page.clock.fastForward(3500); await expect(page).toHaveURL(/\/login\?return_to=/); expect(t.requests.filter(r => new URL(r.url()).pathname === "/v1/settings/profile")).toHaveLength(1);
});
test("P15 foreign member success cannot publish fake saved state", async ({ page }) => {
  const t = await boundary(page, r => r.method() === "PUT" ? { data: { ...t.data.profile, memberId: "foreign-member" } } : undefined); await page.goto("/settings/profile"); await page.getByRole("button", { name: "保存个人资料" }).click(); await expect(page).toHaveURL(/\/unauthorized$/); await expect(page.locator("body")).not.toContainText("个人资料已保存");
});
for (const theme of ["dark", "light"] as const) test(`P15 ${theme} all pages responsive keyboard and axe`, async ({ page }, info) => {
  await boundary(page, () => undefined, theme); const scans = [];
  for (const section of ["profile", "notifications", "security"]) for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 900 }); await page.goto(`/settings/${section}`); await expect(page.locator(`[data-ui-p15="${section}"]`)).toBeVisible(); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.getByRole("link", { name: "关闭设置" }).focus(); await expect(page.getByRole("link", { name: "关闭设置" })).toBeFocused();
    const a = await new AxeBuilder({ page }).analyze(); scans.push({ section, width, violations: a.violations, incomplete: a.incomplete }); expect(a.violations, `${theme}/${section}/${width}`).toEqual([]);
    const png = info.outputPath(`${section}-${theme}-${width}.png`); await page.screenshot({ path: png, fullPage: true }); await info.attach(`${section}-${width}`, { path: png, contentType: "image/png" });
    if (width === 390) { await page.evaluate(() => { document.documentElement.style.zoom = "2"; }); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width); if (section === "security") await expect(page.locator(".settings-high-risk").first()).toBeHidden(); }
  }
  const path = info.outputPath(`axe-${theme}.json`); await writeFile(path, JSON.stringify(scans, null, 2)); await info.attach(`axe-${theme}`, { path, contentType: "application/json" });
});
for (const theme of ["dark", "light"] as const) test(`P15 visual baseline ${theme}`, async ({ page }) => {
  await page.clock.pauseAt(now); await boundary(page, () => undefined, theme); for (const section of ["profile", "notifications", "security"]) { await page.goto(`/settings/${section}`); await expect(page.locator(`[data-ui-p15="${section}"]`)).toBeVisible(); await expect(page).toHaveScreenshot(`p15-${section}-${theme}.png`, { fullPage: true, maxDiffPixelRatio: .005 }); }
});
