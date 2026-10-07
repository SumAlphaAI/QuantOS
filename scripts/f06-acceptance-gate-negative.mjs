import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { URL } from "node:url";

import { validateF06Acceptance as validate } from "./check-f06-acceptance.mjs";

const plan = readFileSync(new URL("../docs/SumAlpha-QuantOS-Development-Plan.md", import.meta.url), "utf8");
const archivedFindings = readFileSync(new URL("../docs/audit/F06-closed-findings-2026-09-25.md", import.meta.url), "utf8");
const validateF06Acceptance = (input) => validate({ archivedFindings, ...input });
const sourceCommit = "a".repeat(40);
const receipt = Object.fromEntries(["realOidcBff", "executionRoleAndVault", "denialMatrix"].map((key) => [key, { status: "PASS" }]));
receipt.sourceCommit = sourceCommit;
receipt.schema = "quantos-f06-target-acceptance/v2";
receipt.status = "PASS";
receipt.failures = [];
const accepted = plan;

test("development COMPLETED does not accept the current F06 review", () => {
  const pending = accepted.replace(/(历史正式复审：`)ACCEPTED(`；F06-A01)/, "$1FIX_VALIDATION$2");
  const result = validateF06Acceptance({ plan: pending, receipt, sourceCommit });
  assert.equal(result.status, "FAIL");
  assert(result.failures.includes("F06 historical review is not uniquely ACCEPTED"));
});

test("ACCEPTED with any open finding remains blocked", () => {
  const open = archivedFindings.replace(/( {2}- issue_id: F06-A03[\s\S]*? {4}status: )CLOSED/, "$1OPEN");
  const result = validateF06Acceptance({ plan: accepted, archivedFindings: open, receipt, sourceCommit });
  assert(result.failures.includes("F06 findings are missing or still open"));
});

test("all closed findings require a same-SHA complete receipt", () => {
  assert.equal(validateF06Acceptance({ plan: accepted, receipt, sourceCommit }).status, "PASS");
  assert(validateF06Acceptance({ plan: accepted, receipt: null, sourceCommit }).failures.some((failure) => failure.includes("receipt")));
  assert(validateF06Acceptance({ plan: accepted, receipt: { ...receipt, sourceCommit: "b".repeat(40) }, sourceCommit }).failures.some((failure) => failure.includes("sourceCommit")));
  assert(validateF06Acceptance({ plan: accepted, receipt: { ...receipt, realOidcBff: { status: "FAIL" } }, sourceCommit }).failures.includes("realOidcBff is not PASS"));
  assert(validateF06Acceptance({ plan: accepted, receipt: { ...receipt, executionRoleAndVault: { status: "FAIL" } }, sourceCommit }).failures.includes("executionRoleAndVault is not PASS"));
  assert(validateF06Acceptance({ plan: accepted, receipt: { ...receipt, denialMatrix: { status: "FAIL" } }, sourceCommit }).failures.includes("denialMatrix is not PASS"));
  assert(validateF06Acceptance({ plan: accepted, receipt: { ...receipt, status: "FAIL" }, sourceCommit }).failures.includes("F06 target receipt is not a clean PASS"));
  assert(validateF06Acceptance({ plan: accepted, receipt: { ...receipt, failures: ["unresolved"] }, sourceCommit }).failures.includes("F06 target receipt is not a clean PASS"));
  assert.equal(validateF06Acceptance({ plan: accepted, receipt: { ...receipt, developerRemoteP95: { status: "FAIL" } }, sourceCommit }).status, "PASS");
  assert(validateF06Acceptance({ plan: accepted, receipt: { ...receipt, schema: "quantos-f06-target-acceptance/v1" }, sourceCommit }).failures.includes("F06 target receipt schema is invalid"));
  assert(validateF06Acceptance({ plan: accepted, receipt: { ...receipt, schema: "unknown" }, sourceCommit }).failures.includes("F06 target receipt schema is invalid"));
});

test("missing or duplicate review markers fail closed", () => {
  assert.equal(validateF06Acceptance({ plan: plan.replace('<a id="task-f06"></a>', ""), receipt, sourceCommit }).status, "FAIL");
  const duplicated = accepted.replace(/(历史正式复审：`)ACCEPTED(`；F06-A01)/, "$1FIX_VALIDATION`；历史正式复审：`ACCEPTED$2");
  assert(validateF06Acceptance({ plan: duplicated, receipt, sourceCommit }).failures.includes("F06 historical review is not uniquely ACCEPTED"));
});

test("archived closure records must be present, complete and unique", () => {
  for (const content of [null, "", archivedFindings.replace("issue_id: F06-A03", "issue_id: F06-A02"),
    archivedFindings.replace("    status: CLOSED", "    status: FIX_VALIDATION"),
    archivedFindings.replace("    status: CLOSED", "    status: CLOSED\n    status: OPEN")]) {
    assert.equal(validateF06Acceptance({ plan: accepted, archivedFindings: content, receipt, sourceCommit }).status, "FAIL");
  }
  const unlinked = accepted.replace("./audit/F06-closed-findings-2026-09-25.md", "./audit/missing.md");
  assert.equal(validateF06Acceptance({ plan: unlinked, receipt, sourceCommit }).status, "FAIL");
});


test("duplicate F06 task or engineering summaries fail closed", () => {
  const summary = accepted.match(/^- 当前工程复核：.*F06-A01–A10.*$/m)[0];
  for (const changed of [accepted.replace(summary, summary + "\n" + summary), accepted + '\n<a id="task-f06"></a>\n']) {
    assert.equal(validateF06Acceptance({ plan: changed, receipt, sourceCommit }).status, "FAIL");
  }
});
