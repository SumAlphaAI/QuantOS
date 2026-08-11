#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) continue;
    args.set(value.slice(2), argv[index + 1] ?? "");
    index += 1;
  }
  return args;
}

function required(args, name) {
  const value = args.get(name);
  if (!value) throw new Error(`missing required argument --${name}`);
  return path.resolve(value);
}

function git(repository, ...args) {
  return execFileSync("git", ["-C", repository, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} mismatch: expected ${expected}, got ${actual}`);
  }
}

const args = parseArgs(process.argv.slice(2));
const baselinePath = required(args, "baseline");
const remoteLockPath = required(args, "remote-lock");
const readonlyPath = required(args, "readonly");
const forkPath = args.get("fork") ? path.resolve(args.get("fork")) : null;
const allowMissingFork = args.get("allow-missing-fork") === "1";
const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
const remoteLock = JSON.parse(fs.readFileSync(remoteLockPath, "utf8"));

assertEqual(git(readonlyPath, "rev-parse", "HEAD"), baseline.upstream.commit, "readonly HEAD");
assertEqual(
  git(readonlyPath, "remote", "get-url", "upstream"),
  baseline.upstream.repositoryUrl,
  "readonly upstream fetch URL",
);
assertEqual(
  git(readonlyPath, "remote", "get-url", "--push", "upstream"),
  "DISABLED",
  "readonly upstream push URL",
);

for (const descriptor of [
  baseline.license.licenseFile,
  baseline.license.noticeFile,
  baseline.dependencyDigests.pythonLock,
  baseline.dependencyDigests.projectDescriptor,
]) {
  assertEqual(sha256(path.join(readonlyPath, descriptor.path)), descriptor.sha256, descriptor.path);
}

let forkVerified = false;
if (forkPath && fs.existsSync(path.join(forkPath, ".git"))) {
  assertEqual(git(forkPath, "remote", "get-url", "origin"), remoteLock.fork.url, "fork origin");
  assertEqual(git(forkPath, "remote", "get-url", "upstream"), remoteLock.upstream.url, "fork upstream");
  assertEqual(
    git(forkPath, "remote", "get-url", "--push", "upstream"),
    "DISABLED",
    "fork upstream push URL",
  );
  assertEqual(
    git(forkPath, "rev-parse", `refs/heads/${remoteLock.fork.baseBranch}`),
    baseline.upstream.commit,
    "controlled fork base branch",
  );
  git(forkPath, "cat-file", "-e", `${baseline.upstream.commit}^{commit}`);
  forkVerified = true;
} else if (!allowMissingFork) {
  throw new Error(
    `controlled fork checkout missing at ${forkPath ?? "<not supplied>"}; run bootstrap-vibe-repositories.mjs with authenticated GitHub access`,
  );
}

console.log(
  `TP01 repository checks passed: readonly=${baseline.upstream.commit}, fork=${forkVerified ? "verified" : "pending-auth"}`,
);
