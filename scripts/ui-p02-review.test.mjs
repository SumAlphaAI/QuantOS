import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { commands, omitted, validateState, validateLocalHttp } from './ui-p02-review.mjs';
import { validateExecution, validateBrowser } from './ui-p01-review.mjs';
import { digest } from './provider-a1-receipts.mjs';
const state = () => ({ schema: 'quantos-ui-p02-current-function/v1', nodeId: 'FE:UI-P02', engineeringStatus: 'PASS', clientContractIntegration: 'PASS', localModuleComposition: 'PASS_REFERENCE_FIXTURES_ONLY', confirmation: 'PENDING', stageGate: 'NOT_ASSESSED', firefoxBrowser: 'BLOCKED_ENVIRONMENT', formalAccepted: false, runtimeAdmission: 'DENIED', recursiveDependencyRevalidation: false, liveCommandStream: 'NOT_ENABLED_HTTP_SNAPSHOT', ...Object.fromEntries(omitted.map(k => [k, 'NOT_RUN'])) });
test('bounded commands never initialize baselines or run upstream/database campaigns', () => {
  const rows = commands('attempt'); assert.equal(rows.length, 16);
  for (const { command } of rows) { assert(!command.includes('install')); assert(!command.includes('--workspace')); assert(!command.includes('--update-snapshots=all')); assert(!command.some(s => /coverage:web|postgres|provider-all-development/.test(s))); }
  for (const id of ['browser', 'local-http', 'regression', 'visual', 'mock-regression']) { const cmd = rows.find(r => r.id === id).command; assert(cmd.includes('--retries=0')); assert(cmd.includes('--update-snapshots=none')); }
});
for (const [key, value] of Object.entries({ stageGate: 'READY', confirmation: 'CONFIRMED', firefoxBrowser: 'PASS', localModuleComposition: 'PASS_PRODUCTION', formalAccepted: true, runtimeAdmission: 'ALLOWED', recursiveDependencyRevalidation: true, liveCommandStream: 'CONNECTED', ...Object.fromEntries(omitted.map(k => [k, 'PASS'])) })) test(`refuses false promotion ${key}`, () => { validateState(state()); assert.throws(() => validateState({ ...state(), [key]: value })); });
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
test('local reference composition cannot masquerade as target IdP/Cookie/CORS or mutate business facts', () => {
  const row = { mode: 'LOCAL_REFERENCE_SEEDED_PROVIDERS', identityFixture: 'session-current', realIdp: 'NOT_RUN', browserCookieCors: 'NOT_RUN_TEST_BRIDGE', rows: [{ method: 'GET', path: '/v1/session', status: 200, body: {} }, { method: 'GET', path: '/v1/context', status: 200, body: { accountId: 'account', mode: 'paper' } }, { method: 'GET', path: '/v1/command/summary', status: 200, body: { accountId: 'account', mode: 'paper' } }] }; validateLocalHttp(row);
  for (const changed of [{ mode: 'PRODUCTION' }, { realIdp: 'PASS' }, { browserCookieCors: 'PASS' }, { rows: [] }, { rows: row.rows.map((r, i) => i === 2 ? { ...r, body: { accountId: 'other', mode: 'paper' } } : r) }, { rows: row.rows.map(r => ({ ...r, method: 'POST' })) }]) assert.throws(() => validateLocalHttp({ ...row, ...changed }));
});
