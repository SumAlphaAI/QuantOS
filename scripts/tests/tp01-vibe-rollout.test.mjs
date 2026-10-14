import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  applyRollback,
  buildRolloutState,
  evaluateRollout,
  loadJson,
  renderDrillReportMarkdown,
} from "../tp01-vibe-rollout-lib.mjs";

const repoRoot = path.resolve(new URL("../..", import.meta.url).pathname);
const policyDocument = loadJson(
  path.join(repoRoot, "third_party/vibe-trading/canary-policy.json"),
);

function loadScenario(name) {
  return loadJson(
    path.join(repoRoot, "scripts/fixtures/tp01-vibe-canary", `${name}.json`),
  );
}

test("healthy seven day canary passes and enables the capability", () => {
  const result = evaluateRollout({
    policyDocument,
    scenario: loadScenario("healthy-7d"),
  });
  assert.equal(result.outcome, "canary_passed");
  assert.equal(result.blocked, false);
  assert.equal(result.capabilityFlag.state, "enabled");
  assert.equal(result.alerts.length, 0);
});

test("critical breach disables the capability and blocks rollout", () => {
  const result = evaluateRollout({
    policyDocument,
    scenario: loadScenario("alert-breach"),
  });
  assert.equal(result.outcome, "disabled");
  assert.equal(result.blocked, true);
  assert.equal(result.capabilityFlag.state, "disabled");
  assert.ok(result.alerts.some((alert) => alert.rule_id === "tp01_vibe_unexplained_p1"));
  assert.ok(
    result.alerts.some((alert) => alert.rule_id === "tp01_vibe_unauthorized_egress_total"),
  );
});

test("rollback drill completes within SLA and records drill evidence", () => {
  const result = evaluateRollout({
    policyDocument,
    scenario: loadScenario("rollback-drill"),
  });
  assert.equal(result.outcome, "rolled_back");
  assert.equal(result.blocked, false);
  assert.match(renderDrillReportMarkdown(result), /240.0s/);
});

test("one-click rollback restores the previous release", () => {
  const result = evaluateRollout({
    policyDocument,
    scenario: loadScenario("healthy-7d"),
  });
  const state = buildRolloutState(result);
  const next = applyRollback({
    state,
    action: "rollback",
    reason: "operator drill",
    completedAt: "2026-07-30T15:00:00.000Z",
  });
  assert.equal(next.status, "rolled_back");
  assert.equal(next.capabilityFlag.state, "rolled_back");
  assert.equal(next.activeRelease.releaseId, "vibe-adapter-disabled-baseline");
});

test("synthetic success never grants target or formal acceptance", () => {
  const r = evaluateRollout({policyDocument, scenario: loadScenario("healthy-7d")});
  assert.equal(r.evidenceMode, "SYNTHETIC_POLICY_SIMULATION");
  assert.equal(r.targetCanaryAccepted, false);
  assert.equal(r.formalAccepted, false);
});

test("missing shadow evidence blocks a healthy-looking window", () => {
  const scenario = loadScenario("healthy-7d");
  scenario.observations.shadowTasksCompleted = 0;
  const r = evaluateRollout({policyDocument, scenario});
  assert.equal(r.blocked, true);
  assert.equal(r.capabilityFlag.rolloutPercent, 0);
});

test("rollback without measured duration cannot pass", () => {
  const scenario = loadScenario("rollback-drill");
  scenario.observations.rollbackCompletedSecs = null;
  const r = evaluateRollout({policyDocument, scenario});
  assert.equal(r.outcome, "rollback_failed");
  assert.equal(r.blocked, true);
});

for (const value of [undefined, NaN, Infinity, -1, "0", true]) {
  test("malformed metric rejects " + String(value), () => {
    const scenario = loadScenario("healthy-7d");
    scenario.observations.unexplainedP1 = value;
    assert.throws(() => evaluateRollout({policyDocument, scenario}), /INVALID_SIMULATION/);
  });
}

test("disable retains critical incident evidence and blocking status", () => {
  const r = evaluateRollout({policyDocument, scenario: loadScenario("alert-breach")});
  const state = buildRolloutState(r);
  const next = applyRollback({state, action:"disable", reason:"critical incident"});
  assert.equal(next.blocked, true);
  assert.deepEqual(next.latestEvaluation.alerts, state.latestEvaluation.alerts);
  assert.equal(next.capabilityFlag.rolloutPercent, 0);
});

test("rollback without a previous release or reason is refused", () => {
  const state = buildRolloutState(evaluateRollout({policyDocument, scenario:loadScenario("healthy-7d")}));
  assert.throws(() => applyRollback({state, action:"disable", reason:""}), /INVALID_ROLLBACK/);
  delete state.previousRelease;
  assert.throws(() => applyRollback({state, action:"rollback", reason:"drill"}), /INVALID_ROLLBACK/);
});
