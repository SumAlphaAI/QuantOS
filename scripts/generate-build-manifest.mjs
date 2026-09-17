import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { cleanSource, files, digest } from "./f01-lib.mjs";

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
  } catch (error) {
    throw new Error(`Required build tool failed: ${command}`, { cause: error });
  }
}

const packageJson = readJson("package.json");
const source = cleanSource(repoRoot);
if (process.env.GITHUB_SHA && process.env.GITHUB_SHA !== source.commit) throw new Error("Build SHA does not match checked out source");
const metadataOnly = process.argv.includes("--metadata-only");
const releaseRoot = path.join(repoRoot,"artifacts/release");
const manifest = {
  schemaVersion: 2,
  kind: metadataOnly ? "metadata-only" : "release",
  project: "sumalpha-quantos",
  generatedAt: new Date().toISOString(),
  git: {
    commit: source.commit,
    tree: source.tree,
    dirty: false,
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
    python: shell("uv", ["run", "--locked", "--project", "engines", "python", "--version"]),
  },
  dependencyDigests: {
    cargoLockSha256: sha256("Cargo.lock"),
    bufLockSha256: sha256("buf.lock"),
    pnpmLockSha256: sha256("pnpm-lock.yaml"),
    uvLockSha256: sha256("engines/uv.lock"),
  },
  packageManager: packageJson.packageManager,
  generatedBy: "scripts/generate-build-manifest.mjs",
};

if (!metadataOnly) {
  manifest.files = digest(files(releaseRoot).filter(p=>p!==path.join(releaseRoot,"manifest.json")),releaseRoot).files;
  const sbom=JSON.parse(fs.readFileSync(path.join(releaseRoot,"sbom/quantos.spdx.json")));
  if(sbom.packages.find(p=>p.SPDXID==="SPDXRef-Package-QuantOS")?.versionInfo!==source.commit) throw new Error("SBOM source mismatch");
}
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Wrote build manifest to ${path.relative(repoRoot, outputPath)}.`);
