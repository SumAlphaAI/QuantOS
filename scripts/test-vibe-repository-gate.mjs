#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "quantos-vibe-gate-"));
const fixtureFork = path.join(temporaryDirectory, "controlled-fork");
const baseline = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "third_party/vibe-trading/baseline.lock.json"), "utf8"),
);
const remoteLock = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "forks/vibe-trading/repository.lock.json"), "utf8"),
);

function git(...args) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function checkFork(expectSuccess) {
  try {
    execFileSync(
      process.execPath,
      [
        "./scripts/check-vibe-repositories.mjs",
        "--baseline",
        "./third_party/vibe-trading/baseline.lock.json",
        "--remote-lock",
        "./forks/vibe-trading/repository.lock.json",
        "--readonly",
        "./third_party/vibe-trading/upstream-src",
        "--fork",
        fixtureFork,
      ],
      { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    assert.equal(expectSuccess, true, "mutated remote unexpectedly passed");
  } catch (error) {
    if (expectSuccess) throw error;
  }
}

try {
  fs.mkdirSync(fixtureFork, { recursive: true });
  git("-C", fixtureFork, "init");
  const readonlyGitDirectory = git(
    "-C",
    "third_party/vibe-trading/upstream-src",
    "rev-parse",
    "--absolute-git-dir",
  ).trim();
  const alternatesFile = path.join(fixtureFork, ".git", "objects", "info", "alternates");
  fs.mkdirSync(path.dirname(alternatesFile), { recursive: true });
  fs.writeFileSync(alternatesFile, `${path.join(readonlyGitDirectory, "objects")}\n`);
  git("-C", fixtureFork, "remote", "add", "origin", remoteLock.fork.url);
  git("-C", fixtureFork, "remote", "add", "upstream", remoteLock.upstream.url);
  git("-C", fixtureFork, "remote", "set-url", "--push", "upstream", "DISABLED");
  git(
    "-C",
    fixtureFork,
    "update-ref",
    `refs/heads/${remoteLock.fork.baseBranch}`,
    baseline.upstream.commit,
  );
  checkFork(true);

  git("-C", fixtureFork, "remote", "set-url", "origin", "https://example.invalid/uncontrolled.git");
  checkFork(false);
  console.log("TP01 controlled fork gate positive and negative checks passed.");
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
