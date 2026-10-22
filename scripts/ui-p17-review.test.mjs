import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { commands, omitted, validateState, validateLocalHttp } from './ui-p17-review.mjs';
import { validateExecution, validateBrowser } from './ui-p01-review.mjs';
import { digest } from './provider-a1-receipts.mjs';
const state = () => ({ schema: 'quantos-ui-p17-current-function/v1', nodeId: 'FE:UI-P17', engineeringStatus: 'PASS', clientContractIntegration: 'PASS', localModuleComposition: 'PASS_REFERENCE_FIXTURES_ONLY', confirmation: 'PENDING', stageGate: 'NOT_ASSESSED', firefoxBrowser: 'BLOCKED_ENVIRONMENT', webKitAttachmentBrowser: 'BLOCKED_ENVIRONMENT_TEST_INTERCEPTION', formalAccepted: false, runtimeAdmission: 'DENIED', recursiveDependencyRevalidation: false, liveSettingsStream: 'NOT_ENABLED_HTTP_SNAPSHOT', ...Object.fromEntries(omitted.map(k => [k, 'NOT_RUN'])) });
test('bounded commands never initialize baselines or run upstream/database campaigns', () => {
  const rows = commands('attempt'); assert.equal(rows.length, 17);
  for (const { command } of rows) { assert(!command.includes('install')); assert(!command.includes('--workspace')); assert(!command.includes('--update-snapshots=all')); assert(!command.some(s => /coverage:web|postgres|provider-all-development/.test(s))); }
  for (const id of ['browser', 'local-http', 'regression', 'visual', 'mock-regression']) { const cmd = rows.find(r => r.id === id).command; assert(cmd.includes('--retries=0')); assert(cmd.includes('--update-snapshots=none')); }
});
for (const [key, value] of Object.entries({ stageGate: 'READY', confirmation: 'CONFIRMED', firefoxBrowser: 'PASS', webKitAttachmentBrowser: 'PASS', localModuleComposition: 'PASS_PRODUCTION', formalAccepted: true, runtimeAdmission: 'ALLOWED', recursiveDependencyRevalidation: true, liveSettingsStream: 'CONNECTED', ...Object.fromEntries(omitted.map(k => [k, 'PASS'])) })) test(`refuses false promotion ${key}`, () => { validateState(state()); assert.throws(() => validateState({ ...state(), [key]: value })); });
test('actual execution cannot be omitted, substituted, failed, interrupted or relabelled', () => {
  const expected = [{ id: 'unit', command: ['unit'] }], row = { ...expected[0], exitCode: 0, signal: null, errorCode: null, log: 'log', logSha256: digest('actual') }, read = () => Buffer.from('actual'); validateExecution([row], expected, read);
  for (const change of [{ exitCode: 1 }, { signal: 'SIGINT' }, { errorCode: 'ETIMEDOUT' }, { command: ['fake'] }, { logSha256: digest('different') }]) assert.throws(() => validateExecution([{ ...row, ...change }], expected, read));
  assert.throws(() => validateExecution([], expected, read)); assert.throws(() => validateExecution([row], expected, () => Buffer.from('')));
});
test('browser evidence rejects missing cases, skips, failures, flakes and errors', () => {
  const report = { stats: { expected: 36, unexpected: 0, flaky: 0, skipped: 0 }, errors: [] }; validateBrowser(report, 36);
  for (const key of ['unexpected', 'flaky', 'skipped']) assert.throws(() => validateBrowser({ ...report, stats: { ...report.stats, [key]: 1 } }, 36));
  assert.throws(() => validateBrowser(report, 35)); assert.throws(() => validateBrowser({ ...report, errors: [{}] }, 36));
});
test('reference browser composition cannot claim delivery or target identity', () => {
 const hash = digest('controlled'), row = { mode: 'LOCAL_REFERENCE_SEEDED_PROVIDERS', scenario: 'invalid', identityFixture: 'invalid-session', realIdp: 'NOT_RUN', targetDatabase: 'NOT_RUN', browserCookieCors: 'NOT_RUN_TEST_BRIDGE', responseForwarding: 'BYTE_FOR_BYTE', referenceLease: 'REJECTED_UNTRUSTED_URL_NOT_DELIVERY', setupRows: [['/v1/auth/mfa/challenges',200],['/v1/auth/reauth',200],['/v1/exports',202]].map(([path,status])=>({method:'POST',path,status,bodySha256:hash})), rows: [{ method: 'GET', path: '/v1/session', status: 401, bodySha256: hash }] }; validateLocalHttp(row);
 for (const changed of [{ mode: 'PRODUCTION' }, { realIdp: 'PASS' }, { targetDatabase: 'PASS' }, { browserCookieCors: 'PASS' }, { referenceLease: 'DELIVERED' }, { responseForwarding: 'REWRITTEN' }, { rows: [] }, { scenario: 'unknown' }, { identityFixture: 'session-current' }, { rows: [...row.rows, { method: 'DELETE', path: '/v1/settings/sessions/target', status: 202, bodySha256: hash }] }]) assert.throws(() => validateLocalHttp({ ...row, ...changed }));
});
