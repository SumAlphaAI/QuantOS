const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { runAuthLoginAttempts, validateLoginAttempts } = require('./lib/auth-login-retry.cjs');
const timeout = () => new DOMException('The operation was aborted due to timeout', 'TimeoutError');

test('Auth timeout is retained before bounded successful retry', async () => {
  let calls = 0; const outcomes = [];
  const value = await runAuthLoginAttempts(async () => { if (++calls === 1) throw timeout(); return 'token'; }, { onAttempt: r => outcomes.push(r) });
  assert.equal(value, 'token'); assert.equal(calls, 2);
  assert.equal(outcomes[0].status, 'FAIL'); assert.equal(outcomes[0].transient, true);
  assert.equal(outcomes[1].status, 'PASS'); assert.equal(outcomes[1].attempt, 2);
});
test('persistent login timeout remains failure after exactly three attempts', async () => {
  let calls = 0; const outcomes = [];
  await assert.rejects(runAuthLoginAttempts(async () => { calls++; throw timeout(); }, { onAttempt: r => outcomes.push(r) }), { name: 'TimeoutError' });
  assert.equal(calls, 3); assert.equal(outcomes.length, 3); assert(outcomes.every(r => r.status === 'FAIL'));
});
test('Auth denial, invalid body and explicit cancellation never retry', async () => {
  for (const error of [Error('Supabase Auth returned HTTP 403'), Error('login returned no access token'), new DOMException('cancelled', 'AbortError'), new TypeError('unknown fetch failure')]) {
    let calls = 0;
    await assert.rejects(runAuthLoginAttempts(async () => { calls++; throw error; }));
    assert.equal(calls, 1);
  }
});
test('known closed login transport can retry without recording credential text', async () => {
  let calls = 0; const outcomes = [];
  const error = new TypeError('private-fixture-token', { cause: { code: 'ECONNRESET' } });
  await runAuthLoginAttempts(async () => { if (++calls === 1) throw error; return {}; }, { onAttempt: r => outcomes.push(r) });
  assert.equal(calls, 2); assert.equal(outcomes[0].causeCode, 'ECONNRESET');
  assert(!JSON.stringify(outcomes).includes('private-fixture-token'));
});
test('login budget cannot be extended beyond three attempts', async () => {
  for (const maxAttempts of [0, 4, Infinity, 1.5]) await assert.rejects(runAuthLoginAttempts(async () => {}, { maxAttempts }), /budget/);
});

function logins() {
  return [1, 2].map(id => ({ id, route: '/auth/v1/token?grant_type=password', timeoutMs: 15000, maxAttempts: 3,
    attempts: [{ attempt: 1, status: 'PASS', transient: false, elapsedMs: 1 }] }));
}
test('only retained transport failures can precede actual login PASS', () => {
  const requests = logins(); requests[0].attempts = [
    { attempt: 1, status: 'FAIL', transient: true, elapsedMs: 15000, errorKind: 'TimeoutError' },
    { attempt: 2, status: 'PASS', transient: false, elapsedMs: 3 }];
  validateLoginAttempts(requests);
  requests[0].attempts[0].errorKind = 'Error';
  assert.throws(() => validateLoginAttempts(requests), /semantic Auth failures/);
});
test('missing, excessive and unfinished Auth attempts cannot establish acceptance', () => {
  for (const change of [r => r.pop(), r => r[0].attempts = [], r => r[0].attempts[0].status = 'FAIL', r => r[0].maxAttempts = 4,
    r => r[0].attempts[0].elapsedMs = -1, r => r[0].attempts[0].attempt = 2]) {
    const requests = logins(); change(requests); assert.throws(() => validateLoginAttempts(requests));
  }
});

function receipt() {
  const actorId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', tenantId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  return { schema: 'quantos-f07-target-service/v1', sourceCommit: 'a'.repeat(40), targetClass: 'configured-supabase-local-service-development',
    status: 'DIAGNOSTIC_ONLY', engineeringStatus: 'PASS', formalAccepted: false, storageCredentialScope: 'temporary-admin-key',
    checks: ['one', 'two', 'three', 'four', 'separate real Auth tenant denied', 'logout revokes'],
    excluded: ['deployed HTTPS', 'restricted Runtime Storage credential', 'scheduling P95', 'hosted CI'],
    authLoginRequests: logins(), fixture: { actorId, tenantId }, completedAt: '2026-10-08T04:00:00Z',
    fixtureCleanup: { status: 'PASS', metadata: 'RETAINED', failures: [], startedServices: 2, stoppedPids: [10, 20],
      sessionRetirements: [{ kind: 'separate', status: 204 }], actor: { id: actorId, tenant_id: tenantId, is_active: false }, completedAt: '2026-10-08T03:59:00Z' } };
}
async function validate(r) {
  const { validateF0Artifact } = await import('./f0-functional-artifacts.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quantos-f07-receipt-'));
  try { const file = path.join(dir, 'receipt.json'); fs.writeFileSync(file, JSON.stringify(r)); return validateF0Artifact('f07-service', file, 'a'.repeat(40)); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
test('actual-service receipt requires owned actor, confirmed session retirement and reaped PIDs', async () => { await validate(receipt()); });
for (const [name, change] of [
  ['active actor', r => r.fixtureCleanup.actor.is_active = true],
  ['foreign actor', r => r.fixtureCleanup.actor.id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'],
  ['foreign tenant', r => r.fixtureCleanup.actor.tenant_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'],
  ['no service cleanup', r => r.fixtureCleanup.stoppedPids = []],
  ['reused PID', r => r.fixtureCleanup.stoppedPids = [10, 10]],
  ['unconfirmed logout', r => r.fixtureCleanup.sessionRetirements[0].status = 403],
  ['missing logout', r => r.fixtureCleanup.sessionRetirements = []],
  ['cleanup failure', r => r.fixtureCleanup.status = 'FAIL'],
  ['cleanup after receipt', r => r.fixtureCleanup.completedAt = '2026-10-08T04:01:00Z'],
]) test('F07 rejects ' + name, async () => { const r = receipt(); change(r); await assert.rejects(validate(r)); });
