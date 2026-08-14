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
const baselinePath = (name: string) =>
  join(process.cwd(), "tests/e2e/command.spec.ts-snapshots", `${name}-chromium-${process.platform}.png`);

test.describe("Command Center（/command）", () => {
  test("路由可打开且渲染共享壳标记", async ({ page }) => {
    await page.goto("/command");
    await expect(page.locator('[data-smoke="route-/command"]')).toBeVisible();
    await expect(page.getByRole("heading", { name: "Command Center" })).toBeVisible();
  });

  test("axe 无严重/高等级可访问性问题（执行计划 7.1）", async ({ page }) => {
    await page.goto("/command");
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter((v) => ["critical", "serious"].includes(v.impact ?? ""));
    expect(blocking).toEqual([]);
  });

  test("视觉基线：1440 深主题", async ({ page }, testInfo) => {
    const snapshot = "command-1440-dark";
    testInfo.skip(
      !existsSync(baselinePath(snapshot)),
      `本平台（${process.platform}）视觉基线未入库，由 QA 在该平台 runner 生成并提交后启用`,
    );
    await page.goto("/command");
    await expect(page).toHaveScreenshot(`${snapshot}.png`, { maxDiffPixelRatio: 0.005 });
  });
});
