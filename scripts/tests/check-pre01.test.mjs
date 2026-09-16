import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { validatePre01 } from "../check-pre01.mjs";

const root = resolve(new URL("../..", import.meta.url).pathname);
const valid = {
  ledger: readFileSync(resolve(root, "docs/PRE-01-page-ledger-and-stories.md"), "utf8"),
  matrix: readFileSync(resolve(root, "docs/PRE-01-route-permission-matrix.md"), "utf8"),
  scenarios: readFileSync(resolve(root, "docs/PRE-01-acceptance-scenarios.md"), "utf8"),
};

test("current PRE-01 artifacts satisfy the executable contract", () => {
  const report = validatePre01(valid);
  assert.deepEqual(
    { pages: report.pages, scenarios: report.acceptance_scenarios, traceability: report.traceability_rows },
    { pages: 31, scenarios: 217, traceability: 31 },
  );
});

test("missing a page state fails closed", () => {
  const broken = { ...valid, scenarios: valid.scenarios.replace(/^\| ACC-WEB-03-S7 .*\n/m, "") };
  assert.throws(() => validatePre01(broken), /acceptance scenarios must define S1\.\.S7/);
});

test("invalid story priority fails closed", () => {
  const broken = { ...valid, ledger: valid.ledger.replace(/(\| ST-P01-01 .*?\| )P0( \|)/, "$1P2$2") };
  assert.throws(() => validatePre01(broken), /ST-P01-01: invalid priority/);
});

test("missing traceability row fails closed", () => {
  const broken = { ...valid, scenarios: valid.scenarios.replace(/^\| P23 \|.*\n/m, "") };
  assert.throws(() => validatePre01(broken), /traceability table must contain every page/);
});
