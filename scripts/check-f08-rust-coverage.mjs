import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const file = process.argv[2];
assert(file, "usage: node scripts/check-f08-rust-coverage.mjs REPORT_JSON");
const report = JSON.parse(readFileSync(file, "utf8"));
const sources = [
  "crates/quantos-engine-manager/src/lib.rs",
  "crates/quantos-engine-manager/src/bin/f08-approval.rs",
];
const results = sources.map((suffix) => {
  const matches = report.data.flatMap((item) => item.files).filter((item) => item.filename.endsWith(suffix));
  assert.equal(matches.length, 1, `${suffix}: missing or duplicate coverage entry`);
  const summary = matches[0].summary;
  const metrics = Object.fromEntries(["lines", "regions", "branches"].map((name) => {
    const value = summary[name];
    assert(value && Number.isInteger(value.count) && Number.isInteger(value.covered) && value.count >= value.covered, `${suffix}: invalid ${name} coverage`);
    return [name, value];
  }));
  return { file: suffix, metrics };
});
const totals = Object.fromEntries(["lines", "regions", "branches"].map((name) => {
  const count = results.reduce((sum, item) => sum + item.metrics[name].count, 0);
  const covered = results.reduce((sum, item) => sum + item.metrics[name].covered, 0);
  return [name, { count, covered, percent: count ? 100 * covered / count : null }];
}));
console.log(JSON.stringify({ schema: "quantos-f08-rust-coverage/v1", files: results, totals }, null, 2));
assert(totals.lines.count && totals.lines.percent >= 90, "F08 Rust line coverage below 90%");
assert(totals.regions.count && totals.regions.percent >= 85, "F08 Rust region coverage below 85%");
if (process.argv.includes("--require-branches")) {
  assert(totals.branches.count && totals.branches.percent >= 85, "F08 Rust nightly branch coverage below 85%");
}
