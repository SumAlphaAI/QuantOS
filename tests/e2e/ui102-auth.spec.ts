import { expect, test } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

const BFF = "http://localhost:4010";
const corsHeaders = {
  "access-control-allow-origin": "http://localhost:3190",
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

test.describe("UI-102 identity, access and recovery", () => {
  test("P01 登录页仅展示安全、审计、Paper/Shadow 三项事实且通过 axe", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "进入 QuantOS Terminal" })).toBeVisible();
    const facts = page.getByLabel("安全、审计与运行模式说明");
    await expect(facts.getByRole("heading", { name: "安全边界" })).toBeVisible();
    await expect(facts.getByRole("heading", { name: "全链路审计" })).toBeVisible();
    await expect(facts.getByRole("heading", { name: "Paper / Shadow" })).toBeVisible();
    await expect(facts.locator("article")).toHaveCount(3);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter((entry) => ["critical", "serious"].includes(entry.impact ?? ""))).toEqual([]);
  });

  test("MFA 成功后只返回消毒后的安全路由", async ({ page }) => {
    await page.route(`${BFF}/v1/auth/mfa/challenges`, async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }
      expect(JSON.parse(route.request().postData() ?? "{}")).toEqual({ purpose: "login", code: "123456" });
      await route.fulfill({ status: 200, contentType: "application/json", headers: corsHeaders, body: JSON.stringify({ challengeRef: "11111111-2222-4333-8444-555555555555", status: "verified" }) });
    });
    await page.goto("/mfa?return_to=/command");
    for (const [index, digit] of [..."123456"].entries()) await page.getByLabel(`验证码第 ${index + 1} 位`).fill(digit);
    await page.getByRole("button", { name: "验证并继续" }).click();
    await page.waitForURL((url) => url.pathname === "/command");
    expect(page.url()).not.toContain("code=");
  });

  test("MFA 429 文案不泄露账户存在性并展示等待时间", async ({ page }) => {
    await page.route(`${BFF}/v1/auth/mfa/challenges`, async (route) => {
      if (route.request().method() === "OPTIONS") await route.fulfill({ status: 204, headers: corsHeaders });
      else await route.fulfill({ status: 429, contentType: "application/json", headers: corsHeaders, body: JSON.stringify({ code: "RATE_LIMITED", message: "internal account exists", correlationId: "11111111-2222-4333-8444-555555555555", retryAfter: 60 }) });
    });
    await page.goto("/mfa");
    for (const [index, digit] of [..."000000"].entries()) await page.getByLabel(`验证码第 ${index + 1} 位`).fill(digit);
    await page.getByRole("button", { name: "验证并继续" }).click();
    const alert = page.locator(".auth-error");
    await expect(alert).toContainText("60 秒");
    await expect(alert).not.toContainText("account");
  });

  test("访问申请 202 只显示已受理而非权限已开通", async ({ page }) => {
    await page.route(`${BFF}/v1/access-requests`, async (route) => {
      if (route.request().method() === "OPTIONS") await route.fulfill({ status: 204, headers: corsHeaders });
      else await route.fulfill({ status: 202, contentType: "application/json", headers: corsHeaders, body: JSON.stringify({ jobId: "11111111-2222-4333-8444-555555555555", status: "accepted", correlationId: "66666666-7777-4888-8999-000000000000" }) });
    });
    await page.goto("/access-request");
    await page.getByLabel("组织 / 公司").fill("SumAlpha Research");
    await page.getByLabel("工作邮箱").fill("research@example.com");
    await page.getByLabel("使用场景 / 用途说明").fill("用于受控的 Paper 模式量化研究与策略验证流程。");
    await page.getByRole("button", { name: "提交申请" }).click();
    await expect(page.getByRole("heading", { name: "申请已受理" })).toBeVisible();
    await expect(page.getByText(/不代表访问权限已经开通/)).toBeVisible();
  });

  test("403 页面与 404 页面使用相同的不可探测资源文案", async ({ page }) => {
    await page.goto("/unauthorized?correlation_id=11111111-2222-4333-8444-555555555555");
    const concealedCopy = "未找到或无权访问此资源";
    await expect(page.getByRole("heading", { name: concealedCopy })).toBeVisible();
    await page.goto("/resource-that-does-not-exist");
    await expect(page.getByRole("heading", { name: concealedCopy })).toBeVisible();
    await expect(page.getByText(/不会说明该资源是否存在/)).toBeVisible();
  });

  test("maintenance 明确禁写，offline 强制只读且不自动提交旧意图", async ({ page, context }) => {
    await page.goto("/maintenance");
    await expect(page.getByRole("heading", { name: "系统维护中" })).toBeVisible();
    await expect(page.getByText(/不会在维护期间接受创建、审批或交易操作/)).toBeVisible();
    await page.goto("/offline");
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(page.getByRole("heading", { name: "连接已断开" })).toBeVisible();
    await expect(page.getByText(/恢复后不会自动提交离线期间的旧意图/)).toBeVisible();
    await context.setOffline(false);
  });

  test("390px 与 200% 缩放下认证操作仍可达", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "使用组织账户继续" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
    await expect(page.getByRole("button", { name: "使用组织账户继续" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });

  test("P01 1440 深色视觉基线", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveScreenshot("ui102-login-1440-dark.png", { maxDiffPixelRatio: 0.005 });
  });
});
