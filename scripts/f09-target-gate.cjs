const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');
const { Client } = require('pg');
const { validateF09MigrationLedger } = require('./lib/f09-migration-ledger.cjs');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/f09/target.json');
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const dirty = Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim());
const receipt = {
  schema: 'quantos-f09-target-gate/v3', sourceCommit, dirty,
  targetClass: 'test-supabase-postgresql', status: 'RUNNING', checks: [],
  acceptanceScope: 'F09 development database and Engine component probes',
  f09Accepted: false,
  remainingDevelopmentAcceptance: [
    'same-SHA remote CI and Nightly receipts',
  ],
  deferredToL04: [
    'nine deployed business metric producers and one-minute monitor',
    'cross-service same-chain fault exercises and secret leak scan',
    'sustained live thresholds, dashboard queries and notification delivery',
  ],
  startedAt: new Date().toISOString(),
};

function save() {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`);
}

function run(command, args, logName, env = process.env) {
  const result = spawnSync(command, args, {
    cwd: root, env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
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
  return outputText;
}

function traceId(outputText, pattern) {
  const id = outputText.match(pattern)?.[1];
  if (!id || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) {
    throw new Error('F09 write entrypoint did not emit a checked correlation ID');
  }
  return id;
}

async function connectTarget(config) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const client = new Client(config);
    try {
      await client.connect();
      if (attempt > 1) receipt.connectionAttempts = attempt;
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
  if (dirty) throw new Error('F09 target Gate requires a clean exact-SHA checkout');
  const rawDatabase = process.env.DATABASE_URL;
  const rawApi = process.env.SUPABASE_URL;
  if (!rawDatabase || !rawApi) {
    throw new Error('F09 Supabase database and API URLs are required');
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
  const caPath = process.env.QUANTOS_BFF_SSLROOTCERT;
  if (!caPath || !path.isAbsolute(caPath) || !fs.existsSync(caPath)) {
    throw new Error('F09 target Gate requires QUANTOS_BFF_SSLROOTCERT');
  }
  receipt.targetRefHash = crypto.createHash('sha256')
    .update(`${database.hostname}/${api.hostname}`).digest('hex').slice(0, 16);
  const client = await connectTarget({
    host: database.hostname, port: Number(database.port || 5432),
    user: decodeURIComponent(database.username), password: decodeURIComponent(database.password),
    database: database.pathname.slice(1) || 'postgres',
    ssl: { ca: fs.readFileSync(caPath, 'utf8'), rejectUnauthorized: true },
    connectionTimeoutMillis: 10000,
  });
  try {
    const remote = (await client.query(`select filename, sha256 from quantos.schema_migrations
      order by filename`)).rows;
    const migrationDir = path.join(root, 'supabase/migrations');
    const local = fs.readdirSync(migrationDir).filter((name) => name.endsWith('.sql')).sort();
    receipt.migrationHead = validateF09MigrationLedger(remote, new Map(local.map(name => [name, fs.readFileSync(path.join(migrationDir, name))])));
  } finally {
    await client.end();
  }
  receipt.checks.push('same source migration ledger and checksums');
  run('cargo', ['build', '-p', 'capacity-monitor', '--locked']);
  run('cargo', ['build', '-p', 'portfolio-rebuild', '--locked']);
  run('node', ['scripts/f09-scheduler-smoke.cjs'], 'scheduler-smoke.log');
  receipt.checks.push('two one-minute Supabase scheduler ticks fail closed on missing metrics');
  run('make', ['test-f09-live'], 'postgres-exercises.log');
  receipt.checks.push('live capacity, own-session termination, consumer recovery and redaction tests');
  run('cargo', [
    'test', '-p', 'quantos-portfolio', '--test', 'postgres_portfolio', '--locked',
    'f09_portfolio_and_risk_queries_persist_actual_latency_samples', '--', '--exact', '--nocapture',
  ], 'portfolio-query.log');
  receipt.checks.push('real portfolio and risk query samples');
  const liveEnv = { ...process.env, QUANTOS_RUN_F09_POSTGRES_TESTS: '1' };
  const bffOutput = run('cargo', [
    'test', '-p', 'bff-gateway', '--lib', 'f09_live_tests', '--locked',
    '--', '--test-threads=1', '--nocapture',
  ], 'bff-write-trace.log', liveEnv);
  const runtimeOutput = run('cargo', [
    'test', '-p', 'runtime-gateway', '--bin', 'runtime-gateway',
    'f09_runtime_real_write_trace', '--locked', '--', '--nocapture',
  ], 'runtime-write-trace.log', liveEnv);
  const portfolioOutput = run('node', [
    'scripts/f09-portfolio-write-trace.cjs',
  ], 'portfolio-write-trace.log');
  const portfolioEvidence = portfolioOutput.split('\n')
    .filter((line) => line.includes('F09_PORTFOLIO_WRITE_TRACE_PASS'))
    .map((line) => JSON.parse(line)).at(-1);
  if (!portfolioEvidence || !portfolioEvidence.snapshotHash ||
      portfolioEvidence.lastEventSequence < 20 || portfolioEvidence.positionCount < 1) {
    throw new Error('F09 portfolio write trace evidence is incomplete');
  }
  receipt.writeTraces = {
    bffSessionRevoke: traceId(bffOutput, /F09 BFF real session revoke and persistent trace share correlation_id=([0-9a-f-]{36})/),
    runtimeRunSchedule: traceId(runtimeOutput, /F09 Runtime persisted run and trace share correlation_id=([0-9a-f-]{36})/),
    portfolioProjection: portfolioEvidence,
  };
  receipt.checks.push('real BFF, Runtime and Portfolio writes linked to persistent trace');
  run('cargo', [
    'test', '-p', 'quantos-engine-manager', '--test', 'python_mock_engine', '--locked',
    'manager_supervises_three_real_crashes_without_test_owned_restarts', '--', '--exact', '--nocapture',
  ], 'engine-crash.log');
  receipt.checks.push('local supervised Engine process crash and recovery');
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
