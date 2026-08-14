#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runsFlag = process.argv.indexOf("--runs");
const outputFlag = process.argv.indexOf("--output");
const runCount = runsFlag >= 0 ? Number(process.argv[runsFlag + 1]) : 3;
const outputPath = path.resolve(
  repoRoot,
  outputFlag >= 0
    ? process.argv[outputFlag + 1]
    : "artifacts/reproducibility/f01-build-digests.json",
);

if (!Number.isInteger(runCount) || runCount < 1) {
  throw new Error("--runs must be a positive integer");
}

const rustBinaries = [
  "execution-gateway",
  "market-ingestor",
  "portfolio-rebuild",
  "replay-cli",
  "runtime-gateway",
];
const webRoots = [
  "apps/terminal-desktop/dist",
  // Next.js 静态导出（output: "export"）产物输出到 out/ 而非 dist/
  "apps/terminal/out",
  "apps/website/out",
  "packages/api-client/dist",
  "packages/config/dist",
  "packages/domain-ui/dist",
  "packages/platform/dist",
  "packages/ui/dist",
];

function command(name, args, env = {}) {
  execFileSync(name, args, {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    stdio: "inherit",
  });
}

function git(args) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
}

function listFiles(root) {
  if (!fs.existsSync(root)) throw new Error(`Expected build output is missing: ${root}`);
  const result = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) result.push(...listFiles(fullPath));
    else if (entry.isFile()) result.push(fullPath);
  }
  return result.sort();
}

function digestFiles(files, logicalName) {
  const hash = crypto.createHash("sha256");
  const entries = [];
  for (const file of files.sort((left, right) => left.name.localeCompare(right.name))) {
    const content = fs.readFileSync(file.path);
    const sha256 = crypto.createHash("sha256").update(content).digest("hex");
    entries.push({ path: file.name, sha256, sizeBytes: content.length });
    hash.update(`${file.name}\0${sha256}\0${content.length}\n`);
  }
  if (entries.length === 0) throw new Error(`${logicalName} produced no files`);
  return { sha256: hash.digest("hex"), files: entries };
}

function buildOnce(index, sourceDateEpoch) {
  const buildRoot = fs.mkdtempSync(path.join(os.tmpdir(), `quantos-f01-run-${index}-`));
  try {
    const rustTarget = path.join(buildRoot, "rust-target");
    const pythonDist = path.join(buildRoot, "python-dist");
    const deterministicEnv = {
      CARGO_TARGET_DIR: rustTarget,
      SOURCE_DATE_EPOCH: sourceDateEpoch,
      TZ: "UTC",
    };

    command("cargo", ["build", "--workspace", "--release", "--locked"], deterministicEnv);
    command("pnpm", ["build"], deterministicEnv);
    command(
      "uv",
      [
        "build",
        "--project",
        "engines",
        "--all-packages",
        "--wheel",
        "--out-dir",
        pythonDist,
        "--no-build-logs",
      ],
      deterministicEnv,
    );

    const rust = digestFiles(
      rustBinaries.map((name) => ({
        name,
        path: path.join(rustTarget, "release", name),
      })),
      "Rust release build",
    );
    const typescript = digestFiles(
      webRoots.flatMap((relativeRoot) =>
        listFiles(path.join(repoRoot, relativeRoot)).map((file) => ({
          name: path.relative(repoRoot, file),
          path: file,
        })),
      ),
      "TypeScript build",
    );
    const python = digestFiles(
      listFiles(pythonDist).map((file) => ({
        name: path.relative(pythonDist, file),
        path: file,
      })),
      "Python wheel build",
    );
    const combinedSha256 = crypto
      .createHash("sha256")
      .update(`rust=${rust.sha256}\ntypescript=${typescript.sha256}\npython=${python.sha256}\n`)
      .digest("hex");
    return { run: index, rust, typescript, python, combinedSha256 };
  } finally {
    fs.rmSync(buildRoot, { recursive: true, force: true });
  }
}

const commit = process.env.GITHUB_SHA || git(["rev-parse", "HEAD"]);
const sourceDateEpoch = git(["show", "-s", "--format=%ct", commit]);
const startedAt = new Date();
const runs = [];
for (let index = 1; index <= runCount; index += 1) {
  console.log(`Starting independent reproducibility build ${index}/${runCount}`);
  runs.push(buildOnce(index, sourceDateEpoch));
}

const baseline = runs[0].combinedSha256;
const reproducible = runs.every((run) => run.combinedSha256 === baseline);
const evidence = {
  schemaVersion: 1,
  commit,
  sourceDateEpoch: Number(sourceDateEpoch),
  startedAt: startedAt.toISOString(),
  completedAt: new Date().toISOString(),
  runCount,
  reproducible,
  runs,
};
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);

if (!reproducible) {
  throw new Error(`Build digests differ; evidence written to ${outputPath}`);
}
console.log(`All ${runCount} independent cross-language build digests match: ${baseline}`);
console.log(`Wrote reproducibility evidence to ${path.relative(repoRoot, outputPath)}`);
