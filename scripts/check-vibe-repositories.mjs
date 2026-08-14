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
    timeout: 15_000,
  }).trim();
}

function publicRemoteBranch(remoteUrl, branch) {
  try {
    return execFileSync(
      "git",
      [
        "-c",
        "credential.helper=",
        "ls-remote",
        "--exit-code",
        remoteUrl,
        `refs/heads/${branch}`,
      ],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 15_000,
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "Never" },
      },
    ).trim();
  } catch (error) {
    if (error.status === 2) {
      throw new Error(`required remote branch ${branch} is missing from ${remoteUrl}`);
    }
    throw error;
  }
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
const skipRemoteGovernance = args.get("skip-remote-governance") === "1";
const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
const remoteLock = JSON.parse(fs.readFileSync(remoteLockPath, "utf8"));
const evidenceDirectory = path.dirname(baselinePath);
const sbom = JSON.parse(fs.readFileSync(path.join(evidenceDirectory, "sbom.spdx.json"), "utf8"));
const cveEvidence = JSON.parse(
  fs.readFileSync(path.join(evidenceDirectory, baseline.cveAudit.rawEvidence), "utf8"),
);

assertEqual(
  remoteLock.upstream.baselineCommit,
  baseline.upstream.commit,
  "remote lock baseline commit",
);
assertEqual(remoteLock.upstream.baselineTag, baseline.upstream.tag, "remote lock baseline tag");
const upstreamPackage = sbom.packages.find((entry) => entry.SPDXID === "SPDXRef-VibeTrading");
assertEqual(upstreamPackage?.versionInfo, baseline.upstream.tag, "SBOM baseline tag");
assertEqual(
  upstreamPackage?.downloadLocation,
  `git+${baseline.upstream.repositoryUrl}@${baseline.upstream.commit}`,
  "SBOM baseline source",
);
assertEqual(baseline.cveAudit.status, "passed", "CVE audit status");
assertEqual(cveEvidence.dependencies.length, baseline.cveAudit.dependencyCount, "CVE dependency count");
assertEqual(
  cveEvidence.dependencies.flatMap((dependency) => dependency.vulns).length,
  baseline.cveAudit.vulnerabilityCount,
  "CVE vulnerability count",
);

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
  if (!skipRemoteGovernance) {
    for (const branch of [remoteLock.fork.baseBranch, remoteLock.fork.integrationBranch]) {
      const output = publicRemoteBranch(remoteLock.fork.url, branch);
      const [remoteCommit] = output.split(/\s+/);
      assertEqual(remoteCommit, baseline.upstream.commit, `remote branch ${branch}`);
    }
  }
  forkVerified = true;
} else if (!allowMissingFork) {
  throw new Error(
    `controlled fork checkout missing at ${forkPath ?? "<not supplied>"}; run bootstrap-vibe-repositories.mjs with authenticated GitHub access`,
  );
}

console.log(
  `TP01 repository checks passed: readonly=${baseline.upstream.commit}, fork=${forkVerified ? "verified" : "pending-auth"}`,
);
