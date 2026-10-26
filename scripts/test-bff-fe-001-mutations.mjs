import assert from "node:assert/strict";
import { cpSync, readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync, execFileSync } from "node:child_process";
import { digest } from "./bff-fe-001-execution.mjs";

const root = resolve(import.meta.dirname, "..");
const scratch = mkdtempSync(join(tmpdir(), "quantos-a2-mutants-"));
const evidence = resolve(root, process.argv[2] ?? "artifacts/bff-fe-001");
mkdirSync(evidence, { recursive: true });
const original = readFileSync(resolve(root, "services/bff-gateway/src/lib.rs"), "utf8");
const livePolicyPath="services/bff-gateway/src/live/settings_policy.rs";
const originalPolicy=readFileSync(resolve(root,livePolicyPath),"utf8");
const records = [];
let lockProof;
const mutations = [
  ["replay-authorization", source => source.replace("if state.now() >= state.session_expires_at\n                    ||", "if false && state.now() >= state.session_expires_at\n                    || false &&").replace("|| (session == CURRENT_SESSION && !state.session_active)", "|| false && (session == CURRENT_SESSION && !state.session_active)"), "revoked_stream_discards_backlog_before_delivering_any_settings_event"],
  ["last-factor-protection", source => source.replace("if state.factors.len() <= 1 {", "if false {"), "current_session_and_last_mfa_factor_are_protected"],
  ["csrf-enforcement", source => source.replace("if cookie_csrf != Some(CSRF_TOKEN)", "if false && cookie_csrf != Some(CSRF_TOKEN)").replace("|| header_csrf != Some(CSRF_TOKEN)", "|| false && header_csrf != Some(CSRF_TOKEN)").replace("|| origin != Some(ALLOWED_ORIGIN)", "|| false && origin != Some(ALLOWED_ORIGIN)"), "authentication_csrf_and_resource_failures_fail_closed"],
  ["challenge-freshness", source => source.replace("expires_at: now + Duration::minutes(5)", "expires_at: now + Duration::days(365)").replace(".is_some_and(|at| at + Duration::minutes(5) > now)", ".is_some_and(|at| at + Duration::days(365) > now)"), "challenges_are_fresh_single_use_and_cooldown_precedes_verification"],
];
try {
  // Library tests compile SQL include_str! inputs and the X3 service fixture
  // referenced by #[path]. Preserve both in the reduced workspace without
  // executing migrations or adding unrelated service workspace members.
  for (const folder of ["crates", "services/bff-gateway", "services/execution-gateway/tests", "supabase/migrations"]) cpSync(resolve(root, folder), resolve(scratch, folder), { recursive: true });
  const manifest = readFileSync(resolve(root, "Cargo.toml"), "utf8").replace(/members = \[[\s\S]*?\]/, 'members = ["services/bff-gateway"]');
  writeFileSync(join(scratch, "Cargo.toml"), manifest);
  cpSync(resolve(root, "Cargo.lock"), join(scratch, "Cargo.lock"));
  // A reduced workspace prunes unused members from the copied lock. Retain every
  // resolved package identity/checksum from the pinned root; never update the root.
  const sourceLock = readFileSync(resolve(root, "Cargo.lock"), "utf8");
  const host = /^host: (.+)$/m.exec(execFileSync("rustc", ["-vV"], { encoding: "utf8" }))[1];
  const lock = spawnSync("cargo", ["metadata", "--offline", "--filter-platform", host, "--format-version", "1", "--manifest-path", join(scratch, "Cargo.toml")], { cwd: root, encoding: "utf8", timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
  writeFileSync(join(evidence, "lock-pruning.log"), lock.stderr ?? "");
  assert.equal(lock.status, 0, "scratch lock pruning must succeed offline");
  assert.equal(lock.signal, null);
  assert.equal(lock.error, undefined);
  const scratchLock = readFileSync(join(scratch, "Cargo.lock"), "utf8");
  const identities = text => text.split("[[package]]").slice(1).map(block => ["name", "version", "source", "checksum"].map(key => new RegExp('^' + key + ' = "([^"\\n]+)"', 'm').exec(block)?.[1] ?? "").join("|"));
  const sourcePackages = new Set(identities(sourceLock)), scratchPackages = identities(scratchLock);
  assert(scratchPackages.length > 0 && scratchPackages.every(key => sourcePackages.has(key)), "scratch lock introduced unpinned package identity/checksum");
  assert.equal(readFileSync(resolve(root, "Cargo.lock"), "utf8"), sourceLock);
  lockProof = { sourceSha256: digest(sourceLock), scratchSha256: digest(scratchLock), sourcePackages: sourcePackages.size, scratchPackages: scratchPackages.length, host, packageIdentityChecksumSubset: true, offline: true, rootUnchanged: true };
  const liveMutations=[
    ["live-last-factor",source=>source.replace('if target["status"] == "verified"','if false && target["status"] == "verified"'),"last_verified_factor_cannot_be_removed_even_with_unverified_siblings"],
    ["live-first-factor-state",source=>source.replace('recovering_existing || !factors.iter().any(|f| f["status"] == "verified")','true || recovering_existing || !factors.iter().any(|f| f["status"] == "verified")'),"first_factor_cannot_create_after_any_verified_factor_exists"],
    ["live-csrf",source=>source.replace('cookie == header && hash(header) == expected','cookie == header || hash(header) == expected'),"live_csrf_requires_bound_cookie_and_header"],
    ["live-challenge-ttl",source=>source.replace('now + Duration::minutes(5)','now + Duration::days(365)'),"live_challenge_has_five_minute_lifetime"],
    ["live-revocation",source=>source.replace('    authorized\n','    true\n'),"revoked_delivery_is_terminal"],
  ];
  for (const [name, change, expectedTest, live] of [...mutations.map(m=>[...m,false]),...liveMutations.map(m=>[...m,true])]) {
    const source=live?originalPolicy:original;
    const mutated = change(source);
    assert.notEqual(mutated, source, `mutation ${name} matched no source`);
    writeFileSync(resolve(scratch, "services/bff-gateway/src/lib.rs"), live?original:mutated);
    writeFileSync(resolve(scratch,livePolicyPath),live?mutated:originalPolicy);
    const result = spawnSync("cargo", ["test", "--offline", "--locked", "--manifest-path", join(scratch, "Cargo.toml"), "--target-dir", resolve(root, "target/bff-fe-001-mutants"), "-p", "bff-gateway", ...(live?["--lib"]:["--test", "auth_settings_provider"]), expectedTest], { cwd: root, encoding: "utf8", timeout: 240000, maxBuffer: 8 * 1024 * 1024 });
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    writeFileSync(join(evidence, `mutation-${name}.log`), output);
    const rejected = result.status === 101 && !result.signal && !result.error && output.includes("test result: FAILED.") && output.includes(`${expectedTest} ... FAILED`);
    records.push({ name, scope:live?"actual live policy":"reference provider", expectedTest, exitCode: result.status, signal: result.signal, errorCode: result.error?.code ?? null, rejected, mutatedSourceSha256: digest(mutated), outputSha256: digest(output) });
    assert(rejected, `${name} must fail an executed business assertion, not compilation; see artifacts/bff-fe-001/mutation-${name}.log`);
    console.log(`PASS actual semantic mutation rejected: ${name}`);
  }
} finally {
  writeFileSync(join(evidence, "mutations.json"), JSON.stringify({ schema: "quantos-bff-a2-semantic-mutations/v1", sourceSha256: digest(original), livePolicySha256:digest(originalPolicy), lockProof, records }, null, 2) + "\n");
  rmSync(scratch, { recursive: true, force: true });
}
