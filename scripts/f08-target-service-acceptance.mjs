import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const run = (command, args, env, timeout = 180_000) => {
  const started = Date.now();
  const result = spawnSync(command, args, { encoding: "utf8", env, timeout });
  return {
    success: result.status === 0 && !result.error,
    exitCode: result.status,
    elapsedMs: Date.now() - started,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
    error: result.error?.message ?? null,
  };
};
const sha = run("git", ["rev-parse", "HEAD"], process.env);
assert(sha.success, sha.output);
const sourceCommit = sha.output.trim();
assert.match(sourceCommit, /^[0-9a-f]{40}$/);
assert.equal(process.env.F08_SOURCE_SHA ?? sourceCommit, sourceCommit, "target source SHA differs from checkout");

const artifactDir = "artifacts/f08-target";
mkdirSync(artifactDir, { recursive: true });
const targetDir = mkdtempSync(join(tmpdir(), "f08-target-"));
chmodSync(targetDir, 0o700);
const env = {
  ...process.env,
  QUANTOS_SKIP_ENV: "1",
  UV_NO_SYNC: "1",
  F08_TARGET_SOCKET_DIR: targetDir,
  TMPDIR: targetDir,
};
const installedModule = run("uv", ["run", "--directory", "engines", "--package", "quantos-mock-engine", "python", "-c", "import mock_engine; print(mock_engine.__file__)"], env);
const modulePath = installedModule.output.trim();
const wheelInstalled = installedModule.success && modulePath.includes("/site-packages/mock_engine/") && !modulePath.includes("/mock-engine/src/");
writeFileSync(join(artifactDir, "installed-module.log"), installedModule.output);
const cases = [
  ["five_rpc_and_tenant_denial", "python_mock_engine_contracts_round_trip_over_uds"],
  ["three_supervised_crashes", "manager_supervises_three_real_crashes_without_test_owned_restarts"],
  ["deadline_two_seconds", "python_mock_engine_deadline_timeout_is_deterministic"],
  ["running_cancel", "manager_cancel_interrupts_owned_running_execution"],
  ["durable_reconstruction", "durable_result_and_circuit_survive_manager_reconstruction"],
  ["manager_os_kill_and_replay_policy", "os_killed_manager_replays_pending_key_into_one_durable_result"],
  ["idempotency_and_changed_input", "duplicate_key_returns_same_result_and_changed_input_is_rejected"],
  ["sidecar_artifact_integrity", "supervised_sidecar_refuses_tampered_artifact_then_recovers"],
  ["untrusted_rpc_rejection", "untrusted_engine_cannot_bypass_manager_response_identity_checks"],
];
const results = [];
try {
  for (const [id, name] of cases) {
    const result = run("cargo", ["test", "-p", "quantos-engine-manager", "--locked", "--release", "--test", "python_mock_engine", name, "--", "--exact", "--nocapture"], env, 900_000);
    writeFileSync(join(artifactDir, `${id}.log`), result.output);
    results.push({ id, test: name, status: result.success ? "PASS" : "FAIL", exitCode: result.exitCode, elapsedMs: result.elapsedMs, log: `${id}.log`, error: result.error });
  }
  const wheelDir = join(artifactDir, "wheels");
  const wheels = readdirSync(wheelDir).filter((name) => name.startsWith("quantos_mock_engine-") && name.endsWith(".whl"));
  assert.equal(wheels.length, 1, "expected one immutable Mock Engine wheel");
  const wheel = join(wheelDir, wheels[0]);
  const receipt = {
    schema: "quantos-f08-target-service/v1",
    sourceCommit,
    environment: process.env.GITHUB_ACTIONS === "true" ? "github-actions-ubuntu-24.04-isolated-runner" : "local-isolated-process-diagnostic",
    githubRunId: process.env.GITHUB_RUN_ID ?? null,
    targetDirectoryMode: (statSync(targetDir).mode & 0o777).toString(8),
    mockWheel: { file: wheels[0], sha256: createHash("sha256").update(readFileSync(wheel)).digest("hex") },
    installedFromWheel: wheelInstalled,
    installedModulePath: modulePath,
    cases: results,
    status: results.every((item) => item.status === "PASS") && (statSync(targetDir).mode & 0o777) === 0o700 && wheelInstalled ? "PASS" : "FAIL",
  };
  writeFileSync(join(artifactDir, "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(JSON.stringify({ sourceCommit, environment: receipt.environment, cases: results.map(({ id, status }) => ({ id, status })), status: receipt.status }, null, 2));
  assert.equal(receipt.status, "PASS", "isolated target service acceptance failed");
} finally {
  rmSync(targetDir, { recursive: true, force: true });
}
