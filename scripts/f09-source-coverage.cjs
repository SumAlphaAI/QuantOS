#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { Client } = require('pg');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/f09/source-coverage.json');
const metricNames = [
  'realtime_projection_delay_secs',
  'realtime_quota_utilization',
  'risk_query_latency_ms',
  'portfolio_query_latency_ms',
  'risk_mv_freshness_secs',
  'ops_aggregate_freshness_secs',
  'storage_operation_error',
  'secret_rotation_failure',
  'secret_read_failure',
];

const receipt = {
  schema: 'quantos-f09-source-coverage/v1',
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  dirty: Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim()),
  targetClass: 'test-supabase-postgresql',
  status: 'RUNNING',
  f09Accepted: false,
  evidenceScope: 'sample presence only; provenance and business producer deployment require separate proof',
};

function save() {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`);
}

async function connect(config) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const client = new Client(config);
    try {
      await client.connect();
      receipt.connectionAttempts = attempt;
      return client;
    } catch (error) {
      lastError = error;
      await client.end().catch(() => {});
      if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  throw lastError;
}

async function main() {
  save();
  if (receipt.dirty) throw new Error('source coverage requires a clean exact-SHA checkout');
  if (!process.env.DATABASE_URL || !process.env.SUPABASE_URL || !process.env.QUANTOS_BFF_SSLROOTCERT) {
    throw new Error('DATABASE_URL, SUPABASE_URL and QUANTOS_BFF_SSLROOTCERT are required');
  }
  const database = new URL(process.env.DATABASE_URL);
  const api = new URL(process.env.SUPABASE_URL);
  const databaseRef = database.hostname.startsWith('db.')
    ? database.hostname.split('.')[1]
    : decodeURIComponent(database.username).split('.').at(-1);
  if (!database.hostname.endsWith('.supabase.com') || !api.hostname.endsWith('.supabase.co')
      || databaseRef !== api.hostname.split('.')[0] || database.port === '6543') {
    throw new Error('source coverage requires one configured test Supabase project and a session endpoint');
  }
  const caPath = process.env.QUANTOS_BFF_SSLROOTCERT;
  if (!path.isAbsolute(caPath)) throw new Error('QUANTOS_BFF_SSLROOTCERT must be absolute');
  receipt.targetRefHash = crypto.createHash('sha256')
    .update(`${database.hostname}/${api.hostname}`).digest('hex').slice(0, 16);
  const client = await connect({
    host: database.hostname, port: Number(database.port || 5432),
    user: decodeURIComponent(database.username), password: decodeURIComponent(database.password),
    database: database.pathname.slice(1) || 'postgres',
    ssl: { ca: fs.readFileSync(caPath, 'utf8'), rejectUnauthorized: true },
    connectionTimeoutMillis: 10000,
  });
  try {
    const { rows } = await client.query(`
      select clock_timestamp() as observed_at,
             name as metric_name,
             (select count(*)::int from quantos.operational_metric_samples sample
              where sample.metric_name = name and sample.observed_at >= now() - interval '90 seconds') as recent_count,
             (select count(*)::int from quantos.operational_metric_samples sample
              where sample.metric_name = name and sample.observed_at >= now() - interval '24 hours') as day_count
      from unnest($1::text[]) as name order by name`, [metricNames]);
    receipt.observedAt = rows[0]?.observed_at?.toISOString();
    receipt.metrics = rows.map(({ metric_name, recent_count, day_count }) => ({
      name: metric_name, last90Seconds: recent_count, last24Hours: day_count,
    }));
    receipt.missingRecent = receipt.metrics.filter((metric) => metric.last90Seconds === 0)
      .map((metric) => metric.name);
    receipt.status = receipt.missingRecent.length === 0 ? 'PASS' : 'FAIL';
  } finally {
    await client.end();
  }
  if (receipt.status !== 'PASS') process.exitCode = 1;
}

main().catch((error) => {
  receipt.status = 'FAIL';
  receipt.error = error.code || error.message;
  process.exitCode = 1;
}).finally(() => {
  receipt.completedAt = new Date().toISOString();
  save();
  console.log(JSON.stringify({ sourceCommit: receipt.sourceCommit, status: receipt.status,
    missingRecent: receipt.missingRecent ?? [], error: receipt.error ?? null }));
});
