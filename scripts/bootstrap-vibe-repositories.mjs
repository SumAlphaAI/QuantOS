#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const baseline = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "third_party/vibe-trading/baseline.lock.json"), "utf8"),
);
const remoteLock = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "forks/vibe-trading/repository.lock.json"), "utf8"),
);
const readonlyPath = path.join(repoRoot, "third_party/vibe-trading/upstream-src");
const forkPath = path.resolve(
  repoRoot,
  process.env.QUANTOS_VIBE_FORK_PATH ?? remoteLock.checkout.defaultPath,
);
const readonlyOnly = process.argv.includes("--readonly-only");

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "inherit",
    ...options,
  });
}

run("git", ["submodule", "update", "--init", "--depth", "1", "third_party/vibe-trading/upstream-src"]);
const readonlyRemotes = execFileSync("git", ["-C", readonlyPath, "remote"], { encoding: "utf8" });
if (readonlyRemotes.split(/\s+/).includes("origin")) {
  run("git", ["-C", readonlyPath, "remote", "rename", "origin", "upstream"]);
}
run("git", ["-C", readonlyPath, "remote", "set-url", "upstream", remoteLock.upstream.url]);
run("git", ["-C", readonlyPath, "remote", "set-url", "--push", "upstream", "DISABLED"]);

if (readonlyOnly) {
  run("node", [
    "./scripts/check-vibe-repositories.mjs",
    "--baseline",
    "./third_party/vibe-trading/baseline.lock.json",
    "--remote-lock",
    "./forks/vibe-trading/repository.lock.json",
    "--readonly",
    "./third_party/vibe-trading/upstream-src",
    "--allow-missing-fork",
    "1",
  ]);
  process.exit(0);
}

if (!fs.existsSync(path.join(forkPath, ".git"))) {
  fs.mkdirSync(path.dirname(forkPath), { recursive: true });
  run("git", ["clone", "--filter=blob:none", "--no-checkout", remoteLock.fork.url, forkPath]);
}

const forkRemotes = execFileSync("git", ["-C", forkPath, "remote"], { encoding: "utf8" });
if (!forkRemotes.split(/\s+/).includes("upstream")) {
  run("git", ["-C", forkPath, "remote", "add", "upstream", remoteLock.upstream.url]);
}
run("git", ["-C", forkPath, "remote", "set-url", "origin", remoteLock.fork.url]);
run("git", ["-C", forkPath, "remote", "set-url", "upstream", remoteLock.upstream.url]);
run("git", ["-C", forkPath, "remote", "set-url", "--push", "upstream", "DISABLED"]);
run("git", ["-C", forkPath, "fetch", "--depth", "1", "upstream", baseline.upstream.commit]);
run("git", ["-C", forkPath, "checkout", "-B", remoteLock.fork.baseBranch, baseline.upstream.commit]);

run("node", [
  "./scripts/check-vibe-repositories.mjs",
  "--baseline",
  "./third_party/vibe-trading/baseline.lock.json",
  "--remote-lock",
  "./forks/vibe-trading/repository.lock.json",
  "--readonly",
  "./third_party/vibe-trading/upstream-src",
  "--fork",
  forkPath,
]);
