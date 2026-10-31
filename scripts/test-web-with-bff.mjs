import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';
import console from 'node:console';

// Use the same assertion-enabled functional host as L04. Cargo supplies the
// actual path, including custom targets; never silently use a stale debug host.
export function runWebTests(args = ['test'], { run = spawnSync, env = process.env, cwd = process.cwd(), exists = existsSync } = {}) {
  const resultOf = (result, phase) => ({ status: result.status, signal: result.signal, errorCode: result.error?.code ?? null, phase });
  const build = run('cargo', ['build', '--locked', '--profile', 'owned-fixture', '--package', 'bff-gateway', '--bin', 'bff-gateway', '--message-format=json'],
    { cwd, env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'] });
  if (build.status !== 0 || build.signal || build.error) return resultOf(build, 'fixture-build');
  const artifact = build.stdout.split('\n').filter(Boolean).map(line => JSON.parse(line)).find(row =>
    row.reason === 'compiler-artifact' && row.target?.name === 'bff-gateway' && row.target.kind?.includes('bin') && row.executable);
  if (!artifact || !exists(artifact.executable)) return { status: 1, signal: null, errorCode: 'REFERENCE_BFF_FIXTURE_MISSING', phase: 'fixture-build' };
  console.log(`Owned Web fixture selected: ${artifact.executable}`);
  return resultOf(run('pnpm', args, { cwd, env: { ...env, QUANTOS_REFERENCE_BFF_EXECUTABLE: artifact.executable }, stdio: 'inherit' }), 'test');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const result = runWebTests(args.length ? args : ['test']);
  console.log(JSON.stringify({ schema: 'quantos-web-tests-with-bff/v1', ...result }));
  process.exitCode = result.errorCode || result.signal ? 1 : result.status ?? 1;
}
