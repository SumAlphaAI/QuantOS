#!/usr/bin/env node

import path from "node:path";

import {
  buildReleaseManifest,
  buildRolloutState,
  evaluateRollout,
  loadJson,
  renderCanarySummaryMarkdown,
  renderDrillReportMarkdown,
  verifyExpectedRollout,
  writeJson,
  writeText,
} from "./tp01-vibe-rollout-lib.mjs";

function parseArgs(argv) {
  const args = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (!value.startsWith("--")) {
      continue;
    }
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args.set(value.slice(2), "true");
      continue;
    }
    args.set(value.slice(2), next);
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
const policyPath = path.resolve(repoRoot, requireArg(args, "policy"));
const scenarioPath = path.resolve(repoRoot, requireArg(args, "scenario"));
const outputDir = path.resolve(repoRoot, requireArg(args, "output-dir"));
const buildManifestPath = args.get("build-manifest")
  ? path.resolve(repoRoot, args.get("build-manifest"))
  : null;
const syncSummaryPath = args.get("sync-summary")
  ? path.resolve(repoRoot, args.get("sync-summary"))
  : null;

const policyDocument = loadJson(policyPath);
const scenario = loadJson(scenarioPath);
const buildManifest = buildManifestPath ? loadJson(buildManifestPath) : null;
const syncSummary = syncSummaryPath ? loadJson(syncSummaryPath) : null;

const result = evaluateRollout({
  policyDocument,
  scenario,
  buildManifest,
  syncSummary,
});

if (args.get("verify-expected") === "true") {
  verifyExpectedRollout(result, scenario.expected);
}

writeJson(path.join(outputDir, "canary-summary.json"), result);
writeText(path.join(outputDir, "canary-summary.md"), renderCanarySummaryMarkdown(result));
writeJson(path.join(outputDir, "release-manifest.json"), buildReleaseManifest(result));
writeJson(path.join(outputDir, "rollout-state.json"), buildRolloutState(result));
writeText(path.join(outputDir, "drill-report.md"), renderDrillReportMarkdown(result));

console.log(`Wrote ${path.relative(repoRoot, outputDir)}`);
