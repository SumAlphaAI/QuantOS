import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

/**
 * PRE-06 基线 E2E：/command（关联 ACC-GS-S1、ACC-P02-S1）。
 * 后续每个 UI-Pxx 任务在同一目录追加页面 spec（七态 + 键盘 + 视觉）。
 * 视觉基线按平台入库（<name>-chromium-<platform>.png）；本平台基线缺失时跳过并告警，
 * 由 QA 在对应平台 runner 生成并提交基线（见 docs/PRE-06-summary.md 遗留项 3）。
 * 视觉门禁有效性由 scripts/pre06-sabotage-check.mjs 独立保证。
 */
const baselinePath = (name: string, project: string) =>
  join(process.cwd(), "tests/e2e/command.spec.ts-snapshots", `${name}-${project}-${process.platform}.png`);

test.describe("Command Center（/command）", () => {
  test("静态首屏只渲染守卫状态，不提前泄露 Command 投影", async ({ request }) => {
    const response = await request.get("/command");
    const html = await response.text();
    expect(html).toContain('data-guard-state="checking"');
    expect(html).not.toContain('data-smoke="route-/command"');
    expect(html).not.toContain("Research run-1842");
  });

  test("路由可打开且渲染共享壳标记", async ({ page }) => {
    await page.goto("/command");
    const guard = page.locator('[data-guard-state="allowed"]');
    await expect(guard).toHaveAttribute("data-guard-steps", "session,tenant_workspace,rbac_capability,resource,mode,data_freshness");
    await expect(page.locator('[data-smoke="route-/command"]')).toBeVisible();
    await expect(page.getByRole("heading", { name: "Command Center" })).toBeVisible();
    await expect(page.locator('[data-contract-mode="mocked"]')).toBeVisible();
    await expect(page.getByText(/C02 Runtime Guard Mocked/)).toBeVisible();
  });

  test("复用 UI-103 的 freshness、risk 与 connection 领域组件", async ({ page }) => {
    await page.goto("/command");
    await expect(page.locator(".freshness-status").getByRole("status", { name: "live" })).toBeVisible();
    await expect(page.locator(".risk-status").getByRole("status", { name: "allow" })).toBeVisible();
    const connection = page.locator(".terminal-statusbar .q-alert");
    await expect(connection).toContainText("Connected");
    await expect(connection).toHaveAttribute("aria-live", "polite");
  });

  test("axe 无严重/高等级可访问性问题（执行计划 7.1）", async ({ page }) => {
    await page.goto("/command");
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""));
    expect(blocking).toEqual([]);
  });

  test("优先级筛选与侧栏折叠可交互", async ({ page }) => {
    await page.goto("/command");
    await page.getByRole("button", { name: "信息 0" }).click();
    await expect(page.getByText("当前没有需要你处理的事项。")).toBeVisible();
    await page.getByRole("button", { name: "折叠侧栏" }).click();
    await expect(page.locator("[data-ui101-shell]")).toHaveClass(/sidebar-collapsed/);
    await expect(page.getByRole("button", { name: "展开侧栏" })).toBeVisible();
  });

  test("390px 小屏保持只读监控并隐藏高风险入口", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/command");
    await expect(page.getByRole("heading", { name: "Command Center" })).toBeVisible();
    await expect(page.locator(".high-risk-action").first()).toBeHidden();
    await expect(page.getByLabel("连接状态")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    expect(await page.locator(".activity-table").evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
  });

  test("视觉基线：1440 深主题", async ({ page }, testInfo) => {
    const snapshot = "command-1440-dark";
    testInfo.skip(
      !existsSync(baselinePath(snapshot, testInfo.project.name)),
      `本项目/平台（${testInfo.project.name}/${process.platform}）视觉基线未入库，由 QA 在对应平台 runner 生成并提交后启用`,
    );
    await page.goto("/command");
    await expect(page).toHaveScreenshot(`${snapshot}.png`, { maxDiffPixelRatio: 0.005 });
  });
});
