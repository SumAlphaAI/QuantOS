import { defineConfig, devices } from "@playwright/test";

/**
 * PRE-06 Playwright project：
 * - 三浏览器项目常驻注册；执行范围由 CI 任务以 --project 选择
 *   （ci.yml 每 PR 仅 chromium；compatibility.yml 跑 chromium/firefox/webkit 全矩阵）。
 * - webServer 直接服务 apps/terminal/out（PRE-03 构建产物，需先 build；
 *   ci.yml 与 compatibility.yml 均已前置构建步骤）。
 */
export default defineConfig({
  // Playwright PR diff capture fetches --depth=1, truncating history needed by security gates.
  captureGitInfo: { commit: true, diff: false },
  testDir: "./tests/e2e",
  testIgnore: ["ui202.spec.ts", "ui-p03.spec.ts", "ui201.spec.ts", "ui-p05.spec.ts", "ui204.spec.ts", "ui-p12.spec.ts", "ui507.spec.ts", "g1-journey.spec.ts", "g1-recovery.spec.ts", "website.spec.ts", "web101-current.spec.ts", "deep-link-reauth.spec.ts", "ui101-bff.spec.ts", "ui104-bff.spec.ts", "ui-p02.spec.ts", "ui-p02-http.spec.ts", "ui-p15.spec.ts", "ui-p15-http.spec.ts", "ui-p17.spec.ts", "ui-p17-http.spec.ts"],
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  failOnFlakyTests: Boolean(process.env.CI),
  outputDir: "artifacts/browser/terminal/test-results",
  reporter: process.env.CI ? [["github"], ["json", { outputFile: "artifacts/browser/terminal/report.json" }]] : "list",
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
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "firefox", use: { ...devices["Desktop Firefox"], viewport: { width: 1440, height: 900 } } },
    { name: "webkit", use: { ...devices["Desktop Safari"], viewport: { width: 1440, height: 900 } } },
  ],
});
