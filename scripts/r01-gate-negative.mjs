import assert from "node:assert/strict";
import test from "node:test";

import { loadR01Inputs, validateR01 } from "./check-r01.mjs";

const current = loadR01Inputs();

test("current R01 repository Gate passes", () => {
  const report = validateR01(current);
  assert.equal(report.status, "PASS", report.failures.join("\n"));
});

test("replay count regression is rejected", () => {
  const fixture = { ...current.fixture, count: 99_999 };
  assert(validateR01({ ...current, fixture }).failures.includes("replay fixture contains exactly 100000 ticks"));
});

test("provider allowlist deletion is rejected", () => {
  const source = current.source.replaceAll("ApprovedProviderRegistry", "RemovedProviderRegistry");
  assert(validateR01({ ...current, source }).failures.includes("market contract implements ApprovedProviderRegistry"));
});

test("permissive symbol parsing is rejected", () => {
  const source = current.source.replace("character.is_ascii_alphanumeric() || matches!(character, '/' | '-' | '_')", "true");
  assert(validateR01({ ...current, source }).failures.includes("symbol normalization rejects unexpected punctuation"));
});

test("non-positive quality check deletion is rejected", () => {
  const source = current.source.replace("price.value() <= Decimal::ZERO", "price.value().is_zero()");
  assert(validateR01({ ...current, source }).failures.includes("non-positive price and volume fail quality"));
});

test("five-second anomaly bound weakening is rejected", () => {
  const source = current.source.replace("Duration::from_secs(5)", "Duration::from_secs(6)");
  assert(validateR01({ ...current, source }).failures.includes("anomaly emission test enforces the five-second bound"));
});

test("R01 status regression is rejected", () => {
  const plan = current.plan.replace(/(- task_id: `R01`[\s\S]*?- development_status: `)COMPLETED(`)/, "$1PARTIAL$2");
  assert(validateR01({ ...current, plan }).failures.includes("R01 development status is COMPLETED"));
});

test("dependency regression is rejected", () => {
  const plan = current.plan.replace(/(- task_id: `F05`[\s\S]*?- development_status: `)COMPLETED(`)/, "$1PARTIAL$2");
  assert(validateR01({ ...current, plan }).failures.includes("dependency F05 is COMPLETED"));
});

test("CI Gate deletion is rejected", () => {
  const workflow = current.workflow.replace("make r01-check", "echo removed-r01-check");
  assert(validateR01({ ...current, workflow }).failures.includes("main CI runs the R01 Gate"));
});
