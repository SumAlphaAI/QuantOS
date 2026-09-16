import { defineConfig, devices } from "@playwright/test";

/**
 * WEB-101 官网独立 E2E：服务 apps/website/out 静态产物（需先 pnpm --filter @sumalpha/website build）。
 * 与 Terminal 的 playwright.config.ts 分配置，避免官网用例误入业务 CI 矩阵。
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "website.spec.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3196",
    trace: "retain-on-failure",
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: "node scripts/serve-static.mjs apps/website/out 3196",
    url: "http://localhost:3196/",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "firefox", use: { ...devices["Desktop Firefox"], viewport: { width: 1440, height: 900 } } },
    { name: "webkit", use: { ...devices["Desktop Safari"], viewport: { width: 1440, height: 900 } } },
  ],
});
