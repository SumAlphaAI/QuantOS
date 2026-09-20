import fs from "node:fs";

const reportPath = process.argv[2];
if (!reportPath) {
  throw new Error("usage: node scripts/check-f04-branch.mjs <llvm-cov-report.json>");
}

const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const totals = report?.data?.[0]?.totals;
const branches = totals?.branches;
if (!branches || branches.count <= 0) {
  throw new Error("F04 branch report contains no instrumented branches");
}
if (branches.percent < 90) {
  throw new Error(
    `F04 branch coverage ${branches.percent.toFixed(2)}% is below 90% (${branches.covered}/${branches.count})`,
  );
}

console.log(
  JSON.stringify({
    acceptance: "PASS",
    branchPercent: Number(branches.percent.toFixed(2)),
    coveredBranches: branches.covered,
    totalBranches: branches.count,
    linePercent: Number(totals.lines.percent.toFixed(2)),
    regionPercent: Number(totals.regions.percent.toFixed(2)),
  }),
);
