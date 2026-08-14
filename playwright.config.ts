import { defineConfig, devices } from "@playwright/test";

/**
 * PRE-06 Playwright project：
 * - 三浏览器项目常驻注册；执行范围由 CI 任务以 --project 选择
 *   （ci.yml 每 PR 仅 chromium；compatibility.yml 跑 chromium/firefox/webkit 全矩阵）。
 * - webServer 直接服务 apps/terminal/out（PRE-03 构建产物，需先 build；
 *   ci.yml 与 compatibility.yml 均已前置构建步骤）。
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3190",
    trace: "retain-on-failure",
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: "node scripts/serve-static.mjs apps/terminal/out 3190",
    url: "http://localhost:3190/command",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
