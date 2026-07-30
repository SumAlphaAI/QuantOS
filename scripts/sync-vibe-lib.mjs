import fs from "node:fs";
import path from "node:path";

export function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function unique(values) {
  return [...new Set(values)];
}

function normalizeSeverity(value) {
  return String(value || "").trim().toUpperCase();
}

function classifyChangedPath(filePath) {
  if (!filePath) {
    return "unknown";
  }
  if (filePath.includes("requirements") || filePath.includes("pyproject")) {
    return "dependency";
  }
  if (filePath.includes("license") || filePath.includes("notice")) {
    return "license";
  }
  if (filePath.includes("session") || filePath.includes("memory")) {
    return "state";
  }
  if (filePath.includes("mcp") || filePath.includes("tool")) {
    return "tooling";
  }
  if (filePath.includes("frontend") || filePath.includes("router") || filePath.includes("ui")) {
    return "ux";
  }
  if (filePath.includes("api") || filePath.includes("proto")) {
    return "api";
  }
  return "workflow";
}

export function summarizeChangedPaths(changedPaths = []) {
  const counts = new Map();
  for (const changedPath of changedPaths) {
    const category = classifyChangedPath(changedPath);
    counts.set(category, (counts.get(category) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([category, count]) => ({ category, count }));
}

export function normalizeMonitorCandidate({ baseline, candidate }) {
  const refParts = String(candidate.ref || "").split("@");
  const refName = refParts[0] || "candidate";
  const digests = candidate.digests || {};
  const licenseChange =
    Boolean(digests.license) && digests.license !== baseline.license.licenseFile.sha256;
  const noticeChange =
    Boolean(digests.notice) && digests.notice !== baseline.license.noticeFile.sha256;
  const dependencyDrift =
    (Boolean(digests.pyprojectToml) &&
      digests.pyprojectToml !== baseline.dependencyDigests.projectDescriptor.sha256) ||
    (Boolean(digests.requirementsLock) &&
      digests.requirementsLock !== baseline.dependencyDigests.pythonLock.sha256);
  return {
    schemaVersion: 1,
    scenarioId: slugify(candidate.ref || candidate.title || "monitor-candidate"),
    title: candidate.title,
    candidateRef: candidate.ref,
    releaseTag:
      refName !== baseline.upstream.defaultBranch && refName !== baseline.upstream.tag ? refName : null,
    changedPaths: [],
    securityAdvisories: [],
    patchQueueOverlaps: [],
    notes: unique([candidate.reason, candidate.action].filter(Boolean)),
    apiBreak: false,
    licenseChange: licenseChange || noticeChange,
    dependencyDrift,
    patchConflict: false,
    researchOnly:
      String(candidate.severity || "").toUpperCase() === "S3" &&
      String(candidate.title || "").includes("main advanced"),
    expectedSeverity: candidate.severity,
    expectedBlocked: ["S0", "S1"].includes(String(candidate.severity || "").toUpperCase()),
  };
}

export function loadScenarios({ baseline, scenarioPath, candidateReportPath }) {
  if (scenarioPath) {
    return [loadJson(scenarioPath)];
  }
  if (candidateReportPath) {
    const report = loadJson(candidateReportPath);
    return (report.candidates || []).map((candidate) =>
      normalizeMonitorCandidate({ baseline, candidate }),
    );
  }
  throw new Error("either --scenario or --candidate-report is required");
}

function computeSeverity(scenario) {
  const advisories = scenario.securityAdvisories || [];
  const hasHighSecurity = advisories.some((advisory) =>
    ["HIGH", "CRITICAL"].includes(normalizeSeverity(advisory.severity)),
  );
  if (scenario.securityIncident || hasHighSecurity) {
    return "S0";
  }
  if (
    scenario.apiBreak ||
    scenario.licenseChange ||
    scenario.dependencyDrift ||
    scenario.patchConflict ||
    scenario.protocolChange
  ) {
    return "S1";
  }
  if (scenario.releaseTag || scenario.stableBugfix || scenario.performanceChange) {
    return "S2";
  }
  return "S3";
}

function computeBlocked(scenario, severity) {
  if (severity === "S0") {
    return true;
  }
  if (severity === "S1") {
    return true;
  }
  return Boolean(scenario.forceBlock);
}

function buildReasons(scenario, severity) {
  const reasons = [];
  if (severity === "S0") {
    reasons.push("security advisory or supply-chain incident touches the candidate");
  }
  for (const advisory of scenario.securityAdvisories || []) {
    const advisoryParts = [advisory.cve, advisory.package, advisory.summary].filter(Boolean);
    if (advisoryParts.length > 0) {
      reasons.push(advisoryParts.join(" | "));
    }
  }
  if (scenario.apiBreak) {
    reasons.push("candidate indicates adapter API / contract breakage");
  }
  if (scenario.licenseChange) {
    reasons.push("LICENSE or NOTICE drift requires legal / supply-chain review");
  }
  if (scenario.dependencyDrift) {
    reasons.push("dependency manifest drift requires compatibility review");
  }
  if (scenario.patchConflict) {
    reasons.push("patch queue overlap or merge conflict requires manual decision");
  }
  if (scenario.researchOnly) {
    reasons.push("candidate is research-only and should remain outside the default capability registry");
  }
  for (const note of scenario.notes || []) {
    reasons.push(note);
  }
  return unique(reasons);
}

function buildRequiredActions(scenario, severity, blocked) {
  const actions = [];
  if (severity === "S0") {
    actions.push("disable affected capability or keep it disabled until the advisory is resolved");
    actions.push("record an emergency decision record and rollback pointer");
  }
  if (severity === "S1") {
    actions.push("run adapter contract, replay, and negative-permission regression suites");
    actions.push("review LICENSE / NOTICE / dependency diffs before any merge");
  }
  if (scenario.patchConflict) {
    actions.push("inspect range-diff overlap and decide between rewrite, backport, or drop");
  }
  if (scenario.apiBreak) {
    actions.push("prepare a versioned translator or keep the candidate isolated");
  }
  if (scenario.researchOnly && !blocked) {
    actions.push("record ADR or prototype only; do not promote into the default capability registry");
  }
  if (!actions.length) {
    actions.push("record candidate evidence and continue through the planned sync review window");
  }
  return unique(actions);
}

function buildRangeDiffSummary(scenario, patchQueue) {
  const explicitOverlaps = scenario.patchQueueOverlaps || [];
  if (explicitOverlaps.length > 0) {
    return explicitOverlaps.map((overlap) => ({
      queueId: overlap.queueId,
      title: overlap.title || overlap.path || "patch-overlap",
      reason: overlap.reason || "explicit overlap declared by scenario",
    }));
  }

  const changedPaths = scenario.changedPaths || [];
  const overlaps = [];
  for (const entry of patchQueue.queue || []) {
    const adapterModule = entry.adapterModule || "";
    for (const changedPath of changedPaths) {
      if (changedPath && adapterModule && changedPath.includes(path.basename(adapterModule))) {
        overlaps.push({
          queueId: entry.id,
          title: entry.title,
          reason: `changed path overlaps adapter module ${adapterModule}`,
        });
      }
    }
  }
  return overlaps;
}

function buildIssueTitle(severity, scenario) {
  const suffix = scenario.candidateRef || scenario.title || scenario.scenarioId;
  return `TP01-E [${severity}] ${suffix}`;
}

export function classifyScenario({ baseline, patchQueue, scenario }) {
  const severity = computeSeverity(scenario);
  const blocked = computeBlocked(scenario, severity);
  const diffSummary = summarizeChangedPaths(scenario.changedPaths || []);
  const rangeDiffSummary = buildRangeDiffSummary(scenario, patchQueue);
  const reasons = buildReasons(scenario, severity);
  const requiredActions = buildRequiredActions(scenario, severity, blocked);
  const slug = slugify(`${scenario.scenarioId || scenario.title || "candidate"}-${severity}`);

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    slug,
    title: scenario.title || scenario.scenarioId || "candidate",
    candidateRef: scenario.candidateRef || "unknown",
    releaseTag: scenario.releaseTag || null,
    severity,
    blocked,
    baseline: {
      tag: baseline.upstream.tag,
      commit: baseline.upstream.commit,
    },
    reasons,
    requiredActions,
    securityAdvisories: scenario.securityAdvisories || [],
    diffSummary,
    rangeDiffSummary,
    expectedSeverity: scenario.expectedSeverity || null,
    expectedBlocked:
      typeof scenario.expectedBlocked === "boolean" ? scenario.expectedBlocked : null,
    issueTitle: buildIssueTitle(severity, scenario),
  };
}

export function renderSummaryMarkdown(summary) {
  const lines = [];
  lines.push("# TP01-E Vibe Sync Decisions");
  lines.push("");
  lines.push(`- generated at: \`${summary.generatedAt}\``);
  lines.push(`- baseline: \`${summary.baseline.upstream.tag}\` @ \`${summary.baseline.upstream.commit}\``);
  lines.push(`- decisions: \`${summary.decisions.length}\``);
  lines.push("");
  for (const decision of summary.decisions) {
    lines.push(`## ${decision.severity} ${decision.title}`);
    lines.push("");
    lines.push(`- candidate ref: \`${decision.candidateRef}\``);
    lines.push(`- blocked: \`${decision.blocked}\``);
    lines.push(`- issue title: ${decision.issueTitle}`);
    lines.push("- reasons:");
    for (const reason of decision.reasons) {
      lines.push(`  - ${reason}`);
    }
    if (decision.diffSummary.length > 0) {
      lines.push("- diff summary:");
      for (const entry of decision.diffSummary) {
        lines.push(`  - ${entry.category}: ${entry.count}`);
      }
    }
    if (decision.rangeDiffSummary.length > 0) {
      lines.push("- range-diff overlap:");
      for (const overlap of decision.rangeDiffSummary) {
        lines.push(`  - ${overlap.queueId}: ${overlap.reason}`);
      }
    }
    lines.push("");
  }
  if (summary.decisions.length === 0) {
    lines.push("No upstream candidates require a TP01-E decision.");
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

export function renderDecisionRecord(decision) {
  const lines = [];
  lines.push(`# TP01 Sync Decision: ${decision.title}`);
  lines.push("");
  lines.push(`- Severity: \`${decision.severity}\``);
  lines.push(`- Candidate ref: \`${decision.candidateRef}\``);
  lines.push(`- Baseline: \`${decision.baseline.tag}\` @ \`${decision.baseline.commit}\``);
  lines.push(`- Blocked: \`${decision.blocked}\``);
  lines.push("");
  lines.push("## Reasons");
  lines.push("");
  for (const reason of decision.reasons) {
    lines.push(`- ${reason}`);
  }
  lines.push("");
  lines.push("## Diff Summary");
  lines.push("");
  if (decision.diffSummary.length === 0) {
    lines.push("- diff evidence is not available from the current candidate source");
  } else {
    for (const entry of decision.diffSummary) {
      lines.push(`- ${entry.category}: ${entry.count}`);
    }
  }
  lines.push("");
  lines.push("## Range-Diff Summary");
  lines.push("");
  if (decision.rangeDiffSummary.length === 0) {
    lines.push("- no patch-queue overlap detected");
  } else {
    for (const overlap of decision.rangeDiffSummary) {
      lines.push(`- ${overlap.queueId}: ${overlap.reason}`);
    }
  }
  lines.push("");
  lines.push("## Required Actions");
  lines.push("");
  for (const action of decision.requiredActions) {
    lines.push(`- ${action}`);
  }
  lines.push("");
  lines.push("## Gate Result");
  lines.push("");
  lines.push(
    decision.blocked
      ? "- Result: blocked pending the required actions and quality gate evidence."
      : "- Result: candidate may proceed to the next planned sync review stage.",
  );
  lines.push("");
  return `${lines.join("\n")}\n`;
}

export function renderCandidateIssue(decision) {
  const lines = [];
  lines.push(`# ${decision.issueTitle}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- severity: \`${decision.severity}\``);
  lines.push(`- candidate ref: \`${decision.candidateRef}\``);
  lines.push(`- blocked: \`${decision.blocked}\``);
  lines.push("");
  lines.push("## Reasons");
  lines.push("");
  for (const reason of decision.reasons) {
    lines.push(`- ${reason}`);
  }
  lines.push("");
  lines.push("## Required Actions");
  lines.push("");
  for (const action of decision.requiredActions) {
    lines.push(`- [ ] ${action}`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

export function verifyExpectedDecisions(decisions) {
  for (const decision of decisions) {
    if (
      decision.expectedSeverity &&
      String(decision.expectedSeverity).toUpperCase() !== decision.severity
    ) {
      throw new Error(
        `expected severity ${decision.expectedSeverity} but got ${decision.severity} for ${decision.slug}`,
      );
    }
    if (
      typeof decision.expectedBlocked === "boolean" &&
      decision.expectedBlocked !== decision.blocked
    ) {
      throw new Error(
        `expected blocked=${decision.expectedBlocked} but got ${decision.blocked} for ${decision.slug}`,
      );
    }
  }
}
