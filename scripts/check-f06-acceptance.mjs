#!/usr/bin/env node

import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const plan = readFileSync(resolve(root, "docs/SumAlpha-QuantOS-Development-Plan.md"), "utf8");
const section = plan.split('<a id="review-f06"></a>')[1]?.split('<a id="task-f07"></a>')[0] ?? "";
const receiptPath = resolve(root, "docs/audit/F06-target-acceptance-receipt.json");
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const failures = [];
if (!section.includes("- review_status: `ACCEPTED`")) failures.push("F06 review_status is not ACCEPTED");
if (/\bstatus: OPEN\b/.test(section)) failures.push("F06 still has open findings");
if (!existsSync(receiptPath)) {
  failures.push("F06 target acceptance receipt is missing");
} else {
  const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
  if (receipt.sourceCommit !== sourceCommit) failures.push("receipt sourceCommit differs from HEAD");
  for (const key of ["realOidcBff", "executionRoleAndVault", "denialMatrix", "developerRemoteP95", "sameRegionP95"]) {
    if (receipt[key]?.status !== "PASS") failures.push(`${key} is not PASS`);
  }
}
console.log(JSON.stringify({ status: failures.length ? "FAIL" : "PASS", sourceCommit, failures }));
if (failures.length) process.exitCode = 1;
