import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const evaluations = [
  ["TP02", "third_party/tp02-rd-agent"],
  ["TP03", "third_party/tp03-llmquant"],
  ["TP04", "third_party/tp04-trading-agents"],
  ["TP05", "third_party/tp05-openbb"],
];
const sha = /^[0-9a-f]{40}$/;
const digest = /^[0-9a-f]{64}$/;

function load(path) {
  return JSON.parse(readFileSync(resolve(root, path), "utf8"));
}

for (const [task, directory] of evaluations) {
  const baseline = load(`${directory}/baseline.lock.json`);
  const inventory = load(`${directory}/capability-inventory.json`);
  const sbom = load(`${directory}/sbom.spdx.json`);
  if (!existsSync(resolve(root, directory, "cve-audit.md"))) {
    throw new Error(`${task}: CVE evaluation record is required`);
  }
  if (sbom.spdxVersion !== "SPDX-2.3" || !Array.isArray(sbom.packages) || sbom.packages.length === 0) {
    throw new Error(`${task}: non-empty SPDX 2.3 evaluation SBOM is required`);
  }
  if (baseline.task !== task || inventory.task !== task) {
    throw new Error(`${task}: mismatched task identifier`);
  }
  if (!baseline.adapter || typeof baseline.productionApproved !== "boolean") {
    throw new Error(`${task}: adapter and productionApproved are required`);
  }
  if (baseline.upstream) {
    if (!baseline.upstream.repositoryUrl.endsWith(".git")) {
      throw new Error(`${task}: immutable upstream repository URL is required`);
    }
    if (!baseline.upstream.tag || !sha.test(baseline.upstream.commit)) {
      throw new Error(`${task}: tag and 40-character commit are required`);
    }
    if (!baseline.license.spdx || !digest.test(baseline.license.licenseSha256)) {
      throw new Error(`${task}: license conclusion and SHA-256 are required`);
    }
    if (!digest.test(baseline.dependencyEvidence.descriptorSha256)) {
      throw new Error(`${task}: dependency descriptor SHA-256 is required`);
    }
  } else if (!baseline.sourceDisposition) {
    throw new Error(`${task}: native/reference disposition must be explicit`);
  }
  if (!Array.isArray(inventory.capabilities) || inventory.capabilities.length === 0) {
    throw new Error(`${task}: capability inventory cannot be empty`);
  }
  for (const capability of inventory.capabilities) {
    for (const field of ["name", "input", "output", "sideEffects", "permissions", "forbidden", "replacement"]) {
      if (capability[field] === undefined || capability[field] === "") {
        throw new Error(`${task}/${capability.name ?? "unknown"}: missing ${field}`);
      }
    }
  }
}

const uvLock = readFileSync(resolve(root, "engines/uv.lock"), "utf8");
for (const forbiddenPackage of ["rdagent", "tradingagents", "openbb"]) {
  const packagePattern = new RegExp(`name = ["']${forbiddenPackage}["']`, "i");
  if (packagePattern.test(uvLock)) {
    throw new Error(`unapproved upstream package ${forbiddenPackage} entered engines/uv.lock`);
  }
}

const productionLocks = ["Cargo.lock", "pnpm-lock.yaml", "engines/uv.lock"]
  .map((path) => readFileSync(resolve(root, path), "utf8").toLowerCase())
  .join("\n");
for (const forbiddenRepository of [
  "github.com/microsoft/rd-agent",
  "github.com/tauricresearch/tradingagents",
  "github.com/openbb-finance/openbb",
]) {
  if (productionLocks.includes(forbiddenRepository)) {
    throw new Error(`unapproved upstream repository ${forbiddenRepository} entered a production lock`);
  }
}

console.log("TP02-TP05 intake evidence is complete; unapproved upstream packages are absent from production locks.");
