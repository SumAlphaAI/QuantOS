import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repoRoot = path.resolve(new URL("../..", import.meta.url).pathname);
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(repoRoot, name), "utf8"));
const baseline = readJson("third_party/vibe-trading/baseline.lock.json");
// Immutable monitor evidence, not the missing original failed live decisions.
const originalReport = readJson("docs/audit/evidence/ci-acceptance-41a3b27-20261008/tp01-upstream-monitor/upstream-candidates.json");
// The standalone workflow installs Node only. Keep these tests dependency-free.
const workflow = fs.readFileSync(path.join(repoRoot, ".github/workflows/tp01_vibe_sync_gate.yml"), "utf8");
function workflowStep(name) {
  const block = workflow.split(`      - name: ${name}\n`)[1]?.split("\n      - name:")[0];
  assert.ok(block, `missing workflow step: ${name}`);
  const run = block.match(/^        run: [|>]\n((?:          .*\n?)+)/m)?.[1]
    ?.split("\n").map((line) => line.slice(10)).join("\n")
    ?? block.match(/^        run: (.+)$/m)?.[1];
  return { block, run };
}

function fixture(t, report = originalReport) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "quantos-tp01-sync-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const input = path.join(root, "candidate-report.json");
  fs.writeFileSync(input, JSON.stringify(report));
  const output = path.join(root, "summary.json");
  const cli = (extra = []) => spawnSync(process.execPath, [
    path.join(repoRoot, "scripts/sync-vibe.mjs"),
    "--baseline", path.join(repoRoot, "third_party/vibe-trading/baseline.lock.json"),
    "--patch-queue", path.join(repoRoot, "forks/vibe-trading/patch-queue/queue.json"),
    "--candidate-report", input,
    "--json-output", output,
    "--markdown-output", path.join(root, "summary.md"),
    "--decision-dir", path.join(root, "decisions"),
    "--issue-dir", path.join(root, "issues"), ...extra,
  ], { encoding: "utf8", timeout: 15000 });
  return { root, input, output, cli };
}

test("monitor succeeds with visible BLOCKED decisions and no sync approval", (t) => {
  const f = fixture(t);
  const result = f.cli(["--monitor-only"]);
  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(fs.readFileSync(f.output, "utf8"));
  assert.equal(summary.executionMode, "monitor");
  assert.equal(summary.monitoringStatus, "COMPLETED");
  assert.equal(summary.syncGateStatus, "BLOCKED");
  assert.equal(summary.blockedCandidateCount, 1);
  assert.equal(summary.syncApproved, false);
  assert.deepEqual(summary.decisions.map((d) => [d.severity, d.blocked]), [["S3", false], ["S1", true]]);
  assert.match(result.stderr, /::warning::.*BLOCKED/);
  assert.equal(fs.readdirSync(path.join(f.root, "decisions")).length, 2);
  assert.equal(fs.readdirSync(path.join(f.root, "issues")).length, 2);
  assert.match(fs.readFileSync(path.join(f.root, "summary.md"), "utf8"), /sync gate status: `BLOCKED`/);
});

