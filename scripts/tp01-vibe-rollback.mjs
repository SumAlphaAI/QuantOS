#!/usr/bin/env node

import path from "node:path";

import {
  applyRollback,
  loadJson,
  renderRollbackActionMarkdown,
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
const statePath = path.resolve(repoRoot, requireArg(args, "state"));
const outputStatePath = path.resolve(repoRoot, requireArg(args, "output-state"));
const outputReportPath = path.resolve(repoRoot, requireArg(args, "output-report"));
const action = requireArg(args, "action");
const reason = requireArg(args, "reason");

const previousState = loadJson(statePath);
const nextState = applyRollback({
  state: previousState,
  action,
  reason,
  completedAt: new Date().toISOString(),
});

writeJson(outputStatePath, nextState);
writeText(
  outputReportPath,
  renderRollbackActionMarkdown({ previousState, nextState, action, reason }),
);

console.log(`Wrote ${path.relative(repoRoot, outputStatePath)}`);
