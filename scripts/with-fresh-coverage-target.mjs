import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import console from 'node:console';

// cargo-llvm-cov cleans profiles, but old instrumented objects can still carry
// obsolete line mappings. Keep each attempt's objects and profiles together.
export function runFreshCoverage(args, { env = process.env, run = spawnSync } = {}) {
  assert.deepEqual(args.slice(0, 2), ['cargo', 'llvm-cov']);
  const target = mkdtempSync(join(tmpdir(), 'quantos-critical-coverage-'));
  const childEnv = { ...env, CARGO_TARGET_DIR: target };
  delete childEnv.CARGO_LLVM_COV_TARGET_DIR;
  delete childEnv.LLVM_PROFILE_FILE;
  // llvm-cov runs `cargo test --tests`, which does not build examples. Build
  // the owned stdio peer in this attempt, outside the instrumented report tree.
  const needsFixture = args.some((arg, index) =>
    (['--package', '-p'].includes(arg) && args[index + 1] === 'quantos-execution')
    || arg === '--package=quantos-execution');
  let fixture;
  const outcome = (result, phase) => ({ target, status: result.status, signal: result.signal,
    errorCode: result.error?.code ?? null, phase, ...(fixture ? { fixture } : {}) });
  if (needsFixture) {
    const fixtureTarget = join(target, 'owned-fixture');
    const executable = join(fixtureTarget, 'debug', 'examples', `l01_fixture${process.platform === 'win32' ? '.exe' : ''}`);
    const fixtureEnv = { ...childEnv, CARGO_TARGET_DIR: fixtureTarget, RUSTFLAGS: '', RUSTDOCFLAGS: '' };
    delete fixtureEnv.CARGO_ENCODED_RUSTFLAGS;
    delete fixtureEnv.QUANTOS_L01_FIXTURE_EXECUTABLE;
    const build = run('cargo', ['build', '--package', 'quantos-execution', '--example', 'l01_fixture', '--locked', '--offline'],
      { env: fixtureEnv, stdio: 'inherit' });
    if (build.status !== 0 || build.signal || build.error) return outcome(build, 'fixture-build');
    if (!existsSync(executable)) return outcome({ status: null, signal: null, error: { code: 'ENOENT' } }, 'fixture-build');
    fixture = { executable, target: fixtureTarget, sha256: createHash('sha256').update(readFileSync(executable)).digest('hex'),
      instrumented: false, scope: 'owned protocol test peer only; excluded from measurement objects' };
    childEnv.QUANTOS_L01_FIXTURE_EXECUTABLE = executable;
  }
  const result = run(args[0], args.slice(1), { env: childEnv, stdio: 'inherit' });
  return outcome(result, 'coverage');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = runFreshCoverage(process.argv.slice(2));
  console.log(JSON.stringify({ schema: 'quantos-fresh-critical-coverage/v1', ...result }));
  process.exitCode = result.errorCode || result.signal ? 1 : result.status ?? 1;
}
