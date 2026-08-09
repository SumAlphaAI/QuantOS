import { expect, test } from "@playwright/test";

import { createTerminalApp } from "../../apps/terminal/src/app.js";
import { renderTerminalShell } from "../../apps/terminal/src/index.js";

test("renders the shared noindex shell in the browser", async ({ page }) => {
  const shell = renderTerminalShell();
  await page.setContent(`<!doctype html>
    <html><head><meta name="robots" content="noindex"></head>
    <body><main data-testid="shell"></main></body></html>`);
  await page.getByTestId("shell").evaluate((element, value) => {
    element.textContent = String(value);
  }, shell);

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
  await expect(page.getByTestId("shell")).toHaveText("domain-ui::api-client::web");
});

test("keeps high-risk actions hidden on a small browser viewport", async ({ page }) => {
  const app = createTerminalApp("web");
  const actions = app.actionsFor("/research/:runId", 390);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent(`<main data-testid="actions"></main>`);
  await page.getByTestId("actions").evaluate((element, values) => {
    for (const action of values as string[]) {
      const button = document.createElement("button");
      button.dataset.riskAction = action;
      element.append(button);
    }
  }, actions);

  await expect(page.locator("[data-risk-action]")).toHaveCount(0);
});

test("exposes approved high-risk actions on a regular viewport", async ({ page }) => {
  const app = createTerminalApp("web");
  const actions = app.actionsFor("/research/:runId", 1440);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.setContent(`<main data-testid="actions"></main>`);
  await page.getByTestId("actions").evaluate((element, values) => {
    for (const action of values as string[]) {
      const button = document.createElement("button");
      button.dataset.riskAction = action;
      element.append(button);
    }
  }, actions);

  await expect(page.locator('[data-risk-action="cancel_run"]')).toHaveCount(1);
  await expect(page.locator('[data-risk-action="create_strategy_draft"]')).toHaveCount(1);
});
