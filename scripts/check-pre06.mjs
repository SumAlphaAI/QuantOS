#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";

import { validateFixtureInventory } from "../tests/contract/fixture-inventory.mjs";
import { validateTestStructure, configValue, projectNames, budgetValue, hasCall } from "./pre06-test-structure.mjs";
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
    visualTests: Object.fromEntries(["command.spec.ts", "ui102-auth.spec.ts", "ui104-settings.spec.ts"].map(name => [name, read(root, "tests/e2e/" + name)])),
    criticalInventory: JSON.parse(read(root, "tests/critical-branches.json")),
    criticalConfig: read(root, "vitest.critical.config.ts"),
    fixtureReport: validateFixtureInventory(join(root, "tests/contract")),
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
  check(scripts["test:pre06"] === "node --test scripts/pre06-gate-negative.mjs scripts/pre06-runtime-negative.mjs", "PRE-06 negative Gate is registered");
  check(scripts["check:visual-baselines"] === "node scripts/check-visual-baselines.mjs", "visual integrity Gate is registered");
  check(scripts["check:pre03:web"] === "node scripts/pre03-smoke.mjs --web-only", "Web-only build smoke is registered");

  check(!/terminal-desktop|tauri|dual-end/i.test(inputs.frontendWorkflowText), "Frontend Baseline has no Desktop/Tauri Gate");
  check(!/terminal-desktop|tauri|desktop contract/i.test(inputs.compatibilityWorkflowText), "Web compatibility has no Desktop/Tauri Gate");
  const frontend = parseYaml(inputs.frontendWorkflowText);
  const compatibility = parseYaml(inputs.compatibilityWorkflowText);
  function active(workflow, command) {
    return Object.values(workflow.jobs ?? {}).some(job => job.if === undefined && !job["continue-on-error"] &&
      (job.steps ?? []).some(step => step.if === undefined && !step["continue-on-error"] &&
        String(step.run ?? "").split(/\s*&&\s*|\n/).map(line => line.split(" #")[0].trim()).includes(command)));
  }
  const required = [
    ["pnpm check:pre06", "Frontend Baseline runs PRE-06 positive/negative structure Gates"],
    ["pnpm test:pre06", "Frontend Baseline runs PRE-06 positive/negative structure Gates"],
    ["pnpm check:visual-baselines --platform linux", "Frontend Baseline validates real visual baseline integrity"],
    ["pnpm test:browser:website --project=chromium", "Frontend Baseline runs website Chromium E2E"],
    ["pnpm exec playwright test --project=chromium", "Frontend Baseline runs Terminal Chromium E2E"],
    ["node scripts/pre06-sabotage-check.mjs", "Frontend Baseline runs actual sabotage Gate"],
    ["pnpm exec vitest run tests/contract", "Frontend Baseline runs actual contract tests"],
    ["node scripts/check-perf-budget.mjs apps/terminal/out", "Frontend Baseline runs Terminal performance Gate"],
    ["node scripts/check-perf-budget.mjs apps/website/out", "Frontend Baseline runs website performance Gate"],
    ["pnpm coverage:critical", "Frontend Baseline runs critical branch coverage"],
  ];
  for (const [command, message] of required) check(active(frontend, command), message);
  check(JSON.stringify(compatibility.jobs?.["browser-regression"]?.strategy?.matrix?.browser) === JSON.stringify(["chromium", "firefox", "webkit"]), "Web compatibility freezes the three-browser matrix");
  check(active(compatibility, "pnpm test:browser:website --project=${{ matrix.browser }} --reporter=github,json"), "Web compatibility runs website in every browser");
  check(active(compatibility, "pnpm test:browser --project=${{ matrix.browser }} --reporter=github,json"), "Web compatibility runs Terminal in every browser");
  const steps=frontend.jobs?.["frontend-baseline"]?.steps ?? [];
  const index=(fragment)=>steps.findIndex(step=>String(step.run??"").includes(fragment));
  check(index("pnpm check:pre06") < index("pnpm exec vitest") && index("pnpm --filter @sumalpha/website build") < index("node scripts/check-perf-budget") && index("pnpm check:visual-baselines") < index("pnpm exec playwright test"), "Frontend Gate executes prerequisites before consumers");
  for (const [name, workflow] of [["Frontend",frontend],["Compatibility",compatibility]]) {
    const jobs=Object.values(workflow.jobs??{});
    check(jobs.some(job=>(job.steps??[]).some(step=>step.uses?.startsWith("actions/upload-artifact@") && step.if==='always()' && String(step.with?.path??'').includes('artifacts/browser/') && step.with?.['retention-days']===14)), name+" archives reports and failure attachments");
  }
  const desktopTriggers = inputs.desktopWorkflow?.on ?? {};
  check(Object.hasOwn(desktopTriggers, "workflow_dispatch") && !Object.hasOwn(desktopTriggers, "push") && !Object.hasOwn(desktopTriggers, "pull_request"), "Desktop workflow is phase-two manual-only");

  for (const [name, config] of [["Terminal", inputs.terminalPlaywright], ["Website", inputs.websitePlaywright]]) {
    for (const browser of ["chromium", "firefox", "webkit"]) {
      check(projectNames(config).includes(browser), `${name} Playwright registers ${browser}`);
    }
    check(configValue(config,["forbidOnly"]) === "Boolean(process.env.CI)", `${name} Playwright forbids test.only in CI`);
    check(configValue(config,["failOnFlakyTests"]) === "Boolean(process.env.CI)", `${name} Playwright rejects flaky CI tests`);
    check(configValue(config,["use","trace"]) === '"retain-on-failure"', `${name} Playwright retains failure traces`);
    check(configValue(config,["use","viewport","width"]) === "1440" && configValue(config,["use","viewport","height"]) === "900", `${name} Playwright freezes the 1440x900 desktop viewport`);
  }
  check(configValue(inputs.terminalPlaywright,["testIgnore"])?.includes('"deep-link-reauth.spec.ts"'), "phase-one Terminal excludes the Desktop deep-link spec");

  check(inputs.operations.version === "1.5.0", "BFF fixture manifest is version 1.5.0");
  check(inputs.operations.operations?.length === 62, "BFF fixture manifest covers 62 operations");
  check(Object.keys(inputs.schemas.$defs ?? {}).length === 52, "BFF fixture schema bundle covers 52 schemas");
  for (const failure of validateTestStructure(inputs.contractTests, inputs.visualTests)) failures.push(failure);
  const criticalPaths=["packages/api-client/src/sse-contract.ts","packages/domain-ui/src/ui101.ts","packages/domain-ui/src/indicators.tsx","packages/ui/src/components/DangerConfirmDialog/confirmation-policy.ts","apps/terminal/src/auth/flow.ts","apps/terminal/src/audit/gateway.ts"];
  check(inputs.criticalInventory.schema === "quantos-critical-branches/v1" && criticalPaths.every(path=>inputs.criticalInventory.files.some(entry=>entry.path===path&&entry.policy)), "critical policy inventory cannot shrink");
  check(configValue(inputs.criticalConfig,["test","coverage","thresholds","perFile"]) === "true" && ["branches","lines","functions","statements"].every(key=>configValue(inputs.criticalConfig,["test","coverage","thresholds",key]) === "100") && configValue(inputs.criticalConfig,["test","coverage","exclude"]) === "[]" && configValue(inputs.criticalConfig,["test","coverage","include"]) === "inventory.files.map(entry=>entry.path)", "critical coverage freezes per-file 100% including TSX");
  check(inputs.fixtureReport.status === "PASS", "all fixture inventory entries pass schema and sensitive policy");

  check(budgetValue(inputs.performanceGate,"sharedFirstLoadJs") === 250*1024, "shared first-load JS budget is 250KB gzip");
  check(budgetValue(inputs.performanceGate,"singleChunk") === 200*1024, "single chunk budget is 200KB gzip");
  check(budgetValue(inputs.performanceGate,"totalCss") === 60*1024, "CSS budget is 60KB gzip");
  check(hasCall(inputs.sabotageGate,"validateVisualBaselines"), "visual sabotage uses the real baseline integrity Gate");
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
    const summary = { ...report, checks: undefined, failures: undefined };
    console.log(JSON.stringify(summary, null, 2));
  }
}
