import fs from "node:fs";
import path from "node:path";

export function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

export function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function formatPercent(value) {
  return `${(Number(value) * 100).toFixed(2)}%`;
}

function formatDurationSecs(value) {
  return `${Number(value).toFixed(1)}s`;
}

function buildMetricAlerts(observations, policy) {
  const alerts = [];
  const push = (ruleId, severity, observedValue, threshold, summary) => {
    alerts.push({
      rule_id: ruleId,
      severity,
      observed_value: observedValue,
      threshold,
      summary,
    });
  };

  if (observations.unexplainedP1 > policy.maxUnexplainedP1) {
    push(
      "tp01_vibe_unexplained_p1",
      "critical",
      observations.unexplainedP1,
      policy.maxUnexplainedP1,
      "unexplained P1 detected during canary",
    );
  }
  if (observations.executeP95Ms > policy.maxExecuteP95Ms) {
    push(
      "tp01_vibe_execute_p95_ms",
      "critical",
      observations.executeP95Ms,
      policy.maxExecuteP95Ms,
      "execute P95 exceeded canary threshold",
    );
  }
  if (observations.cancelConfirmSecs > policy.maxCancelConfirmSecs) {
    push(
      "tp01_vibe_cancel_confirmation_secs",
      "critical",
      observations.cancelConfirmSecs,
      policy.maxCancelConfirmSecs,
      "cancel confirmation exceeded deterministic threshold",
    );
  }
  if (observations.errorRate > policy.maxErrorRate) {
    push(
      "tp01_vibe_error_rate",
      "critical",
      observations.errorRate,
      policy.maxErrorRate,
      "canary error rate exceeded threshold",
    );
  }
  if (observations.shadowMismatchRate > policy.maxShadowMismatchRate) {
    push(
      "tp01_vibe_shadow_mismatch_rate",
      "warning",
      observations.shadowMismatchRate,
      policy.maxShadowMismatchRate,
      "shadow mismatch rate exceeded threshold",
    );
  }
  if (observations.unauthorizedEgress > policy.maxUnauthorizedEgress) {
    push(
      "tp01_vibe_unauthorized_egress_total",
      "critical",
      observations.unauthorizedEgress,
      policy.maxUnauthorizedEgress,
      "unauthorized egress detected",
    );
  }
  if (observations.secretOrVenueViolations > policy.maxSecretOrVenueViolations) {
    push(
      "tp01_vibe_secret_or_venue_violation_total",
      "critical",
      observations.secretOrVenueViolations,
      policy.maxSecretOrVenueViolations,
      "secret or venue violation detected",
    );
  }
  if (!observations.signedArtifactsPresent && policy.requireSignedArtifacts) {
    push(
      "tp01_vibe_unsigned_release_artifacts",
      "critical",
      observations.signedArtifactsPresent,
      true,
      "required signed artifacts are missing",
    );
  }
  if (!observations.auditComplete && policy.requireAuditCompleteness) {
    push(
      "tp01_vibe_audit_incomplete",
      "critical",
      observations.auditComplete,
      true,
      "audit evidence is incomplete",
    );
  }
  if (!observations.runtimeIsolationVerified && policy.requireRuntimeIsolation) {
    push(
      "tp01_vibe_runtime_isolation_failed",
      "critical",
      observations.runtimeIsolationVerified,
      true,
      "runtime isolation without vibe-adapter was not verified",
    );
  }
  if (
    observations.rollbackCompletedSecs != null &&
    observations.rollbackCompletedSecs > policy.rollbackSlaSecs
  ) {
    push(
      "tp01_vibe_rollback_duration_secs",
      "critical",
      observations.rollbackCompletedSecs,
      policy.rollbackSlaSecs,
      "rollback drill exceeded the five-minute SLA",
    );
  }

  return alerts;
}

function buildReasons(observations, policy, alerts) {
  const reasons = alerts.map((alert) => alert.summary);
  if (observations.canaryDaysObserved < policy.canaryDaysRequired) {
    reasons.push(
      `canary window is ${observations.canaryDaysObserved} day(s); ${policy.canaryDaysRequired} day(s) are required before default enablement`,
    );
  }
  if (observations.shadowTasksCompleted < 1) {
    reasons.push("no shadow tasks were recorded during the rollout window");
  }
  return reasons;
}

