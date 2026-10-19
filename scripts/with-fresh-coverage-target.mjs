import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

// cargo-llvm-cov cleans profiles, but old instrumented objects can still carry
// obsolete line mappings. Keep each attempt's objects and profiles together.
export function runFreshCoverage(args, { env = process.env, run = spawnSync } = {}) {
  assert.deepEqual(args.slice(0, 2), ['cargo', 'llvm-cov']);
  const target = mkdtempSync(join(tmpdir(), 'quantos-critical-coverage-'));
  const childEnv = { ...env, CARGO_TARGET_DIR: target };
  delete childEnv.CARGO_LLVM_COV_TARGET_DIR;
  delete childEnv.LLVM_PROFILE_FILE;
  const result = run(args[0], args.slice(1), { env: childEnv, stdio: 'inherit' });
  return { target, status: result.status, signal: result.signal, errorCode: result.error?.code ?? null };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = runFreshCoverage(process.argv.slice(2));
  console.log(JSON.stringify({ schema: 'quantos-fresh-critical-coverage/v1', ...result }));
  process.exitCode = result.errorCode || result.signal ? 1 : result.status ?? 1;
}
