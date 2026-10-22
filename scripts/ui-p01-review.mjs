import assert from 'node:assert/strict';
import process from 'node:process';
import console from 'node:console';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inventory, digest, nodesFromPlans, planInput, confined } from './provider-a1-receipts.mjs';
import { webEnvironment } from './p0-functional-scope.mjs';
export const directory = 'docs/audit/evidence/ui-p01-local-20261022';
export const checks = [
  ['unit', ['pnpm', 'exec', 'vitest', 'run', 'apps/terminal/tests/ui-p01-action.test.ts', 'apps/terminal/tests/auth-poc.test.ts', 'apps/terminal/tests/auth-bff.test.ts', 'apps/terminal/tests/ui102-callback-lifecycle.test.ts', 'apps/terminal/tests/deep-link-auth.test.ts', 'apps/terminal/tests/ui101-runtime.test.ts', 'apps/terminal/tests/ui104-settings.test.ts']],
  ['types', ['pnpm', '--filter', '@sumalpha/api-client', '--filter', '@sumalpha/terminal', 'typecheck']],
  ['lint', ['pnpm', '--filter', '@sumalpha/terminal', 'lint']],
  ['test-lint', ['pnpm', 'exec', 'eslint', 'tests/e2e/ui-p01.spec.ts', 'tests/e2e/ui102-auth.spec.ts', 'scripts/ui-p01-review.mjs', 'scripts/ui-p01-review.test.mjs', 'scripts/ui-p01-browser-environment.mjs']],
  ['negative', ['node', '--test', 'scripts/ui-p01-review.test.mjs', 'scripts/frontend-import-boundary.test.mjs']],
  ['build', ['pnpm', '--filter', '@sumalpha/terminal', 'build']],
  ['firefox-diagnostic', ['node', 'scripts/ui-p01-browser-environment.mjs', '{attempt}/firefox-environment.json']],
  ['browser', ['pnpm', 'exec', 'playwright', 'test', 'tests/e2e/ui-p01.spec.ts', '--grep-invert', 'visual baselines', '--project=chromium', '--project=webkit', '--workers=1', '--retries=0', '--update-snapshots=none', '--reporter=list,json', '--output={attempt}/browser/results']],
  ['regression', ['pnpm', 'exec', 'playwright', 'test', 'tests/e2e/ui102-auth.spec.ts', 'tests/e2e/ui102-current.spec.ts', 'tests/e2e/auth-callback.spec.ts', '--grep-invert', '视觉基线|visual baselines', '--project=chromium', '--workers=1', '--retries=0', '--update-snapshots=none', '--reporter=list,json', '--output={attempt}/regression/results']],
  ['visual', ['pnpm', 'exec', 'playwright', 'test', 'tests/e2e/ui-p01.spec.ts', '--grep', 'visual baselines', '--project=chromium', '--workers=1', '--retries=0', '--update-snapshots=none', '--reporter=list,json', '--output={attempt}/visual/results']],
  ['plans', ['node', 'scripts/check-development-plans.mjs']],
];
export const commands = attempt => checks.map(([id, command]) => ({ id, command: command.map(s => s.replaceAll('{attempt}', attempt)) }));
const read = p => readFileSync(confined(p));
export function snapshot() {
  const nodes = nodesFromPlans(), task = nodes.get('FE:UI-P01');
  return { inputs: inventory(['AGENTS.md', 'apps/terminal/', 'packages/', 'scripts/', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'patches/', '.nvmrc', 'tsconfig.base.json', 'eslint.config.mjs', 'playwright.config.ts', 'env/local-mock.env.example', 'tests/e2e/ui-p01.spec.ts', 'tests/e2e/ui-p01.spec.ts-snapshots/', 'tests/e2e/ui102-auth.spec.ts', 'tests/e2e/ui102-current.spec.ts', 'tests/e2e/auth-callback.spec.ts', 'design/P01-Identity-Access-Recovery-High-Fidelity-v1.png', 'docs/operations/ui-p01-current-function.md']), requirements: planInput(task), prerequisites: task.dependencies.map(nodeId => ({ nodeId, referenceOnly: true, currentReady: 'NOT_CLAIMED', requirements: planInput(nodes.get(nodeId)) })), checks };
}
function sourceCheck(inputs, sha) { assert.match(sha, /^[a-f0-9]{40}$/); for (const e of inputs) assert.equal(digest(execFileSync('git', ['show', `${sha}:${e.path}`], { maxBuffer: 32e6 })), e.sha256, 'source drift ' + e.path); }
export function validateExecution(actual, expected, readBytes = read) {
  assert.equal(actual.length, expected.length);
  for (const [i, r] of actual.entries()) { assert.equal(r.id, expected[i].id); assert.deepEqual(r.command, expected[i].command); assert.equal(r.exitCode, 0); assert.equal(r.signal, null); assert.equal(r.errorCode, null); assert(readBytes(r.log).length > 0); assert.equal(digest(readBytes(r.log)), r.logSha256); }
}
export function validateState(r) {
  assert.equal(r.schema, 'quantos-ui-p01-current-function/v1'); assert.equal(r.nodeId, 'FE:UI-P01');
  assert.equal(r.engineeringStatus, 'PASS'); assert.equal(r.clientContractIntegration, 'PASS'); assert.equal(r.stageGate, 'NOT_ASSESSED'); assert.equal(r.confirmation, 'PENDING'); assert.equal(r.firefoxBrowser, 'BLOCKED_ENVIRONMENT'); assert.equal(r.formalAccepted, false); assert.equal(r.runtimeAdmission, 'DENIED'); assert.equal(r.recursiveDependencyRevalidation, false);
  for (const k of ['realIdpMfa', 'targetBffDatabase', 'manualScreenReader', 'nativeZoom200', 'crossOSVisual', 'remoteCI', 'releaseAcceptance']) assert.equal(r[k], 'NOT_RUN');
}
export function validateBrowser(r, count) { assert.equal(r.stats.expected, count); for (const key of ['unexpected', 'flaky', 'skipped']) assert.equal(r.stats[key], 0); assert.deepEqual(r.errors, []); }
const files = p => readdirSync(p, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(p + '/' + e.name) : [p + '/' + e.name]);
export function verify(r) {
  validateState(r); assert.deepEqual(r.snapshot, snapshot(), 'current inputs changed'); assert.equal(r.inputDigest, digest(JSON.stringify(r.snapshot))); sourceCheck(r.snapshot.inputs, r.sourceCommit);
  const sourcePlans = nodesFromPlans(['docs/SumAlpha-QuantOS-Development-Plan.md', 'docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md'].map(p => execFileSync('git', ['show', `${r.sourceCommit}:${p}`], { encoding: 'utf8', maxBuffer: 4e6 })));
  assert.deepEqual(r.snapshot.requirements, planInput(sourcePlans.get('FE:UI-P01')));
  for (const ref of r.snapshot.prerequisites) assert.deepEqual(ref.requirements, planInput(sourcePlans.get(ref.nodeId)));
  validateExecution(r.executions, commands(r.attempt));
  assert(r.artifacts.length > 0); for (const a of r.artifacts) assert.equal(digest(read(a.path)), a.sha256, 'artifact drift ' + a.path);
  for (const [id, count] of [['browser', 26], ['regression', 18], ['visual', 2]]) { const path = `${r.attempt}/${id}/report.json`; assert(r.artifacts.some(a => a.path === path)); validateBrowser(JSON.parse(read(path)), count); }
  const scans = r.artifacts.filter(a => /\/axe-(dark|light)\.json$/.test(a.path)); assert.equal(scans.length, 4);
  for (const a of scans) { const s = JSON.parse(read(a.path)); assert.deepEqual(s.map(x => x.path), ['/login', '/mfa', '/access-request', '/unauthorized', '/offline']); for (const x of s) { assert.deepEqual(x.violations, []); assert(Array.isArray(x.incomplete)); } }
  const diagnostic = `${r.attempt}/firefox-environment.json`; assert(r.artifacts.some(a => a.path === diagnostic)); const env = JSON.parse(read(diagnostic)); assert.equal(env.browser, 'firefox'); assert.equal(env.launch, 'FAILED'); assert.equal(env.functionalTests, 'BLOCKED_ENVIRONMENT'); assert(env.error.length > 0);
  const build = `${r.attempt}/terminal-build.json`; assert(r.artifacts.some(a => a.path === build)); assert.equal(JSON.parse(read(build)).app, 'terminal'); assert.equal(JSON.parse(read(build)).buildId, 'terminal-' + r.sourceCommit);
  return { nodeId: r.nodeId, sourceCommit: r.sourceCommit, inputDigest: r.inputDigest, engineeringStatus: r.engineeringStatus, stageGate: r.stageGate, confirmation: r.confirmation, currentHeadAcceptance: 'NOT_CLAIMED' };
}
export function run(attempt) {
  assert(new RegExp('^' + directory + '/function-attempt-[0-9]+$').test(attempt)); assert(!existsSync(attempt));
  const captured = snapshot(), sourceCommit = execFileSync('git', ['rev-parse', 'HEAD']).toString().trim(); sourceCheck(captured.inputs, sourceCommit);
  mkdirSync(attempt, { recursive: true }); writeFileSync(attempt + '/inputs.json', JSON.stringify(captured, null, 2) + '\n'); const executions = [];
  for (const row of commands(attempt)) {
    const start = Date.now(), r = spawnSync(row.command[0], row.command.slice(1), { env: { ...webEnvironment(), CI: '1', PLAYWRIGHT_JSON_OUTPUT_NAME: resolve(attempt, row.id, 'report.json') }, encoding: 'utf8', timeout: 600000, maxBuffer: 32e6 });
    const bytes = (r.stdout ?? '') + (r.stderr ?? ''), log = attempt + '/' + row.id + '.log'; writeFileSync(log, bytes);
    executions.push({ ...row, startedAt: new Date(start).toISOString(), elapsedMs: Date.now() - start, exitCode: r.status, signal: r.signal, errorCode: r.error?.code ?? null, log, logSha256: digest(bytes) });
    writeFileSync(attempt + '/executions.json', JSON.stringify(executions, null, 2) + '\n'); console.log(row.id, r.status); assert.equal(r.status, 0, 'see ' + log); assert.equal(r.signal, null); assert(!r.error);
  }
  assert.deepEqual(snapshot(), captured); writeFileSync(attempt + '/terminal-build.json', readFileSync('apps/terminal/out/pre03-build.json'));
  const artifacts = files(attempt).map(path => ({ path, sha256: digest(read(path)) }));
  const r = { schema: 'quantos-ui-p01-current-function/v1', nodeId: 'FE:UI-P01', engineeringStatus: 'PASS', clientContractIntegration: 'PASS', stageGate: 'NOT_ASSESSED', confirmation: 'PENDING', firefoxBrowser: 'BLOCKED_ENVIRONMENT', formalAccepted: false, runtimeAdmission: 'DENIED', recursiveDependencyRevalidation: false, ...Object.fromEntries(['realIdpMfa', 'targetBffDatabase', 'manualScreenReader', 'nativeZoom200', 'crossOSVisual', 'remoteCI', 'releaseAcceptance'].map(k => [k, 'NOT_RUN'])), sourceCommit, inputDigest: digest(JSON.stringify(captured)), snapshot: captured, attempt, executions, artifacts };
  console.log(JSON.stringify(verify(r))); writeFileSync(attempt + '/receipt.json', JSON.stringify(r, null, 2) + '\n'); writeFileSync(directory + '/receipt.json', JSON.stringify(r, null, 2) + '\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) { try { if (process.argv[2] === '--run') run(process.argv[3]); else { assert.equal(process.argv[2], '--verify'); console.log(JSON.stringify(verify(JSON.parse(read(directory + '/receipt.json'))))); } } catch (e) { console.error(e.stack); process.exitCode = 1; } }
