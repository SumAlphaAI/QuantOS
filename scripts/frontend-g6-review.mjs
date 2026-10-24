import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';
import console from 'node:console';
import { hash, verifyInputs } from './g1-download-review.mjs';
import { webEnvironment } from './p0-functional-scope.mjs';
import { nodesFromPlans, planInput } from './provider-a1-receipts.mjs';
export const directory = 'docs/audit/evidence/frontend-g6-local-20261024';
const read = p => readFileSync(p), json = p => JSON.parse(read(p)), git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64e6 });
const files = p => readdirSync(p, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(p + '/' + e.name) : [p + '/' + e.name]).sort();
export const baseCommit = '032a7a659b7e37cca63cc45fba7d48d151f430b1';
export function inputs() { return git('ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', 'AGENTS.md', 'Cargo.toml', 'Cargo.lock', 'rust-toolchain.toml', '.cargo/', 'crates/', 'services/bff-gateway/', 'packages/', 'apps/terminal/app/', 'apps/terminal/src/', 'apps/terminal/tests/', 'apps/terminal/public/terminal-route-map.json', 'apps/terminal/package.json', 'apps/terminal/next.config.ts', 'apps/terminal/tsconfig.json', 'tests/e2e/frontend-g6.spec.ts', 'tests/e2e/ui-p23.spec.ts', 'tests/e2e/ui601.spec.ts', 'tests/e2e/ui602.spec.ts', 'tests/e2e/fixtures/', 'bff/', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.base.json', 'eslint.config.mjs', 'playwright.config.ts', 'playwright.frontend-g6.config.ts', 'playwright.frontend-g6-impact.config.ts', 'scripts/', 'env/', 'docs/operations/frontend-g6-bounded-composition.md', 'docs/execution/development-followups.json', 'docs/SumAlpha-QuantOS-Development-Plan.md', 'docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md').split('\0').filter(p => p && !/(^|\/)\.env(\.|$)/.test(p) && !/(^|\/)(node_modules|out|dist|\.next)\//.test(p)).sort().map(path => ({ path, sha256: hash(read(path)) })); }
export const historicalGroups = ['ui-p14-local-20261024', 'ui602-local-20261024', 'ui-p13-local-20261024', 'ui601-local-20261024', 'ui-p23-local-20261024', 'ui603-local-20261024', 'frontend-g4-local-20261024', 'fep4-function-local-20261024'];
export function boundary(sourceCommit) { return { schema: 'quantos-frontend-g6-composition/v1', nodeId: 'FRONTEND-GATE:G6', sourceCommit, engineeringGate: 'PASS_G6_OWNED_LOCAL_COMPOSITION', g6Gate: 'NOT_READY_GAPS_OPEN', reviewStatus: 'IN_REVIEW', stageGate: 'NOT_ASSESSED', formalAccepted: false, runtimeAdmission: 'DENIED', fep6Milestone: 'UNSPECIFIED_NOT_CLOSED', closesCoreX06: 'NOT_CLAIMED', productCodeChanged: false, currentFunctionalDefects: 'NONE_OBSERVED_IN_THIS_COMPOSITION', identity: 'EXPLICIT_REFERENCE_COOKIE_BRIDGE', cors: 'LOOPBACK_PROXY_SUBSTITUTION', data: 'OWNED_SYNTHETIC_REFERENCE_SINGLE_INSTANCE', corruption: 'EXPLICIT_PROXY_DELIVERY_NOT_BFF_OUTPUT', notification: 'APPLICATION_INBOX_BOUNDED_SSE_ONLY', systemBackgroundPush: 'NOT_PROVIDED_NOT_CLAIMED', governedFlagRefusal: 409, inspectEvidenceHttpPositive: 'NOT_RUN_REFERENCE_SOURCE_UNAVAILABLE', resolveHttpPositive: 'NOT_RUN_NO_REPAIR_HTTP', nativeResolve: 'OWNED_NATIVE_REPAIR_ONLY', sevenServiceHealth: 'P13-C11-SERVICE-01_OPEN', p14Metadata: 'P14-C11-METADATA-01_OPEN', p14History: 'P14-C11-HISTORY-01_OPEN', p14Export: 'P14-C11-EXPORT-01_OPEN', p14Stream: 'P14-C11-STREAM-01_OPEN', g4Workflow: 'IN_REVIEW', g4Gate: 'NOT_READY_GAPS_OPEN', fep4Gate: 'NOT_READY_GAPS_OPEN', fep4Milestone: 'PARTIAL', markerSource: 'UI402-MARKER-SOURCE-01_OPEN', candleExport: 'P19-C10-EXPORT-01_NOT_IMPLEMENTED', valuationJoin: 'NOT_CLAIMED', realIdpCookieCors: 'NOT_RUN', targetDatabase: 'NOT_RUN', externalSources: 'NOT_RUN', crossProcessDurableRecovery: 'NOT_RUN', sameShaRemoteCI: 'NOT_RUN', firefox: 'NOT_RUN', webkit: 'NOT_RUN', manualScreenReader: 'NOT_RUN', nativeZoom200: 'NOT_RUN', visualMatrix: 'NOT_REEXECUTED_UNCHANGED_LAYOUT_ORIGINAL_SCOPE_ONLY', performanceCapacitySoak: 'NOT_RUN', fullI8Integration: 'NOT_RUN_FULL_SCOPE', releaseAcceptance: 'NOT_RUN', historicalEvidence: 'ORIGINAL_SCOPE_ONLY_UNCHANGED', recursiveDependencyRevalidation: false, productionCredentialsUsed: false, pushed: false, deployed: false, nextTask: 'FE:FEP-6' }; }
export function historyInputs() { return git('ls-files', '-z', '--', ...historicalGroups.map(g => 'docs/audit/evidence/' + g)).split('\0').filter(Boolean).sort().map(path => ({ path, sha256: hash(read(path)) })); }
export function planCheck() { const paths = ['docs/SumAlpha-QuantOS-Development-Plan.md', 'docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md'], before = nodesFromPlans(paths.map(p => git('show', baseCommit + ':' + p))), current = nodesFromPlans(); assert.equal(current.size, 159); assert.equal(before.size, 159); for (const [id, n] of current) {
    const old = before.get(id);
    assert.deepEqual(n.stage_gate, old.stage_gate, id + ' stage');
    assert.deepEqual(planInput(n), planInput(old), id + ' normative');
    assert.equal(n.review_status, id === 'FRONTEND-GATE:G6' ? 'IN_REVIEW' : old.review_status, id + ' review');
    assert.equal(n.development_status, old.development_status, id + ' development');
} assert.equal(read('docs/execution/development-followups.json').toString(), git('show', baseCommit + ':docs/execution/development-followups.json')); for (const p of git('diff', baseCommit, 'HEAD', '--name-only', '--', 'apps/terminal/app/', 'apps/terminal/src/', 'services/', 'crates/', 'packages/').split('\n').filter(Boolean))
    assert.fail('Unexpected product change ' + p); return { stageGatesPreserved: 159, normativeInputsPreserved: true, g6Review: 'IN_REVIEW', fep6Unchanged: true, retainedFollowupsUnchanged: true, productCodeChanged: false }; }
export function dependencies() { const nodes = nodesFromPlans(); return nodes.get('FRONTEND-GATE:G6').dependencies.map(nodeId => ({ nodeId, stageGate: nodes.get(nodeId).stage_gate, development: nodes.get(nodeId).development_status ?? 'UNSPECIFIED', scope: 'ORIGINAL_SCOPE_ONLY', currentCandidateAcceptance: 'NOT_CLAIMED' })); }
export function validateBoundary(r) {
    assert.match(r.sourceCommit, /^[a-f0-9]{40}$/);
    for (const [k, v] of Object.entries(boundary(r.sourceCommit)))
        assert.deepEqual(r[k], v, k);
}
const check = (id, command, exit = 0) => ({ id, command, exit });
export const focusedTests = ['frontend-g6.test.ts', 'frontend-g6-provider-consumer.test.ts', 'ui603.test.ts', 'ui603-provider-consumer.test.ts', 'ui-p23.test.ts', 'ui601.test.ts', 'ui601-provider-consumer.test.ts', 'ui-p13.test.ts', 'ui602.test.ts', 'ui602-provider-consumer.test.ts', 'ui-p14.test.ts', 'operations-provider-consumer.test.ts', 'g1-route-access.test.ts'].map(p => 'apps/terminal/tests/' + p);
export const checks = [
    check('development', ['node', 'scripts/development-execution.mjs', '--development', 'FRONTEND-GATE:G6']),
    check('binary', ['cargo', 'build', '--locked', '--offline', '-p', 'bff-gateway', '--bin', 'bff-gateway']),
    check('native-c11', ['cargo', 'test', '--locked', '--offline', '-p', 'bff-gateway', '--lib', 'operations::tests::']),
    check('unit-consumer', ['pnpm', 'exec', 'vitest', 'run', ...focusedTests, '--reporter=json', '--outputFile={attempt}/unit.json']),
    check('types', ['pnpm', '--filter', '@sumalpha/terminal', 'typecheck']),
    check('lint', ['pnpm', 'exec', 'eslint', 'apps/terminal/tests/frontend-g6.test.ts', 'apps/terminal/tests/frontend-g6-provider-consumer.test.ts', 'tests/e2e/frontend-g6.spec.ts', 'tests/e2e/fixtures/frontend-g6-reference.ts', 'playwright.config.ts', 'playwright.frontend-g6.config.ts', 'playwright.frontend-g6-impact.config.ts', 'scripts/frontend-g6-review.mjs', 'scripts/frontend-g6-review.test.mjs']),
    check('gate-routing', ['node', '--test', 'scripts/frontend-g6-review.test.mjs', 'scripts/terminal-static-routes.test.mjs', 'scripts/development-execution.test.mjs']),
    check('terminal-build', ['pnpm', '--filter', '@sumalpha/terminal', 'build']),
    check('browser', ['pnpm', 'exec', 'playwright', 'test', '--config=playwright.frontend-g6.config.ts', '--project=chromium', '--workers=1', '--retries=0', '--reporter=list,json', '--output={attempt}/browser']),
    check('direct-impact', ['pnpm', 'exec', 'playwright', 'test', '--config=playwright.frontend-g6-impact.config.ts', '--project=chromium', '--workers=1', '--retries=0', '--grep-invert', 'screenshots|synthetic|dark/light', '--reporter=list,json', '--output={attempt}/direct-impact']),
    check('plans', ['node', 'scripts/check-development-plans.mjs']),
    check('integration-refusal', ['node', 'scripts/development-execution.mjs', '--integration', 'FRONTEND-GATE:G6'], 1),
    check('fep6-refusal', ['node', 'scripts/development-execution.mjs', '--integration', 'FE:FEP-6'], 1),
    check('next-development', ['node', 'scripts/development-execution.mjs', '--development', 'FE:FEP-6'])
];
export function validateExecution(e, c, attempt) { assert.deepEqual(e.command, c.command.map(s => s.replaceAll('{attempt}', attempt))); assert.equal(e.id, c.id); assert.equal(e.exitCode, c.exit); assert.equal(e.expectedExitCode, c.exit); assert.equal(e.signal, null); assert.equal(e.errorCode, null); assert.equal(e.log, attempt + '/' + c.id + '.log'); assert.equal(hash(read(e.log)), e.logSha256); assert(Date.parse(e.finishedAt) >= Date.parse(e.startedAt)); }
export function validateBrowser(r, count) {
    assert.equal(r.errors.length, 0);
    assert.deepEqual({ expected: r.stats.expected, unexpected: r.stats.unexpected, skipped: r.stats.skipped, flaky: r.stats.flaky }, { expected: count, unexpected: 0, skipped: 0, flaky: 0 });
    const specs = s => [...(s.specs ?? []), ...(s.suites ?? []).flatMap(specs)], tests = r.suites.flatMap(specs).flatMap(s => s.tests);
    assert.equal(tests.length, count);
    for (const t of tests) {
        assert.equal(t.projectName, 'chromium');
        assert.equal(t.results.length, 1);
        assert.equal(t.results[0].status, 'passed');
    }
}
export function verify(r) {
    validateBoundary(r);
    assert(r.attempt.startsWith(directory + '/attempt-') && !r.attempt.includes('..'));
    assert.deepEqual(inputs(), r.inputs);
    verifyInputs(r.sourceCommit, r.inputs);
    assert.deepEqual(r.plans, planCheck());
    assert.deepEqual(r.dependencies, dependencies());
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
    assert(unit.numPassedTests >= 130);
    assert.equal(unit.numPendingTests, 0);
    assert.equal(unit.numFailedTests, 0);
    for (const s of unit.testResults)
        for (const a of s.assertionResults)
            assert.equal(a.status, 'passed');
    validateBrowser(json(r.attempt + '/browser/report.json'), 5);
    validateBrowser(json(r.attempt + '/direct-impact/report.json'), 17);
    assert.match(read(r.attempt + '/native-c11.log').toString(), /22 passed; 0 failed/);
    const binary = json(r.attempt + '/binary.json');
    assert.equal(binary.sourceCommit, r.sourceCommit);
    assert.equal(binary.sha256, hash(read('target/debug/bff-gateway')));
    assert.equal(json(r.attempt + '/terminal-build.json').buildId, 'terminal-' + r.sourceCommit);
    for (const a of json(r.attempt + '/build-artifacts.json'))
        assert.equal(hash(read(a.path)), a.sha256);
    const networks = r.artifacts.filter(a => a.path.startsWith(r.attempt + '/browser/') && a.path.endsWith('/frontend-g6.json'));
    assert.equal(networks.length, 5);
    for (const a of networks) {
        const n = json(a.path);
        assert.equal(n.sourceCommit, r.sourceCommit);
        assert.equal('sha256:' + n.binarySha256, binary.sha256);
        assert.equal(n.status, 'passed');
        assert.equal(n.identity, r.identity);
        assert.equal(n.cors, r.cors);
        assert.match(n.referenceInstance, /^owned-process-[0-9]+$/);
        for (const row of n.rows) {
            assert(row.path.startsWith('/v1/'));
            assert(row.method === 'GET' || row.method === 'POST' && ['/v1/auth/mfa/challenges', '/v1/auth/reauth'].includes(row.path) || ['POST', 'PUT', 'DELETE'].includes(row.method) && (/^\/v1\/admin\/(members|roles|policies|capabilities|feature-flags)(\/[a-f0-9-]{36})?$/.test(row.path) || /^\/v1\/alerts\/[a-f0-9-]{36}\/(ack|unack)$/.test(row.path) || row.path === '/v1/alerts/subscriptions' || row.path === '/v1/operations/incidents' || /^\/v1\/operations\/incidents\/[a-f0-9-]{36}\/(ack|resolve)$/.test(row.path) || row.path === '/v1/operations/runbook-actions/inspect-health/runs'));
            assert(!row.query?.ticket || row.query.ticket.startsWith('sha256:'));
        }
    }
    const artifact = name => { const a = r.artifacts.filter(a => a.path.endsWith('/' + name)); assert.equal(a.length, 1, name); return json(a[0].path); };
    const j = artifact('g6-journey.json');
    assert.equal(j.sourceCommit, r.sourceCommit);
    assert.equal(j.scope, 'ACTUAL_OWNED_REFERENCE_SINGLE_INSTANCE');
    assert.equal(j.sourceResolved, false);
    assert.equal(j.incidentStatus, 'acknowledged');
    assert.equal(j.receipts.length, 5);
    assert.equal(j.chains.length, 5);
    for (const receipt of j.receipts)
        assert(j.chains.some(c => c.correlationId === receipt.correlationId && c.items.filter(e => e.eventId === receipt.auditRef).length === 1));
    const recover = artifact('g6-recovery.json');
    assert.equal(recover.pairs.length, 2);
    for (const pair of recover.pairs) {
        assert.equal(pair.length, 2);
        for (const k of ['bodyHash', 'keyHash', 'version', 'responseHash'])
            assert.equal(pair[0][k], pair[1][k]);
    }
    const w = artifact('g6-withdrawal.json');
    assert.equal(w.sourceCommit, r.sourceCommit);
    assert.equal(w.originalReplayDispatched, false);
    assert.equal(w.freshReadAllowed, true);
    assert.equal(w.highRiskWriteAllowed, false);
    assert.equal(w.sourceResolved, false);
    const sub = artifact('g6-subscriptions.json');
    assert.equal(sub.sourceCommit, r.sourceCommit);
    assert.equal(sub.governedDenialStatus, 409);
    assert.equal(sub.explicitRestore, true);
    assert.equal(sub.streamEof, 'disconnected');
    const gaps = artifact('g6-gaps.json');
    assert.equal(gaps.sourceCommit, r.sourceCommit);
    assert.equal(gaps.resolveHttpPositive, r.resolveHttpPositive);
    assert.equal(gaps.inspectEvidenceHttpPositive, r.inspectEvidenceHttpPositive);
    assert.equal(gaps.sevenServiceHealth, r.sevenServiceHealth);
    assert.equal(gaps.p14Metadata, 'NOT_PROVIDED_C11_CONTRACT');
    assert.equal(gaps.lastAdminDenied, 409);
    assert.equal(gaps.activeSourceResolveDenied, 403);
    assert.equal(gaps.formalGate, r.g6Gate);
    const loss = artifact('g6-authority-loss.json');
    assert.equal(loss.sourceCommit, r.sourceCommit);
    assert.equal(loss.mobileHighRiskWrites, false);
    assert.equal(loss.offlinePrivateFactsCleared, true);
    assert.equal(loss.nonJson403PendingCleared, true);
    assert.equal(loss.scope, 'EXPLICIT_DELIVERY_REFUSAL_NOT_BFF_OUTPUT');
    const regression = r.artifacts.filter(a => a.path.startsWith(r.attempt + '/direct-impact/') && /\/(ui601|ui602|p23)\.json$/.test(a.path));
    for (const [suffix, count] of [['ui601', 7], ['ui602', 5], ['p23', 5]])
        assert.equal(regression.filter(a => a.path.endsWith('/' + suffix + '.json')).length, count);
    for (const a of regression) {
        const n = json(a.path);
        assert.equal(n.status, 'passed');
        assert.equal(n.sourceCommit, r.sourceCommit);
        assert.equal('sha256:' + n.binarySha256, binary.sha256);
    }
    assert.equal(r.artifacts.filter(a => /g6-(operations-desktop|admin-desktop|withdrawn-reader)\.png$/.test(a.path)).length, 3);
    assert.equal(json(r.attempt + '/integration-refusal.log').allowed, false);
    assert.equal(json(r.attempt + '/fep6-refusal.log').allowed, false);
    assert.equal(json(r.attempt + '/next-development.log').allowed, true);
    assert.deepEqual(historyInputs(), r.historyInputs);
    verifyInputs(r.sourceCommit, r.historyInputs);
    return { engineeringGate: r.engineeringGate, g6Gate: r.g6Gate, sourceCommit: r.sourceCommit, unitConsumerContractTests: unit.numPassedTests, nativeC11Tests: 22, chromiumComposition: 5, chromiumDirectImpact: 17, historicalEvidenceFiles: r.historyInputs.length, reviewStatus: r.reviewStatus, stageGate: r.stageGate, formalAccepted: false, runtimeAdmission: 'DENIED', nextTask: r.nextTask };
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
        env.PLAYWRIGHT_JSON_OUTPUT_NAME = resolve(attempt, c.id === 'direct-impact' ? 'direct-impact/report.json' : 'browser/report.json');
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
    const receipt = { ...boundary(sourceCommit), plans: planCheck(), dependencies: dependencies(), historyInputs: historyInputs(), attempt, inputs: sourceInputs, executions, artifacts: files(attempt).map(path => ({ path, sha256: hash(read(path)) })) };
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
