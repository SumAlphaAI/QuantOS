import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { validateRuns } from "./f04-measurements.mjs";

test("P95 gate rejects absent, nonnumeric and over-budget measurements", () => {
  const good = { digest: `sha256:${"a".repeat(64)}`, fixtures: 1000, p95Micros: 30 };
  assert.equal(validateRuns(good, good).acceptance, "PASS");
  for (const bad of [undefined, null, "1", NaN, Infinity, -1, 50_000]) {
    assert.throws(() => validateRuns(good, { ...good, p95Micros: bad }));
  }
  assert.throws(() => validateRuns(good, { ...good, fixtures: 999 }));
  assert.throws(() => validateRuns(good, { ...good, digest: `sha256:${"b".repeat(64)}` }));
});

function report(count = 100, covered = 95) {
  return { data: [{ totals: {
    branches: { count, covered, percent: covered / count * 100 },
    lines: { percent: 100 }, regions: { percent: 100 },
  }, files: [{ filename: "/repo/crates/quantos-core/src/precision.rs",
    summary: { branches: { count: 10, covered: 10 } } }] }] };
}

test("branch gate rejects missing, fabricated, low and empty measurements", () => {
  const directory = mkdtempSync(join(tmpdir(), "f04-gate-"));
  try {
    const cases = [[report(), true], [report(100, 89), false], [report(0, 0), false]];
    const missing = report(); delete missing.data[0].totals.branches.percent;
    const forged = report(100, 1); forged.data[0].totals.branches.percent = 100;
    const negative = report(100, -1);
    const lowPrecision = report(); lowPrecision.data[0].files[0].summary.branches.covered = 8;
    const missingFile = report(); missingFile.data[0].files = [];
    for (const bad of [missing, forged, negative, lowPrecision, missingFile, {}]) cases.push([bad, false]);
    for (const [value, pass] of cases) {
      const path = join(directory, "report.json");
      writeFileSync(path, JSON.stringify(value));
      const result = spawnSync(process.execPath, ["scripts/check-f04-branch.mjs", path]);
      assert.equal(result.status === 0, pass, JSON.stringify(value));
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("nightly workflow explicitly overrides the repository stable toolchain", () => {
  const workflow = readFileSync(".github/workflows/f04-core-nightly.yml", "utf8");
  assert.match(workflow, /RUSTUP_TOOLCHAIN: nightly/);
  assert.match(workflow, /cargo-llvm-cov --version 0\.8\.7 --locked/);
  assert.match(workflow, /scripts\/check-f04\*\.mjs/);
});
