import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

// 视觉基线按平台入库（<name>-<project>-<platform>.png）；本平台基线缺失时跳过并告警，
// 由 QA 在对应平台 runner 生成并提交基线（同 command.spec.ts，见 docs/PRE-06-summary.md 遗留项 3）
const baselinePath = (name: string, project: string) =>
  join(process.cwd(), "tests/e2e/ui104-settings.spec.ts-snapshots", `${name}-${project}-${process.platform}.png`);

test.describe("UI-104 profile, security, notifications and browser settings", () => {
  test("P15/P17 routes render the shared settings workspace", async ({ page }) => {
    const routes = [
      ["/settings/profile", "Profile & Settings"],
      ["/settings/notifications", "Notification settings"],
      ["/settings/security", "Security & MFA"],
      ["/settings/browser", "Browser settings"],
    ] as const;
    for (const [route, heading] of routes) {
      await page.goto(route);
      await expect(page.locator(`[data-smoke="route-${route}"]`)).toBeVisible();
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
      await expect(page.getByText(/C17 Contract Mocked/)).toBeVisible();
    }
  });

  test("browser notification denial degrades without blocking in-app alerts", async ({ page }) => {
    await page.goto("/settings/notifications");
    await expect(page.getByRole("status").filter({ hasText: "已降级为站内通知" })).toBeVisible();
    const browserToggles = page.getByRole("cell").filter({ has: page.getByRole("checkbox", { disabled: true }) });
    await expect(browserToggles.first()).toBeVisible();
  });

  test("scrollable browser download history is keyboard focusable", async ({ page }) => {
    await page.goto("/settings/browser");
    const downloads = page.getByRole("region", { name: "最近下载记录" });
    await downloads.focus();
    await expect(downloads).toBeFocused();
  });

  test("session revocation requires phrase and six-digit MFA, with cancel focused first", async ({ page }) => {
    await page.goto("/settings/security");
    await page.getByRole("button", { name: "撤销会话" }).first().click();
    await expect(page.getByRole("dialog", { name: "撤销活动会话" })).toBeVisible();
    await expect(page.getByRole("button", { name: "取消" })).toBeFocused();
    const confirm = page.getByRole("button", { name: "确认撤销会话" });
    await expect(confirm).toBeDisabled();
    await page.getByLabel(/输入“REVOKE sess-12de-remote”/).fill("REVOKE sess-12de-remote");
    await page.getByLabel("MFA 验证码").fill("123456");
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(page.getByText(/会话撤销已受理/)).toBeVisible();
  });

  test("390px and 200% zoom hide high-risk settings actions without page overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/settings/security");
    await expect(page.getByRole("heading", { name: "Security & MFA" })).toBeVisible();
    await expect(page.locator(".settings-high-risk").first()).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
    await expect(page.locator(".settings-high-risk").first()).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });

  test("offline mode freezes profile and notification writes", async ({ page, context }) => {
    await page.goto("/settings/profile");
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(page.getByRole("button", { name: "保存个人资料" })).toBeDisabled();
    await expect(page.getByText(/恢复连接后不会自动重放保存或撤销操作/)).toBeVisible();
    await context.setOffline(false);
  });

  test("profile, security and browser pages have no serious or critical axe violations", async ({ page }) => {
    for (const route of ["/settings/profile", "/settings/security", "/settings/browser"]) {
      await page.goto(route);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations.filter((entry) => ["critical", "serious"].includes(entry.impact ?? "")), route).toEqual([]);
    }
  });

  test("P15 security and P17 browser 1440 dark visual baselines", async ({ page }, testInfo) => {
    const snapshots = ["ui104-security-1440-dark", "ui104-browser-1440-dark"];
    const missing = snapshots.filter((name) => !existsSync(baselinePath(name, testInfo.project.name)));
    testInfo.skip(
      missing.length > 0,
      `本项目/平台（${testInfo.project.name}/${process.platform}）视觉基线未入库（${missing.join("、")}），由 QA 在对应平台 runner 生成并提交后启用`,
    );
    await page.goto("/settings/security");
    await expect(page).toHaveScreenshot(`${snapshots[0]}.png`, { fullPage: true, maxDiffPixelRatio: 0.005 });
    await page.goto("/settings/browser");
    await expect(page).toHaveScreenshot(`${snapshots[1]}.png`, { fullPage: true, maxDiffPixelRatio: 0.005 });
  });
});
