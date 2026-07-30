#!/usr/bin/env node

import path from "node:path";

import {
  classifyScenario,
  loadJson,
  loadScenarios,
  renderCandidateIssue,
  renderDecisionRecord,
  renderSummaryMarkdown,
  verifyExpectedDecisions,
  writeText,
} from "./sync-vibe-lib.mjs";

function parseArgs(argv) {
  const args = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (!value.startsWith("--")) {
      continue;
    }
    const key = value.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args.set(key, "true");
      continue;
    }
    args.set(key, next);
    i += 1;
  }
  return args;
}

function requireArg(args, name) {
  const value = args.get(name);
  if (!value) {
    throw new Error(`missing required argument --${name}`);
  }
  return value;
}

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const args = parseArgs(process.argv.slice(2));
const baselinePath = path.resolve(repoRoot, requireArg(args, "baseline"));
const patchQueuePath = path.resolve(repoRoot, requireArg(args, "patch-queue"));
const jsonOutputPath = path.resolve(repoRoot, requireArg(args, "json-output"));
const markdownOutputPath = path.resolve(repoRoot, requireArg(args, "markdown-output"));
const decisionDir = path.resolve(repoRoot, requireArg(args, "decision-dir"));
const issueDir = path.resolve(repoRoot, requireArg(args, "issue-dir"));
const verifyExpected = args.get("verify-expected") === "true";
const failOnBlock = args.get("fail-on-block") === "true";
const scenarioPath = args.get("scenario")
  ? path.resolve(repoRoot, args.get("scenario"))
  : null;
const candidateReportPath = args.get("candidate-report")
  ? path.resolve(repoRoot, args.get("candidate-report"))
  : null;

const baseline = loadJson(baselinePath);
const patchQueue = loadJson(patchQueuePath);
const scenarios = loadScenarios({
  baseline,
  scenarioPath,
  candidateReportPath,
});

const decisions = scenarios.map((scenario) =>
  classifyScenario({
    baseline,
    patchQueue,
    scenario,
  }),
);

if (verifyExpected) {
  verifyExpectedDecisions(decisions);
}

const summary = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  baseline,
  patchQueue,
  decisions,
};

writeText(jsonOutputPath, `${JSON.stringify(summary, null, 2)}\n`);
writeText(markdownOutputPath, renderSummaryMarkdown(summary));

for (const decision of decisions) {
  writeText(path.join(decisionDir, `${decision.slug}.md`), renderDecisionRecord(decision));
  writeText(path.join(issueDir, `${decision.slug}.md`), renderCandidateIssue(decision));
}

console.log(`Wrote ${path.relative(repoRoot, jsonOutputPath)}`);
console.log(`Wrote ${path.relative(repoRoot, markdownOutputPath)}`);
console.log(`Generated ${decisions.length} decision record(s).`);

if (failOnBlock && decisions.some((decision) => decision.blocked)) {
  console.error("TP01-E blocked: one or more sync decisions require manual action.");
  process.exit(2);
}
