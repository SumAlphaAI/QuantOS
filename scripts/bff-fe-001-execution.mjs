import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

export const executionSources = {
  provider: "services/bff-gateway/src/lib.rs",
  providerTests: "services/bff-gateway/tests/auth_settings_provider.rs",
  liveRouter: "services/bff-gateway/src/live.rs",
  authBoundary: "crates/quantos-auth/src/lib.rs",
  liveTests: "scripts/test-bff-fe-001-live.mjs",
  schemaGenerator: "scripts/generate-bff-contracts.mjs",
  migration: "supabase/migrations/20261003090000_bff_a2_identity_settings.sql",
  liveProvider: "services/bff-gateway/src/live/settings.rs",
  inputGuard: "services/bff-gateway/src/input_contract.rs",
  authClient: "apps/terminal/src/auth/bff.ts",
  settingsClient: "apps/terminal/src/settings/gateway.ts",
  responseParser: "packages/api-client/src/bff-response.ts",
  responseSchemas: "packages/api-client/src/bff-gen/quantos-bff.zod.ts",
  authTests: "apps/terminal/tests/auth-bff.test.ts",
  settingsTests: "apps/terminal/tests/ui104-settings.test.ts",
};
export const digest = value => createHash("sha256").update(value).digest("hex");
export function executionInputs(root) {
  return Object.fromEntries(Object.entries(executionSources).map(([name, file]) => [name, readFileSync(resolve(root, file), "utf8")]));
}
const proofPath = root => resolve(root, "artifacts/bff-fe-001/semantics.json");
export function readExecutionProof(root) {
  return existsSync(proofPath(root)) ? JSON.parse(readFileSync(proofPath(root), "utf8")) : null;
}
export function runExecutionProof(root) {
  const sources = executionInputs(root);
  const commands = [
    ["cargo", ["test", "--locked", "--offline", "-p", "bff-gateway", "--test", "auth_settings_provider"]],
    ["pnpm", ["--filter", "@sumalpha/terminal", "exec", "vitest", "run", "tests/auth-bff.test.ts", "tests/ui104-settings.test.ts"]],
  ];
  const results = commands.map(([command, args]) => {
    const result = spawnSync(command, args, { cwd: root, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    return { command, args, exitCode: result.status, outputSha256: digest(output), output };
  });
  const report = { schema: "quantos-bff-a2-executed-semantics/v1", scope: "local reference provider and consumer regressions; live target separate", sourceHashes: Object.fromEntries(Object.entries(sources).map(([key, value]) => [key, digest(value)])), results: results.map(({ output, ...result }) => result), status: results.every(r => r.exitCode === 0) ? "PASS" : "FAIL" };
  mkdirSync(resolve(root, "artifacts/bff-fe-001"), { recursive: true });
  for (const [index, result] of results.entries()) writeFileSync(resolve(root, `artifacts/bff-fe-001/semantics-${index}.log`), result.output);
  writeFileSync(proofPath(root), JSON.stringify(report, null, 2) + "\n");
  if (report.status !== "PASS") throw Error("A2 provider/consumer semantic regressions failed; see artifacts/bff-fe-001/semantics-*.log");
  return report;
}
