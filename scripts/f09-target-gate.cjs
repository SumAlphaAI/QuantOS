const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');
const { Client } = require('pg');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/f09/target.json');
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const dirty = Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim());
const receipt = {
  schema: 'quantos-f09-target-gate/v1', sourceCommit, dirty,
  targetClass: 'test-supabase-postgresql', status: 'RUNNING', checks: [],
  acceptanceScope: 'F09 database and Engine component probes',
  f09Accepted: false,
  remainingAcceptance: [
    'nine live business metric producers and one-minute deployment',
    'cross-service same-chain fault exercise',
    'dashboard query and notification delivery',
    'same-SHA remote CI and Nightly receipts',
  ],
  startedAt: new Date().toISOString(),
};

function save() {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`);
}

function run(command, args, logName) {
  const result = spawnSync(command, args, {
    cwd: root, env: process.env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  });
  let outputText = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const sensitiveValues = [
    process.env.DATABASE_URL,
    process.env.QUANTOS_RUNTIME_DATABASE_URL,
    process.env.QUANTOS_EXECUTION_DATABASE_URL,
    process.env.QUANTOS_RUNTIME_STORAGE_KEY,
    process.env.QUANTOS_F06_PROBE_SESSION_HASH,
  ].filter((value) => typeof value === 'string' && value.length > 8);
  for (const value of sensitiveValues) {
    if (outputText.includes(value)) {
      outputText = outputText.replaceAll(value, '[REDACTED]');
      receipt.secretLeakDetected = true;
    }
  }
  process.stdout.write(outputText);
  if (logName) {
    const logPath = path.join(root, 'artifacts/f09', logName);
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.writeFileSync(logPath, outputText);
    receipt.logs ??= {};
    receipt.logs[logName] = crypto.createHash('sha256').update(outputText).digest('hex');
  }
  if (receipt.secretLeakDetected) throw new Error('F09 exercise output included a configured secret');
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed with ${result.status}`);
}

