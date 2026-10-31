import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runWebTests } from './test-web-with-bff.mjs';

const ok = { status: 0, signal: null };
const artifact = JSON.stringify({ reason: 'compiler-artifact', target: { name: 'bff-gateway', kind: ['bin'] }, executable: '/custom target/owned-fixture/bff-gateway' });

test('builds current functional host and overrides stale executable while preserving archive provenance', () => {
  const calls = [];
  const result = runWebTests(undefined, { cwd: '/archive', env: { GITHUB_SHA: 'frozen-source', CARGO_TARGET_DIR: '/custom target', QUANTOS_REFERENCE_BFF_EXECUTABLE: '/stale' }, exists: () => true,
    run: (command, args, options) => { calls.push({ command, args, options }); return calls.length === 1 ? { ...ok, stdout: artifact } : ok; },
  });
  assert.equal(result.status, 0);
  assert.deepEqual(calls[0].args, ['build', '--locked', '--profile', 'owned-fixture', '--package', 'bff-gateway', '--bin', 'bff-gateway', '--message-format=json']);
  assert.equal(calls[1].command, 'pnpm');
  assert.deepEqual(calls[1].args, ['test']);
  assert.equal(calls[1].options.env.QUANTOS_REFERENCE_BFF_EXECUTABLE, '/custom target/owned-fixture/bff-gateway');
  assert.equal(calls[1].options.env.GITHUB_SHA, 'frozen-source');
  assert.equal(calls[1].options.cwd, '/archive');
});

test('explicit scope and failing test result are propagated', () => {
  let count = 0;
  const result = runWebTests(['--filter', '@sumalpha/terminal', 'test'], { exists: () => true, run: (_command, args) => {
    if (++count === 1) return { ...ok, stdout: artifact };
    assert.deepEqual(args, ['--filter', '@sumalpha/terminal', 'test']);
    return { status: 1, signal: null };
  } });
  assert.equal(result.status, 1);
  assert.equal(result.phase, 'test');
});

for (const [name, build, present] of [
  ['build failure', { status: 101 }, true], ['interruption', { signal: 'SIGTERM' }, true], ['spawn error', { error: { code: 'ENOENT' } }, true],
  ['missing artifact', { ...ok, stdout: '' }, true], ['missing file', { ...ok, stdout: artifact }, false],
]) test(`${name} cannot run tests or report success`, () => {
  let count = 0;
  const result = runWebTests(undefined, { exists: () => present, run: () => { count++; return build; } });
  assert.equal(count, 1);
  assert.equal(result.phase, 'fixture-build');
  assert(result.status !== 0 || result.signal || result.errorCode);
});
