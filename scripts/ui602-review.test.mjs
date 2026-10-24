import test from 'node:test';
import assert from 'node:assert/strict';
import { boundary, validateBoundary, validateBrowser, checks } from './ui602-review.mjs';
const sha = 'a'.repeat(40);
test('UI602 functional proof preserves every G4/FEP4 and P13 gap', () => validateBoundary(boundary(sha)));
for (const [key, value] of Object.entries({ formalAccepted: true, runtimeAdmission: 'ALLOWED', stageGate: 'PASS', productionCredentialsUsed: true, pushed: true, deployed: true, designAdaptation: 'PASS', signedEngineReview: 'PRODUCTION', auditRead: 'INFERRED_OWNER', recursiveDependencyRevalidation: true, inspectEvidenceHttpPositive: 'PASS', resolveHttpPositive: 'PASS', sevenServiceHealth: 'CLOSED', markerSource: 'CLOSED', candleExport: 'IMPLEMENTED', valuationJoin: 'PASS', data: 'PRODUCTION', g4Gate: 'READY', fep4Gate: 'READY', g4Workflow: 'ACCEPTED', fep4Milestone: 'COMPLETE', nextTask: 'FE:FEP-4', historicalEvidence: 'REBOUND' }))
    test('reject false promotion ' + key, () => assert.throws(() => validateBoundary({ ...boundary(sha), [key]: value })));
test('profile verifies governance, shared navigation impact, static routes and independent integration refusal', () => { assert.equal(checks.find(c => c.id === 'integration-refusal').exit, 1); assert(checks.some(c => c.id === 'native-governance')); assert(checks.some(c => c.command.includes('packages/domain-ui/tests/ui101.test.ts'))); assert(!checks.some(c => c.command.includes('--workspace') || c.command.includes('push') || c.command.includes('deploy'))); });
const browser = () => ({ errors: [], stats: { expected: 1, unexpected: 0, skipped: 0, flaky: 0 }, suites: [{ specs: [{ tests: [{ projectName: 'chromium', results: [{ status: 'passed' }] }] }] }] });
test('browser proof refuses retries, skips, incomplete results', () => { validateBrowser(browser(), 1); for (const key of ['unexpected', 'skipped', 'flaky']) {
    const b = browser();
    b.stats[key] = 1;
    assert.throws(() => validateBrowser(b, 1));
} const b = browser(); b.suites[0].specs[0].tests[0].results.push({ status: 'passed' }); assert.throws(() => validateBrowser(b, 1)); });
