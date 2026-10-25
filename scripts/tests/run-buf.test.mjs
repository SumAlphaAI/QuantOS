import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {runBuf} from '../run-buf.mjs';

const failure = stderr => ({code: 7, stderr});
async function probe(results) {
  const calls = [], sleeps = [];
  const code = await runBuf('buf', ['breaking', '--against', '.git#ref=trusted'], {
    execute: async (...args) => { calls.push(args); return results.shift(); },
    delay: async ms => sleeps.push(ms), log() {},
  });
  return {code, calls, sleeps};
}
test('explicit transport failure retries the exact invocation then succeeds', async () => {
  const r = await probe([failure('Failure: deadline_exceeded: context deadline exceeded'), {code: 0}]);
  assert.equal(r.code, 0);
  assert.deepEqual(r.calls, Array(2).fill(['buf', ['breaking', '--against', '.git#ref=trusted']]));
  assert.deepEqual(r.sleeps, [1000]);
});
test('exhausted transport failure retains nonzero status and bounded attempts', async () => {
  const r = await probe(Array(3).fill(failure('Failure: unavailable: network')));
  assert.equal(r.code, 7); assert.equal(r.calls.length, 3); assert.deepEqual(r.sleeps, [1000, 2000]);
});
for (const stderr of ['schema.proto:1: invalid schema', 'Failure: failed_precondition: breaking change', 'plugin failed: deadline_exceeded']) {
  test(`source or plugin error is never retried: ${stderr}`, async () => {
    const r = await probe([failure(stderr)]);
    assert.equal(r.code, 7); assert.equal(r.calls.length, 1); assert.deepEqual(r.sleeps, []);
  });
}
test('signals cannot become successful retries', async () => {
  const r = await probe([{code: null, signal: 'SIGTERM', stderr: 'Failure: unavailable: network'}]);
  assert.equal(r.code, 1); assert.equal(r.calls.length, 1);
});
test('CLI streams generator output, preserves arguments and returns its failing status', t => {
  const directory = mkdtempSync(join(tmpdir(), 'quantos-buf-test-'));
  t.after(() => rmSync(directory, {recursive: true, force: true}));
  const fixture = join(directory, 'buf.cjs');
  writeFileSync(fixture, "console.log(JSON.stringify(process.argv.slice(2)));console.error('invalid schema');process.exitCode=9;");
  const result = spawnSync(process.execPath, ['scripts/run-buf.mjs', process.execPath, fixture, 'a b'], {encoding: 'utf8'});
  assert.equal(result.status, 9); assert.equal(result.stdout.trim(), '["a b"]');
  assert.match(result.stderr, /invalid schema/); assert.doesNotMatch(result.stderr, /retrying/);
});
test('missing executable rejects instead of reporting success', async () => {
  await assert.rejects(runBuf('/quantos-nonexistent-buf', ['build'], {log() {}}), /ENOENT/);
});
