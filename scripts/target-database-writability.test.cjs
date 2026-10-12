const test = require('node:test');
const assert = require('node:assert/strict');
const { inspectTargetWritability, requireWritableTarget } = require('./lib/target-database-writability.cjs');
const row = overrides => ({ transaction_read_only: 'off', default_transaction_read_only: 'off', in_recovery: false, ...overrides });
for (const [name, values] of [['transaction', { transaction_read_only: 'on' }], ['default', { default_transaction_read_only: 'on' }], ['recovery', { in_recovery: true }]]) {
  test(`${name} read-only target is rejected using observations without writes`, async () => {
    const statements = [];
    const observation = await inspectTargetWritability({ query: async sql => { statements.push(sql); return { rows: [row(values)] }; } });
    assert.equal(observation.status, 'READ_ONLY');
    assert.throws(() => requireWritableTarget(observation), { code: 'TARGET_DATABASE_READ_ONLY' });
    assert.equal(statements.length, 1); assert.match(statements[0], /^select /); assert.doesNotMatch(statements[0], /\b(?:set|insert|update|delete)\b/i);
  });
}
test('fully writable primary can proceed but is not database acceptance', async () => {
  const observation = await inspectTargetWritability({ query: async () => ({ rows: [row()] }) });
  assert.equal(observation.status, 'WRITABLE'); requireWritableTarget(observation);
  assert.equal(observation.formalAccepted, undefined);
});
for (const values of [undefined, row({ transaction_read_only: undefined }), row({ in_recovery: 'false' }), row({ default_transaction_read_only: 'unknown' })]) {
  test('incomplete target observation fails closed ' + JSON.stringify(values), async () => {
    await assert.rejects(inspectTargetWritability({ query: async () => ({ rows: values ? [values] : [] }) }), /incomplete/);
  });
}
test('transport failure propagates without query retry or write fallback', async () => {
  let calls = 0;
  await assert.rejects(inspectTargetWritability({ query: async () => { calls++; throw Object.assign(Error('transport'), { code: 'ECONNRESET' }); } }), { code: 'ECONNRESET' });
  assert.equal(calls, 1);
});
const { requireAuthResponse } = require('./lib/supabase-auth-result.cjs');
const { runAuthLoginAttempts } = require('./lib/auth-login-retry.cjs');
test('Supabase database 500 is explicit, remains failed and is never retried', async () => {
  let calls = 0;
  await assert.rejects(runAuthLoginAttempts(async () => { calls++; requireAuthResponse({ ok: false, status: 500 },
    { error_code: 'unexpected_failure', msg: 'Database error granting user' }); }), error => {
    assert.equal(error.code, 'SUPABASE_AUTH_DATABASE_FAILURE');
    assert.deepEqual(error.authFailure, { status: 500, errorCode: 'unexpected_failure', messageClass: 'Database error granting user' }); return true;
  });
  assert.equal(calls, 1);
});
test('identity creation database failure is classified without retaining user data', () => {
  assert.throws(() => requireAuthResponse({ ok: false, status: 500 }, { msg: 'Database error saving new user', email: 'private@example.com', access_token: 'private-token' }), error => {
    assert.equal(error.code, 'SUPABASE_AUTH_DATABASE_FAILURE'); assert(!JSON.stringify(error).includes('private')); return true;
  });
});
test('unknown Auth body and code are withheld while HTTP failure stays failed', () => {
  assert.throws(() => requireAuthResponse({ ok: false, status: 403 }, { error_code: 'private-token', msg: 'private@example.com' }), error => {
    assert.equal(error.code, 'SUPABASE_AUTH_HTTP_FAILURE'); assert(!JSON.stringify(error).includes('private')); return true;
  });
});
test('successful response is allowed without fabricating an Auth token', () => {
  assert.equal(requireAuthResponse({ ok: true, status: 200 }, { access_token: 'not-persisted' }), undefined);
});
