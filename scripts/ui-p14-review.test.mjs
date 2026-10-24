import test from 'node:test';
import assert from 'node:assert/strict';
import { boundary, validateBoundary, validateBrowser, validateGeometry, checks } from './ui-p14-review.mjs';
const sha = 'a'.repeat(40);
test('P14 high fidelity engineering scope keeps UI602, G4/FEP4 and formal gates independent', () => validateBoundary(boundary(sha)));
for (const [key, value] of Object.entries({ formalAccepted: true, runtimeAdmission: 'ALLOWED', stageGate: 'PASS', productionCredentialsUsed: true, pushed: true, deployed: true, designAdaptation: 'PIXEL_PERFECT_FULL_DATA', advancedMetadata: 'VERIFIED', fullVersionHistory: 'COMPLETE', productionApproval: 'APPROVED', memberExport: 'IMPLEMENTED', governanceStream: 'LIVE', metadataGap: 'CLOSED', ownerCount: 'DISTINCT_USERS', signedEngineReview: 'PRODUCTION', recursiveDependencyRevalidation: true, inspectEvidenceHttpPositive: 'PASS', resolveHttpPositive: 'PASS', sevenServiceHealth: 'CLOSED', markerSource: 'CLOSED', candleExport: 'IMPLEMENTED', valuationJoin: 'PASS', data: 'PRODUCTION', g4Gate: 'READY', fep4Gate: 'READY', g4Workflow: 'ACCEPTED', fep4Milestone: 'COMPLETE', nextTask: 'FE:FEP-4', historicalEvidence: 'REBOUND' }))
    test('reject false promotion ' + key, () => assert.throws(() => validateBoundary({ ...boundary(sha), [key]: value })));
test('profile preserves direct UI602 regression and independent integration refusal without recursive native revalidation', () => { assert.equal(checks.find(c => c.id === 'integration-refusal').exit, 1); assert(checks.some(c => c.id === 'ui602-impact')); assert(checks.some(c => c.command.includes('apps/terminal/tests/ui602-provider-consumer.test.ts'))); assert(!checks.some(c => c.command.includes('--workspace') || c.command.includes('push') || c.command.includes('deploy') || c.id === 'native-governance')); });
const browser = () => ({ errors: [], stats: { expected: 1, unexpected: 0, skipped: 0, flaky: 0 }, suites: [{ specs: [{ tests: [{ projectName: 'chromium', results: [{ status: 'passed' }] }] }] }] });
test('browser gate rejects skipped, retried and incomplete evidence', () => { validateBrowser(browser(), 1); for (const key of ['unexpected', 'skipped', 'flaky']) {
    const b = browser();
    b.stats[key] = 1;
    assert.throws(() => validateBrowser(b, 1));
} const b = browser(); b.suites[0].specs[0].tests[0].results.push({ status: 'passed' }); assert.throws(() => validateBrowser(b, 1)); });
test('geometry cannot omit cards, overflow, hide a pane or collapse the design wide layout', () => { const rows = ['dark', 'light'].flatMap(theme => [1672, 1440, 1024, 390].map(width => ({ theme, width, catalog: { x: 0, y: 0, width: 100, right: 100 }, detail: { x: width >= 1440 ? 110 : 0, y: width >= 1440 ? 0 : 120, width: 100, right: width >= 1440 ? 210 : 100 }, records: { x: 0, y: 100, width: 100, right: 100 }, cards: Array.from({ length: 4 }, () => ({ x: 0, y: 0, width: 50, right: 50 })) }))); validateGeometry(rows); assert.throws(() => validateGeometry(rows.slice(1))); for (const patch of ['missing', 'overflow', 'collapsed']) {
    const r = globalThis.structuredClone(rows);
    if (patch === 'missing')
        r[0].cards.pop();
    if (patch === 'overflow')
        r[0].detail.right = 1800;
    if (patch === 'collapsed')
        r[0].detail.x = 0;
    assert.throws(() => validateGeometry(r));
} });
