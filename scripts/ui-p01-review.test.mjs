import test from 'node:test';
import { Buffer } from 'node:buffer';
import assert from 'node:assert/strict';
import { digest } from './provider-a1-receipts.mjs';
import { commands, validateExecution, validateState, validateBrowser } from './ui-p01-review.mjs';
const state = () => ({ schema: 'quantos-ui-p01-current-function/v1', nodeId: 'FE:UI-P01', engineeringStatus: 'PASS', clientContractIntegration: 'PASS', stageGate: 'NOT_ASSESSED', confirmation: 'PENDING', firefoxBrowser: 'BLOCKED_ENVIRONMENT', formalAccepted: false, runtimeAdmission: 'DENIED', recursiveDependencyRevalidation: false, ...Object.fromEntries(['realIdpMfa', 'targetBffDatabase', 'manualScreenReader', 'nativeZoom200', 'crossOSVisual', 'remoteCI', 'releaseAcceptance'].map(k => [k, 'NOT_RUN'])) });
test('bounded task scope cannot initialize baselines, retry failures or run upstream/database campaigns', () => {
  const rows = commands('attempt'); assert.equal(rows.length, 11);
  for (const { command } of rows) { assert(!command.includes('install')); assert(!command.includes('--workspace')); assert(!command.includes('--update-snapshots=all')); assert(!command.some(s => /provider-all-development|coverage:web|postgres/.test(s))); }
  for (const id of ['browser', 'regression', 'visual']) { const r = rows.find(r => r.id === id); assert(r.command.includes('--retries=0')); assert(r.command.includes('--update-snapshots=none')); }
});
for (const [key, value] of Object.entries({ firefoxBrowser: 'PASS', stageGate: 'READY', confirmation: 'CONFIRMED', formalAccepted: true, runtimeAdmission: 'ALLOWED', recursiveDependencyRevalidation: true, realIdpMfa: 'PASS', targetBffDatabase: 'PASS', manualScreenReader: 'PASS', nativeZoom200: 'PASS', crossOSVisual: 'PASS', remoteCI: 'PASS', releaseAcceptance: 'PASS' })) test(`refuses false promotion ${key}`, () => { validateState(state()); assert.throws(() => validateState({ ...state(), [key]: value })); });
test('rejects missing, failed, interrupted, substituted or altered command evidence', () => {
  const expected = [{ id: 'unit', command: ['unit'] }], row = { ...expected[0], exitCode: 0, signal: null, errorCode: null, log: 'log', logSha256: digest('real') }, read = () => Buffer.from('real');
  validateExecution([row], expected, read);
  for (const change of [{ exitCode: 1 }, { signal: 'SIGTERM' }, { errorCode: 'ETIMEDOUT' }, { command: ['fake'] }, { logSha256: digest('other') }]) assert.throws(() => validateExecution([{ ...row, ...change }], expected, read));
  assert.throws(() => validateExecution([], expected, read)); assert.throws(() => validateExecution([row], expected, () => Buffer.from('')));
});
test('rejects browser skipped/flaky/failure/empty evidence', () => {
  const r = { stats: { expected: 39, unexpected: 0, flaky: 0, skipped: 0 }, errors: [] }; validateBrowser(r, 39);
  for (const key of ['unexpected', 'flaky', 'skipped']) assert.throws(() => validateBrowser({ ...r, stats: { ...r.stats, [key]: 1 } }, 39));
  assert.throws(() => validateBrowser(r, 0)); assert.throws(() => validateBrowser({ ...r, errors: [{}] }, 39));
});
