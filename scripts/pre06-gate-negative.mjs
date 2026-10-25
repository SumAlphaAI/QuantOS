import assert from "node:assert/strict";
import test from "node:test";
import { parse, stringify } from "yaml";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { candidateVisualPaths, requiredVisualPaths } from "./check-visual-baselines.mjs";

import { loadPre06Inputs, validatePre06 } from "./check-pre06.mjs";

const current = loadPre06Inputs();

test("Linux candidate artifacts include all P01 themes and browsers and refuse an old twelve-image receipt", () => {
  const paths = candidateVisualPaths("linux");
  assert.equal(paths.length, 42);assert.equal(new Set(paths).size, 42);
  for (const browser of ["chromium", "firefox", "webkit"]) for (const theme of ["dark", "light"]) {
    for (const page of ["login", "mfa", "access-request", "unauthorized", "offline"]) {
      assert(paths.includes(`tests/e2e/ui-p01.spec.ts-snapshots/p01-${page}-${theme}-${browser}-linux.png`));
    }
  }
  const directory = mkdtempSync(join(tmpdir(), "quantos-incomplete-visuals-"));
  try {
    const commit = "a".repeat(40);
    writeFileSync(join(directory, "receipt.json"), JSON.stringify({schema:"quantos-visual-candidates/v1",status:"CANDIDATE_REQUIRES_REVIEW",commit,runner:"ubuntu-24.04",run:"https://github.com/SumAlphaAI/QuantOS/actions/runs/1",files:requiredVisualPaths("linux").map(path => ({path}))}));
    const result = spawnSync(process.execPath, ["scripts/visual-baseline-candidates.mjs", "import-reviewed", directory, commit], {encoding:"utf8"});
    assert.notEqual(result.status, 0);assert.match(result.stderr, /Expected exactly 42 Linux snapshots/);
  } finally {rmSync(directory, {recursive:true, force:true});}
});

test("Chromium installation cannot be missing, disabled or moved after Market consumers", () => {
  for (const mutate of [
    steps => steps.splice(steps.findIndex(s => s.run === 'pnpm exec playwright install chromium --with-deps'), 1),
    steps => { steps.find(s => s.run === 'pnpm exec playwright install chromium --with-deps').if = false; },
    steps => steps.push(...steps.splice(steps.findIndex(s => s.run === 'pnpm exec playwright install chromium --with-deps'), 1)),
  ]) {
    const workflow = parse(current.frontendWorkflowText);
    mutate(workflow.jobs['frontend-baseline'].steps);
    const report = validatePre06({ ...current, frontendWorkflowText: stringify(workflow) });
    assert(report.failures.includes("Chromium is installed before the first Market provider browser consumer"));
  }
});

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
  assert(report.failures.includes("BFF fixture manifest covers the exact OpenAPI operations and routes"));
});

test("generated manifest version, operation identity and route drift are rejected", () => {
  for (const mutate of [
    operations => { operations.version = "0.0.0"; },
    operations => { operations.operations[0].operationId = "unknownOperation"; },
    operations => { operations.operations[0].path = "/wrong-route"; },
    operations => { operations.operations[0].method = "TRACE"; },
  ]) {
    const operations = structuredClone(current.operations);
    mutate(operations);
    assert.equal(validatePre06({ ...current, operations }).status, "FAIL");
  }
});

test("schema deletion and same-count schema substitution are rejected", () => {
  for (const substitute of [false, true]) {
    const schemas = structuredClone(current.schemas);
    delete schemas.$defs[Object.keys(schemas.$defs)[0]];
    if (substitute) schemas.$defs.UnknownSchema = {};
    assert(validatePre06({ ...current, schemas }).failures.includes("BFF fixture schema bundle covers the exact OpenAPI schemas"));
  }
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

test("skipped suites and inactive screenshot assertions cannot satisfy the baseline", () => {
  for(const change of [
    text=>text.replace('test("视觉基线：1440 深主题"','test.skip("视觉基线：1440 深主题"'),
    text=>text.replace('test.describe(','test.describe.skip('),
    text=>text.replace('await expect(page).toHaveScreenshot','if (false) await expect(page).toHaveScreenshot'),
    text=>text.replace('await expect(page).toHaveScreenshot','return; await expect(page).toHaveScreenshot'),
    text=>text.replace('await expect(page).toHaveScreenshot','test.skip(); await expect(page).toHaveScreenshot'),
    text=>text.replace('await expect(page).toHaveScreenshot','expect(page).toHaveScreenshot'),
  ]) {
    const visualTests={...current.visualTests,'command.spec.ts':change(current.visualTests['command.spec.ts'])};
    assert.equal(validatePre06({...current,visualTests}).status,'FAIL');
  }
  for(const method of ['skip','todo'])assert.equal(validatePre06({...current,contractTests:current.contractTests.replaceAll('describe(',`describe.${method}(`)}).status,'FAIL');
});

test("critical contract callbacks cannot return early, hide assertions, or remove runtime counting", () => {
  const start='it("故意破坏 schema → 校验失败", () => {';
  for(const text of [
    current.contractTests.replace(start,start+' return;'),
    current.contractTests.replace(start,start+' if (true) return;'),
    current.contractTests.replace('beforeEach(() => expect.hasAssertions());',''),
    current.contractTests.replace('const issues = validateFixture(loadFixture("sabotage/schema-broken.json"), { schema: "SessionContext" });\n    expect(issues.length).toBeGreaterThan(0);','if (false) { const issues = validateFixture(loadFixture("sabotage/schema-broken.json"), { schema: "SessionContext" }); expect(issues.length).toBeGreaterThan(0); }'),
    current.contractTests.replace('const issues = validateFixture(loadFixture("sabotage/schema-broken.json"), { schema: "SessionContext" });\n    expect(issues.length).toBeGreaterThan(0);','const unused = () => { const issues = validateFixture(loadFixture("sabotage/schema-broken.json"), { schema: "SessionContext" }); expect(issues.length).toBeGreaterThan(0); };'),
  ])assert.equal(validatePre06({...current,contractTests:text}).status,'FAIL');
});
