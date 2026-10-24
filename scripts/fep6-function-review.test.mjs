import test from 'node:test';
import assert from 'node:assert/strict';
import { boundary, validateBoundary, productChanges, validatePlan, validateReadConsumer, gapCheck, checks, pageAudit, dependencyAudit, impactCheck } from './fep6-function-review.mjs';
import { nodesFromPlans } from './provider-a1-receipts.mjs';
const sha = 'a'.repeat(40);
test('FEP6 scope closure stays PARTIAL and cannot close G6/core/target/release', () => validateBoundary(boundary(sha)));
for (const [key, value] of Object.entries({ developmentStatus: 'COMPLETED', functionExecution: 'COMPLETED_FULL_MILESTONE', g6Gate: 'READY', fep6Gate: 'READY', g6Review: 'ACCEPTED', g4Gate: 'READY', fep4Gate: 'READY', fep4Milestone: 'COMPLETE', formalAccepted: true, stageGate: 'READY', runtimeAdmission: 'ALLOWED', closesCoreX06: 'ACCEPTED', model: 'ACTUAL_SIGNED_BFF', binaryRebuilt: true, browserMatrix: 'PASS_CURRENT_SHA', rustNativeTests: 'PASS_CURRENT_SHA', terminalBuild: 'PASS_CURRENT_SHA', runtimeFixtureSource: 'OLD_BINARY_BUILD_SHA', historicalAcceptanceRebound: true, resolveHttpPositive: 'PASS', inspectEvidenceHttpPositive: 'PASS', sevenServiceHealth: 'CLOSED', p14Metadata: 'CLOSED', p14History: 'COMPLETE', p14Export: 'IMPLEMENTED', p14Stream: 'LIVE', notification: 'ALWAYS_ON_PUSH', systemBackgroundPush: 'PASS', actualC09C12PositiveJoin: 'PASS', c12ControlledExport: 'PASS', c12ValuationJoin: 'PASS', targetDatabase: 'PASS', crossProcessDurableRecovery: 'PASS', sameShaRemoteCI: 'PASS', performanceCapacitySoak: 'PASS', fullI8Integration: 'PASS', releaseAcceptance: 'PASS', recursiveDependencyRevalidation: true, productionCredentialsUsed: true, pushed: true, deployed: true, nextTask: 'FE:FEP-7' }))
    test('reject false FEP6 promotion ' + key, () => assert.throws(() => validateBoundary({ ...boundary(sha), [key]: value })));
test('six deliveries and 22 dependencies preserve open G4/G6 gaps and CORE:X06 mapping without acceptance', () => { assert.equal(pageAudit.length, 6); assert(pageAudit.every(p => p.scope === 'IMPLEMENTED_CONSUMER_SCOPE_ONLY' && !p.fullMilestoneReady)); assert.equal(dependencyAudit().length, 22); const gaps = gapCheck(); assert(gaps.some(g => g.id === 'P19-C10-EXPORT-01' && g.status === 'NOT_IMPLEMENTED_UNSUPPORTED_CONTRACT_SCOPE')); assert(gaps.some(g => g.id === 'UI402-MARKER-SOURCE-01' && g.status === 'NOT_RUN_COMPOSED_SCOPE')); assert(gaps.every(g => g.developmentPrerequisite === false)); assert.throws(() => gapCheck([])); });
test('current unchanged product/binary reuse is explicit and no silent build/native/browser rerun is allowed', () => { productChanges([]); for (const p of ['apps/terminal/src/alerts/runtime.ts', 'services/bff-gateway/src/operations.rs', 'apps/terminal/app/admin/editor.tsx', 'playwright.config.ts'])
    assert.throws(() => productChanges([p])); const i = impactCheck(); assert.equal(i.productFilesChanged, 0); assert.equal(i.binarySourceCommit, '1cee533781312f684c4c5ac121a13a5922c689a0'); assert.equal(i.binaryRebuilt, false); assert(!checks.some(c => c.command.includes('build') || c.command.includes('cargo') || c.command.includes('playwright') || c.command.includes('--workspace') || c.command.includes('push'))); });
