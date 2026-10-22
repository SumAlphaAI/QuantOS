#!/usr/bin/env node
const fs = require('node:fs');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Client } = require('pg');
const { loadLocalDatabaseEnvironment } = require('./lib/manual-database-policy.cjs');
const { maintainMetrics } = require('./lib/database-hygiene.cjs');
loadLocalDatabaseEnvironment();

async function main() {
  assert(process.argv.slice(2).every(arg => arg === '--apply'), 'usage: node scripts/database-hygiene.cjs [--apply]');
  const apply = process.argv.includes('--apply');
  const url = new URL(process.env.DATABASE_URL);
  const api = new URL(process.env.SUPABASE_URL);
  const ref = url.hostname.startsWith('db.') ? url.hostname.split('.')[1] : decodeURIComponent(url.username).split('.').at(-1);
  assert(ref === api.hostname.split('.')[0] && api.hostname.endsWith('.supabase.co'), 'matching Supabase database/API required');
  assert(process.env.QUANTOS_BFF_SSLROOTCERT, 'verified CA file required');
  const client = new Client({ host: url.hostname, port: Number(url.port || 5432),
    user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: url.pathname.slice(1),
    ssl: { ca: fs.readFileSync(process.env.QUANTOS_BFF_SSLROOTCERT, 'utf8'), rejectUnauthorized: true },
    connectionTimeoutMillis: 10000, statement_timeout: 15000 });
  client.on('error', () => { process.exitCode = 1; });
  try {
    await client.connect();
    await client.query(apply ? 'begin' : 'begin read only');
    await client.query("set local lock_timeout = '2s'");
    const info = (await client.query(`select pg_database_size(current_database())::text as database_bytes,
      to_regclass('quantos.operational_metric_samples') is not null as metrics_table_present`)).rows[0];
    const result = { schema: 'quantos-database-hygiene/v1', verifiedTLS: true,
      projectHash: crypto.createHash('sha256').update(ref).digest('hex').slice(0, 16), ...info };
    if (info.metrics_table_present) Object.assign(result, await maintainMetrics(client, { apply }));
    else Object.assign(result, { status: 'NOT_APPLICABLE_UNINITIALIZED', deleted: 0 });
    result.tables = (await client.query(`select relname, pg_total_relation_size(relid)::text as total_bytes,
      n_live_tup::text as estimated_live_rows, n_dead_tup::text as estimated_dead_rows,
      last_autovacuum from pg_stat_user_tables order by pg_total_relation_size(relid) desc limit 20`)).rows;
    await client.query(apply ? 'commit' : 'rollback');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    await client.query('rollback').catch(() => {});
    // pg diagnostics may contain values from the server; output codes only.
    console.error(`Database hygiene failed: ${error.code || error.name}`);
    process.exitCode = 1;
  } finally { await client.end(); }
}
main().catch(error => { console.error(`Database hygiene preflight failed: ${error.code || error.name}`); process.exitCode = 1; });
