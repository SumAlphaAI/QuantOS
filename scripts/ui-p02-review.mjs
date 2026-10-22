import assert from 'node:assert/strict';
import console from 'node:console';
import process from 'node:process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inventory, digest, nodesFromPlans, planInput, confined } from './provider-a1-receipts.mjs';
import { webEnvironment } from './p0-functional-scope.mjs';
import { validateExecution, validateBrowser } from './ui-p01-review.mjs';
import { validateVisualBaselines } from './check-visual-baselines.mjs';
export const directory = 'docs/audit/evidence/ui-p02-local-20261022';
export const checks = [
  ['bff-build', ['cargo', 'build', '--locked', '--offline', '-p', 'bff-gateway', '--bin', 'bff-gateway']],
  ['unit', ['pnpm', 'exec', 'vitest', 'run', 'apps/terminal/tests/ui-p02-presentation.test.ts', 'apps/terminal/tests/ui101-source.test.ts', 'apps/terminal/tests/ui101-runtime.test.ts', 'apps/terminal/tests/ui101-http.test.ts', 'apps/terminal/tests/command-provider-consumer.test.ts', 'packages/domain-ui/tests/ui101.test.ts', 'packages/domain-ui/tests/chrome.test.tsx', 'packages/domain-ui/tests/indicators.test.tsx']],
  ['types', ['pnpm', '--filter', '@sumalpha/api-client', '--filter', '@sumalpha/domain-ui', '--filter', '@sumalpha/terminal', 'typecheck']],
  ['lint', ['pnpm', '--filter', '@sumalpha/domain-ui', '--filter', '@sumalpha/terminal', 'lint']],
  ['test-lint', ['pnpm', 'exec', 'eslint', 'tests/e2e/ui-p02.spec.ts', 'tests/e2e/ui-p02-http.spec.ts', 'tests/e2e/ui101-bff.spec.ts', 'tests/e2e/fixtures/ui-p02.ts', 'tests/e2e/fixtures/ui101.ts', 'tests/e2e/command.spec.ts', 'playwright.config.ts', 'playwright.ui-p02.config.ts', 'scripts/ui-p02-review.mjs', 'scripts/ui-p02-review.test.mjs']],
  ['negative', ['node', '--test', 'scripts/ui-p02-review.test.mjs', 'scripts/frontend-import-boundary.test.mjs']],
  ['terminal-bff', ['pnpm', '--filter', '@sumalpha/terminal', 'build']],
  ['browser', ['pnpm', 'exec', 'playwright', 'test', '--config=playwright.ui-p02.config.ts', 'tests/e2e/ui-p02.spec.ts', '--grep-invert', 'visual baseline', '--project=chromium', '--project=webkit', '--workers=1', '--retries=0', '--update-snapshots=none', '--reporter=list,json', '--output={attempt}/browser/results']],
  ['local-http', ['pnpm', 'exec', 'playwright', 'test', '--config=playwright.ui-p02.config.ts', 'tests/e2e/ui-p02-http.spec.ts', '--project=chromium', '--workers=1', '--retries=0', '--update-snapshots=none', '--reporter=list,json', '--output={attempt}/local-http/results']],
  ['regression', ['pnpm', 'exec', 'playwright', 'test', '--config=playwright.ui-p02.config.ts', 'tests/e2e/ui101-bff.spec.ts', '--project=chromium', '--workers=1', '--retries=0', '--update-snapshots=none', '--reporter=list,json', '--output={attempt}/regression/results']],
  ['visual', ['pnpm', 'exec', 'playwright', 'test', '--config=playwright.ui-p02.config.ts', 'tests/e2e/ui-p02.spec.ts', '--grep', 'visual baseline', '--project=chromium', '--workers=1', '--retries=0', '--update-snapshots=none', '--reporter=list,json', '--output={attempt}/visual/results']],
  ['terminal-mock', ['pnpm', '--filter', '@sumalpha/terminal', 'build']],
  ['mock-regression', ['pnpm', 'exec', 'playwright', 'test', 'tests/e2e/command.spec.ts', '--project=chromium', '--workers=1', '--retries=0', '--update-snapshots=none', '--reporter=list,json', '--output={attempt}/mock-regression/results']],
  ['firefox-diagnostic', ['node', 'scripts/ui-p01-browser-environment.mjs', '{attempt}/firefox-environment.json']],
  ['baselines', ['node', 'scripts/check-visual-baselines.mjs']],
  ['plans', ['node', 'scripts/check-development-plans.mjs']],
];
export const commands = attempt => checks.map(([id, command]) => ({ id, command: command.map(s => s.replaceAll('{attempt}', attempt)) }));
const read = path => readFileSync(confined(path));
export function snapshot() {
  const nodes = nodesFromPlans(), task = nodes.get('FE:UI-P02');
  return { inputs: inventory(['AGENTS.md', 'packages/', 'apps/terminal/', 'scripts/', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'patches/', 'tsconfig.base.json', 'eslint.config.mjs', '.nvmrc', 'playwright.config.ts', 'playwright.ui-p02.config.ts', 'env/local-mock.env.example', 'env/local-integrated.env.example', 'tests/e2e/ui-p02*', 'tests/e2e/fixtures/ui-p02.ts', 'tests/e2e/ui101-bff.spec.ts', 'tests/e2e/fixtures/ui101.ts', 'tests/e2e/command.spec.ts', 'tests/e2e/command.spec.ts-snapshots/command-1440-dark-chromium-darwin.png', 'tests/e2e/visual-baselines.json', 'docs/operations/ui-p02-current-function.md', 'design/P02-Command-Center-High-Fidelity-v1.png', 'Cargo.toml', 'Cargo.lock', 'rust-toolchain.toml', 'crates/', 'services/bff-gateway/', 'bff/', 'proto/']), requirements: planInput(task), prerequisites: task.dependencies.map(nodeId => ({ nodeId, referenceOnly: true, currentReady: 'NOT_CLAIMED', requirements: planInput(nodes.get(nodeId)) })), checks };
}
function sourceCheck(inputs, sha) { assert.match(sha, /^[a-f0-9]{40}$/); for (const e of inputs) assert.equal(digest(execFileSync('git', ['show', `${sha}:${e.path}`], { maxBuffer: 32e6 })), e.sha256, 'source drift ' + e.path); }
export const omitted = ['realIdpMfa', 'targetBffDatabase', 'realCookieCors', 'manualScreenReader', 'nativeZoom200', 'crossOSVisual', 'remoteCI', 'performanceAndSoak', 'releaseAcceptance'];
export function validateState(r) {
  assert.equal(r.schema, 'quantos-ui-p02-current-function/v1'); assert.equal(r.nodeId, 'FE:UI-P02'); assert.equal(r.engineeringStatus, 'PASS'); assert.equal(r.clientContractIntegration, 'PASS'); assert.equal(r.localModuleComposition, 'PASS_REFERENCE_FIXTURES_ONLY');
  assert.equal(r.confirmation, 'PENDING'); assert.equal(r.stageGate, 'NOT_ASSESSED'); assert.equal(r.firefoxBrowser, 'BLOCKED_ENVIRONMENT'); assert.equal(r.formalAccepted, false); assert.equal(r.runtimeAdmission, 'DENIED'); assert.equal(r.recursiveDependencyRevalidation, false); assert.equal(r.liveCommandStream, 'NOT_ENABLED_HTTP_SNAPSHOT'); for (const key of omitted) assert.equal(r[key], 'NOT_RUN');
}
export function validateLocalHttp(r) {
  assert.equal(r.mode, 'LOCAL_REFERENCE_SEEDED_PROVIDERS'); assert.equal(r.realIdp, 'NOT_RUN'); assert.equal(r.browserCookieCors, 'NOT_RUN_TEST_BRIDGE');
  const invalid = r.identityFixture === 'invalid-session', viewer = r.identityFixture === 'session-viewer';
  assert(['session-current', 'session-owner', 'session-viewer', 'invalid-session'].includes(r.identityFixture));
  assert.deepEqual(r.rows.map(row => row.path), invalid ? ['/v1/session'] : viewer ? ['/v1/session', '/v1/context'] : ['/v1/session', '/v1/context', '/v1/command/summary']); assert(r.rows.every(row => row.method === 'GET')); assert.equal(r.rows[0].status, invalid ? 401 : 200);
  if (!invalid && !viewer) { assert.equal(r.rows[2].status, 200); assert.equal(r.rows[2].body.accountId, r.rows[1].body.accountId); assert.equal(r.rows[2].body.mode, r.rows[1].body.mode); }
}
const files = path => readdirSync(path, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(path + '/' + e.name) : [path + '/' + e.name]);
export function verify(r) {
  validateState(r); assert.deepEqual(r.snapshot, snapshot(), 'current input drift'); assert.equal(r.inputDigest, digest(JSON.stringify(r.snapshot))); sourceCheck(r.snapshot.inputs, r.sourceCommit);
  const sourcePlans = nodesFromPlans(['docs/SumAlpha-QuantOS-Development-Plan.md', 'docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md'].map(p => execFileSync('git', ['show', `${r.sourceCommit}:${p}`], { encoding: 'utf8', maxBuffer: 4e6 })));
  assert.deepEqual(r.snapshot.requirements, planInput(sourcePlans.get('FE:UI-P02'))); assert.equal(r.snapshot.prerequisites.length, 16); for (const ref of r.snapshot.prerequisites) assert.deepEqual(ref.requirements, planInput(sourcePlans.get(ref.nodeId)));
  for (const [name, path] of [['visual-baselines.json', 'tests/e2e/visual-baselines.json'], ['command-1440-dark-chromium-darwin.png', 'tests/e2e/command.spec.ts-snapshots/command-1440-dark-chromium-darwin.png']]) assert.deepEqual(read(directory + '/legacy-visual-before/' + name), execFileSync('git', ['show', `b6537135e9cc1ec4b1b51db0bb4174f378d31c38:${path}`], { maxBuffer: 16e6 }), 'historical visual original drift');
  validateExecution(r.executions, commands(r.attempt)); for (const a of r.artifacts) assert.equal(digest(read(a.path)), a.sha256, 'artifact drift ' + a.path);
  for (const [id, count] of [['browser', 38], ['local-http', 4], ['regression', 14], ['visual', 2], ['mock-regression', 7]]) { const path = `${r.attempt}/${id}/report.json`; assert(r.artifacts.some(a => a.path === path)); validateBrowser(JSON.parse(read(path)), count); }
  const axe = r.artifacts.filter(a => /\/axe-(dark|light)\.json$/.test(a.path)); assert.equal(axe.length, 4); for (const a of axe) { const scans = JSON.parse(read(a.path)); assert.deepEqual(scans.map(s => s.width), [1440, 1024, 390]); for (const scan of scans) { assert.deepEqual(scan.violations, []); assert(Array.isArray(scan.incomplete)); } }
  const http = r.artifacts.filter(a => a.path.endsWith('/reference-http.json')); assert.equal(http.length, 4); const identities = []; for (const a of http) { const h = JSON.parse(read(a.path)); validateLocalHttp(h); identities.push(h.identityFixture); } assert.equal(new Set(identities).size, 4);
  const fpath = r.attempt + '/firefox-environment.json'; assert(r.artifacts.some(a => a.path === fpath)); const firefox = JSON.parse(read(fpath)); assert.equal(firefox.launch, 'FAILED'); assert.equal(firefox.functionalTests, 'BLOCKED_ENVIRONMENT'); assert(firefox.error.length > 0);
  for (const id of ['terminal-bff', 'terminal-mock']) { const p = r.attempt + '/' + id + '-build.json'; assert(r.artifacts.some(a => a.path === p)); const b = JSON.parse(read(p)); assert.equal(b.app, 'terminal'); assert.equal(b.buildId, 'terminal-' + r.sourceCommit); }
  const binaryPath = r.attempt + '/bff-executable.json'; assert(r.artifacts.some(a => a.path === binaryPath)); assert.equal(JSON.parse(read(binaryPath)).sourceCommit, r.sourceCommit);
  assert.equal(validateVisualBaselines().status, 'PASS');
  return { nodeId: r.nodeId, sourceCommit: r.sourceCommit, inputDigest: r.inputDigest, engineeringStatus: r.engineeringStatus, localModuleComposition: r.localModuleComposition, stageGate: r.stageGate, confirmation: r.confirmation, firefoxBrowser: r.firefoxBrowser, formalAccepted: false, runtimeAdmission: 'DENIED', currentHeadAcceptance: 'NOT_CLAIMED' };
}
export function run(attempt) {
  assert(new RegExp('^' + directory + '/function-attempt-[0-9]+$').test(attempt)); assert(!existsSync(attempt));
  const captured = snapshot(), sourceCommit = execFileSync('git', ['rev-parse', 'HEAD']).toString().trim(); sourceCheck(captured.inputs, sourceCommit);
  mkdirSync(attempt, { recursive: true }); writeFileSync(attempt + '/inputs.json', JSON.stringify(captured, null, 2) + '\n'); const executions = [];
  for (const row of commands(attempt)) {
    const start = Date.now(), mock = row.id === 'terminal-mock' || row.id === 'mock-regression';
    const r = spawnSync(row.command[0], row.command.slice(1), { env: { ...webEnvironment(), ...(!mock ? { NEXT_PUBLIC_QUANTOS_ENV: 'local-integrated', NEXT_PUBLIC_QUANTOS_MOCK_ENABLED: 'false' } : {}), CARGO_NET_OFFLINE: 'true', CARGO_BUILD_JOBS: '1', CI: '1', PLAYWRIGHT_JSON_OUTPUT_NAME: resolve(attempt, row.id, 'report.json') }, encoding: 'utf8', timeout: 600000, maxBuffer: 32e6 });
    const bytes = (r.stdout ?? '') + (r.stderr ?? ''), log = attempt + '/' + row.id + '.log'; writeFileSync(log, bytes); executions.push({ ...row, exitCode: r.status, signal: r.signal, errorCode: r.error?.code ?? null, startedAt: new Date(start).toISOString(), elapsedMs: Date.now() - start, log, logSha256: digest(bytes) }); writeFileSync(attempt + '/executions.json', JSON.stringify(executions, null, 2) + '\n'); console.log(row.id, r.status); assert.equal(r.status, 0, 'see ' + log); assert.equal(r.signal, null); assert(!r.error);
    if (row.id === 'bff-build') { const path = 'target/debug/' + (process.platform === 'win32' ? 'bff-gateway.exe' : 'bff-gateway'); const bytes = readFileSync(path); writeFileSync(attempt + '/bff-executable.json', JSON.stringify({ sourceCommit, path, bytes: bytes.length, sha256: digest(bytes) }, null, 2) + '\n'); }
    if (row.id === 'terminal-bff' || row.id === 'terminal-mock') writeFileSync(attempt + '/' + row.id + '-build.json', readFileSync('apps/terminal/out/pre03-build.json'));
  }
  assert.deepEqual(snapshot(), captured); const binary = JSON.parse(read(attempt + '/bff-executable.json')); assert.equal(digest(readFileSync(binary.path)), binary.sha256, 'BFF executable changed during tests'); const artifacts = [...files(attempt), ...files(directory + '/legacy-visual-before')].map(path => ({ path, sha256: digest(read(path)) }));
  const r = { schema: 'quantos-ui-p02-current-function/v1', nodeId: 'FE:UI-P02', sourceCommit, inputDigest: digest(JSON.stringify(captured)), snapshot: captured, attempt, executions, artifacts, engineeringStatus: 'PASS', clientContractIntegration: 'PASS', localModuleComposition: 'PASS_REFERENCE_FIXTURES_ONLY', stageGate: 'NOT_ASSESSED', confirmation: 'PENDING', firefoxBrowser: 'BLOCKED_ENVIRONMENT', formalAccepted: false, runtimeAdmission: 'DENIED', recursiveDependencyRevalidation: false, liveCommandStream: 'NOT_ENABLED_HTTP_SNAPSHOT', ...Object.fromEntries(omitted.map(k => [k, 'NOT_RUN'])) };
  console.log(JSON.stringify(verify(r))); writeFileSync(attempt + '/receipt.json', JSON.stringify(r, null, 2) + '\n'); writeFileSync(directory + '/receipt.json', JSON.stringify(r, null, 2) + '\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) { try { if (process.argv[2] === '--run') run(process.argv[3]); else { assert.equal(process.argv[2], '--verify'); console.log(JSON.stringify(verify(JSON.parse(read(directory + '/receipt.json'))))); } } catch (e) { console.error(e.stack); process.exitCode = 1; } }
