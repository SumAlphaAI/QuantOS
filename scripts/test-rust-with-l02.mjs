import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';
import console from 'node:console';

// Cargo builds an integration test's own package binaries, but does not build
// dependency binaries. L04 must use a freshly built, explicitly selected L02 peer.
export function runRustTests(args, { run = spawnSync, env = process.env, cwd = process.cwd(), exists = existsSync } = {}) {
  const resultOf = (result, phase) => ({ status: result.status, signal: result.signal,
    errorCode: result.error?.code ?? null, phase });
  const options = { cwd, env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'] };
  let source = env.GITHUB_SHA;
  if (!source) {
    const git = run('git', ['rev-parse', 'HEAD'], options);
    if (git.status !== 0 || git.signal || git.error) return resultOf(git, 'source');
    source = git.stdout.trim();
  }
  const build = run('cargo', ['build', '--locked', '--profile', 'owned-fixture', '--package', 'execution-gateway', '--package', 'bff-gateway', '--bins', '--message-format=json'], options);
  if (build.status !== 0 || build.signal || build.error) return resultOf(build, 'fixture-build');
  // Use Cargo's emitted path, including custom CARGO_TARGET_DIR/configuration.
  const artifacts = build.stdout.split('\n').filter(Boolean).map(line => JSON.parse(line));
  const peer = artifacts.find(row => row.reason === 'compiler-artifact'
    && row.target?.name === 'execution-gateway' && row.target.kind?.includes('bin') && row.executable)?.executable;
  const bff = artifacts.find(row => row.reason === 'compiler-artifact'
    && row.target?.name === 'bff-gateway' && row.target.kind?.includes('bin') && row.executable)?.executable;
  if (!peer || !exists(peer)) return { status: 1, signal: null, errorCode: 'L02_FIXTURE_MISSING', phase: 'fixture-build' };
  if (!bff || !exists(bff)) return { status: 1, signal: null, errorCode: 'L04_BFF_FIXTURE_MISSING', phase: 'fixture-build' };
  const childEnv = { ...env, GITHUB_SHA: source, QUANTOS_L02_FIXTURE_EXECUTABLE: peer, QUANTOS_L04_BFF_EXECUTABLE: bff };
  console.log(`L02 owned fixture selected: ${peer}`);
  const cargoArgs = args.slice(0, args.indexOf('--') < 0 ? args.length : args.indexOf('--'));
  const explicitProfile = cargoArgs.some(arg => arg === '--profile' || arg.startsWith('--profile=') || arg === '--release');
  const testArgs = explicitProfile ? args : ['--profile', 'owned-fixture', ...args];
  return resultOf(run('cargo', ['test', ...testArgs], { cwd, env: childEnv, stdio: 'inherit' }), 'test');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = runRustTests(process.argv.slice(2));
  console.log(JSON.stringify({ schema: 'quantos-rust-tests-with-l02/v1', ...result }));
  process.exitCode = result.errorCode || result.signal ? 1 : result.status ?? 1;
}
