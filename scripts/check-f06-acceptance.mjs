#!/usr/bin/env node

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import process from "node:process";
import console from "node:console";

import {candidateArgument,resolveCandidate,candidateFile,candidateNote} from "./acceptance-candidate.mjs";
const root = resolve(import.meta.dirname, "..");
const archivePath = "docs/audit/F06-closed-findings-2026-09-25.md";
const requiredChecks = ["realOidcBff", "executionRoleAndVault", "denialMatrix"];

export function validateF06Acceptance({ plan, receipt, sourceCommit, archivedFindings }) {
  const failures = [];
  const marker = '<a id="task-f06"></a>';
  const sections = plan.split(marker);
  const section = sections.length === 2 ? sections[1].split('<a id=')[0] : null;
  if (!section) return { status: "FAIL", sourceCommit, failures: ["F06 task section is missing or duplicated"] };

  const summaries = [...section.matchAll(/^- 当前工程复核：(\S.*)$/gm)];
  const summary = summaries.length === 1 ? summaries[0][1] : "";
  const reviewStatuses = [...summary.matchAll(/历史正式复审：`([^`]+)`/g)];
  if (reviewStatuses.length !== 1 || reviewStatuses[0][1] !== "ACCEPTED") failures.push("F06 historical review is not uniquely ACCEPTED");
  // The plan summary only locates the historical closure. Acceptance still
  // requires all archived findings and a complete selected-candidate target receipt.
  const findings = archivedFindings;
  if (!summary.includes("./audit/F06-closed-findings-2026-09-25.md")) {
    failures.push("F06 closed findings archive link is missing");
  }
  const issueBlock = findings?.split("- issues:")[1]?.split("- fix_tracking:")[0] ?? "";
  const records = [...issueBlock.matchAll(/^ {2}- issue_id: ([^\n]+)\n([\s\S]*?)(?=^ {2}- issue_id: |$(?![\s\S]))/gm)];
  const expected = Array.from({ length: 10 }, (_, i) => `F06-A${String(i + 1).padStart(2, "0")}`);
  if (records.length !== 10 || expected.some((id) => records.filter((r) => r[1] === id).length !== 1)
      || records.some((r) => {
        const statuses = [...r[2].matchAll(/^ {4}status: (\S+)$/gm)];
        return statuses.length !== 1 || statuses[0][1] !== "CLOSED";
      })) failures.push("F06 findings are missing or still open");


  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt) || "receiptError" in receipt) {
    failures.push("F06 target acceptance receipt is missing or invalid");
  } else {
    if (receipt.schema !== "quantos-f06-target-acceptance/v2") failures.push("F06 target receipt schema is invalid");
    if (receipt.sourceCommit !== sourceCommit || !/^[a-f0-9]{40}$/.test(receipt.sourceCommit ?? "")) failures.push("receipt sourceCommit differs from selected candidate or is not a full SHA");
    if (receipt.status !== "PASS" || !Array.isArray(receipt.failures) || receipt.failures.length !== 0) {
      failures.push("F06 target receipt is not a clean PASS");
    }
    for (const key of requiredChecks) {
      if (receipt[key]?.status !== "PASS") failures.push(`${key} is not PASS`);
    }
  }
  return { status: failures.length ? "FAIL" : "PASS", sourceCommit, failures };
}

export function checkF06Candidate(candidate,{root:repository=root}={}) {
  const selection=resolveCandidate(candidate,{root:repository});
  const sourceCommit=selection.sourceCommit;
  const report=validateF06Acceptance({sourceCommit,plan:candidateFile(repository,sourceCommit,'docs/SumAlpha-QuantOS-Development-Plan.md').toString(),receipt:candidateNote(repository,sourceCommit,'f06-acceptance'),archivedFindings:candidateFile(repository,sourceCommit,archivePath).toString()});
  return {...report,...selection};
}
if (process.argv[1]&&import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
 try{const {candidate,remaining}=candidateArgument(process.argv.slice(2));if(remaining.length)throw Error('Usage: --candidate <SHA>');const report=checkF06Candidate(candidate);console.log(JSON.stringify(report));if(report.status!=='PASS')process.exitCode=1;}catch(e){console.error(e.message);process.exitCode=1;}
}
