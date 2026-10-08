const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const crypto = require('node:crypto'), { EventEmitter } = require('node:events');
const { runDatabase } = require('./lib/f02-development-database.cjs');
const sourceCommit = 'b'.repeat(40);
function fixture({ connectErrors = [], resetOnMutationRead = false, badCleanup = false,
  ignoredMutation = false, primaryCloseFailure = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'quantos-f02-unit-'));
  const output = path.join(root, 'receipt.json'), ca = path.join(root, 'ca');
  fs.writeFileSync(ca, 'unit CA; never connects to a network');
  const env = { DATABASE_URL: 'postgres://unit:private-fixture-value@db.unit-fixture.supabase.co:5432/postgres',
    SUPABASE_URL: 'https://unit-fixture.supabase.co', QUANTOS_BFF_SSLROOTCERT: ca };
  const localMigrations = new Map([['unit.sql', Buffer.from('unit SQL bytes')], ['20260927093000_f09_execution_metric_returning.sql', Buffer.from('unit prerequisite')]]);
  const ledger = [...localMigrations].sort(([a], [b]) => a.localeCompare(b)).map(([filename, bytes]) => ({ filename, sha256: crypto.createHash('sha256').update(bytes).digest('hex') }));
  const before = { tables: [{ relname: 'tenants' }], policies: [{ tablename: 'tenants', policyname: 'unit_policy' }], changed: false };
  const clients = [];
  class MockClient extends EventEmitter {
    constructor(index) { super(); this.index = index; this.state = structuredClone(before); this.queries = []; this.closed = false; this.schemaReads = 0; }
    async connect() { if (connectErrors[this.index]) throw connectErrors[this.index]; }
    async end() { if (primaryCloseFailure && this.index === 0) throw Object.assign(Error('unit close failed'), { code: 'ECLOSE' }); this.closed = true; this.state = structuredClone(before); }
    async query(sql) {
      this.queries.push(sql);
      if (sql === 'select unit_catalog') {
        this.schemaReads++;
        if (resetOnMutationRead && this.state.changed && this.index === 0) {
          this.emit('error', Object.assign(Error('private-fixture-value'), { code: 'ECONNRESET' }));
        }
        const state = structuredClone(this.state);
        if (badCleanup && this.index > 0) state.changed = 'unexpected catalog drift';
        return { catalog: state };
      }
      if (sql.startsWith('select filename,sha256')) return { rows: structuredClone(ledger) };
      if (/^(alter table|drop policy|create index)/.test(sql) && !ignoredMutation) this.state.changed = sql;
      if (sql === 'rollback') this.state = structuredClone(before);
      return { rows: [] };
    }
  }
  const createClient = options => {
    assert.equal(options.ssl.rejectUnauthorized, true);
    assert.equal(options.connectionTimeoutMillis, 10000);
    assert.equal(options.keepAlive, true);
    const c = new MockClient(clients.length); clients.push(c); return c;
  };
  const options = { root, output, env, sourceCommit, createClient, localMigrations,
    readSchema: async client => (await client.query('select unit_catalog')).catalog,
    pause: async () => {}, log() {} };
  const read = () => JSON.parse(fs.readFileSync(output));
  const remove = () => fs.rmSync(root, { recursive: true });
  return { options, clients, read, remove, root, output };
}
test('successful checks publish only after all seven negatives, independent read-only verification and close', async () => {
  const f = fixture(); try {
    const r = await runDatabase(f.options);
    assert.equal(r.schema, 'quantos-f02-development-database/v2'); assert.equal(r.status, 'PASS');
    assert.equal(r.phase, 'COMPLETE'); assert.equal(r.checks.length, 7);
    assert.equal(r.cleanup.readOnly, true); assert.equal(r.cleanup.ledgerUnchanged, true);
    assert.equal(r.catalogDigest, r.cleanup.catalogDigest); assert.equal(r.cleanup.connectionsClosed, true);
    assert.equal(f.clients.length, 2); assert(f.clients.every(c => c.closed));
    assert(!f.clients[1].queries.some(q => /^(alter|create|drop)/.test(q)));
  } finally { f.remove(); }
});
test('an idle error after mutation is handled, no SQL is replayed and independent cleanup cannot convert FAIL to PASS', async () => {
  const f = fixture({ resetOnMutationRead: true }); try {
    await assert.rejects(runDatabase(f.options), /ECONNRESET/);
    const r = f.read(); assert.equal(r.status, 'FAIL'); assert.equal(r.passed, false);
    assert.equal(r.failure.phase, 'TRANSACTION_disable RLS');
    assert.equal(r.transportErrors.length, 1); assert.equal(r.transportErrors[0].afterStatements, true);
    assert.equal(r.cleanup.status, 'PASS'); assert.equal(r.cleanup.connectionsClosed, true);
    assert.equal(f.clients[0].queries.filter(q => q.startsWith('alter table')).length, 1);
    assert.equal(f.clients.length, 2); assert(!f.clients[1].queries.some(q => /^(alter|create|drop)/.test(q)));
    assert(!JSON.stringify(r).includes('private-fixture-value'));
  } finally { f.remove(); }
});
test('initial known transport failure closes the failed connection before a fresh connection, preserving bootstrap', async () => {
  const f = fixture({ connectErrors: [Object.assign(Error('private-fixture-value'), { code: 'ECONNRESET' })] });
  try { const r = await runDatabase(f.options); assert.equal(r.status, 'PASS');
    assert.equal(r.bootstrapConnection.attempts.length, 2); assert.equal(r.bootstrapConnection.attempts[0].connectionClosed, true);
    assert.equal(f.clients[0].queries.length, 0); assert(f.clients.every(c => c.closed));
  } finally { f.remove(); }
});
for (const code of ['28P01', '42501', 'CERT_HAS_EXPIRED']) test(code + ' initial failure never retries', async () => {
  const f = fixture({ connectErrors: [Object.assign(Error('private-fixture-value'), { code })] });
  try { await assert.rejects(runDatabase(f.options)); assert.equal(f.clients.length, 1);
    assert.equal(f.clients[0].queries.length, 0); assert(f.clients[0].closed); assert.equal(f.read().status, 'FAIL');
  } finally { f.remove(); }
});
test('configuration failure overwrites historic PASS with current-source FAIL', async () => {
  const f = fixture(); try {
    fs.writeFileSync(f.output, JSON.stringify({ status: 'PASS', sourceCommit: 'OLD' }));
    await assert.rejects(runDatabase({ ...f.options, env: {} }));
    const r = f.read(); assert.equal(r.status, 'FAIL'); assert.equal(r.sourceCommit, sourceCommit);
    assert.equal(r.failure.phase, 'CONFIGURATION'); assert.equal(f.clients.length, 0);
  } finally { f.remove(); }
});
test('cleanup catalog mismatch fails even after seven successful checks', async () => {
  const f = fixture({ badCleanup: true }); try {
    await assert.rejects(runDatabase(f.options)); const r = f.read();
    assert.equal(r.status, 'FAIL'); assert.equal(r.checks.length, 7); assert.equal(r.cleanup.status, 'FAIL');
  } finally { f.remove(); }
});
test('failed primary close preserves its error and cannot publish success after read-only verification', async () => {
  const f = fixture({ primaryCloseFailure: true }); try {
    await assert.rejects(runDatabase(f.options), /PRIMARY_CLOSE: ECLOSE/);
    const r = f.read(); assert.equal(r.status, 'FAIL'); assert.equal(r.failure.code, 'ECLOSE');
    assert.equal(r.cleanup.status, 'PASS'); assert.equal(r.cleanup.connectionsClosed, false);
    assert.equal(f.clients.length, 2); assert.equal(f.clients[1].closed, true);
  } finally { f.remove(); }
});
test('a mutation that does not affect schema is rejected', async () => {
  const f = fixture({ ignoredMutation: true }); try {
    await assert.rejects(runDatabase(f.options)); assert.equal(f.read().status, 'FAIL');
    assert.equal(f.clients[0].queries.filter(q => q.startsWith('alter table')).length, 1);
  } finally { f.remove(); }
});
test('strict artifact acceptance rejects stale success, unclosed sessions, missing bootstrap and post-SQL errors', async () => {
  const { validateF0Artifact } = await import('./f0-functional-artifacts.mjs');
  const f = fixture(); try {
    const original = await runDatabase(f.options);
    validateF0Artifact('f02-database', f.output, sourceCommit);
    for (const mutate of [
      r => r.schema = 'quantos-f02-development-database/v1', r => r.status = 'RUNNING',
      r => r.passed = false, r => r.phase = 'PRIMARY_CLOSE', r => r.checks.pop(),
      r => r.bootstrapConnection = null, r => r.cleanup.bootstrapConnection = null,
      r => r.cleanup.status = 'FAIL', r => r.cleanup.readOnly = false,
      r => r.cleanup.connectionsClosed = false, r => r.cleanup.catalogMatchesBefore = false,
      r => r.cleanup.ledgerUnchanged = false, r => r.cleanup.catalogDigest = 'sha256:' + '0'.repeat(64),
      r => r.transportErrors.push({ afterStatements: true, code: 'ECONNRESET' }),
    ]) {
      const r = structuredClone(original); mutate(r); fs.writeFileSync(f.output, JSON.stringify(r));
      assert.throws(() => validateF0Artifact('f02-database', f.output, sourceCommit));
    }
  } finally { f.remove(); }
});
