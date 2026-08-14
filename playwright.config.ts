import { defineConfig, devices } from "@playwright/test";

/**
 * PRE-06 Playwright project：
 * - PR：仅 Chromium（执行计划 8.1：每 PR 跑 Chromium）；
 * - 夜间/全矩阵：FULL_MATRIX=1 追加 Firefox/WebKit。
 * - webServer 直接服务 apps/terminal/out（PRE-03 构建产物，需先 build）。
 */
const fullMatrix = process.env.FULL_MATRIX === "1";

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
    ...(fullMatrix
      ? [
          { name: "firefox", use: { ...devices["Desktop Firefox"] } },
          { name: "webkit", use: { ...devices["Desktop Safari"] } },
        ]
      : []),
  ],
});
