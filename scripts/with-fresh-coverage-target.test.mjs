import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import process from 'node:process';
import { runFreshCoverage } from './with-fresh-coverage-target.mjs';

test('repeated coverage attempts never consume prior objects or inherited profile targets', () => {
  const targets = [];
  const env = { CARGO_TARGET_DIR: '/synthetic-old-objects', CARGO_LLVM_COV_TARGET_DIR: '/synthetic-old-cov', LLVM_PROFILE_FILE: '/synthetic-old-profile' };
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = runFreshCoverage(['cargo', 'llvm-cov', '--summary-only'], { env, run(command, args, options) {
        assert.equal(command, 'cargo'); assert.deepEqual(args, ['llvm-cov', '--summary-only']);
        const target = options.env.CARGO_TARGET_DIR; targets.push(target);
        assert.deepEqual(readdirSync(target), []);
        assert.equal(options.env.CARGO_LLVM_COV_TARGET_DIR, undefined);
        assert.equal(options.env.LLVM_PROFILE_FILE, undefined);
        writeFileSync(join(target, 'old-object-marker'), 'synthetic');
        return { status: 0, signal: null };
      } });
      assert.equal(result.status, 0);
    }
    assert.notEqual(targets[0], targets[1]);
    assert(existsSync(join(targets[0], 'old-object-marker')), 'previous attempt is preserved');
    assert.equal(env.CARGO_TARGET_DIR, '/synthetic-old-objects');
    assert.equal(env.LLVM_PROFILE_FILE, '/synthetic-old-profile');
  } finally { for (const target of targets) rmSync(target, { recursive: true, force: true }); }
});
for (const outcome of [{status:1,signal:null},{status:null,signal:'SIGTERM'},{status:null,error:{code:'ENOENT'}}]) {
  test(`failed coverage outcome is retained: ${JSON.stringify(outcome)}`, () => {
    const result = runFreshCoverage(['cargo', 'llvm-cov'], { run: () => outcome });
    try { assert.equal(result.status, outcome.status); assert.equal(result.signal, outcome.signal); assert.equal(result.errorCode, outcome.error?.code ?? null); }
    finally { rmSync(result.target, { recursive: true, force: true }); }
  });
}
test('fresh coverage wrapper rejects unrelated commands before launching', () => {
  assert.throws(() => runFreshCoverage(['sh', '-c', 'echo synthetic'], { run() { throw Error('must not run'); } }));
});

test('execution coverage builds a fresh owned peer without inherited instrumentation or fixture paths', () => {
  const targets = [], args = ['cargo', 'llvm-cov', '--package', 'quantos-execution', '--fail-under-lines', '90', '--summary-only'];
  const env = { QUANTOS_L01_FIXTURE_EXECUTABLE: '/stale/untrusted-peer', LLVM_PROFILE_FILE: '/stale/profile',
    CARGO_LLVM_COV_TARGET_DIR: '/stale/report', RUSTFLAGS: '-Cinstrument-coverage', CARGO_ENCODED_RUSTFLAGS: '-Cinstrument-coverage' };
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      let calls = 0, executable;
      const result = runFreshCoverage(args, { env, run(command, argv, options) {
        assert.equal(command, 'cargo'); calls++;
        if (calls === 1) {
          assert.deepEqual(argv, ['build', '--package', 'quantos-execution', '--example', 'l01_fixture', '--locked', '--offline']);
          assert.equal(options.env.RUSTFLAGS, ''); assert.equal(options.env.CARGO_ENCODED_RUSTFLAGS, undefined);
          assert.equal(options.env.LLVM_PROFILE_FILE, undefined); assert.equal(options.env.CARGO_LLVM_COV_TARGET_DIR, undefined);
          assert.equal(options.env.QUANTOS_L01_FIXTURE_EXECUTABLE, undefined);
          const bin = join(options.env.CARGO_TARGET_DIR, 'debug', 'examples'); mkdirSync(bin, {recursive: true});
          executable = join(bin, `l01_fixture${process.platform === 'win32' ? '.exe' : ''}`);
          writeFileSync(executable, 'synthetic owned peer');
        } else {
          assert.deepEqual(argv, args.slice(1));
          assert.equal(options.env.QUANTOS_L01_FIXTURE_EXECUTABLE, executable);
          assert(executable.startsWith(join(options.env.CARGO_TARGET_DIR, 'owned-fixture') + sep));
          assert.equal(options.env.LLVM_PROFILE_FILE, undefined);
        }
        return {status: calls === 2 && attempt === 1 ? 101 : 0, signal: null};
      } });
      targets.push(result.target); assert.equal(calls, 2); assert.equal(result.status, attempt === 1 ? 101 : 0);
      assert.equal(result.phase, 'coverage');
      assert.equal(result.fixture.executable, executable); assert.match(result.fixture.sha256, /^[a-f0-9]{64}$/);
      assert.equal(result.fixture.instrumented, false);
    }
    assert.notEqual(targets[0], targets[1]);
    assert.equal(env.QUANTOS_L01_FIXTURE_EXECUTABLE, '/stale/untrusted-peer');
  } finally { for (const target of targets) rmSync(target, {recursive: true, force: true}); }
});
for (const failure of [{status: 101, signal: null}, {status: null, signal: 'SIGTERM'}, {status: null, error: {code: 'ENOENT'}}]) {
  test(`fixture build failure stops before coverage: ${JSON.stringify(failure)}`, () => {
    let calls = 0;
    const result = runFreshCoverage(['cargo', 'llvm-cov', '--package', 'quantos-execution'], {run() { calls++; return failure; }});
    try { assert.equal(calls, 1); assert.equal(result.phase, 'fixture-build'); assert.equal(result.status, failure.status);
      assert.equal(result.signal, failure.signal); assert.equal(result.errorCode, failure.error?.code ?? null); }
    finally { rmSync(result.target, {recursive: true, force: true}); }
  });
}
test('successful build without the owned executable cannot run coverage', () => {
  let calls = 0;
  const result = runFreshCoverage(['cargo', 'llvm-cov', '-p', 'quantos-execution'], {run() { calls++; return {status: 0, signal: null}; }});
  try { assert.equal(calls, 1); assert.equal(result.phase, 'fixture-build'); assert.equal(result.errorCode, 'ENOENT'); }
  finally { rmSync(result.target, {recursive: true, force: true}); }
});
