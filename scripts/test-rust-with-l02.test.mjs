import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runRustTests } from './test-rust-with-l02.mjs';

const ok = { status: 0, signal: null };
const artifact = executable => JSON.stringify({ reason: 'compiler-artifact', target: { name: 'execution-gateway', kind: ['bin'] }, executable }) + '\n';

test('build emitted path overrides stale peer and forwards test selection and source', () => {
  const calls = [], peer = '/custom target/debug/execution-gateway';
  const result = runRustTests(['-p', 'bff-gateway', '--test', 'core_l04', '--locked'], {
    cwd: '/snapshot', env: { GITHUB_SHA: 'bound-source', CARGO_TARGET_DIR: '/custom target', QUANTOS_L02_FIXTURE_EXECUTABLE: '/stale' },
    exists: path => path === peer,
    run: (cmd, args, options) => { calls.push({ cmd, args, options }); return calls.length === 1 ? { ...ok, stdout: artifact(peer) } : ok; },
  });
  assert.equal(result.status, 0);
  assert.deepEqual(calls[0].args, ['build', '--locked', '--package', 'execution-gateway', '--bin', 'execution-gateway', '--message-format=json']);
  assert.deepEqual(calls[1].args, ['test', '-p', 'bff-gateway', '--test', 'core_l04', '--locked']);
  assert.equal(calls[1].options.env.QUANTOS_L02_FIXTURE_EXECUTABLE, peer);
  assert.equal(calls[1].options.env.GITHUB_SHA, 'bound-source');
  assert.equal(calls[0].options.env.CARGO_TARGET_DIR, '/custom target');
  assert.equal(calls[1].options.cwd, '/snapshot');
});

test('local source is resolved when GITHUB_SHA is absent; test failure propagates', () => {
  const calls = [];
  const result = runRustTests(['--workspace', '--locked'], { env: {}, exists: () => true,
    run: (cmd, args, options) => {
      calls.push({ cmd, args, options });
      if (cmd === 'git') return { ...ok, stdout: 'local-source\n' };
      if (args[0] === 'build') return { ...ok, stdout: artifact('/peer') };
      assert.equal(options.env.GITHUB_SHA, 'local-source');
      return { status: 101, signal: null };
    },
  });
  assert.deepEqual(calls.map(c => c.cmd), ['git', 'cargo', 'cargo']);
  assert.equal(result.status, 101);
  assert.equal(result.phase, 'test');
});

for (const [label, build, exists] of [
  ['build failure', { status: 101, signal: null }, true],
  ['interrupted build', { status: null, signal: 'SIGTERM' }, true],
  ['spawn error', { status: null, error: { code: 'ENOENT' } }, true],
  ['missing artifact', { ...ok, stdout: '' }, true],
  ['missing executable', { ...ok, stdout: artifact('/missing') }, false],
]) test(`${label} cannot execute or pass tests`, () => {
  let calls = 0;
  const result = runRustTests(['--workspace'], { env: { GITHUB_SHA: 'source' }, exists: () => exists,
    run: () => { calls++; return build; },
  });
  assert.equal(calls, 1);
  assert.equal(result.phase, 'fixture-build');
  assert(result.status !== 0 || result.signal || result.errorCode);
});
