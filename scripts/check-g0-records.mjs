#!/usr/bin/env node

import { readFileSync } from "node:fs";

const readiness = readFileSync("docs/gate-records/G0-readiness-assessment.md", "utf8");
const review = readFileSync("docs/gate-records/G0-PRE-01-review-record.md", "utf8");
const summaries = [1, 2, 3, 4, 5, 6]
  .map((number) => {
    const prefix = `docs/PRE-0${number}`;
    const file = number === 1 ? `${prefix}-summary-and-risks.md` : `${prefix}-summary.md`;
    return [file, readFileSync(file, "utf8")];
  });

const failures = [];
const forbidden = [
  "状态：交付待评审",
  "当前状态\"待联合评审签署\"",
  "页面级 BFF OpenAPI 不存在",
  "页面级 BFF OpenAPI 完全缺失",
  "GAP-01–17 全部 Open",
  "G0 放行仍依赖",
  "列为 G0 前人工验证项",
  "当前 mock schema 为过渡自著版",
];

for (const [file, content] of [
  ["docs/gate-records/G0-readiness-assessment.md", readiness],
  ["docs/gate-records/G0-PRE-01-review-record.md", review],
  ...summaries,
]) {
  for (const phrase of forbidden) {
    if (content.includes(phrase)) failures.push(`${file}: stale contradiction: ${phrase}`);
  }
}

if (!review.includes("- [x] 六方全部签署通过")) failures.push("six-party approval checkbox is not checked");
if (!readiness.includes("G0 五项条件全部满足")) failures.push("readiness conclusion is not an explicit five-condition pass");

const ledger = review.split("## 3. 评审结论记录")[1]?.split("## 4. 修订记录")[0] ?? "";
const rows = ledger.split("\n").filter((line) => line.startsWith("|") && /^\| [^-(]/.test(line));
let populatedRows = 0;
for (const row of rows) {
  const cells = row.split("|").slice(1, -1).map((cell) => cell.trim());
  if (cells.length !== 4) continue;
  const [item, owner, deadline, strategy] = cells;
  if (item === "遗留项") continue;
  populatedRows += 1;
  if (!item || !owner || !/^2026-\d{2}-\d{2}$/.test(deadline) || !strategy) {
    failures.push(`incomplete post-G0 ledger row: ${row}`);
  }
}
if (populatedRows < 10) failures.push(`post-G0 ledger has only ${populatedRows} populated rows; expected at least 10`);

if (failures.length > 0) {
  failures.forEach((failure) => console.error(`FAIL  ${failure}`));
  process.exit(1);
}

console.log(`G0 records passed: six-party confirmation recorded, ${populatedRows} dated compatibility ledger rows, no stale contradictions.`);
