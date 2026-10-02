import assert from "node:assert/strict";
import test from "node:test";

import { loadCurrentPre02, validatePre02 } from "./pre02-checks.mjs";

const current = loadCurrentPre02();

test("current PRE-02 design-system contract passes", () => {
  const report = validatePre02(current);
  assert.equal(report.status, "PASS", report.failures.join("\n"));
  assert.deepEqual(
    { wcag: report.wcag_pairs, safety: report.safety_keys, common: report.common_component_rows, domain: report.domain_component_rows, stories: report.baseline_stories },
    { wcag: 252, safety: 18, common: 19, domain: 25, stories: 7 },
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

const regressions = [
  ["deny cannot become success", x => { x.tokens.stateColor.deny = "semantic.success"; }],
  ["mapped token paths must exist", x => { x.tokens.stateColor.deny = "semantic.nonexistent"; }],
  ["English safety semantics cannot be inverted", x => { x.en["safety.nonExecutableProposal"] = "This is an executable order. Submit it now."; }],
  ["all compact density values remain frozen", x => { x.tokens.density.compact.controlHeight = 0; x.tokens.density.compact.padding = -12; }],
  ["focus width and path remain frozen", x => { x.tokens.focus.ringWidth = 0; x.tokens.focus.ringColorToken = "border.default"; }],
  ["breakpoint intervals cannot develop gaps", x => { x.tokens.breakpoints.collapsed.max = 800; }],
  ["typography and spacing must match the reviewed contract", x => { x.tokens.typography.body.fontSize = "1px"; x.tokens.spacing.base = 3; }],
  ["required component identity cannot be replaced", x => { x.componentInventory = x.componentInventory.replace("Dialog / DangerConfirmDialog", "UnrelatedPlaceholder"); }],
  ["comments do not supply executable Storybook configuration", x => {
    for (const key of ["storybookMain", "storybookPreview", "stateBadgeStories"]) x[key] = x[key].split("\n").map(line => `// ${line}`).join("\n");
  }],
  ["surface.2 contrast cannot be removed from the contract", x => { x.tokens.color.dark.surface["2"] = x.tokens.color.dark.text.primary; }],
];
for (const [name, mutate] of regressions) test(name, () => {
  const input = structuredClone(current); mutate(input);
  assert.equal(validatePre02(input).status, "FAIL");
});
test("native reference viewport is not a prerequisite of the Web Gate", () => {
  const input = structuredClone(current); delete input.tokens.breakpoints.desktopMin;
  assert.equal(validatePre02(input).status, "PASS");
});
test("disabled contrast rule cannot hide behind a matching comment", () => {
  const input = { ...current, storybookPreview: current.storybookPreview.replace("enabled: true", "enabled: false /* enabled: true */") };
  assert.equal(validatePre02(input).status, "FAIL");
});
test("readonly viewport dimensions cannot hide behind its identifier", () => {
  assert.equal(validatePre02({ ...current, storybookPreview: current.storybookPreview.replace('width: "390px"', 'width: "1920px"') }).status, "FAIL");
});
test("phase-two page cannot enter the Web component acceptance rows", () => {
  assert.equal(validatePre02({ ...current, componentInventory: current.componentInventory.replace("| P17 |", "| P16/P17 |") }).status, "FAIL");
});
test("provider JSX outside the decorator cannot authorize empty decorators", () => {
  const input = { ...current, storybookPreview: current.storybookPreview.replace('decorators: [(Story, context)', 'unused: [(Story, context)') };
  assert.equal(validatePre02(input).status, "FAIL");
});
test("unexported configuration does not authorize a Storybook entry", () => {
  assert.equal(validatePre02({ ...current, storybookMain: current.storybookMain.replace('export default config;', '// export default config;') }).status, "FAIL");
});
test("initial theme cannot contradict the dark default contract", () => {
  assert.equal(validatePre02({ ...current, storybookPreview: current.storybookPreview.replace('defaultValue: "dark"', 'defaultValue: "light"') }).status, "FAIL");
});