test("strict sync gate still exits 2 and writes all blocked evidence", (t) => {
  const f = fixture(t);
  const result = f.cli(["--fail-on-block"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /TP01-E blocked/);
  const summary = JSON.parse(fs.readFileSync(f.output, "utf8"));
  assert.equal(summary.executionMode, "gate");
  assert.equal(summary.syncGateStatus, "BLOCKED");
  assert.equal(summary.syncApproved, false);
  assert.equal(fs.readdirSync(path.join(f.root, "decisions")).length, 2);
});

test("empty valid monitor report is CLEAR without approving adoption", (t) => {
  const f = fixture(t, { ...originalReport, candidates: [] });
  assert.equal(f.cli(["--monitor-only"]).status, 0);
  const summary = JSON.parse(fs.readFileSync(f.output, "utf8"));
  assert.equal(summary.syncGateStatus, "CLEAR");
  assert.equal(summary.blockedCandidateCount, 0);
  assert.equal(summary.syncApproved, false);
});

test("upstream S0 is retained even without detailed scenario advisories", (t) => {
  const report = structuredClone(originalReport);
  report.candidates = [{ ...report.candidates[0], severity: "S0" }];
  const f = fixture(t, report);
  assert.equal(f.cli(["--fail-on-block"]).status, 2);
  const summary = JSON.parse(fs.readFileSync(f.output, "utf8"));
  assert.equal(summary.decisions[0].severity, "S0");
  assert.equal(summary.decisions[0].blocked, true);
});

for (const [name, mutate] of [
  ["missing candidates", (r) => { delete r.candidates; }],
  ["unsupported schema", (r) => { r.schemaVersion = 999; }],
  ["stale baseline", (r) => { r.baseline.upstream.commit = "0".repeat(40); }],
  ["unknown severity", (r) => { r.candidates[0].severity = "UNKNOWN"; }],
  ["mutable candidate ref", (r) => { r.candidates[0].ref = "main"; }],
  ["missing release digests", (r) => { delete r.candidates[1].digests; }],
]) {
  test(`monitor rejects ${name} as execution failure`, (t) => {
    const report = structuredClone(originalReport);
    mutate(report);
    const f = fixture(t, report);
    const result = f.cli(["--monitor-only"]);
    assert.equal(result.status, 1, result.stderr);
    assert.equal(fs.existsSync(f.output), false);
  });
}

test("monitor rejects unreadable JSON instead of reporting success", (t) => {
  const f = fixture(t);
  fs.writeFileSync(f.input, "{");
  assert.equal(f.cli(["--monitor-only"]).status, 1);
  assert.equal(fs.existsSync(f.output), false);
});

for (const flags of [["--fail-on-block"], ["--verify-expected"], ["--scenario", "unused.json"]]) {
  test(`monitor cannot bypass gate/simulation flags ${flags[0]}`, (t) => {
    const f = fixture(t);
    const result = f.cli(["--monitor-only", ...flags]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /cannot be combined/);
  });
}

for (const event of ["schedule", "workflow_dispatch"]) {
  test(`actual workflow shell keeps ${event} semantics and publishes failure evidence`, (t) => {
    const f = fixture(t);
    // Copy entrypoints so import.meta resolves inside this fixture, not a symlink's source.
    fs.mkdirSync(path.join(f.root, "scripts"));
    for (const name of ["sync-vibe.mjs", "sync-vibe-lib.mjs"]) {
      fs.copyFileSync(path.join(repoRoot, "scripts", name), path.join(f.root, "scripts", name));
    }
    for (const dir of ["third_party", "forks"]) {
      fs.symlinkSync(path.join(repoRoot, dir), path.join(f.root, dir));
    }
    const artifactRoot = path.join(f.root, "artifacts/third_party/vibe-trading");
    fs.mkdirSync(artifactRoot, { recursive: true });
    fs.copyFileSync(f.input, path.join(artifactRoot, "upstream-candidates.json"));
    const evaluate = workflowStep("Evaluate live sync candidates");
    const result = spawnSync("bash", ["-e", "-o", "pipefail", "-c", evaluate.run], {
      cwd: f.root, env: { ...process.env, SYNC_EVENT: event }, encoding: "utf8", timeout: 15000,
    });
    assert.equal(result.status, event === "schedule" ? 0 : 2, result.stderr);
    const summary = JSON.parse(fs.readFileSync(path.join(artifactRoot, "sync-vibe/live-summary.json")));
    assert.equal(summary.syncGateStatus, "BLOCKED");
    assert.equal(summary.syncApproved, false);
    const publish = workflowStep("Publish workflow summary");
    const upload = workflowStep("Upload live sync artifacts");
    assert.match(publish.block, /^        if: always\(\)$/m);
    assert.match(upload.block, /^        if: always\(\)$/m);
    assert.match(upload.block, /if-no-files-found: error/);
    assert.match(upload.block, /upstream-candidates\.json/);
    const summaryFile = path.join(f.root, "github-summary.md");
    const published = spawnSync("bash", ["-e", "-o", "pipefail", "-c", publish.run], {
      cwd: f.root, env: { ...process.env, GITHUB_STEP_SUMMARY: summaryFile }, encoding: "utf8",
    });
    assert.equal(published.status, 0, published.stderr);
    assert.match(fs.readFileSync(summaryFile, "utf8"), /sync gate status: `BLOCKED`/);
    assert.equal(fs.readdirSync(path.join(artifactRoot, "sync-vibe/live-decisions")).length, 2);
  });
}

test("simulation workflow retains all six scenarios and expected-result assertions", () => {
  for (const scenario of ["api-break", "license-change", "cve-high", "patch-conflict", "planned-sync", "research-drift"]) {
    assert.ok(workflow.includes(`          - ${scenario}\n`));
  }
  const evaluate = workflowStep("Evaluate simulation scenario");
  assert.match(evaluate.run, /--verify-expected/);
  assert.doesNotMatch(evaluate.run, /--monitor-only/);
  assert.match(workflowStep("Upload simulation artifacts").block, /^        if: always\(\)$/m);
  assert.equal(baseline.upstream.commit, originalReport.baseline.upstream.commit);
});
