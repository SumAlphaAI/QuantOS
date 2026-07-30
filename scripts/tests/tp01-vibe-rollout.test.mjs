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
