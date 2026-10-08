const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Client } = require('pg');
const { connectBeforeStatements } = require('./postgres-bootstrap.cjs');
const { schemaState, assertSchemaMatches } = require('../db-schema-state.cjs');
const { validateF09MigrationLedger } = require('./f09-migration-ledger.cjs');
const digest = value => 'sha256:' + crypto.createHash('sha256').update(value).digest('hex');
async function runDatabase({ root, sourceCommit, env = process.env,
  output = path.join(root, 'artifacts/f02/development-database.json'),
  createClient = options => new Client(options), readSchema = schemaState,
  localMigrations, pause, log = value => console.log(value) } = {}) {
  const receipt = { schema: 'quantos-f02-development-database/v2', status: 'RUNNING',
    passed: false, sourceCommit, targetClass: 'configured-supabase', formalAccepted: false,
    fullReferenceRebuild: false, startedAt: new Date().toISOString(), phase: 'CONFIGURATION',
    checks: [], transportErrors: [], bootstrapConnection: {}, cleanup: { status: 'NOT_RUN' } };
  const save = () => { fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(receipt, null, 2) + '\n'); };
  save(); // Revoke any old PASS even when configuration or initial connection fails.
  const states = [], stateByClient = new WeakMap();
  let primary, before, ledger, failure, failurePhase;
  const setPhase = phase => { receipt.phase = phase; save(); };
  try {
    const url = new URL(env.DATABASE_URL), api = new URL(env.SUPABASE_URL);
    const ref = url.hostname.startsWith('db.') ? url.hostname.split('.')[1] : decodeURIComponent(url.username).split('.').at(-1);
    assert(api.protocol === 'https:' && api.hostname.endsWith('.supabase.co') &&
      (url.hostname.endsWith('.supabase.com') || url.hostname.endsWith('.supabase.co')) &&
      ref === api.hostname.split('.')[0] && (!url.port || url.port === '5432'),
    'configured same-project Supabase session endpoint required');
    const options = { host: url.hostname, port: Number(url.port || 5432),
      user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
      database: url.pathname.slice(1), ssl: { ca: fs.readFileSync(env.QUANTOS_BFF_SSLROOTCERT), rejectUnauthorized: true },
      connectionTimeoutMillis: 10000, keepAlive: true, keepAliveInitialDelayMillis: 10000 };
    const local = localMigrations || new Map(fs.readdirSync(path.join(root, 'supabase/migrations'))
      .filter(p => p.endsWith('.sql')).sort().map(p => [p, fs.readFileSync(path.join(root, 'supabase/migrations', p))]));
    const open = async (label, record) => connectBeforeStatements(() => {
      const client = createClient(options);
      const state = { label, index: states.length + 1, statements: 0, closed: false, fault: null };
      states.push(state); stateByClient.set(client, state);
      client.on('error', error => { error.f02Phase ||= receipt.phase; state.fault ||= error;
        if (receipt.status === 'PASS') { receipt.status = 'FAIL'; receipt.passed = false; }
        receipt.transportErrors.push({ connection: state.index, label, phase: receipt.phase,
          afterStatements: state.statements > 0, code: error.code || 'CONNECTION_ERROR' }); save(); });
      const query = client.query.bind(client), end = client.end.bind(client);
      client.query = async (...args) => {
        if (state.fault) throw state.fault;
        state.statements++;
        try {
          const result = await query(...args);
          if (state.fault) throw state.fault;
          return result;
        } catch (error) { error.f02Phase ||= receipt.phase; throw error; }
      };
      client.end = async () => { await end(); state.closed = true; };
      return client;
    }, { record, pause, onAttempt: save });
    setPhase('INITIAL_CONNECTION');
    primary = await open('primary', receipt.bootstrapConnection);
    try {
      setPhase('MIGRATION_LEDGER');
      ledger = (await primary.query('select filename,sha256 from quantos.schema_migrations order by filename')).rows;
      validateF09MigrationLedger(ledger, local); receipt.checks.push('actual migration ledger matches repository');
      setPhase('BASELINE_CATALOG'); before = await readSchema(primary);
      assert(before.tables.length > 0); assertSchemaMatches(before, before);
      const policies = before.policies.filter(p => p.tablename === 'tenants'); assert(policies.length, 'tenant policies required');
      const quote = s => '"' + s.replaceAll('"', '""') + '"';
      const mutations = [ ['disable RLS', 'alter table quantos.tenants disable row level security'],
        ['disable FORCE RLS', 'alter table quantos.tenants no force row level security'],
        ['drop tenant policies', policies.map(p => 'drop policy ' + quote(p.policyname) + ' on quantos.tenants').join(';')],
        ['column drift', 'alter table quantos.tenants add column fep0_drift_probe text'],
        ['index drift', 'create index fep0_drift_probe on quantos.tenants(slug)'] ];
      for (const [name, sql] of mutations) {
        setPhase('TRANSACTION_' + name); await primary.query('begin');
        try {
          await primary.query("set local lock_timeout='2s'; set local statement_timeout='10s'");
          await primary.query(sql);
          const changed = await readSchema(primary);
          assert.throws(() => assertSchemaMatches(changed, before), /SCHEMA_DRIFT/);
          receipt.checks.push('reject ' + name);
        } catch (error) { error.f02Phase ||= receipt.phase; throw error; }
        finally { setPhase('ROLLBACK_' + name); await primary.query('rollback'); }
        setPhase('RESTORED_' + name); assertSchemaMatches(await readSchema(primary), before);
      }
      setPhase('LEDGER_NEGATIVES');
      for (const mutate of [rows => rows.slice(1), rows => rows.map((r, i) => i ? r : { ...r, sha256: '0'.repeat(64) })]) {
        assert.throws(() => validateF09MigrationLedger(mutate(ledger), local));
      }
      receipt.checks.push('reject missing/changed applied SQL; unchanged catalog after every rollback');
    } catch (error) { failure = error; failurePhase = error.f02Phase || receipt.phase; }
    finally {
      setPhase('PRIMARY_CLOSE');
      try { if (!stateByClient.get(primary).fault) await primary.query('rollback'); }
      catch (error) { failure ||= error; failurePhase ||= error.f02Phase || receipt.phase; }
      try { await primary.end(); } catch (error) { failure ||= error; failurePhase ||= error.f02Phase || receipt.phase; }
      if (before) {
        const cleanup = receipt.cleanup = { status: 'RUNNING', readOnly: true, bootstrapConnection: {} };
        let verifier;
        try {
          setPhase('READONLY_CLEANUP_CONNECTION'); verifier = await open('cleanup', cleanup.bootstrapConnection);
          setPhase('READONLY_CLEANUP_CATALOG'); await verifier.query('begin read only');
          const after = await readSchema(verifier); assertSchemaMatches(after, before);
          const afterLedger = (await verifier.query('select filename,sha256 from quantos.schema_migrations order by filename')).rows;
          assert.deepEqual(afterLedger, ledger); await verifier.query('rollback');
          cleanup.catalogDigest = digest(JSON.stringify(after)); cleanup.ledgerUnchanged = true;
          cleanup.catalogMatchesBefore = true; cleanup.status = 'PASS';
        } catch (error) {
          cleanup.status = 'FAIL'; cleanup.errorCode = error.code || 'CLEANUP_FAILED';
          failure ||= error; failurePhase ||= error.f02Phase || receipt.phase;
        } finally {
          try { await verifier?.end(); } catch (error) { cleanup.status = 'FAIL'; failure ||= error; failurePhase ||= error.f02Phase || receipt.phase; }
        }
      } else receipt.cleanup = { status: 'NOT_NEEDED_NO_MUTATION', mutationsStarted: false };
      receipt.cleanup.connectionsClosed = states.every(state => state.closed);
      if (!receipt.cleanup.connectionsClosed) { failure ||= Error('connection cleanup incomplete'); failurePhase ||= receipt.phase; }
    }
    if (!failure) {
      assert.equal(receipt.checks.length, 7); assert.equal(receipt.cleanup.status, 'PASS');
      assert.equal(receipt.transportErrors.filter(e => e.afterStatements).length, 0);
      receipt.catalogDigest = digest(JSON.stringify(before)); receipt.status = 'PASS'; receipt.passed = true;
      receipt.phase = 'COMPLETE';
    }
  } catch (error) { failure ||= error; failurePhase ||= error.f02Phase || receipt.phase; }
  finally {
    if (!primary) receipt.cleanup = { status: 'NOT_NEEDED_NO_MUTATION', mutationsStarted: false };
    receipt.cleanup.connectionsClosed = states.every(state => state.closed);
    if (failure) { receipt.status = 'FAIL'; receipt.passed = false;
      receipt.failure = { phase: failurePhase || receipt.phase, code: failure.code || 'CHECK_FAILED' }; }
    receipt.completedAt = new Date().toISOString(); save();
  }
  if (failure) throw Object.assign(Error('F02 database failure at ' + receipt.failure.phase + ': ' + receipt.failure.code), { receipt });
  log('F02 configured Supabase transactional negatives PASS ' + receipt.checks.length);
  return receipt;
}
module.exports = { runDatabase };
