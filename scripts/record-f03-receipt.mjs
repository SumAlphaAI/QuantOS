import {createHash} from "node:crypto";
import {existsSync, mkdirSync, readFileSync, writeFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {pathToFileURL} from "node:url";

const generatedPaths = [
  "crates/quantos-proto/src/generated", "engines/engine-sdk/src",
  "packages/api-client/src/gen", "proto/openapi", "proto/jsonschema",
];

export function acceptance({sourceSha, expectedSha, outcome, changes, files, log}) {
  return /^[a-f0-9]{40}$/.test(sourceSha) && sourceSha === expectedSha &&
    outcome === "success" && changes.length === 0 && files.length > 0 && files.every(file => file.path && /^[a-f0-9]{64}$/.test(file.sha256 ?? "")) &&
    log.includes("Proto checks passed.") &&
    log.includes("Validated all six ProtoJSON directions") &&
    log.includes("15 invalid-JSON rejection probes passed.");
}

export function recordReceipt() {
  const git = (...args) => execFileSync("git", args, {encoding: "utf8"}).trim();
  const sourceSha = git("rev-parse", "HEAD");
  const expectedSha = process.env.GITHUB_SHA ?? "";
  const changes = git("status", "--porcelain", "--untracked-files=all", "--", ...generatedPaths);
  const files = git("ls-files", "--", ...generatedPaths).split("\n").filter(Boolean).map(path => ({
    path, sha256: existsSync(path) ? createHash("sha256").update(readFileSync(path)).digest("hex") : null,
  }));
  const logPath = "artifacts/f03/proto-check.log";
  const log = existsSync(logPath) ? readFileSync(logPath, "utf8") : "";
  const outcome = process.env.PROTO_OUTCOME ?? "not_run";
  const passed = acceptance({sourceSha, expectedSha, outcome, changes, files, log});
  const receipt = {
    schema: "quantos-f03-remote-protocol/v1", sourceSha, expectedSha,
    runId: process.env.GITHUB_RUN_ID ?? null, runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
    event: process.env.GITHUB_EVENT_NAME ?? null, ref: process.env.GITHUB_REF ?? null,
    protocolStepOutcome: outcome, acceptance: passed ? "PASS" : "FAIL",
    generatedChanges: changes, generatedFiles: files,
    logSha256: log ? createHash("sha256").update(log).digest("hex") : null,
  };
  mkdirSync("artifacts/f03", {recursive: true});
  writeFileSync("artifacts/f03/receipt.json", `${JSON.stringify(receipt, null, 2)}\n`);
  if (!passed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) recordReceipt();
