import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateF06Acceptance } from "./check-f06-acceptance.mjs";

const plan = readFileSync(new URL("../docs/SumAlpha-QuantOS-Development-Plan.md", import.meta.url), "utf8");
const sourceCommit = "a".repeat(40);
const receipt = Object.fromEntries(["realOidcBff", "executionRoleAndVault", "denialMatrix", "developerRemoteP95"].map((key) => [key, { status: "PASS" }]));
receipt.sourceCommit = sourceCommit;

test("development COMPLETED does not accept the current F06 review", () => {
  const result = validateF06Acceptance({ plan, receipt, sourceCommit });
  assert.equal(result.status, "FAIL");
  assert(result.failures.includes("F06 review_status is not uniquely ACCEPTED"));
});

test("ACCEPTED with any open finding remains blocked", () => {
  const accepted = plan.replace(/(<a id="review-f06"><\/a>[\s\S]*?- review_status: `)FIX_VALIDATION(`)/, "$1ACCEPTED$2");
  const result = validateF06Acceptance({ plan: accepted, receipt, sourceCommit });
  assert(result.failures.includes("F06 findings are missing or still open"));
});

test("all closed findings require a same-SHA complete receipt", () => {
  const accepted = plan.replace(/(<a id="review-f06"><\/a>[\s\S]*?- review_status: `)FIX_VALIDATION(`)/, "$1ACCEPTED$2")
    .replace(/(  - issue_id: F06-A\d\d[\s\S]*?    status: )OPEN/g, "$1CLOSED");
  assert.equal(validateF06Acceptance({ plan: accepted, receipt, sourceCommit }).status, "PASS");
  assert(validateF06Acceptance({ plan: accepted, receipt: null, sourceCommit }).failures.some((failure) => failure.includes("receipt")));
  assert(validateF06Acceptance({ plan: accepted, receipt: { ...receipt, sourceCommit: "b".repeat(40) }, sourceCommit }).failures.some((failure) => failure.includes("sourceCommit")));
  assert(validateF06Acceptance({ plan: accepted, receipt: { ...receipt, denialMatrix: { status: "FAIL" } }, sourceCommit }).failures.includes("denialMatrix is not PASS"));
});

test("missing or duplicate review markers fail closed", () => {
  assert.equal(validateF06Acceptance({ plan: plan.replace('<a id="review-f06"></a>', ""), receipt, sourceCommit }).status, "FAIL");
  const duplicated = plan.replace("- review_status: `FIX_VALIDATION`", "- review_status: `FIX_VALIDATION`\n- review_status: `ACCEPTED`");
  assert(validateF06Acceptance({ plan: duplicated, receipt, sourceCommit }).failures.includes("F06 review_status is not uniquely ACCEPTED"));
});
