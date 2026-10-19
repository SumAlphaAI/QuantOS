import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
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
