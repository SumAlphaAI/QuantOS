const test = require('node:test'), assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { openConnection } = require('./lib/r02-chain-connection.cjs');
const { validateBootstrap } = require('./lib/postgres-bootstrap.cjs');
function fixture(errors = []) {
  const clients = [], record = {}, phase = { value: 'INITIAL_CONNECTION' }, evidence = [];
  const createClient = () => {
    const index = clients.length, c = new EventEmitter(); c.queries = 0; c.closed = false;
    c.connect = async () => { if (errors[index]) throw errors[index]; };
    c.query = async () => { c.queries++; return { rows: [] }; };
    c.end = async () => { c.closed = true; }; clients.push(c); return c;
  };
  return { clients, record, phase, options: { record, phase, createClient,
    save: () => evidence.push(structuredClone(record)), pause: async () => {} } };
}
test('retained chain preserves transient initial failures and closes preparation before separate cleanup', async () => {
  const f = fixture([Error('timeout expired')]);
  const preparation = await openConnection('unused', 'preparation', f.options);
  validateBootstrap(f.record); assert.equal(f.clients.length, 2);
  assert(f.clients[0].closed); assert.equal(f.clients[0].queries, 0);
  f.phase.value = 'ACTOR_PROVISIONING'; await preparation.query('unit fixture SQL'); await preparation.end();
  assert.equal(f.record.connectionClosed, true); assert(f.clients.every(c => c.closed));
  const cleanup = fixture(); const connection = await openConnection('unused', 'cleanup', cleanup.options);
  assert(f.clients.every(c => c.closed)); await connection.end(); assert(cleanup.clients[0].closed);
});
test('idle error after SQL is captured with phase and never reconnects or replays', async () => {
  const f = fixture(); const c = await openConnection('unused', 'preparation', f.options);
  f.phase.value = 'RETAINED_SOURCE_SQL'; await c.query('unit read');
  c.emit('error', Object.assign(Error('private-fixture-value'), { code: 'ECONNRESET' }));
  await assert.rejects(c.query('must not run'), e => e.chainPhase === 'RETAINED_SOURCE_SQL');
  assert.equal(f.clients.length, 1); assert.equal(c.queries, 1);
  await assert.rejects(c.end()); assert(c.closed); assert.equal(f.record.connectionClosed, true);
  assert.equal(f.record.transportErrors[0].afterStatements, true);
  assert(!JSON.stringify(f.record).includes('private-fixture-value'));
});
for (const code of ['28P01', '42501', 'CERT_HAS_EXPIRED']) test(code + ' never retries during retained chain startup', async () => {
  const f = fixture([Object.assign(Error('private-fixture-value'), { code })]);
  await assert.rejects(openConnection('unused', 'preparation', f.options));
  assert.equal(f.clients.length, 1); assert(f.clients[0].closed); assert.equal(f.clients[0].queries, 0);
});
test('persistent initial timeout fails after three; no SQL or actor creation', async () => {
  const f = fixture(Array.from({ length: 3 }, () => Error('timeout expired')));
  await assert.rejects(openConnection('unused', 'preparation', f.options));
  assert.equal(f.clients.length, 3); assert(f.clients.every(c => c.closed && c.queries === 0));
  assert.equal(f.record.status, 'FAIL');
});
test('Node operator verifies an explicit trusted CA without rewriting the Rust URL', () => {
  const { operatorUrl } = require('./lib/r02-chain-connection.cjs');
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quantos-r02-ca-unit-'));
  try {
    const ca = path.join(dir, 'ca.pem'); fs.writeFileSync(ca, 'unit CA');
    const original = 'postgres://unit:private-fixture-value@db.unit-fixture.supabase.co:5432/postgres?sslmode=require';
    const derived = new URL(operatorUrl(original, { QUANTOS_BFF_SSLROOTCERT: ca }));
    assert.equal(derived.searchParams.get('sslmode'), 'verify-full');
    assert.equal(derived.searchParams.get('sslrootcert'), ca);
    assert.equal(new URL(original).searchParams.get('sslmode'), 'require');
    assert.throws(() => operatorUrl(original, {}), /TRUSTED_CA/);
    assert.throws(() => operatorUrl(original, { QUANTOS_BFF_SSLROOTCERT: 'relative.pem' }), /TRUSTED_CA/);
  } finally { fs.rmSync(dir, { recursive: true }); }
});
