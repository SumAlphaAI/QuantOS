import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * WEB-101 官网验收：页面渲染、无障碍、移动端无横向溢出、表单防滥用与合规文案。
 * 服务目标为 apps/website/out 静态产物（见 playwright.website.config.ts）。
 */

const PAGES = ["", "product", "architecture-security", "use-cases", "docs", "access-request", "login"];

async function fillAccessRequest(page: import("@playwright/test").Page) {
  const form = page.locator('[data-smoke="website-access-form"]');
  await form.locator('input[name="teamName"]').fill("SumAlpha Research");
  await form.locator('input[name="contactEmail"]').fill("research@example.com");
  await form.locator('select[name="market"]').selectOption("futures");
  await form.locator('select[name="expectedMode"]').selectOption("shadow");
  await form.locator('textarea[name="purpose"]').fill("用于验证可重放研究、策略治理与 Shadow 模式协作流程。");
  await form.locator('input[type="checkbox"]').check();
  return form;
}

test.describe("WEB-101 website", () => {
  test("首页呈现品牌主张、信任承诺与证据链", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('[data-smoke="website-home"]')).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("AI-native operating system");
    await expect(page.getByText("Agent 不直接下单")).toBeVisible();
    await expect(page.getByText("默认 Paper / Shadow")).toBeVisible();
    await expect(page.getByRole("img", { name: /受控链路示意图/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "申请访问" }).first()).toBeVisible();
  });

  test("全部首期页面可访问且导航互链", async ({ page }) => {
    for (const path of PAGES) {
      const response = await page.goto(`/${path}`);
      expect(response?.status(), `GET /${path}`).toBe(200);
      await expect(page.locator("main#main-content")).toBeVisible();
    }
    await page.goto("/product");
    await page.getByRole("link", { name: "架构与安全" }).first().click();
    await expect(page).toHaveURL(/architecture-security/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("边界先行");
  });

  for (const path of PAGES) {
    test(`/${path} 无 serious/critical 无障碍违规`, async ({ page }) => {
      await page.goto(`/${path}`);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(blocking, JSON.stringify(blocking.map((v) => v.id))).toEqual([]);
    });
  }

  test("390px 移动端无页面级横向溢出", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of PAGES) {
      await page.goto(`/${path}`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `/${path} horizontal overflow`).toBeLessThanOrEqual(0);
    }
  });

  test("文档中心无结果时可清除条件并联系支持", async ({ page }) => {
    await page.goto("/docs");
    await page.getByRole("searchbox", { name: "搜索文档" }).fill("不存在的文档关键词");
    await expect(page.getByRole("heading", { name: "没有匹配的文档" })).toBeVisible();
    await expect(page.getByRole("status").getByRole("link", { name: "联系支持" })).toHaveAttribute("href", "mailto:support@sumalpha.ai");
    await page.getByRole("button", { name: "清除搜索条件" }).click();
    await expect(page.locator(".docs-grid > li")).toHaveCount(6);
    const architectureDetails = page.locator("#architecture details");
    await architectureDetails.getByText("阅读当前版本", { exact: true }).click();
    await expect(architectureDetails).toHaveAttribute("open", "");
    await expect(architectureDetails.getByText("浏览器只访问 Gateway/BFF", { exact: false })).toBeVisible();
  });

  test("访问申请表单：校验、honeypot 与受理语义", async ({ page }) => {
    await page.goto("/access-request");
    const form = page.locator('[data-smoke="website-access-form"]');
    await expect(form).toBeVisible();
    // 未同意隐私条款时浏览器原生校验阻断提交
    await form.getByRole("button", { name: "提交申请" }).click();
    await expect(form).toBeVisible();
    // honeypot 填充后静默拒绝（不发起网络请求）
    let requested = false;
    page.on("request", (req) => {
      if (req.url().includes("/v1/access-requests")) requested = true;
    });
    await form.locator('input[name="website"]').fill("spam-bot");
    await form.locator('input[name="teamName"]').fill("Spam Team");
    await form.locator('input[name="contactEmail"]').fill("spam@example.com");
    await form.locator('textarea[name="purpose"]').fill("这是一个用于验证蜜罐行为的自动化提交内容。");
    await form.locator('input[type="checkbox"]').check();
    await form.getByRole("button", { name: "提交申请" }).click();
    await page.waitForTimeout(300);
    expect(requested).toBe(false);
    await expect(page.getByText("申请已受理")).not.toBeVisible();
  });

  test("访问申请 202 仅显示受理态并发送冻结契约字段", async ({ page }) => {
    let payload: Record<string, unknown> | undefined;
    await page.route("**/v1/access-requests", async (route) => {
      payload = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({
          jobId: "11111111-2222-4333-8444-555555555555",
          status: "accepted",
          correlationId: "66666666-7777-4888-8999-000000000000",
        }),
      });
    });
    await page.goto("/access-request");
    const form = await fillAccessRequest(page);
    await form.getByRole("button", { name: "提交申请" }).click();
    await expect(page.getByRole("heading", { name: "申请已受理" })).toBeVisible();
    await expect(page.getByText("不代表访问权限已经开通")).toBeVisible();
    expect(payload).toMatchObject({
      teamName: "SumAlpha Research",
      markets: ["futures"],
      expectedMode: "shadow",
      privacyNoticeVersion: "2026-08-15",
    });
  });

  test("访问申请 429 显示等待与参考号且保留输入", async ({ page }) => {
    await page.route("**/v1/access-requests", (route) => route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({
        code: "RATE_LIMITED",
        message: "rate limited",
        retryAfter: 60,
        correlationId: "66666666-7777-4888-8999-000000000000",
      }),
    }));
    await page.goto("/access-request");
    const form = await fillAccessRequest(page);
    await form.getByRole("button", { name: "提交申请" }).click();
    await expect(form.locator(".form-error")).toContainText("建议等待 60 秒");
    await expect(form.locator(".form-error")).toContainText("66666666-7777-4888-8999-000000000000");
    await expect(form.locator('input[name="teamName"]')).toHaveValue("SumAlpha Research");
  });

  test("离线时禁止提交并保留已填内容", async ({ page, context }) => {
    await page.goto("/access-request");
    const form = await fillAccessRequest(page);
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(form.getByRole("button", { name: "离线，无法提交" })).toBeDisabled();
    await expect(form.locator(".form-error")).toContainText("网络已断开");
    await expect(form.locator('textarea[name="purpose"]')).toHaveValue(/用于验证可重放研究/);
    await context.setOffline(false);
  });

  test("SEO 输出覆盖 canonical、robots 与七页 sitemap", async ({ page, request }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("SumAlpha QuantOS — AI 原生量化研究与交易操作系统");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://sumalpha.ai");
    const robots = await request.get("/robots.txt");
    expect(await robots.text()).toContain("Sitemap: https://sumalpha.ai/sitemap.xml");
    const sitemap = await request.get("/sitemap.xml");
    const xml = await sitemap.text();
    for (const url of [
      "https://sumalpha.ai",
      "https://sumalpha.ai/product",
      "https://sumalpha.ai/architecture-security",
      "https://sumalpha.ai/use-cases",
      "https://sumalpha.ai/docs",
      "https://sumalpha.ai/access-request",
      "https://sumalpha.ai/login",
    ]) {
      expect(xml).toContain(`<loc>${url}</loc>`);
    }
  });

  test("官网不包含收益承诺类禁用词", async ({ page }) => {
    const banned = [
      "保证收益", "稳赚", "保本", "年化收益", "躺赚", "翻倍", "财富自由",
      "一键跟单", "智能跟单", "跟单获利", "加入喊单", "收益排行榜", "guaranteed return",
    ];
    for (const path of PAGES) {
      await page.goto(`/${path}`);
      const text = (await page.locator("main").innerText()).toLowerCase();
      for (const phrase of banned) {
        expect(text.includes(phrase.toLowerCase()), `/${path} contains "${phrase}"`).toBe(false);
      }
    }
  });

  test("登录页指向 Terminal 且不内嵌认证表单", async ({ page }) => {
    await page.goto("/login");
    const entry = page.getByRole("link", { name: "前往 Terminal 登录" });
    await expect(entry).toBeVisible();
    await expect(entry).toHaveAttribute("href", /\/login$/);
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });
});