async function main() {
  save();
  if (dirty) throw new Error('F09 target Gate requires a clean exact-SHA checkout');
  const rawDatabase = process.env.DATABASE_URL;
  const rawApi = process.env.SUPABASE_URL;
  if (!rawDatabase || !rawApi || !process.env.QUANTOS_RUNTIME_DATABASE_URL
      || !process.env.QUANTOS_EXECUTION_DATABASE_URL) {
    throw new Error('F09 Supabase, Runtime and Execution database URLs are required');
  }
  const database = new URL(rawDatabase);
  const api = new URL(rawApi);
  if (!database.hostname.endsWith('.supabase.com') || !api.hostname.endsWith('.supabase.co')) {
    throw new Error('F09 target Gate requires the configured test Supabase project');
  }
  const databaseRef = database.hostname.startsWith('db.')
    ? database.hostname.split('.')[1]
    : decodeURIComponent(database.username).split('.').at(-1);
  const apiRef = api.hostname.split('.')[0];
  if (!databaseRef || databaseRef !== apiRef || database.port === '6543') {
    throw new Error('F09 target Gate requires the same project and a direct/session PostgreSQL endpoint');
  }
  const runtimeDatabase = new URL(process.env.QUANTOS_RUNTIME_DATABASE_URL);
  const runtimeRef = runtimeDatabase.hostname.startsWith('db.')
    ? runtimeDatabase.hostname.split('.')[1]
    : decodeURIComponent(runtimeDatabase.username).split('.').at(-1);
  if (runtimeRef !== databaseRef) {
    throw new Error('F09 runtime metric login must target the same Supabase project');
  }
  const executionDatabase = new URL(process.env.QUANTOS_EXECUTION_DATABASE_URL);
  const executionRef = executionDatabase.hostname.startsWith('db.')
    ? executionDatabase.hostname.split('.')[1]
    : decodeURIComponent(executionDatabase.username).split('.').at(-1);
  if (executionRef !== databaseRef) {
    throw new Error('F09 execution metric login must target the same Supabase project');
  }
  const caPath = process.env.QUANTOS_BFF_SSLROOTCERT;
  if (!caPath || !path.isAbsolute(caPath) || !fs.existsSync(caPath)) {
    throw new Error('F09 target Gate requires QUANTOS_BFF_SSLROOTCERT');
  }
  receipt.targetRefHash = crypto.createHash('sha256')
    .update(`${database.hostname}/${api.hostname}`).digest('hex').slice(0, 16);
  const client = new Client({
    host: database.hostname, port: Number(database.port || 5432),
    user: decodeURIComponent(database.username), password: decodeURIComponent(database.password),
    database: database.pathname.slice(1) || 'postgres',
    ssl: { ca: fs.readFileSync(caPath, 'utf8'), rejectUnauthorized: true },
    connectionTimeoutMillis: 10000,
  });
  await client.connect();
  try {
    const remote = (await client.query(`select filename, sha256 from quantos.schema_migrations
      order by filename`)).rows;
    const migrationDir = path.join(root, 'supabase/migrations');
    const local = fs.readdirSync(migrationDir).filter((name) => name.endsWith('.sql')).sort();
    if (JSON.stringify(remote.map((row) => row.filename)) !== JSON.stringify(local)) {
      throw new Error('F09 target migration ledger differs from repository files');
    }
    for (const row of remote) {
      const expected = crypto.createHash('sha256')
        .update(fs.readFileSync(path.join(migrationDir, row.filename))).digest('hex');
      if (row.sha256 !== expected) throw new Error(`F09 target migration checksum mismatch: ${row.filename}`);
    }
    receipt.migrationHead = remote.at(-1)?.filename ?? null;
    if (receipt.migrationHead !== '20260927093000_f09_execution_metric_returning.sql') {
      throw new Error('F09 target migration is not current');
    }
  } finally {
    await client.end();
  }
  receipt.checks.push('same source migration ledger and checksums');
  const runtimeClient = new Client({
    host: runtimeDatabase.hostname, port: Number(runtimeDatabase.port || 5432),
    user: decodeURIComponent(runtimeDatabase.username),
    password: decodeURIComponent(runtimeDatabase.password),
    database: runtimeDatabase.pathname.slice(1) || 'postgres',
    ssl: { ca: fs.readFileSync(caPath, 'utf8'), rejectUnauthorized: true },
    connectionTimeoutMillis: 10000,
  });
  await runtimeClient.connect();
  try {
    await runtimeClient.query('set role quantos_runtime');
    await runtimeClient.query('begin');
    let rejected = false;
    try {
      await runtimeClient.query(`select quantos.record_operational_metric(
        null, 'risk_query_latency_ms', 1.0, 'risk_query_latency_ms',
        null, '{}'::jsonb, now())`);
    } catch (error) {
      rejected = error.code === '42501';
    } finally {
      await runtimeClient.query('rollback');
    }
    if (!rejected) throw new Error('restricted Runtime role could write a non-Storage metric');
  } finally {
    await runtimeClient.end();
  }
  receipt.checks.push('restricted Runtime role rejects other metric families');
  const executionClient = new Client({
    host: executionDatabase.hostname, port: Number(executionDatabase.port || 5432),
    user: decodeURIComponent(executionDatabase.username),
    password: decodeURIComponent(executionDatabase.password),
    database: executionDatabase.pathname.slice(1) || 'postgres',
    ssl: { ca: fs.readFileSync(caPath, 'utf8'), rejectUnauthorized: true },
    connectionTimeoutMillis: 10000,
  });
  await executionClient.connect();
  try {
    await executionClient.query('set role quantos_execution_gateway');
    await executionClient.query('begin');
    await executionClient.query(`select quantos.record_operational_metric(
      null, 'secret_read_failure', 1.0, 'secret_read_failure',
      null, '{}'::jsonb, now())`);
    await executionClient.query('rollback');
    await executionClient.query('begin');
    let rejected = false;
    try {
      await executionClient.query(`select quantos.record_operational_metric(
        null, 'storage_operation_error', 1.0, 'storage_operation_error',
        null, '{}'::jsonb, now())`);
    } catch (error) {
      rejected = error.code === '42501';
    } finally {
      await executionClient.query('rollback');
    }
    if (!rejected) throw new Error('restricted Execution role could write a Storage metric');
  } finally {
    await executionClient.end();
  }
  receipt.checks.push('restricted Execution role can write only secret metric families');
  run('cargo', ['build', '-p', 'capacity-monitor', '--locked']);
  run('node', ['scripts/f09-scheduler-smoke.cjs'], 'scheduler-smoke.log');
  receipt.checks.push('two one-minute Supabase scheduler ticks fail closed on missing metrics');
  run('make', ['test-f09-live'], 'postgres-exercises.log');
  receipt.checks.push('live capacity, own-session termination, consumer recovery and redaction tests');
  run('cargo', [
    'test', '-p', 'quantos-portfolio', '--test', 'postgres_portfolio', '--locked',
    'f09_portfolio_and_risk_queries_persist_actual_latency_samples', '--', '--exact', '--nocapture',
  ], 'portfolio-query.log');
  receipt.checks.push('real portfolio and risk query samples');
  run('cargo', [
    'test', '-p', 'quantos-engine-manager', '--test', 'python_mock_engine', '--locked',
    'manager_supervises_three_real_crashes_without_test_owned_restarts', '--', '--exact', '--nocapture',
  ], 'engine-crash.log');
  receipt.checks.push('local supervised Engine process crash and recovery');
  run('cargo', [
    'test', '-p', 'quantos-portfolio', '--test', 'postgres_portfolio', '--locked',
    'postgres_portfolio_store_persists_and_reads_projection', '--', '--exact', '--nocapture',
  ], 'portfolio-p95.log');
  receipt.checks.push('portfolio end-to-end query p95 below 300ms');
  receipt.status = 'PASS';
}

main().catch((error) => {
  receipt.status = 'FAIL';
  receipt.error = error.message;
  process.exitCode = 1;
  console.error(error.message);
}).finally(() => {
  receipt.completedAt = new Date().toISOString();
  save();
});
