import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  classifyScenario,
  loadJson,
  renderCandidateIssue,
  renderDecisionRecord,
} from "../sync-vibe-lib.mjs";

const repoRoot = path.resolve(new URL("../..", import.meta.url).pathname);
const baseline = loadJson(
  path.join(repoRoot, "third_party/vibe-trading/baseline.lock.json"),
);
const patchQueue = loadJson(
  path.join(repoRoot, "forks/vibe-trading/patch-queue/queue.json"),
);

function scenario(name) {
  return loadJson(path.join(repoRoot, "scripts/fixtures/tp01-vibe-sync", `${name}.json`));
}

test("classify api break as blocked S1", () => {
  const decision = classifyScenario({
    baseline,
    patchQueue,
    scenario: scenario("api-break"),
  });
  assert.equal(decision.severity, "S1");
  assert.equal(decision.blocked, true);
  assert.match(renderDecisionRecord(decision), /adapter API \/ contract breakage/);
});

test("classify license drift as blocked S1", () => {
  const decision = classifyScenario({
    baseline,
    patchQueue,
    scenario: scenario("license-change"),
  });
  assert.equal(decision.severity, "S1");
  assert.equal(decision.blocked, true);
});

test("classify high CVE as blocked S0", () => {
  const decision = classifyScenario({
    baseline,
    patchQueue,
    scenario: scenario("cve-high"),
  });
  assert.equal(decision.severity, "S0");
  assert.equal(decision.blocked, true);
  assert.match(renderCandidateIssue(decision), /CVE-2026-9001/);
});

test("classify patch conflict as blocked S1 with overlap summary", () => {
  const decision = classifyScenario({
    baseline,
    patchQueue,
    scenario: scenario("patch-conflict"),
  });
  assert.equal(decision.severity, "S1");
  assert.equal(decision.blocked, true);
  assert.equal(decision.rangeDiffSummary[0].queueId, "0001");
});

test("classify planned sync as non-blocking S2", () => {
  const decision = classifyScenario({
    baseline,
    patchQueue,
    scenario: scenario("planned-sync"),
  });
  assert.equal(decision.severity, "S2");
  assert.equal(decision.blocked, false);
});

test("classify research drift as non-blocking S3", () => {
  const decision = classifyScenario({
    baseline,
    patchQueue,
    scenario: scenario("research-drift"),
  });
  assert.equal(decision.severity, "S3");
  assert.equal(decision.blocked, false);
});