function determineOutcome(scenario, observations, policy, alerts) {
  const hasCriticalAlert = alerts.some((alert) => alert.severity === "critical");
  if (scenario.operation === "rollback_drill") {
    if (!hasCriticalAlert && observations.rollbackCompletedSecs <= policy.rollbackSlaSecs) {
      return { outcome: "rolled_back", blocked: false, flagState: "rolled_back" };
    }
    return { outcome: "rollback_failed", blocked: true, flagState: "disabled" };
  }
  if (hasCriticalAlert) {
    return { outcome: "disabled", blocked: true, flagState: "disabled" };
  }
  if (observations.canaryDaysObserved >= policy.canaryDaysRequired) {
    return { outcome: "canary_passed", blocked: false, flagState: "enabled" };
  }
  return { outcome: "canary_observing", blocked: false, flagState: "canary" };
}

export function evaluateRollout({ policyDocument, scenario, buildManifest = null, syncSummary = null }) {
  const policy = policyDocument.rolloutPolicy;
  const observations = scenario.observations;
  const alerts = buildMetricAlerts(observations, policy);
  const reasons = buildReasons(observations, policy, alerts);
  const outcome = determineOutcome(scenario, observations, policy, alerts);

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    scenarioId: scenario.scenarioId,
    title: scenario.title,
    capabilityFlag: {
      name: policyDocument.capabilityFlag.name,
      state: outcome.flagState,
      rolloutPercent:
        outcome.flagState === "enabled" ? 100 : policyDocument.rolloutPolicy.canaryTrafficPercent,
      shadowMode: true,
    },
    candidateRelease: scenario.candidateRelease,
    previousRelease: scenario.previousRelease,
    buildManifest,
    syncSummaryRef: syncSummary?.decisions?.[0]?.candidateRef ?? null,
    operation: scenario.operation || "canary",
    alerts,
    reasons,
    blocked: outcome.blocked,
    outcome: outcome.outcome,
    observations,
  };
}

export function buildReleaseManifest(result) {
  return {
    schemaVersion: 1,
    component: "vibe-adapter",
    generatedAt: result.generatedAt,
    capabilityFlag: result.capabilityFlag,
    candidateRelease: result.candidateRelease,
    previousRelease: result.previousRelease,
    syncSummaryRef: result.syncSummaryRef,
    outcome: result.outcome,
    blocked: result.blocked,
    signedArtifactsRequired: true,
  };
}

export function buildRolloutState(result) {
  return {
    schemaVersion: 1,
    component: "vibe-adapter",
    updatedAt: result.generatedAt,
    status: result.outcome,
    blocked: result.blocked,
    capabilityFlag: result.capabilityFlag,
    activeRelease:
      result.outcome === "rolled_back" ? result.previousRelease : result.candidateRelease,
    previousRelease: result.previousRelease,
    latestEvaluation: {
      scenarioId: result.scenarioId,
      reasons: result.reasons,
      alerts: result.alerts,
    },
  };
}