const clone = m => new Map([...m].map(([id, n]) => [id, JSON.parse(JSON.stringify(n))]));
test('only FEP6 development PARTIAL changes; stages, G4/FEP4/G6/P14 and formal source bindings remain unchanged', () => { const after = nodesFromPlans(), before = clone(after); before.get('FE:FEP-6').development_status = 'UNSPECIFIED'; assert.equal(validatePlan(before, after).stageGatesPreserved, 159); for (const key of ['stage', 'review', 'normative', 'complete', 'g4', 'p14', 'source']) {
    const bad = clone(after);
    if (key === 'stage')
        bad.get('FRONTEND-GATE:G6').stage_gate.status = 'READY';
    if (key === 'review')
        bad.get('FRONTEND-GATE:G6').review_status = 'ACCEPTED';
    if (key === 'normative')
        bad.get('FE:FEP-6').closes_core = [];
    if (key === 'complete')
        bad.get('FE:FEP-6').development_status = 'COMPLETED';
    if (key === 'g4')
        bad.get('FE:FEP-4').development_status = 'COMPLETED';
    if (key === 'p14')
        bad.get('FE:UI-P14').development_status = 'COMPLETED';
    if (key === 'source')
        bad.get('FRONTEND-GATE:G6').source_commit = sha;
    assert.throws(() => validatePlan(before, bad));
} });
const consumer = () => ({ sourceCommit: sha, fixtureSourceCommit: sha, binarySourceCommit: 'old', binarySha256: 'hash', scope: 'READ_ONLY_ACTUAL_OWNED_REFERENCE_BINARY_REUSED', identity: 'EXPLICIT_COOKIE_TRANSPORT_INJECTION', cors: 'NOT_EXERCISED_NODE_HTTP', businessWrites: 0, mode: 'paper', accountId: 'account', newMutationAuditChain: 'NOT_RUN_READ_ONLY', g6Gate: 'NOT_READY_GAPS_OPEN', alert: { id: 'alert', sourceRef: 'source', sourceVersion: '1', resolved: false, stream: 'disconnected' }, operations: { accountId: 'account', sourceAlertId: 'alert', sourceAlertRef: 'source', sourceVersion: '1', healthReady: false, inspectEvidenceAllowed: false, independentServiceHealth: 'NOT_PROVIDED' }, admin: { resourceCount: 17, availableReviews: 1, enabledEngines: 0, ownerHasAuditRead: false, operatorHasAdminWrite: false, viewerAdmitted: false, ownerAuditStatus: 404 }, audit: { scope: 'AUTHORIZED_CATALOG_ONLY_NOT_NEW_MUTATION_CHAIN' }, rows: Array.from({ length: 21 }, (_, i) => ({ method: 'GET', path: i === 0 ? '/v1/audit/events' : '/v1/admin/capabilities', cache: i === 0 ? 'default' : 'no-store', status: 200, responseHash: 'sha256:' + 'a'.repeat(64) })) });
const impact = { binarySourceCommit: 'old', binarySha256: 'hash' };
test('consumer cannot rebind binary/fixture source, model, write activity, production sources or invented remediation', () => { validateReadConsumer(consumer(), sha, impact); for (const key of ['scope', 'sourceCommit', 'fixtureSourceCommit', 'binarySourceCommit', 'binarySha256', 'businessWrites', 'mode', 'newMutationAuditChain', 'g6Gate']) {
    const r = consumer();
    r[key] = key === 'businessWrites' ? 1 : 'forged';
    assert.throws(() => validateReadConsumer(r, sha, impact));
} for (const change of ['post', 'source', 'resolved', 'health', 'admin', 'signature', 'viewer']) {
    const r = consumer();
    if (change === 'post')
        r.rows[0].method = 'POST';
    if (change === 'source')
        r.operations.sourceAlertRef = 'forged';
    if (change === 'resolved')
        r.alert.resolved = true;
    if (change === 'health')
        r.operations.healthReady = true;
    if (change === 'admin')
        r.admin.operatorHasAdminWrite = true;
    if (change === 'signature')
        r.admin.enabledEngines = 1;
    if (change === 'viewer')
        r.admin.viewerAdmitted = true;
    assert.throws(() => validateReadConsumer(r, sha, impact));
} });
test('FEP6 and G6 integration stay refused; next G7 may start scope assessment only', () => { for (const id of ['fep6-refusal', 'g6-refusal'])
    assert.equal(checks.find(c => c.id === id).exit, 1); assert.deepEqual(checks.at(-1).command, ['node', 'scripts/development-execution.mjs', '--development', 'FRONTEND-GATE:G7']); });
