#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";

import { validateVisualBaselines } from "./check-visual-baselines.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (root, path) => readFileSync(join(root, path), "utf8");

export function loadPre06Inputs(root = repoRoot) {
  return {
    packageJson: JSON.parse(read(root, "package.json")),
    frontendWorkflowText: read(root, ".github/workflows/frontend-baseline.yml"),
    compatibilityWorkflowText: read(root, ".github/workflows/compatibility.yml"),
    desktopWorkflowText: read(root, ".github/workflows/desktop-phase2.yml"),
    frontendWorkflow: parseYaml(read(root, ".github/workflows/frontend-baseline.yml")),
    compatibilityWorkflow: parseYaml(read(root, ".github/workflows/compatibility.yml")),
    desktopWorkflow: parseYaml(read(root, ".github/workflows/desktop-phase2.yml")),
    terminalPlaywright: read(root, "playwright.config.ts"),
    websitePlaywright: read(root, "playwright.website.config.ts"),
    operations: JSON.parse(read(root, "tests/contract/generated/quantos-bff.operations.json")),
    schemas: JSON.parse(read(root, "tests/contract/generated/quantos-bff.components.schema.json")),
    contractTests: read(root, "tests/contract/contract.test.ts"),
    performanceGate: read(root, "scripts/check-perf-budget.mjs"),
    sabotageGate: read(root, "scripts/pre06-sabotage-check.mjs"),
    visualReport: validateVisualBaselines(root),
  };
}

export function validatePre06(inputs) {
  const checks = [];
  const failures = [];
  const check = (condition, message) => (condition ? checks : failures).push(message);
  const scripts = inputs.packageJson.scripts ?? {};

  check(scripts["check:pre06"] === "node scripts/check-pre06.mjs", "PRE-06 structure Gate is registered");
  check(scripts["test:pre06"] === "node --test scripts/pre06-gate-negative.mjs", "PRE-06 negative Gate is registered");
  check(scripts["check:visual-baselines"] === "node scripts/check-visual-baselines.mjs", "visual integrity Gate is registered");
  check(scripts["check:pre03:web"] === "node scripts/pre03-smoke.mjs --web-only", "Web-only build smoke is registered");

  check(!/terminal-desktop|tauri|dual-end/i.test(inputs.frontendWorkflowText), "Frontend Baseline has no Desktop/Tauri Gate");
  check(!/terminal-desktop|tauri|desktop contract/i.test(inputs.compatibilityWorkflowText), "Web compatibility has no Desktop/Tauri Gate");
  check(inputs.frontendWorkflowText.includes("pnpm check:pre06 && pnpm test:pre06"), "Frontend Baseline runs PRE-06 positive/negative structure Gates");
  check(inputs.frontendWorkflowText.includes("pnpm check:visual-baselines"), "Frontend Baseline validates real visual baseline integrity");
  check(inputs.frontendWorkflowText.includes("pnpm test:browser:website --project=chromium"), "Frontend Baseline runs website Chromium E2E");
  check(inputs.frontendWorkflowText.includes("pnpm exec playwright test --project=chromium"), "Frontend Baseline runs Terminal Chromium E2E");
  check(inputs.compatibilityWorkflowText.includes("browser: [chromium, firefox, webkit]"), "Web compatibility freezes the three-browser matrix");
  check(inputs.compatibilityWorkflowText.includes("pnpm test:browser:website --project=${{ matrix.browser }}"), "Web compatibility runs website in every browser");
  check(inputs.compatibilityWorkflowText.includes("pnpm test:browser --project=${{ matrix.browser }}"), "Web compatibility runs Terminal in every browser");
  const desktopTriggers = inputs.desktopWorkflow?.on ?? {};
  check(Object.hasOwn(desktopTriggers, "workflow_dispatch") && !Object.hasOwn(desktopTriggers, "push") && !Object.hasOwn(desktopTriggers, "pull_request"), "Desktop workflow is phase-two manual-only");

  for (const [name, config] of [["Terminal", inputs.terminalPlaywright], ["Website", inputs.websitePlaywright]]) {
    for (const browser of ["chromium", "firefox", "webkit"]) {
      check(config.includes(`name: "${browser}"`), `${name} Playwright registers ${browser}`);
    }
    check(config.includes("forbidOnly: Boolean(process.env.CI)"), `${name} Playwright forbids test.only in CI`);
    check(config.includes('trace: "retain-on-failure"'), `${name} Playwright retains failure traces`);
    check(config.includes("viewport: { width: 1440, height: 900 }"), `${name} Playwright freezes the 1440x900 desktop viewport`);
  }
  check(inputs.terminalPlaywright.includes('"deep-link-reauth.spec.ts"'), "phase-one Terminal excludes the Desktop deep-link spec");

  check(inputs.operations.version === "1.2.0", "BFF fixture manifest is version 1.2.0");
  check(inputs.operations.operations?.length === 56, "BFF fixture manifest covers 56 operations");
  check(Object.keys(inputs.schemas.$defs ?? {}).length === 43, "BFF fixture schema bundle covers 43 schemas");
  for (const marker of ["MOCK_NOT_CONFIGURED", "currentVersion", "retryAfter", "venueApiKey", "executable=true"]) {
    check(inputs.contractTests.includes(marker), `contract tests cover ${marker}`);
  }

  check(inputs.performanceGate.includes("sharedFirstLoadJs: 250 * 1024"), "shared first-load JS budget is 250KB gzip");
  check(inputs.performanceGate.includes("singleChunk: 200 * 1024"), "single chunk budget is 200KB gzip");
  check(inputs.performanceGate.includes("totalCss: 60 * 1024"), "CSS budget is 60KB gzip");
  check(inputs.sabotageGate.includes("validateVisualBaselines"), "visual sabotage uses the real baseline integrity Gate");
  check(inputs.visualReport.status === "PASS" && inputs.visualReport.entries >= 5, "tracked visual baselines pass inventory/hash/dimension checks");

  return {
    schema: "quantos-pre06/v1",
    status: failures.length === 0 ? "PASS" : "FAIL",
    checks,
    failures,
    bff_operations: inputs.operations.operations?.length ?? 0,
    bff_schemas: Object.keys(inputs.schemas.$defs ?? {}).length,
    visual_baselines: inputs.visualReport.entries ?? 0,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const report = validatePre06(loadPre06Inputs());
  if (report.status === "FAIL") {
    for (const failure of report.failures) console.error(`FAIL  ${failure}`);
    process.exitCode = 1;
  } else {
    const { checks: _checks, failures: _failures, ...summary } = report;
    console.log(JSON.stringify(summary, null, 2));
  }
}