export function renderCanarySummaryMarkdown(result) {
  const lines = [];
  lines.push("# TP01-F Vibe Canary Summary");
  lines.push("");
  lines.push(`- scenario: \`${result.scenarioId}\``);
  lines.push(`- outcome: \`${result.outcome}\``);
  lines.push(`- blocked: \`${result.blocked}\``);
  lines.push(`- capability flag: \`${result.capabilityFlag.name}\` -> \`${result.capabilityFlag.state}\``);
  lines.push(`- rollout percent: \`${result.capabilityFlag.rolloutPercent}%\``);
  lines.push(`- canary days observed: \`${result.observations.canaryDaysObserved}\``);
  lines.push(`- shadow tasks completed: \`${result.observations.shadowTasksCompleted}\``);
  lines.push("");
  lines.push("## Reasons");
  lines.push("");
  for (const reason of result.reasons) {
    lines.push(`- ${reason}`);
  }
  if (result.reasons.length === 0) {
    lines.push("- none");
  }
  lines.push("");
  lines.push("## Alerts");
  lines.push("");
  if (result.alerts.length === 0) {
    lines.push("- none");
  } else {
    for (const alert of result.alerts) {
      lines.push(
        `- ${alert.rule_id}: ${alert.summary} (observed=${JSON.stringify(alert.observed_value)}, threshold=${JSON.stringify(alert.threshold)})`,
      );
    }
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

export function renderDrillReportMarkdown(result) {
  const lines = [];
  lines.push("# TP01-F Vibe Canary Drill Report");
  lines.push("");
  lines.push(`- scenario: \`${result.scenarioId}\``);
  lines.push(`- operation: \`${result.operation}\``);
  lines.push(`- outcome: \`${result.outcome}\``);
  lines.push(`- rollback completed in: \`${formatDurationSecs(result.observations.rollbackCompletedSecs ?? 0)}\``);
  lines.push(`- audit complete: \`${result.observations.auditComplete}\``);
  lines.push(`- signed artifacts present: \`${result.observations.signedArtifactsPresent}\``);
  lines.push(`- runtime isolation verified: \`${result.observations.runtimeIsolationVerified}\``);
  lines.push("");
  lines.push("## Canary Metrics");
  lines.push("");
  lines.push(`- error rate: ${formatPercent(result.observations.errorRate)}`);
  lines.push(`- execute P95: ${result.observations.executeP95Ms}ms`);
  lines.push(`- cancel confirmation: ${formatDurationSecs(result.observations.cancelConfirmSecs)}`);
  lines.push(`- shadow mismatch rate: ${formatPercent(result.observations.shadowMismatchRate)}`);
  lines.push("");
  lines.push("## Actions");
  lines.push("");
  if (result.outcome === "rolled_back") {
    lines.push("- capability flag moved to `rolled_back`");
    lines.push(`- active release reverted to \`${result.previousRelease.releaseId}\``);
  } else if (result.outcome === "disabled") {
    lines.push("- capability flag moved to `disabled`");
    lines.push("- candidate release remains isolated pending remediation");
  } else {
    lines.push("- canary remained within configured thresholds");
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

export function applyRollback({ state, action, reason, completedAt }) {
  const timestamp = completedAt || new Date().toISOString();
  if (!["disable", "rollback"].includes(action)) {
    throw new Error(`unsupported rollback action ${action}`);
  }

  const next = structuredClone(state);
  next.updatedAt = timestamp;
  next.status = action === "disable" ? "disabled" : "rolled_back";
  next.blocked = false;
  next.capabilityFlag.state = action === "disable" ? "disabled" : "rolled_back";
  next.capabilityFlag.rolloutPercent = 0;
  next.latestEvaluation = {
    ...next.latestEvaluation,
    rollbackAction: action,
    rollbackReason: reason,
    rollbackCompletedAt: timestamp,
  };
  if (action === "rollback") {
    next.activeRelease = next.previousRelease;
  }
  return next;
}

export function renderRollbackActionMarkdown({ previousState, nextState, action, reason }) {
  const lines = [];
  lines.push("# TP01-F Vibe Rollback Action");
  lines.push("");
  lines.push(`- action: \`${action}\``);
  lines.push(`- previous status: \`${previousState.status}\``);
  lines.push(`- next status: \`${nextState.status}\``);
  lines.push(`- capability flag: \`${nextState.capabilityFlag.name}\` -> \`${nextState.capabilityFlag.state}\``);
  lines.push(`- reason: ${reason}`);
  lines.push("");
  if (action === "rollback") {
    lines.push(`- restored release: \`${nextState.activeRelease.releaseId}\``);
    lines.push(`- restored digest: \`${nextState.activeRelease.artifactDigest}\``);
  } else {
    lines.push("- candidate remains disabled pending investigation");
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

export function verifyExpectedRollout(result, expected) {
  if (!expected) {
    return;
  }
  if (expected.outcome && expected.outcome !== result.outcome) {
    throw new Error(`expected outcome ${expected.outcome} but got ${result.outcome}`);
  }
  if (typeof expected.blocked === "boolean" && expected.blocked !== result.blocked) {
    throw new Error(`expected blocked=${expected.blocked} but got ${result.blocked}`);
  }
  if (expected.flagState && expected.flagState !== result.capabilityFlag.state) {
    throw new Error(
      `expected flagState=${expected.flagState} but got ${result.capabilityFlag.state}`,
    );
  }
}
