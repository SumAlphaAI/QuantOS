import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runRustTests } from './test-rust-with-l02.mjs';

const ok = { status: 0, signal: null };
const artifact = (executable, name = 'execution-gateway') => JSON.stringify({ reason: 'compiler-artifact', target: { name, kind: ['bin'] }, executable }) + '\n';
const hosts = peer => artifact(peer) + artifact(peer + '-bff', 'bff-gateway');

test('build emitted path overrides stale peer and forwards test selection and source', () => {
  const calls = [], peer = '/custom target/debug/execution-gateway';
  const result = runRustTests(['-p', 'bff-gateway', '--test', 'core_l04', '--locked'], {
    cwd: '/snapshot', env: { GITHUB_SHA: 'bound-source', CARGO_TARGET_DIR: '/custom target', QUANTOS_L02_FIXTURE_EXECUTABLE: '/stale' },
    exists: path => [peer, peer + '-bff'].includes(path),
    run: (cmd, args, options) => { calls.push({ cmd, args, options }); return calls.length === 1 ? { ...ok, stdout: hosts(peer) } : ok; },
  });
  assert.equal(result.status, 0);
  assert.deepEqual(calls[0].args, ['build', '--locked', '--profile', 'owned-fixture', '--package', 'execution-gateway', '--package', 'bff-gateway', '--bins', '--message-format=json']);
  assert.deepEqual(calls[1].args, ['test', '--profile', 'owned-fixture', '-p', 'bff-gateway', '--test', 'core_l04', '--locked']);
  assert.equal(calls[1].options.env.QUANTOS_L02_FIXTURE_EXECUTABLE, peer);
  assert.equal(calls[1].options.env.QUANTOS_L04_BFF_EXECUTABLE, peer + '-bff');
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
      if (args[0] === 'build') return { ...ok, stdout: hosts('/peer') };
      assert.equal(options.env.GITHUB_SHA, 'local-source');
      return { status: 101, signal: null };
    },
  });
  assert.deepEqual(calls.map(c => c.cmd), ['git', 'cargo', 'cargo']);
  assert.equal(result.status, 101);
  assert.equal(result.phase, 'test');
});

for (const selection of [['--profile', 'dev'], ['--profile=dev'], ['--release']]) {
  test(`explicit test profile ${selection.join(' ')} is forwarded`, () => {
    const calls = [], args = [...selection, '-p', 'bff-gateway', '--test', 'core_l04'];
    runRustTests(args, { env: { GITHUB_SHA: 'source' }, exists: () => true,
      run: (_cmd, forwarded) => { calls.push(forwarded); return calls.length === 1 ? { ...ok, stdout: hosts('/peer') } : ok; },
    });
    assert.deepEqual(calls[1], ['test', ...args]);
  });
}

for (const [label, build, exists] of [
  ['build failure', { status: 101, signal: null }, true],
  ['interrupted build', { status: null, signal: 'SIGTERM' }, true],
  ['spawn error', { status: null, error: { code: 'ENOENT' } }, true],
  ['missing artifact', { ...ok, stdout: '' }, true],
  ['missing executable', { ...ok, stdout: hosts('/missing') }, false],
  ['missing BFF artifact', { ...ok, stdout: artifact('/peer') }, true],
  ['missing execution artifact', { ...ok, stdout: artifact('/bff', 'bff-gateway') }, true],
]) test(`${label} cannot execute or pass tests`, () => {
  let calls = 0;
  const result = runRustTests(['--workspace'], { env: { GITHUB_SHA: 'source' }, exists: () => exists,
    run: () => { calls++; return build; },
  });
  assert.equal(calls, 1);
  assert.equal(result.phase, 'fixture-build');
  assert(result.status !== 0 || result.signal || result.errorCode);
});
