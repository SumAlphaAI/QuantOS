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
  testIgnore: ["frontend-g7-paper.spec.ts", "frontend-g7-shadow.spec.ts", "frontend-g6.spec.ts","ui-p14.spec.ts","ui602.spec.ts","ui-p13.spec.ts","ui601.spec.ts","ui-p23.spec.ts","ui603.spec.ts","frontend-g4.spec.ts", "ui-p21.spec.ts", "ui403.spec.ts", "ui-p19.spec.ts", "ui402.spec.ts", "fep5-function.spec.ts", "ui-p22.spec.ts", "ui506.spec.ts", "ui-p11.spec.ts", "ui-p20.spec.ts", "ui505.spec.ts", "ui-p10.spec.ts", "ui504.spec.ts", "ui503.spec.ts", "ui-p09.spec.ts", "ui502.spec.ts", "ui-p08.spec.ts", "ui501.spec.ts", "ui-p18.spec.ts", "ui401.spec.ts", "fep3-function.spec.ts", "g3-integration-01.spec.ts", "frontend-g3.spec.ts", "ui-p07.spec.ts", "ui303.spec.ts", "ui302.spec.ts", "ui-p06.spec.ts", "ui301.spec.ts", "ui-p04.spec.ts", "ui203.spec.ts", "ui202.spec.ts", "ui-p03.spec.ts", "ui201.spec.ts", "ui-p05.spec.ts", "ui204.spec.ts", "ui-p12.spec.ts", "ui507.spec.ts", "g1-journey.spec.ts", "g1-recovery.spec.ts", "website.spec.ts", "web101-current.spec.ts", "deep-link-reauth.spec.ts", "ui101-bff.spec.ts", "ui104-bff.spec.ts", "ui-p02.spec.ts", "ui-p02-http.spec.ts", "ui-p15.spec.ts", "ui-p15-http.spec.ts", "ui-p17.spec.ts", "ui-p17-http.spec.ts"],
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
