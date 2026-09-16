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
  assert(report.failures.includes("BFF fixture manifest covers 55 operations"));
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
