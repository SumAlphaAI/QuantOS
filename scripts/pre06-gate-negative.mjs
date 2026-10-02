import assert from "node:assert/strict";
import test from "node:test";

import { loadPre06Inputs, validatePre06 } from "./check-pre06.mjs";

const current = loadPre06Inputs();

test("current PRE-06 Web baseline passes", () => {
  const report = validatePre06(current);
  assert.equal(report.status, "PASS", report.failures.join("\n"));
});

test("website browser Gate deletion is rejected", () => {
  const report = validatePre06({
    ...current,
    frontendWorkflowText: current.frontendWorkflowText.replace("pnpm test:browser:website --project=chromium", "website browser gate removed"),
  });
  assert(report.failures.includes("Frontend Baseline runs website Chromium E2E"));
});

test("Desktop coupling in phase-one compatibility is rejected", () => {
  const report = validatePre06({
    ...current,
    compatibilityWorkflowText: `${current.compatibilityWorkflowText}\n# terminal-desktop tauri\n`,
  });
  assert(report.failures.includes("Web compatibility has no Desktop/Tauri Gate"));
});

test("Desktop deep-link inclusion in phase-one Terminal is rejected", () => {
  const report = validatePre06({
    ...current,
    terminalPlaywright: current.terminalPlaywright.replace('"deep-link-reauth.spec.ts"', '"deep-link-spec-was-reincluded"'),
  });
  assert(report.failures.includes("phase-one Terminal excludes the Desktop deep-link spec"));
});

test("generated operation coverage drift is rejected", () => {
  const operations = structuredClone(current.operations);
  operations.operations.pop();
  const report = validatePre06({ ...current, operations });
  assert(report.failures.includes("BFF fixture manifest covers 62 operations"));
});

test("visual baseline integrity failure is rejected", () => {
  const report = validatePre06({
    ...current,
    visualReport: { status: "FAIL", entries: current.visualReport.entries, issues: ["sha256 mismatch"] },
  });
  assert(report.failures.includes("tracked visual baselines pass inventory/hash/dimension checks"));
});

test("performance budget weakening is rejected", () => {
  const report = validatePre06({
    ...current,
    performanceGate: current.performanceGate.replace("sharedFirstLoadJs: 250 * 1024", "sharedFirstLoadJs: 500 * 1024"),
  });
  assert(report.failures.includes("shared first-load JS budget is 250KB gzip"));
});

test("disabled CI steps and comment-only commands are rejected", () => {
  for (const text of [
    current.frontendWorkflowText.replace('run: pnpm test:browser:website --project=chromium','if: false\n        run: pnpm test:browser:website --project=chromium'),
    current.frontendWorkflowText.replaceAll('run:','run: echo disabled #'),
    current.frontendWorkflowText.replace('run: node scripts/pre06-sabotage-check.mjs','run: echo removed'),
  ]) assert.equal(validatePre06({...current,frontendWorkflowText:text}).status,'FAIL');
});
test("contract assertion deletion and visual comparison deletion fail closed", () => {
  assert.equal(validatePre06({...current,contractTests:'// MOCK_NOT_CONFIGURED currentVersion retryAfter venueApiKey executable=true'}).status,'FAIL');
  const visualTests=Object.fromEntries(Object.entries(current.visualTests).map(([name,text])=>[name,text.split('\n').filter(line=>!line.includes('.toHaveScreenshot(')).join('\n')]));
  assert.equal(validatePre06({...current,visualTests}).status,'FAIL');
});
test("website performance and critical coverage gates cannot be removed", () => {
  for(const command of ['node scripts/check-perf-budget.mjs apps/website/out','pnpm coverage:critical']) {
    assert.equal(validatePre06({...current,frontendWorkflowText:current.frontendWorkflowText.replace(command,'echo removed')}).status,'FAIL');
  }
});
test("CI retry policy must reject flaky outcomes and archive failure evidence", () => {
  assert.equal(validatePre06({...current,terminalPlaywright:current.terminalPlaywright.replace('failOnFlakyTests: Boolean(process.env.CI)','failOnFlakyTests: false')}).status,'FAIL');
  assert.equal(validatePre06({...current,frontendWorkflowText:current.frontendWorkflowText.replace('retention-days: 14','retention-days: 1')}).status,'FAIL');
});

test("comments cannot restore weakened budget or critical coverage policy", () => {
  assert.equal(validatePre06({...current,performanceGate:current.performanceGate.replace("sharedFirstLoadJs: 250 * 1024","sharedFirstLoadJs: 500 * 1024")+"\n// sharedFirstLoadJs: 250 * 1024"}).status,"FAIL");
  assert.equal(validatePre06({...current,criticalConfig:current.criticalConfig.replace("branches: 100","branches: 0")+"\n// perFile: true, branches: 100, lines: 100, functions: 100, statements: 100"}).status,"FAIL");
  assert.equal(validatePre06({...current,criticalInventory:{...current.criticalInventory,files:current.criticalInventory.files.slice(1)}}).status,"FAIL");
});
