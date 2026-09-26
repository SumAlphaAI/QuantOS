import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const reportPath = process.argv[2];
assert(reportPath, "usage: node scripts/check-f08-rust-coverage.mjs REPORT_JSON [--require-branches]");
const report = JSON.parse(readFileSync(reportPath, "utf8"));
const waivers = JSON.parse(readFileSync(new URL("../docs/audit/F08-coverage-waivers.json", import.meta.url), "utf8"));
assert.equal(waivers.schema, "quantos-f08-coverage-waivers/v1");
const sources = [
  "crates/quantos-engine-manager/src/lib.rs",
  "crates/quantos-engine-manager/src/durable.rs",
  "crates/quantos-engine-manager/src/bin/f08-approval.rs",
];
const key = (span) => span.join(":");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const sumMetric = (parts) => {
  const count = parts.reduce((total, part) => total + part.count, 0);
  const covered = parts.reduce((total, part) => total + part.covered, 0);
  return { count, covered, percent: count ? 100 * covered / count : null };
};

const findings = [];
const results = sources.map((suffix) => {
  const matches = report.data.flatMap((item) => item.files).filter((item) => item.filename.endsWith(suffix));
  assert.equal(matches.length, 1, `${suffix}: missing or duplicate coverage entry`);
  const file = matches[0];
  for (const name of ["lines", "regions", "branches"]) {
    const metric = file.summary[name];
    assert(metric && Number.isInteger(metric.count) && Number.isInteger(metric.covered) && metric.count >= metric.covered && metric.covered >= 0, `${suffix}: invalid ${name} summary`);
  }
  const lines = readFileSync(suffix, "utf8").split("\n");
  const fileWaivers = waivers.items.filter((item) => item.file === suffix);
  const regionCounts = new Map();
  for (const data of report.data) {
    for (const fn of data.functions) {
      for (const region of fn.regions) {
        if (fn.filenames[region[5]] !== file.filename || region[6] !== 0) continue;
        const span = key(region.slice(0, 4));
        regionCounts.set(span, Math.max(regionCounts.get(span) ?? 0, region[4]));
      }
    }
  }
  const branches = new Map();
  for (const branch of file.branches ?? []) {
    const span = key(branch.slice(0, 4));
    const previous = branches.get(span) ?? [0, 0];
    branches.set(span, [previous[0] + branch[4], previous[1] + branch[5]]);
  }
  assert.equal(branches.size * 2, file.summary.branches.count, `${suffix}: branch span count changed`);

  const seen = new Set();
  let waivedRegions = 0;
  let waivedBranches = 0;
  for (const item of fileWaivers) {
    assert(["region", "branch"].includes(item.metric), `${suffix}: invalid waiver metric`);
    assert(Array.isArray(item.span) && item.span.length === 4 && item.span.every(Number.isInteger), `${suffix}: invalid waiver span`);
    assert(item.reason && item.ticket && item.lineSha256, `${suffix}: incomplete waiver`);
    const sourceLine = lines[item.span[0] - 1] ?? "";
    assert.equal(sha256(sourceLine), item.lineSha256, `${suffix}:${item.span[0]}: waiver source drift`);
    const permitted = {
      "host-error-conversion-region": /map_err\(|fs::|read_locked\(\)|write_all\(|sync_all\(|rename\(|lock poisoned/,
      "rust-declaration-region": /^\s*(pub struct|struct |type |#\[|pub [a-z_]+:)/,
      "llvm-synthetic-nonconditional-branch": /^(?!.*\b(?:if|while|match|for)\b)(?!.*(?:&&|\|\|)).*$/,
    }[item.category];
    assert(permitted?.test(sourceLine), `${suffix}:${item.span[0]}: waiver category does not match source`);
    assert.equal(item.metric === "branch", item.category === "llvm-synthetic-nonconditional-branch", `${suffix}: waiver metric/category mismatch`);
    const identity = `${item.metric}:${key(item.span)}`;
    assert(!seen.has(identity), `${suffix}: duplicate waiver ${identity}`);
    seen.add(identity);
    if (item.metric === "region") {
      const applicable = regionCounts.has(key(item.span));
      const used = applicable && regionCounts.get(key(item.span)) === 0;
      if (used) waivedRegions += 1;
      findings.push({ ...item, applicable, used });
    } else {
      const counts = branches.get(key(item.span));
      const applicable = Boolean(counts);
      const used = applicable && counts[0] === 0 && counts[1] === 0;
      if (used) waivedBranches += 2;
      findings.push({ ...item, applicable, used });
    }
  }

  // LLVM exports duplicate instantiations and macro expansions as separate line
  // counts. Count physical source lines once using executed segment unions.
  const executable = new Set();
  const hit = new Set();
  for (let index = 0; index < file.segments.length; index += 1) {
    const segment = file.segments[index];
    if (!segment[3]) continue;
    const next = file.segments[index + 1];
    const finalLine = Math.min(next ? next[0] - Number(next[1] === 1) : segment[0], lines.length);
    for (let line = segment[0]; line <= finalLine; line += 1) {
      executable.add(line);
      if (segment[2] > 0) hit.add(line);
    }
  }
  const physicalLines = { count: executable.size, covered: [...executable].filter((line) => hit.has(line)).length };
  physicalLines.percent = 100 * physicalLines.covered / physicalLines.count;
  const sourceBranches = { count: branches.size * 2, covered: [...branches.values()].reduce((n, counts) => n + Number(counts[0] > 0) + Number(counts[1] > 0), 0) };
  const adjustedBranches = { count: sourceBranches.count - waivedBranches, covered: sourceBranches.covered };
  const adjustedRegions = { count: file.summary.regions.count - waivedRegions, covered: file.summary.regions.covered };
  assert(adjustedRegions.count >= adjustedRegions.covered && adjustedBranches.count >= adjustedBranches.covered, `${suffix}: waiver exceeds uncovered metric`);
  return {
    file: suffix,
    raw: file.summary,
    sourceLines: physicalLines,
    sourceBranches,
    waived: { regions: waivedRegions, branchOutcomes: waivedBranches },
    adjusted: {
      regions: { ...adjustedRegions, percent: 100 * adjustedRegions.covered / adjustedRegions.count },
      branches: { ...adjustedBranches, percent: 100 * adjustedBranches.covered / adjustedBranches.count },
    },
  };
});
assert.equal(findings.length, waivers.items.length, "waiver references unmeasured source");
const totals = {
  raw: Object.fromEntries(["lines", "regions", "branches"].map((metric) => [metric, sumMetric(results.map((result) => result.raw[metric]))])),
  sourceLines: sumMetric(results.map((result) => result.sourceLines)),
  sourceBranches: sumMetric(results.map((result) => result.sourceBranches)),
  adjustedRegions: sumMetric(results.map((result) => result.adjusted.regions)),
  adjustedBranches: sumMetric(results.map((result) => result.adjusted.branches)),
};
console.log(JSON.stringify({ schema: "quantos-f08-rust-coverage/v2", files: results, totals, waivers: findings }, null, 2));
assert(totals.sourceLines.count && totals.sourceLines.percent >= 90, "F08 Rust physical source line coverage below 90%");
assert(totals.adjustedRegions.count && totals.adjustedRegions.percent >= 85, "F08 Rust audited region coverage below 85%");
if (process.argv.includes("--require-branches")) {
  assert(totals.adjustedBranches.count && totals.adjustedBranches.percent >= 85, "F08 Rust audited nightly branch coverage below 85%");
}
