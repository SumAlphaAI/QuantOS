import { expect, test, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { writeFile } from "node:fs/promises";
import { P02_NOW, p02Context, p02Summary, p02Time } from "./fixtures/ui-p02";
const cors = { "access-control-allow-origin": "http://localhost:3190", "access-control-allow-credentials": "true" };
async function boundary(page: Page, mutate: (path: string, count: number) => { status?: number; data?: unknown } = () => ({})) {
  const calls: string[] = []; await page.clock.install({ time: new Date(P02_NOW) }); await page.clock.pauseAt(new Date(Date.parse(P02_NOW) + 1000));
  await page.route("http://localhost:4010/v1/**", async route => {
    expect(route.request().method()).toBe("GET"); const path = new URL(route.request().url()).pathname; calls.push(path);
    const row = mutate(path, calls.filter(p => p === path).length);
    await route.fulfill({ status: row.status ?? 200, headers: cors, contentType: "application/json", body: JSON.stringify(row.data ?? (path === "/v1/command/summary" ? p02Summary() : p02Context())) });
  });
  return calls;
}
async function loaded(page: Page) { await page.goto("/command"); await expect(page.locator('[data-ui-p02][data-contract-mode="integrated"]')).toBeVisible(); }
const metric = (page: Page, name: string) => page.locator(".kpi-card").filter({ has: page.getByRole("heading", { name, exact: true }) });

test("P02 guarded real-mode transport renders server counts and truthful source metadata", async ({ page }) => {
  const calls = await boundary(page); await loaded(page);
  expect(calls).toEqual(["/v1/session", "/v1/context", "/v1/command/summary"]);
  await expect(metric(page, "开放风险").locator("strong")).toHaveText("7"); await expect(metric(page, "运行任务").locator("strong")).toHaveText("4"); await expect(metric(page, "订单状态")).toContainText("13 Filled · 1 Rejected");
  await expect(metric(page, "数据新鲜度")).toContainText("5.0s"); await expect(page.locator(".p02-health-state")).toHaveText("degraded");
  await expect(page.locator(".health-row")).toHaveCount(4); expect(await page.locator(".health-row code").allTextContents()).toEqual(["10:42:03", "10:42:04", "10:42:05", "10:42:06"]);
  await expect(page.getByRole("button", { name: "通知", exact: true })).toBeDisabled(); await expect(page.getByLabel("全局搜索")).toBeDisabled(); await expect(page.locator(".terminal-statusbar")).toContainText("未订阅实时流");
  await expect(page.locator(".activity-head")).toContainText("对象 ID"); await expect(page.locator(".activity-table")).not.toContainText("Jane Smith");
});
test("capabilities crop cards and private list rows instead of showing leaked values", async ({ page }) => {
  await boundary(page, path => path !== "/v1/command/summary" ? { data: { ...p02Context(), capabilities: ["ops.read"] } } : {}); await loaded(page);
  await expect(page.locator(".kpi-card")).toHaveCount(1); await expect(metric(page, "开放风险")).toContainText("unknown");
  await expect(page.locator(".priority-row")).toHaveCount(1); await expect(page.getByRole("heading", { name: "运行任务" })).toHaveCount(0); await expect(page.getByRole("link", { name: "Research", exact: true })).toHaveCount(0);
  await expect(page.locator('a[href^="/research/runs/"]')).toHaveCount(0); await expect(page.locator('a[href^="/orders/"]')).toHaveCount(0); await expect(page.locator(".nav-badge")).toHaveCount(0);
});
test("forbidden research data stays concealed even if rows arrive in a partial response", async ({ page }) => {
  await boundary(page, path => { if (path !== "/v1/command/summary") return {}; const s = p02Summary(); s.partial = true; s.sources[0].status = "forbidden"; s.sources[0].asOf = null; s.sources[0].sourceHash = null; s.runningRuns = s.failedRuns = null; return { data: s }; }); await loaded(page);
  await expect(page.getByRole("heading", { name: "运行任务" })).toHaveCount(0); await expect(page.locator('a[href^="/research/runs/"]')).toHaveCount(0); await expect(page.locator(".health-row")).toHaveCount(3); await expect(page.locator(".p02-data-notice")).toContainText("部分来源");
});
test("zero, unknown and stale metrics remain distinct with no synthetic order or run fallback", async ({ page }) => {
  await boundary(page, path => { if (path !== "/v1/command/summary") return {}; const s = p02Summary(); s.partial = true; s.dataFreshness = "stale"; s.riskPosture = "unknown"; s.sources[1].status = "stale"; s.orderSummary = null; s.pendingApprovals = null; s.runningRuns = s.failedRuns = 0; s.openRiskAlerts = 0; return { data: s }; }); await loaded(page);
  await expect(metric(page, "开放风险").locator("strong")).toHaveText("0"); await expect(metric(page, "运行任务").locator("strong")).toHaveText("0"); await expect(metric(page, "订单状态").locator("strong")).toHaveText("—"); await expect(page.locator(".freshness-status")).toContainText("Stale");
});
test("local severity filters and bounded expansions work by keyboard with exact safe resource destinations", async ({ page }) => {
  await boundary(page); await loaded(page); await expect(page.locator(".priority-row")).toHaveCount(3);
  await page.getByRole("button", { name: "查看全部待办（4）" }).click(); await expect(page.locator(".priority-row")).toHaveCount(4);
  const info = page.getByRole("button", { name: "信息 1", exact: true }); await info.focus(); await page.keyboard.press("Enter"); await expect(info).toHaveAttribute("aria-pressed", "true"); await expect(page.locator(".priority-row")).toHaveCount(1);
  await expect(page.locator(".priority-row a")).toHaveAttribute("href", p02Summary().priority[3].objectRef);
  await expect(page.locator(".activity-row[role=row]")).toHaveCount(6); await page.getByRole("button", { name: "查看全部活动（7）" }).click(); await expect(page.locator(".activity-row[role=row]")).toHaveCount(8);
});
test("empty truncated snapshots disclose incompleteness and disable empty expansion controls", async ({ page }) => {
  await boundary(page, path => path === "/v1/command/summary" ? { data: { ...p02Summary(), priority: [], recentActivity: [], bounded: { ...p02Summary().bounded, truncated: true } } } : {}); await loaded(page);
  await expect(page.locator(".p02-data-notice")).toContainText("结果已截断"); await expect(page.getByRole("button", { name: "查看全部待办（0）" })).toBeDisabled(); await expect(page.locator(".p02-empty-activity")).toBeVisible(); await expect(page.locator(".p02-bounds")).toContainText("不代表完整历史为空");
});
test("refresh drops the old snapshot, rechecks scope and recovers without any write", async ({ page }) => {
  const calls = await boundary(page, (path, count) => path === "/v1/command/summary" && count > 1 ? { data: { ...p02Summary(), runningRuns: 9 } } : {}); await loaded(page);
  await page.getByRole("button", { name: "刷新", exact: true }).click(); await expect(metric(page, "运行任务").locator("strong")).toHaveText("9"); expect(calls).toEqual(["/v1/session", "/v1/context", "/v1/command/summary", "/v1/session", "/v1/context", "/v1/command/summary"]);
});
test("offline freezes resource links, reconnect refuses revoked capability and never replays old intent", async ({ page, context }) => {
  let revoked = false; const calls = await boundary(page, path => revoked && path === "/v1/context" ? { data: { ...p02Context(), capabilities: [] } } : {}); await loaded(page);
  await context.setOffline(true); await page.evaluate(() => dispatchEvent(new Event("offline"))); await expect(page.locator("main [role=alert]")).toContainText("只读缓存"); await expect(page.getByRole("button", { name: "刷新", exact: true })).toBeDisabled(); await expect(page.locator(".priority-row a")).toHaveCount(0);
  revoked = true; await context.setOffline(false); await page.evaluate(() => dispatchEvent(new Event("online"))); await expect(page).toHaveURL(/\/unauthorized$/); expect(calls.filter(p => p === "/v1/command/summary")).toHaveLength(1);
});
for (const kind of ["resource", "order-mode", "future-source", "partial", "expired", "overlong-lease"]) test(`malformed ${kind} summary refuses without fixture fallback`, async ({ page }) => {
  await boundary(page, path => { if (path !== "/v1/command/summary") return {}; const s = p02Summary(); if (kind === "resource") s.priority[0].objectRef = "/orders/" + s.priority[0].id; if (kind === "order-mode") s.orderSummary!.mode = "shadow"; if (kind === "future-source") s.sources[0].asOf = p02Time(10_000); if (kind === "partial") s.partial = true; if (kind === "expired") s.expiresAt = p02Time(-1); if (kind === "overlong-lease") s.expiresAt = p02Time(31_000); return { data: s }; });
  await page.goto("/command"); await expect(page).toHaveURL(/\/offline$/); await expect(page.locator("[data-ui-p02]")).toHaveCount(0);
});
test("earlier session deadline removes the shell even when context and snapshot remain valid", async ({ page }) => {
  const calls = await boundary(page, path => path === "/v1/session" ? { data: { ...p02Context(), expiresAt: p02Time(2000) } } : {}); await loaded(page); await page.clock.fastForward(2100); await expect(page).toHaveURL(/\/login$/); expect(calls.filter(p => p === "/v1/command/summary")).toHaveLength(1);
});
test("layout preferences persist booleans only and do not alter server authority", async ({ page }) => {
  const calls = await boundary(page); await loaded(page); await page.getByRole("button", { name: "布局设置" }).click(); await page.getByRole("checkbox", { name: "紧凑布局" }).check(); await page.getByRole("button", { name: "折叠侧栏" }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("quantos.command.layout.v1")!))).toEqual({ collapsed: true, compact: true }); await page.reload(); await expect(page.locator("[data-ui-p02]")).toHaveClass(/command-compact/); await expect(page.getByRole("button", { name: "展开侧栏" })).toBeVisible(); expect(calls.filter(p => p === "/v1/command/summary")).toHaveLength(2);
});
test("storage refusal preserves interactive layout and help remains reachable", async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw Error("denied"); }; }); await boundary(page); await loaded(page);
  await page.getByRole("button", { name: "布局设置" }).click(); await page.getByRole("checkbox", { name: "紧凑布局" }).check(); await expect(page.locator("#command-layout [role=status]")).toContainText("无法保存布局"); await page.getByRole("link", { name: "帮助", exact: true }).click(); await page.locator("#command-help summary").click(); await expect(page.locator("#command-help p")).toBeVisible();
});
for (const theme of ["dark", "light"] as const) {
  test(`P02 ${theme} responsive layouts, keyboard and axe`, async ({ page }, info) => {
    await page.emulateMedia({ colorScheme: theme }); await boundary(page); await loaded(page); await page.clock.resume(); const scans = [];
    for (const width of [1440, 1024, 390]) {
      await page.setViewportSize({ width, height: 900 }); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      const result = await new AxeBuilder({ page }).analyze(); scans.push({ width, theme, violations: result.violations, incomplete: result.incomplete }); expect(result.violations).toEqual([]);
      if (width === 390) { await expect(page.locator(".high-risk-action").first()).toBeHidden(); await page.evaluate(() => { document.documentElement.style.zoom = "2"; }); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width); }
      const path = info.outputPath(`command-${theme}-${width}.png`); await page.screenshot({ path, fullPage: true }); await info.attach(`command-${width}`, { path, contentType: "image/png" });
      await page.evaluate(() => { document.documentElement.style.zoom = "1"; });
    }
    const file = info.outputPath(`axe-${theme}.json`); await writeFile(file, JSON.stringify(scans, null, 2)); await info.attach("axe", { path: file, contentType: "application/json" });
  });
  test(`P02 visual baseline ${theme}`, async ({ page }) => { await page.emulateMedia({ colorScheme: theme }); await boundary(page); await loaded(page); await expect(page).toHaveScreenshot(`p02-command-${theme}.png`, { maxDiffPixelRatio: 0.005 }); });
}
