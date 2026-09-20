#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PNG } from "pngjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestRelativePath = "tests/e2e/visual-baselines.json";

function pngInventory(directory, root, out = []) {
  if (!existsSync(directory)) return out;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) pngInventory(path, root, out);
    else if (entry.isFile() && entry.name.endsWith(".png")) out.push(relative(root, path));
  }
  return out;
}

export const visualCases = [
  ["command", "command-1440-dark"],
  ["ui102-auth", "ui102-login-1440-dark"],
  ["ui104-settings", "ui104-security-1440-dark"],
  ["ui104-settings", "ui104-browser-1440-dark"],
];
export const requiredVisualPaths = (platform) => ["chromium", "firefox", "webkit"].flatMap(
  (browser) => visualCases.map(([spec, name]) => `tests/e2e/${spec}.spec.ts-snapshots/${name}-${browser}-${platform}.png`),
);

export function validateVisualBaselines(root = repoRoot, { readFile = readFileSync, platform } = {}) {
  const issues = [];
  const manifestPath = join(root, manifestRelativePath);
  if (!existsSync(manifestPath)) return { status: "FAIL", issues: [`missing ${manifestRelativePath}`], entries: 0 };

  let manifest;
  try {
    manifest = JSON.parse(readFile(manifestPath));
  } catch (error) {
    return { status: "FAIL", issues: [`invalid ${manifestRelativePath}: ${error.message}`], entries: 0 };
  }
  if (manifest.schema !== "quantos-visual-baselines/v1") issues.push("invalid visual baseline schema");
  if (manifest.maxDiffPixelRatio !== 0.005) issues.push("visual diff threshold must remain 0.005");
  if (!Array.isArray(manifest.entries) || manifest.entries.length === 0) issues.push("visual baseline entries must not be empty");

  const entries = manifest.entries ?? [];
  const declared = entries.map((entry) => entry.path);
  if (new Set(declared).size !== declared.length) issues.push("duplicate visual baseline path");
  if (platform) {
    for (const path of requiredVisualPaths(platform)) {
      if (!declared.includes(path)) issues.push(`missing required platform baseline: ${path}`);
    }
  }
  const actual = pngInventory(join(root, "tests/e2e"), root).sort();
  if (JSON.stringify([...declared].sort()) !== JSON.stringify(actual)) {
    issues.push("visual baseline manifest inventory does not match tracked PNG files");
  }

  for (const entry of entries) {
    if (!entry.path?.startsWith("tests/e2e/") || !entry.path.endsWith(".png")) {
      issues.push(`invalid baseline path: ${entry.path}`);
      continue;
    }
    const path = join(root, entry.path);
    if (!existsSync(path)) {
      issues.push(`missing baseline: ${entry.path}`);
      continue;
    }
    try {
      const bytes = readFile(path);
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      if (sha256 !== entry.sha256) issues.push(`sha256 mismatch: ${entry.path}`);
      const png = PNG.sync.read(bytes);
      if (png.width !== entry.width || png.height !== entry.height) {
        issues.push(`dimension mismatch: ${entry.path} expected ${entry.width}x${entry.height}, got ${png.width}x${png.height}`);
      }
      if (entry.path.includes("1440-") && png.width !== 1440) {
        issues.push(`1440 baseline has wrong width: ${entry.path}`);
      }
      if (!entry.scope) issues.push(`missing scope: ${entry.path}`);
    } catch (error) {
      issues.push(`invalid PNG ${entry.path}: ${error.message}`);
    }
  }

  return { schema: manifest.schema, status: issues.length === 0 ? "PASS" : "FAIL", issues, entries: entries.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const platformIndex = process.argv.indexOf("--platform");
  const platform = platformIndex < 0 ? undefined : process.argv[platformIndex + 1];
  if (platformIndex >= 0 && !["linux", "darwin", "win32"].includes(platform)) throw Error("--platform requires linux, darwin, or win32");
  const report = validateVisualBaselines(repoRoot, { platform });
  if (report.status === "FAIL") {
    for (const issue of report.issues) console.error(`FAIL  ${issue}`);
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({ schema: report.schema, status: report.status, entries: report.entries }, null, 2));
  }
}
