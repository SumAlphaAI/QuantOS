import assert from "node:assert/strict";
import test from "node:test";

import { loadCurrentPre02, validatePre02 } from "./pre02-checks.mjs";

const current = loadCurrentPre02();

test("current PRE-02 design-system contract passes", () => {
  const report = validatePre02(current);
  assert.equal(report.status, "PASS", report.failures.join("\n"));
  assert.deepEqual(
    { wcag: report.wcag_pairs, safety: report.safety_keys, common: report.common_component_rows, domain: report.domain_component_rows, stories: report.baseline_stories },
    { wcag: 36, safety: 18, common: 19, domain: 25, stories: 7 },
  );
});

test("renaming a required safety key fails even when the count stays at 18", () => {
  const zh = { ...current.zh };
  const en = { ...current.en };
  delete zh["safety.nonExecutableProposal"];
  delete en["safety.nonExecutableProposal"];
  zh["safety.fakeReplacement"] = "占位";
  en["safety.fakeReplacement"] = "placeholder";
  const report = validatePre02({ ...current, zh, en });
  assert.equal(report.status, "FAIL");
  assert(report.failures.includes("safety key set is exact"));
});

test("missing state color mapping fails closed", () => {
  const tokens = structuredClone(current.tokens);
  delete tokens.stateColor.deny;
  const report = validatePre02({ ...current, tokens });
  assert.equal(report.status, "FAIL");
  assert(report.failures.includes("stateColor covers every and only frozen state"));
});

test("insufficient focus contrast is rejected", () => {
  const tokens = structuredClone(current.tokens);
  tokens.color.dark.semantic.info = tokens.color.dark.surface["0"];
  const report = validatePre02({ ...current, tokens });
  assert.equal(report.status, "FAIL");
  assert(report.failures.some((failure) => failure.startsWith("dark: focus / surface.0")));
});

test("missing readonly viewport is rejected", () => {
  const report = validatePre02({ ...current, storybookPreview: current.storybookPreview.replaceAll("readonly390", "mobile") });
  assert.equal(report.status, "FAIL");
  assert(report.failures.includes("Storybook preview configures readonly390"));
});
