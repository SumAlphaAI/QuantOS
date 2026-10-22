const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomUUID, createHash } = require('node:crypto');
const { Client } = require('pg');
const { loadLocalDatabaseEnvironment } = require('./lib/manual-database-policy.cjs');
const { maintainMetrics } = require('./lib/database-hygiene.cjs');

test('Supabase: actual batch metric SQL and bounded retention, TEMP tables rolled back', {
  skip: process.env.QUANTOS_HYGIENE_POSTGRES_TESTS !== '1', timeout: 60000,
}, async () => {
  loadLocalDatabaseEnvironment();
  const url = new URL(process.env.DATABASE_URL), api = new URL(process.env.SUPABASE_URL);
  const ref = url.hostname.startsWith('db.') ? url.hostname.split('.')[1] : decodeURIComponent(url.username).split('.').at(-1);
  assert.equal(ref, api.hostname.split('.')[0]);
  assert(api.hostname.endsWith('.supabase.co'));
  assert(process.env.QUANTOS_BFF_SSLROOTCERT, 'verified CA required');
  const client = new Client({ host: url.hostname, port: Number(url.port || 5432),
    user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: url.pathname.slice(1),
    ssl: { ca: fs.readFileSync(process.env.QUANTOS_BFF_SSLROOTCERT, 'utf8'), rejectUnauthorized: true },
    connectionTimeoutMillis: 10000, statement_timeout: 15000 });
  client.on('error', () => {});
  let rolledBack = false;
  try {
    await client.connect();
    const original = (await client.query("select to_regclass('quantos.tenants')::text as tenants")).rows[0];
    await client.query('begin');
    await client.query(`create temp table operational_metric_samples (
      id uuid primary key default gen_random_uuid(), tenant_id uuid, metric_name text,
      metric_value double precision, source text, correlation_id uuid, attributes jsonb, observed_at timestamptz);
      create temp table event_log (id uuid primary key, correlation_id uuid not null, ingested_at timestamptz);
      create temp table outbox_event (id uuid primary key, event_log_id uuid)`);
    const tenant = randomUUID(), other = randomUUID(), correlation = randomUUID();
    const now = new Date(), input = [], events = [];
    for (let i = 0; i < 300; i++) {
      const event = randomUUID(), outbox = randomUUID();
      input.push({ outbox_id: outbox, tenant_id: i < 250 ? tenant : other, completed_at: now.toISOString() });
      events.push({ id: event, outbox, correlation: i < 250 ? correlation : randomUUID(), ingested: new Date(now - (i + 1) * 1000).toISOString() });
    }
    await client.query(`insert into pg_temp.event_log select id, correlation, ingested from
      jsonb_to_recordset($1) as x(id uuid, outbox uuid, correlation uuid, ingested timestamptz)`, [JSON.stringify(events)]);
    await client.query(`insert into pg_temp.outbox_event select outbox, id from
      jsonb_to_recordset($1) as x(id uuid, outbox uuid)`, [JSON.stringify(events)]);
    const rust = fs.readFileSync('crates/quantos-event/src/pg.rs', 'utf8');
    const section = rust.slice(rust.indexOf('// Projection completion'));
    const sql = section.match(/"(with input as \([\s\S]+?)",\n\s*&\[\(&input, Type::JSONB\)\]/)?.[1];
    assert(sql, 'extract the production Rust SQL, not a copied implementation');
    await client.query(sql.replaceAll('quantos.', 'pg_temp.'), [JSON.stringify(input)]);
    const samples = (await client.query('select * from pg_temp.operational_metric_samples order by metric_value')).rows;
    assert.equal(samples.length, 2);
    assert.equal(samples[0].metric_value, 250);
    assert.equal(samples[0].correlation_id, correlation);
    assert.equal(samples[0].attributes.sample_count, 250);
    assert.equal(samples[1].metric_value, 300);
    assert.equal(samples[1].correlation_id, null, 'mixed correlations must not be misattributed');
    assert.equal(samples[1].attributes.sample_count, 50);
    // A single-event batch preserves the existing F09 correlation contract.
    await client.query(sql.replaceAll('quantos.', 'pg_temp.'), [JSON.stringify([input[0]])]);
    assert.equal((await client.query('select count(*)::int as n from pg_temp.operational_metric_samples where correlation_id=$1', [correlation])).rows[0].n, 2);
    await client.query(`insert into pg_temp.operational_metric_samples (tenant_id, observed_at)
      select $1, $2::timestamptz - interval '8 days' from generate_series(1, 5007)`, [tenant, now]);
    const scoped = { query: (query, params) => client.query(query.replaceAll('quantos.', 'pg_temp.'), params) };
    const preview = await maintainMetrics(scoped, { now });
    assert.equal(preview.expiredBefore, 5007); assert.equal(preview.deleted, 0);
    const applied = await maintainMetrics(scoped, { apply: true, now });
    assert.equal(applied.deleted, 5000); assert.equal(applied.remainingEstimate, 7);
    assert.equal((await client.query('select count(*)::int as n from pg_temp.operational_metric_samples')).rows[0].n, 10);
    for (const table of ['event_log', 'outbox_event']) assert.equal((await client.query(`select count(*)::int as n from pg_temp.${table}`)).rows[0].n, 300);
    await client.query('rollback'); rolledBack = true;
    assert.equal((await client.query("select to_regclass('pg_temp.operational_metric_samples')::text as name")).rows[0].name, null);
    assert.deepEqual((await client.query("select to_regclass('quantos.tenants')::text as tenants")).rows[0], original);
    console.log(JSON.stringify({ targetProjectHash: createHash('sha256').update(ref).digest('hex').slice(0, 16), verifiedTLS: true,
      inputEvents: 300, batchSamples: 2, expiredFixtures: 5007, deletedInRollbackTransaction: 5000,
      recentSamplesPreserved: 3, eventAndOutboxRowsPreserved: 300, rolledBack, businessSchemaChanged: false,
      productionSqlSha256: createHash('sha256').update(sql).digest('hex') }));
  } finally {
    if (!rolledBack) await client.query('rollback').catch(() => {});
    await client.end();
  }
});
