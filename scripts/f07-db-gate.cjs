const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');
const { Client } = require('pg');

const root = path.resolve(__dirname, '..');
const runKind = process.env.QUANTOS_F07_MIGRATION_ONLY === '1' ? 'migration-only'
  : process.env.QUANTOS_F07_RECOVERY_DIAGNOSTIC === '1' ? 'recovery-diagnostic'
    : process.env.QUANTOS_F07_COVERAGE_DIAGNOSTIC === '1' ? 'coverage-diagnostic' : 'database';
const output = path.join(root, `artifacts/f07/${runKind}.json`);
const coveragePath = path.join(root, 'artifacts/f07/coverage.json');
const metricsPath = path.join(root, `artifacts/f07/${runKind}-measurements.json`);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.rmSync(metricsPath, { force: true });
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const dirty = Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim());
const receipt = { schema: 'quantos-f07-acceptance/v1', sourceCommit, dirty,
  status: 'RUNNING', targetClass: 'isolated-supabase-postgresql', checks: [],
  startedAt: new Date().toISOString() };
function save() {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`);
}
function run(command, args, env) {
  const result = spawnSync(command, args, { cwd: root, env: { ...process.env, ...env }, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${command} failed with ${result.status}`);
}
function targetConfig() {
  if (!process.env.DATABASE_URL || !process.env.SUPABASE_URL) {
    throw new Error('DATABASE_URL and SUPABASE_URL are required for F07 target acceptance');
  }
  const url = new URL(process.env.DATABASE_URL);
  const api = new URL(process.env.SUPABASE_URL);
  const databaseRef = url.hostname.startsWith('db.')
    ? url.hostname.split('.')[1]
    : decodeURIComponent(url.username).split('.').at(-1);
  const apiRef = api.hostname.split('.')[0];
  if (!databaseRef || databaseRef !== apiRef || !api.hostname.endsWith('.supabase.co')) {
    throw new Error('DATABASE_URL and SUPABASE_URL must identify the same Supabase project');
  }
  if (url.port === '6543') throw new Error('F07 acceptance requires a direct or session PostgreSQL endpoint');
  const caPath = process.env.QUANTOS_BFF_SSLROOTCERT;
  if (!caPath || !path.isAbsolute(caPath) || !fs.existsSync(caPath)) {
    throw new Error('QUANTOS_BFF_SSLROOTCERT must identify an existing absolute CA file');
  }
  url.searchParams.set('sslmode', 'verify-full');
  url.searchParams.set('sslrootcert', caPath);
  return { url, caPath, projectRefHash: crypto.createHash('sha256').update(apiRef).digest('hex').slice(0, 16) };
}
async function main() {
  const target = targetConfig();
  const url = target.url;
  const client = new Client({
    host: url.hostname, port: Number(url.port || 5432),
    user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
    database: url.pathname.slice(1) || 'postgres',
    ssl: { ca: fs.readFileSync(target.caPath, 'utf8'), rejectUnauthorized: true },
    connectionTimeoutMillis: 10000,
  });
  await client.connect();
  try {
    const info = (await client.query(`select current_setting('server_version_num')::int as version,
      exists(select 1 from pg_namespace where nspname='auth') as has_auth,
      to_regclass('quantos.schema_migrations') is not null as has_ledger`)).rows[0];
    if (info.version < 170000 || !info.has_auth || !info.has_ledger) {
      throw new Error('F07 target must be a migrated Supabase PostgreSQL 17 project');
    }
    const pending = (await client.query(`select filename from quantos.schema_migrations order by filename desc limit 1`)).rows[0]?.filename;
    receipt.targetProjectRefHash = target.projectRefHash;
    receipt.targetPostgresMajor = Math.floor(info.version / 10000);
    receipt.migrationBefore = pending || null;
    run(process.execPath, ['scripts/db-cli.cjs', 'apply'], { DATABASE_URL: url.toString() });
    receipt.checks.push('same-project, verified-TLS target and checksum-guarded forward migrations');
    run(process.execPath, ['scripts/db-cli.cjs', 'live-rls'], { DATABASE_URL: url.toString() });
    receipt.checks.push('target RLS baseline');
    if (process.env.QUANTOS_F07_MIGRATION_ONLY === '1') {
      receipt.status = 'MIGRATION_ONLY';
      return;
    }
    if (process.env.QUANTOS_F07_RECOVERY_DIAGNOSTIC === '1') {
      try {
        run('cargo', ['test', '-p', 'quantos-runtime', '--test', 'postgres_runtime', '--locked',
          'postgres_runtime_recovers_one_hundred_runs_without_duplicate_artifacts', '--', '--exact', '--nocapture'], {
          DATABASE_URL: url.toString(), QUANTOS_F07_DB_REQUIRED: '1',
          QUANTOS_F07_COVERAGE_MEASUREMENT: '1', QUANTOS_RUNTIME_RECOVERY_RUNS: '100',
          QUANTOS_F07_METRICS_PATH: metricsPath,
        });
      } finally { run(process.execPath, ['scripts/f07-fixture-check.cjs', '--retire'], { QUANTOS_F07_FIXTURE_RETIRE: '1' }); }
      receipt.checks.push('100 OS-killed worker recoveries; scheduling P95 is deliberately not assessed by this diagnostic');
      receipt.status = 'DIAGNOSTIC_ONLY';
      return;
    }
    if (process.env.QUANTOS_F07_COVERAGE_DIAGNOSTIC === '1') {
      try {
        run('cargo', ['llvm-cov', '--package', 'quantos-runtime', '--package', 'runtime-gateway',
          '--lib', '--bins', '--test', 'postgres_runtime', '--locked',
          ...(process.env.QUANTOS_F07_NIGHTLY_BRANCH === '1' ? ['--branch'] : []), '--json',
          '--output-path', coveragePath, '--', '--test-threads=1', '--nocapture'], {
          DATABASE_URL: url.toString(), QUANTOS_F07_DB_REQUIRED: '1',
          QUANTOS_RUNTIME_RECOVERY_RUNS: '10', QUANTOS_F07_COVERAGE_MEASUREMENT: '1',
          QUANTOS_F07_METRICS_PATH: metricsPath,
        });
      } finally { run(process.execPath, ['scripts/f07-fixture-check.cjs', '--retire'], { QUANTOS_F07_FIXTURE_RETIRE: '1' }); }
      run(process.execPath, ['scripts/f07-coverage-check.cjs', coveragePath]);
      receipt.checks.push('diagnostic coverage; 10 recovery tasks and no P95 acceptance');
      receipt.status = 'DIAGNOSTIC_ONLY';
      return;
    }
    try {
      run('cargo', ['test', '-p', 'quantos-runtime', '--test', 'postgres_runtime', '--locked', '--', '--test-threads=1', '--nocapture'], {
        DATABASE_URL: url.toString(), QUANTOS_F07_DB_REQUIRED: '1',
        QUANTOS_RUNTIME_RECOVERY_RUNS: '100', QUANTOS_RUNTIME_SCHEDULE_P95_LIMIT_MS: '200',
        QUANTOS_F07_METRICS_PATH: metricsPath,
      });
    } finally { run(process.execPath, ['scripts/f07-fixture-check.cjs', '--retire'], { QUANTOS_F07_FIXTURE_RETIRE: '1' }); }
    receipt.checks.push('100 OS-killed worker recoveries, unique artifacts, cancel and timeout audit, scheduling P95 <=200ms');
    run('cargo', ['llvm-cov', '--package', 'quantos-runtime', '--package', 'runtime-gateway', '--lib', '--bins', '--test', 'postgres_runtime',
      '--locked', ...(process.env.QUANTOS_F07_NIGHTLY_BRANCH === '1' ? ['--branch'] : []),
      '--json', '--output-path', coveragePath, '--', '--test-threads=1', '--nocapture'], {
      DATABASE_URL: url.toString(), QUANTOS_F07_DB_REQUIRED: '1',
      QUANTOS_RUNTIME_RECOVERY_RUNS: '100', QUANTOS_F07_COVERAGE_MEASUREMENT: '1',
    });
    run(process.execPath, ['scripts/f07-coverage-check.cjs', coveragePath]);
    receipt.checks.push(process.env.QUANTOS_F07_NIGHTLY_BRANCH === '1'
      ? 'F07 Rust line >=90%, region >=85%, nightly branch >=85%'
      : 'F07 Rust line >=90% and stable region >=85%');
    receipt.status = 'PASS';
  } finally {
    await client.end();
  }
}
save();
main().catch((error) => { receipt.status = 'FAIL'; receipt.error = error.message; process.exitCode = 1; console.error(error.message); })
  .finally(() => {
    if (fs.existsSync(metricsPath)) receipt.measurements = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));
    receipt.completedAt = new Date().toISOString();
    save();
  });
