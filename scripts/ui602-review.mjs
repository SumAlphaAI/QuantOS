import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';
import console from 'node:console';
import { hash, verifyInputs } from './g1-download-review.mjs';
import { webEnvironment } from './p0-functional-scope.mjs';
import { nodesFromPlans } from './provider-a1-receipts.mjs';
export const directory = 'docs/audit/evidence/ui602-local-20261024';
const read = p => readFileSync(p), json = p => JSON.parse(read(p)), git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64e6 });
const files = p => readdirSync(p, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(p + '/' + e.name) : [p + '/' + e.name]).sort();
export function inputs() { return git('ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', 'AGENTS.md', 'Cargo.toml', 'Cargo.lock', 'rust-toolchain.toml', '.cargo/', 'crates/', 'services/bff-gateway/', 'packages/', 'apps/terminal/app/', 'apps/terminal/src/', 'apps/terminal/tests/', 'apps/terminal/public/terminal-route-map.json', 'apps/terminal/package.json', 'apps/terminal/next.config.ts', 'apps/terminal/tsconfig.json', 'tests/contract/', 'tests/e2e/ui602.spec.ts', 'tests/e2e/ui-p23.spec.ts', 'tests/e2e/ui-p18.spec.ts', 'tests/e2e/fixtures/', 'bff/', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.base.json', 'eslint.config.mjs', 'playwright.config.ts', 'playwright.ui602.config.ts', 'playwright.ui-p18.config.ts', 'scripts/', 'env/', 'docs/operations/ui602-admin-governance.md', 'docs/execution/development-followups.json', 'docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md').split('\0').filter(p => p && !/(^|\/)\.env(\.|$)/.test(p) && !/(^|\/)(node_modules|out|dist|\.next)\//.test(p)).sort().map(path => ({ path, sha256: hash(read(path)) })); }
export function boundary(sourceCommit) { return { schema: 'quantos-ui602-function/v1', nodeId: 'FE:UI-602', sourceCommit, engineeringGate: 'PASS_UI602_ADMIN_GOVERNANCE', developmentStatus: 'IMPLEMENTED_PENDING_ACCEPTANCE', stageGate: 'NOT_ASSESSED', formalAccepted: false, runtimeAdmission: 'DENIED', identity: 'EXPLICIT_REFERENCE_COOKIE_BRIDGE', cors: 'LOOPBACK_PROXY_SUBSTITUTION', data: 'OWNED_SYNTHETIC_C11_REFERENCE', signedEngineReview: 'OWNED_REFERENCE_SIGNED_FIXTURE', auditRead: 'INDEPENDENT_AUTHORIZED_C10_SESSION', designAdaptation: 'FUNCTION_ONLY_P14_NOT_RUN', realIdpCookieCors: 'NOT_RUN', targetDatabase: 'NOT_RUN', externalSources: 'NOT_RUN', sameShaRemoteCI: 'NOT_RUN', firefox: 'NOT_RUN', webkit: 'NOT_RUN', manualScreenReader: 'NOT_RUN', nativeZoom200: 'NOT_RUN', performanceCapacitySoak: 'NOT_RUN', fullI8Integration: 'NOT_RUN', releaseAcceptance: 'NOT_RUN', g4Gate: 'NOT_READY_GAPS_OPEN', fep4Gate: 'NOT_READY_GAPS_OPEN', g4Workflow: 'IN_REVIEW', fep4Milestone: 'PARTIAL', markerSource: 'UI402-MARKER-SOURCE-01_OPEN', candleExport: 'P19-C10-EXPORT-01_NOT_IMPLEMENTED', valuationJoin: 'NOT_CLAIMED', sevenServiceHealth: 'P13-C11-SERVICE-01_OPEN', inspectEvidenceHttpPositive: 'NOT_RUN_REFERENCE_SOURCE_UNAVAILABLE', resolveHttpPositive: 'NOT_RUN_NO_REPAIR_HTTP', historicalEvidence: 'ORIGINAL_SCOPE_ONLY_UNCHANGED', recursiveDependencyRevalidation: false, productionCredentialsUsed: false, pushed: false, deployed: false, nextTask: 'FE:UI-P14' }; }
export function historyInputs() { return git('ls-files', '-z', '--', 'docs/audit/evidence/ui-p13-local-20261024', 'docs/audit/evidence/ui601-local-20261024', 'docs/audit/evidence/ui-p23-local-20261024', 'docs/audit/evidence/ui603-local-20261024', 'docs/audit/evidence/frontend-g4-local-20261024', 'docs/audit/evidence/fep4-function-local-20261024').split('\0').filter(Boolean).sort().map(path => ({ path, sha256: hash(read(path)) })); }
export function validateBoundary(r) { assert.match(r.sourceCommit, /^[a-f0-9]{40}$/); for (const [k, v] of Object.entries(boundary(r.sourceCommit)))
    assert.deepEqual(r[k], v, k); }
const check = (id, command, exit = 0) => ({ id, command, exit });
export const checks = [
    check('development', ['node', 'scripts/development-execution.mjs', '--development', 'FE:UI-602']),
    check('binary', ['cargo', 'build', '--locked', '--offline', '-p', 'bff-gateway', '--bin', 'bff-gateway']),
    check('native-governance', ['cargo', 'test', '--locked', '--offline', '-p', 'bff-gateway', '--lib', 'operations::tests::']),
    check('unit-consumer', ['pnpm', 'exec', 'vitest', 'run', 'apps/terminal/tests/ui602.test.ts', 'apps/terminal/tests/ui602-provider-consumer.test.ts', 'apps/terminal/tests/operations-provider-consumer.test.ts', 'packages/domain-ui/tests/ui101.test.ts', '--reporter=json', '--outputFile={attempt}/unit.json']),
    check('types', ['pnpm', '--filter', '@sumalpha/terminal', 'typecheck']),
    check('lint', ['pnpm', 'exec', 'eslint', 'apps/terminal/app/admin', 'apps/terminal/src/admin', 'apps/terminal/tests/ui602.test.ts', 'apps/terminal/tests/ui602-provider-consumer.test.ts', 'packages/domain-ui/src/ui101.ts', 'tests/e2e/ui602.spec.ts', 'tests/e2e/fixtures/ui602-reference.ts', 'playwright.config.ts', 'playwright.ui602.config.ts', 'scripts/ui602-review.mjs', 'scripts/ui602-review.test.mjs']),
    check('gate-routing', ['node', '--test', 'scripts/ui602-review.test.mjs', 'scripts/terminal-static-routes.test.mjs', 'scripts/development-execution.test.mjs']),
    check('terminal-build', ['pnpm', '--filter', '@sumalpha/terminal', 'build']),
    check('browser', ['pnpm', 'exec', 'playwright', 'test', '--config=playwright.ui602.config.ts', '--project=chromium', '--workers=1', '--retries=0', '--reporter=list,json', '--output={attempt}/browser']),
    check('plans', ['node', 'scripts/check-development-plans.mjs']),
    check('integration-refusal', ['node', 'scripts/development-execution.mjs', '--integration', 'FE:UI-602'], 1),
    check('next-development', ['node', 'scripts/development-execution.mjs', '--development', 'FE:UI-P14'])
];
export function validateExecution(e, c, attempt) { assert.deepEqual(e.command, c.command.map(s => s.replaceAll('{attempt}', attempt))); assert.equal(e.id, c.id); assert.equal(e.exitCode, c.exit); assert.equal(e.expectedExitCode, c.exit); assert.equal(e.signal, null); assert.equal(e.errorCode, null); assert.equal(e.log, attempt + '/' + c.id + '.log'); assert.equal(hash(read(e.log)), e.logSha256); assert(Date.parse(e.finishedAt) >= Date.parse(e.startedAt)); }
export function validateBrowser(r, count) { assert.equal(r.errors.length, 0); assert.deepEqual({ expected: r.stats.expected, unexpected: r.stats.unexpected, skipped: r.stats.skipped, flaky: r.stats.flaky }, { expected: count, unexpected: 0, skipped: 0, flaky: 0 }); const specs = s => [...(s.specs ?? []), ...(s.suites ?? []).flatMap(specs)], tests = r.suites.flatMap(specs).flatMap(s => s.tests); assert.equal(tests.length, count); for (const t of tests) {
    assert.equal(t.projectName, 'chromium');
    assert.equal(t.results.length, 1);
    assert.equal(t.results[0].status, 'passed');
} }
export function verify(r) {
    validateBoundary(r);
    assert(r.attempt.startsWith(directory + '/attempt-') && !r.attempt.includes('..'));
    assert.deepEqual(inputs(), r.inputs);
    verifyInputs(r.sourceCommit, r.inputs);
    assert.equal(r.executions.length, checks.length);
    r.executions.forEach((e, i) => validateExecution(e, checks[i], r.attempt));
    assert.deepEqual(r.artifacts.map(a => a.path).sort(), files(r.attempt));
    for (const a of r.artifacts) {
        assert(a.path.startsWith(r.attempt + '/') && !a.path.includes('..'));
        assert.equal(hash(read(a.path)), a.sha256);
    }
    const unit = json(r.attempt + '/unit.json');
    assert.equal(unit.success, true);
    assert.equal(unit.numTotalTests, unit.numPassedTests);
    assert(unit.numPassedTests >= 30);
    assert.equal(unit.numPendingTests, 0);
    assert.equal(unit.numFailedTests, 0);
    for (const s of unit.testResults)
        for (const a of s.assertionResults)
            assert.equal(a.status, 'passed');
    validateBrowser(json(r.attempt + '/browser/report.json'), 6);
    assert.match(read(r.attempt + '/native-governance.log').toString(), /22 passed; 0 failed/);
    const binary = json(r.attempt + '/binary.json');
    assert.equal(binary.sourceCommit, r.sourceCommit);
    assert.equal(binary.sha256, hash(read('target/debug/bff-gateway')));
    assert.equal(json(r.attempt + '/terminal-build.json').buildId, 'terminal-' + r.sourceCommit);
    for (const a of json(r.attempt + '/build-artifacts.json'))
        assert.equal(hash(read(a.path)), a.sha256);
    for (const c of ['members', 'roles', 'policies', 'capabilities', 'flags'])
        assert(r.artifacts.some(a => a.path.endsWith('/build-artifacts.json')) && json(r.attempt + '/build-artifacts.json').some(a => a.path === 'apps/terminal/out/admin/' + c + '.html'));
    const networks = r.artifacts.filter(a => a.path.startsWith(r.attempt + '/browser/') && a.path.endsWith('/ui602.json'));
    assert.equal(networks.length, 6);
    for (const a of networks) {
        const n = json(a.path);
        assert.equal(n.sourceCommit, r.sourceCommit);
        assert.equal('sha256:' + n.binarySha256, binary.sha256);
        assert.equal(n.status, 'passed');
        assert.equal(n.identity, r.identity);
        assert.equal(n.cors, r.cors);
        for (const row of n.rows) {
            assert(row.path.startsWith('/v1/'));
            assert(row.method === 'GET' || row.method === 'POST' && ['/v1/auth/mfa/challenges', '/v1/auth/reauth'].includes(row.path) || ['POST', 'PUT', 'DELETE'].includes(row.method) && /^\/v1\/admin\/(members|roles|policies|capabilities|feature-flags)(\/[a-f0-9-]{36})?$/.test(row.path));
            assert(!row.query?.ticket || row.query.ticket.startsWith('sha256:'));
        }
    }
    const mutations = networks.flatMap(a => json(a.path).rows).filter(r => !r.control && r.path.startsWith('/v1/admin/') && r.method !== 'GET');
    for (const c of ['members', 'roles', 'policies', 'capabilities', 'feature-flags'])
        assert(mutations.some(r => r.path === '/v1/admin/' + c && [200, 201].includes(r.status)) || c === 'feature-flags' && mutations.some(r => r.path.startsWith('/v1/admin/feature-flags/') && r.status === 200));
    assert(mutations.some(r => r.method === 'DELETE' && r.status === 200));
    assert(mutations.some(r => r.status === 409));
    const axe = r.artifacts.filter(a => a.path.endsWith('/ui602-axe.json'));
    assert.equal(axe.length, 1);
    const scans = json(axe[0].path).scans;
    assert.deepEqual(scans.map(s => [s.theme, s.width]), ['dark', 'light'].flatMap(t => [1440, 390].map(w => [t, w])));
    for (const s of scans)
        assert.equal(s.violations.length, 0);
    assert.equal(r.artifacts.filter(a => /admin-(dark|light)-(1440|390)\.png$/.test(a.path)).length, 4);
    assert.equal(r.artifacts.filter(a => a.path.endsWith('/admin-confirm-dark-1440.png')).length, 1);
    const node = nodesFromPlans().get('FE:UI-602');
    assert.equal(node.development_status, r.developmentStatus);
    assert.deepEqual(node.stage_gate, { stage: 'INTEGRATION', status: 'NOT_ASSESSED', input_digest: null, evidence: [] });
    assert.equal(json(r.attempt + '/integration-refusal.log').allowed, false);
    assert.equal(json(r.attempt + '/next-development.log').allowed, true);
    assert.deepEqual(historyInputs(), r.historyInputs);
    verifyInputs(r.sourceCommit, r.historyInputs);
    return { engineeringGate: r.engineeringGate, sourceCommit: r.sourceCommit, unitConsumerContractTests: unit.numPassedTests, nativeGovernanceTests: 22, chromiumCases: 6, historicalEvidenceFiles: r.historyInputs.length, axeScans: 4, axeIncomplete: scans.reduce((n, s) => n + s.incomplete.length, 0), stageGate: r.stageGate, formalAccepted: false, runtimeAdmission: 'DENIED', nextTask: r.nextTask };
}
export function run(attempt) {
    assert(attempt?.startsWith(directory + '/attempt-') && !attempt.includes('..') && !existsSync(attempt));
    const sourceCommit = git('rev-parse', 'HEAD').trim(), sourceInputs = inputs();
    verifyInputs(sourceCommit, sourceInputs);
    mkdirSync(attempt, { recursive: true });
    writeFileSync(attempt + '/inputs.json', JSON.stringify({ sourceCommit, inputs: sourceInputs }, null, 2) + '\n');
    const env = { ...webEnvironment(), NEXT_PUBLIC_QUANTOS_ENV: 'local-integrated', NEXT_PUBLIC_QUANTOS_MOCK_ENABLED: 'false', NEXT_PUBLIC_QUANTOS_BFF_ORIGIN: 'https://127.0.0.1:4010', NEXT_PUBLIC_QUANTOS_OIDC_ISSUER: 'https://127.0.0.1:4010', GITHUB_SHA: sourceCommit, CI: '1', QUANTOS_SKIP_ENV: '1', CARGO_NET_OFFLINE: 'true', QUANTOS_BFF_BASE: git('rev-parse', sourceCommit + '^').trim() }, executions = [];
    for (const c of checks) {
        const command = c.command.map(s => s.replaceAll('{attempt}', attempt));
        env.PLAYWRIGHT_JSON_OUTPUT_NAME = resolve(attempt, 'browser/report.json');
        const startedAt = new Date().toISOString(), out = spawnSync(command[0], command.slice(1), { env, encoding: 'utf8', maxBuffer: 64e6, timeout: 180000 }), log = attempt + '/' + c.id + '.log';
        writeFileSync(log, (out.stdout ?? '') + (out.stderr ?? ''));
        executions.push({ id: c.id, command, expectedExitCode: c.exit, exitCode: out.status, signal: out.signal, errorCode: out.error?.code ?? null, startedAt, finishedAt: new Date().toISOString(), log, logSha256: hash(read(log)) });
        writeFileSync(attempt + '/executions.json', JSON.stringify(executions, null, 2) + '\n');
        console.log(c.id, out.status);
        assert.equal(out.status, c.exit, c.id);
        if (c.id === 'binary')
            writeFileSync(attempt + '/binary.json', JSON.stringify({ sourceCommit, sha256: hash(read('target/debug/bff-gateway')) }) + '\n');
        if (c.id === 'terminal-build') {
            writeFileSync(attempt + '/terminal-build.json', read('apps/terminal/out/pre03-build.json'));
            writeFileSync(attempt + '/build-artifacts.json', JSON.stringify(files('apps/terminal/out').map(path => ({ path, sha256: hash(read(path)) })), null, 2) + '\n');
        }
    }
    const receipt = { ...boundary(sourceCommit), historyInputs: historyInputs(), attempt, inputs: sourceInputs, executions, artifacts: files(attempt).map(path => ({ path, sha256: hash(read(path)) })) };
    const result = verify(receipt);
    writeFileSync(directory + '/receipt.json', JSON.stringify(receipt, null, 2) + '\n');
    writeFileSync(directory + '/result.json', JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    try {
        if (process.argv[2] === '--run')
            run(process.argv[3]);
        else if (process.argv[2] === '--verify')
            console.log(JSON.stringify(verify(json(directory + '/receipt.json'))));
        else
            throw Error('Use --run <new attempt> or --verify');
    }
    catch (e) {
        console.error(e.stack);
        process.exitCode = 1;
    }
}
