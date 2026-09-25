#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const requiredChecks = ["realOidcBff", "executionRoleAndVault", "denialMatrix"];

export function validateF06Acceptance({ plan, receipt, sourceCommit }) {
  const failures = [];
  const section = plan.split('<a id="review-f06"></a>')[1]?.split('<a id="task-f07"></a>')[0];
  if (!section) return { status: "FAIL", sourceCommit, failures: ["F06 review section is missing"] };

  const reviewStatuses = [...section.matchAll(/^\s*- review_status: `([^`]+)`\s*$/gm)];
  if (reviewStatuses.length !== 1 || reviewStatuses[0][1] !== "ACCEPTED") failures.push("F06 review_status is not uniquely ACCEPTED");
  const issueStatuses = [...section.matchAll(/^\s*status: (OPEN|CLOSED)\s*$/gm)].map((match) => match[1]);
  if (issueStatuses.length !== 10 || issueStatuses.some((status) => status !== "CLOSED")) failures.push("F06 findings are missing or still open");

  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt) || "receiptError" in receipt) {
    failures.push("F06 target acceptance receipt is missing or invalid");
  } else {
    if (receipt.schema !== "quantos-f06-target-acceptance/v2") failures.push("F06 target receipt schema is invalid");
    if (receipt.sourceCommit !== sourceCommit || !/^[a-f0-9]{40}$/.test(receipt.sourceCommit ?? "")) failures.push("receipt sourceCommit differs from HEAD or is not a full SHA");
    if (receipt.status !== "PASS" || !Array.isArray(receipt.failures) || receipt.failures.length !== 0) {
      failures.push("F06 target receipt is not a clean PASS");
    }
    for (const key of requiredChecks) {
      if (receipt[key]?.status !== "PASS") failures.push(`${key} is not PASS`);
    }
  }
  return { status: failures.length ? "FAIL" : "PASS", sourceCommit, failures };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const plan = readFileSync(resolve(root, "docs/SumAlpha-QuantOS-Development-Plan.md"), "utf8");
  let receipt = null;
  try {
    receipt = JSON.parse(execFileSync("git", ["notes", "--ref=refs/notes/f06-acceptance", "show", sourceCommit],
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
  } catch (error) {
    receipt = { receiptError: error.message };
  }
  const report = validateF06Acceptance({ plan, receipt, sourceCommit });
  if (execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim()) {
    report.failures.push("working tree is not clean");
    report.status = "FAIL";
  }
  console.log(JSON.stringify(report));
  if (report.failures.length) process.exitCode = 1;
}
