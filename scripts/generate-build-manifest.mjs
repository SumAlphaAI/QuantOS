import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const outputFlagIndex = process.argv.indexOf("--output");
const outputPath =
  outputFlagIndex >= 0
    ? path.resolve(repoRoot, process.argv[outputFlagIndex + 1])
    : path.join(repoRoot, "artifacts", "build", "build-manifest.json");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

function sha256(relativePath) {
  const content = fs.readFileSync(path.join(repoRoot, relativePath));
  return crypto.createHash("sha256").update(content).digest("hex");
}

function shell(command, args) {
  try {
    return execFileSync(command, args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return "unknown";
  }
}

const packageJson = readJson("package.json");
const manifest = {
  schemaVersion: 1,
  project: "sumalpha-quantos",
  generatedAt: new Date().toISOString(),
  git: {
    commit: process.env.GITHUB_SHA || shell("git", ["rev-parse", "HEAD"]),
    branch:
      process.env.GITHUB_REF_NAME ||
      shell("git", ["rev-parse", "--abbrev-ref", "HEAD"]),
  },
  toolchains: {
    rust: shell("rustc", ["--version"]),
    cargo: shell("cargo", ["--version"]),
    node: shell("node", ["--version"]),
    pnpm: shell("pnpm", ["--version"]),
    uv: shell("uv", ["--version"]),
    python: shell("python3", ["--version"]),
  },
  dependencyDigests: {
    cargoLockSha256: sha256("Cargo.lock"),
    pnpmLockSha256: sha256("pnpm-lock.yaml"),
    uvLockSha256: sha256("engines/uv.lock"),
  },
  packageManager: packageJson.packageManager,
  generatedBy: "scripts/generate-build-manifest.mjs",
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Wrote build manifest to ${path.relative(repoRoot, outputPath)}.`);
