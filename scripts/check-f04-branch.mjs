import fs from "node:fs";

const reportPath = process.argv[2];
if (!reportPath) {
  throw new Error("usage: node scripts/check-f04-branch.mjs <llvm-cov-report.json>");
}

const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const totals = report?.data?.[0]?.totals;
const branches = totals?.branches;
if (!branches || !Number.isSafeInteger(branches.count) || branches.count <= 0 ||
    !Number.isSafeInteger(branches.covered) || branches.covered < 0 ||
    branches.covered > branches.count) {
  throw new Error("F04 branch report contains no instrumented branches");
}
const percent = branches.covered / branches.count * 100;
if (!Number.isFinite(branches.percent) || Math.abs(branches.percent - percent) > 0.01) {
  throw new Error("F04 branch percentage does not match its counters");
}
if (percent < 90) {
  throw new Error(
    `F04 branch coverage ${branches.percent.toFixed(2)}% is below 90% (${branches.covered}/${branches.count})`,
  );
}

// The F04 precision threshold must not be hidden by unrelated branches.
const precision = report.data[0].files?.find((file) =>
  file.filename.replaceAll("\\", "/").endsWith("/quantos-core/src/precision.rs"));
const precisionBranches = precision?.summary?.branches;
if (!precisionBranches || !Number.isSafeInteger(precisionBranches.count) ||
    precisionBranches.count <= 0 || !Number.isSafeInteger(precisionBranches.covered) ||
    precisionBranches.covered < 0 || precisionBranches.covered > precisionBranches.count ||
    precisionBranches.covered / precisionBranches.count < 0.9) {
  throw new Error("F04 precision.rs requires at least 90% measured branch coverage");
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
