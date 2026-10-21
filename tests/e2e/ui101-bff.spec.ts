import { expect, test, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { writeFile } from "node:fs/promises";
import { context, summary } from "./fixtures/ui101";
const cors = { "access-control-allow-origin": "http://localhost:3190", "access-control-allow-credentials": "true" };
async function boundary(page: Page, mutate: (path: string) => { status?: number; data?: unknown } = () => ({})) {
  const paths: string[] = [];
  await page.route("http://localhost:4010/v1/**", async route => {
    const path = new URL(route.request().url()).pathname; paths.push(path);
    const row = mutate(path);
    await route.fulfill({ status: row.status ?? 200, headers: cors, contentType: "application/json", body: JSON.stringify(row.data ?? (path === "/v1/command/summary" ? summary() : context())) });
  });
  return paths;
}
test("non-mock build loads generated session/context/summary and shows scoped facts without synthetic zeroes", async ({ page }, info) => {
  const paths = await boundary(page); await page.goto("/command");
  await expect(page.locator('[data-contract-mode="integrated"]')).toBeVisible();
  await expect(page.locator(".q-workspace-mode")).toHaveText("SHADOW");
  await expect(page.locator(".account-context")).toHaveAttribute("title", context().accountId);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
  await expect(page.locator(".freshness-status")).toContainText("Stale");
  await expect(page.locator(".risk-status")).toContainText("Unknown");
  await expect(page.getByRole("link", { name: "Command", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Admin", exact: true })).toHaveCount(0);
  expect(paths).toEqual(["/v1/session", "/v1/context", "/v1/command/summary"]);
  const risk = page.locator(".kpi-card").filter({ has: page.getByRole("heading", { name: "开放风险" }) }); await expect(risk.locator("strong")).toHaveText("—");
  await expect(page.getByRole("button", { name: /发起研究/ })).toBeDisabled();
  const axe = await new AxeBuilder({ page }).analyze(); const path = info.outputPath("axe.json"); await writeFile(path, JSON.stringify({ violations: axe.violations, incomplete: axe.incomplete }, null, 2)); await info.attach("axe.json", { path, contentType: "application/json" });
  expect(axe.violations.filter(v => ["serious", "critical"].includes(v.impact ?? ""))).toEqual([]);
  const capture = info.outputPath("command-bff-shadow.png"); await page.screenshot({ path: capture, fullPage: true }); await info.attach("command-bff-shadow.png", { path: capture, contentType: "image/png" });
});
for (const status of [401,403,404,503]) test(`summary ${status} clears projection and reaches safe recovery`, async ({ page }) => {
  const paths = await boundary(page, path => path === "/v1/command/summary" ? { status, data: { code: "REFUSED", message: "private-object-secret" } } : {});
  await page.goto("/command"); await expect(page).toHaveURL(new RegExp(status === 401 ? "/login$" : status === 503 ? "/maintenance$" : "/unauthorized$"));
  expect(paths).toHaveLength(3); await expect(page.locator("body")).not.toContainText("private-object-secret"); await expect(page.locator('[data-ui101-shell]')).toHaveCount(0);
});
for (const kind of ["workspace", "capability", "mode"]) test(`${kind} refusal stops before summary`, async ({ page }) => {
  const paths = await boundary(page, path => path === "/v1/context" ? { data: { ...context(), ...(kind === "workspace" ? { workspaceId: "55555555-5555-4555-8555-555555555555" } : kind === "capability" ? { capabilities: [] } : { mode: "assisted_live" }) } } : {});
  await page.goto("/command"); await expect(page).toHaveURL(/\/unauthorized$/); expect(paths).toEqual(["/v1/session", "/v1/context"]);
});
test("refresh rechecks authorization and removes an already displayed projection", async ({ page }) => {
  let revoked = false;
  const paths = await boundary(page, path => revoked && path === "/v1/context" ? { data: { ...context(), capabilities: [] } } : {});
  await page.goto("/command"); await expect(page.getByRole("heading", { name: "Command Center" })).toBeVisible();
  revoked = true; await page.getByRole("button", { name: "刷新", exact: true }).click(); await expect(page).toHaveURL(/\/unauthorized$/);
  expect(paths.filter(p => p === "/v1/command/summary")).toHaveLength(1); await expect(page.locator('[data-ui101-shell]')).toHaveCount(0);
});
test("network recovery revalidates; it cannot promote stale data to fresh", async ({ page, context: browser }) => {
  const paths = await boundary(page); await page.goto("/command"); await expect(page.locator(".freshness-status")).toContainText("Stale");
  await browser.setOffline(true); await page.evaluate(() => dispatchEvent(new Event("offline"))); await expect(page.getByRole("alert").filter({ hasText: "网络已断开" })).toBeVisible();
  await browser.setOffline(false); await page.evaluate(() => dispatchEvent(new Event("online")));
  await expect.poll(() => paths.filter(p => p === "/v1/command/summary").length).toBeGreaterThanOrEqual(2);
  await expect(page.locator(".freshness-status")).toContainText("Stale"); await expect(page.locator(".kpi-card").first()).toContainText("stale");
});
test("expired summary refuses with no fallback data", async ({ page }) => {
  await boundary(page, path => path === "/v1/command/summary" ? { data: { ...summary(), expiresAt: "2000-01-01T00:00:00Z" } } : {});
  await page.goto("/command"); await expect(page).toHaveURL(/\/offline$/); await expect(page.locator('[data-ui101-shell]')).toHaveCount(0);
});
test("session deadline removes the mounted shell and rechecks before loading data", async ({ page }) => {
  let expired = false;
  await boundary(page, path => path !== "/v1/command/summary" ? { data: { ...context(), expiresAt: expired ? "2000-01-01T00:00:00Z" : new Date(Date.now() + 2000).toISOString() } } : {});
  await page.goto("/command"); await expect(page.getByRole("heading", { name: "Command Center" })).toBeVisible(); expired = true;
  await expect(page).toHaveURL(/\/login$/, { timeout: 7000 }); await expect(page.locator('[data-ui101-shell]')).toHaveCount(0);
});

test("authoritative context fits 390px and CSS zoom=2 while staying read-only", async ({ page }) => {
  await boundary(page); await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/command");
  await expect(page.getByRole("heading", { name: "Command Center" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page.locator(".high-risk-action").first()).toBeHidden();
  await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("verified normal risk uses the healthy presentation, while null metrics remain unknown", async ({ page }) => {
  await boundary(page, path => path === "/v1/command/summary" ? { data: { ...summary(), riskPosture: "normal", sources: summary().sources.map(source => ({ ...source, status: "ready", asOf: new Date().toISOString(), sourceHash: "sha256:" + "a".repeat(64) })) } } : {});
  await page.goto("/command");
  const risk = page.locator(".kpi-card").filter({ has: page.getByRole("heading", { name: "开放风险" }) });
  await expect(risk.locator("p")).toHaveText("normal"); await expect(risk.locator("p")).toHaveClass("good"); await expect(risk.locator("strong")).toHaveText("—");
});
