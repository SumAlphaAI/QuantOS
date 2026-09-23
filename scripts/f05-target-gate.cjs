const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync, execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/f05/target.json');
const measurementsPath = path.join(root, 'artifacts/f05/measurements.json');
process.env.QUANTOS_F05_MEASUREMENTS_PATH = measurementsPath;
const migrationDirectory = path.join(root, 'supabase/migrations');
const migrationDigest = crypto.createHash('sha256');
for (const filename of fs.readdirSync(migrationDirectory).filter((name) => name.endsWith('.sql')).sort()) {
  migrationDigest.update(filename);
  migrationDigest.update(fs.readFileSync(path.join(migrationDirectory, filename)));
}
const receipt = {
  schema: 'quantos-f05-target-acceptance/v1',
  status: 'RUNNING',
  passed: false,
  targetClass: 'supabase-isolated-project-or-database-branch',
  source: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  dirty: Boolean(execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { cwd: root, encoding: 'utf8' }).trim()),
  migrationDigest: `sha256:${migrationDigest.digest('hex')}`,
  startedAt: new Date().toISOString(),
  checks: [],
};

function save() {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`);
}

function run(target) {
  const result = spawnSync('make', [target], { cwd: root, env: process.env, encoding: 'utf8' });
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error(`make ${target} failed`);
  receipt.checks.push(target);
}

try {
  save();
  fs.rmSync(measurementsPath, { force: true });
  if (receipt.dirty) throw new Error('F05 target acceptance requires a clean exact-SHA checkout');
  if (process.env.QUANTOS_F05_TARGET_ISOLATED !== '1') {
    throw new Error('QUANTOS_F05_TARGET_ISOLATED=1 is required to confirm a disposable Supabase target');
  }
  if (process.env.QUANTOS_DB_RESET_CONFIRM !== 'reset_remote_schema') {
    throw new Error('QUANTOS_DB_RESET_CONFIRM=reset_remote_schema is required for a repeatable F05 target acceptance');
  }
  for (const name of ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
    if (!process.env[name]) throw new Error(`${name} is required for F05 target acceptance`);
  }
  // A target run must start from the repository migration baseline. This is
  // intentionally guarded by both the isolated-target and reset confirmations.
  run('db-reset');
  receipt.checks.push('isolated target reset and complete migration rebuild');
  if (process.env.QUANTOS_F05_COVERAGE === '1') {
    const coverage = require('./f05-coverage.cjs');
    coverage.start();
    coverage.tests('quantos-event', process.env.DATABASE_URL);
    coverage.tests('quantos-storage', process.env.DATABASE_URL);
    coverage.storageLive();
    receipt.coverage = coverage.finish();
    receipt.checks.push('instrumented PostgreSQL, HTTP faults and Supabase Storage live');
  } else {
    run('test-f05-live');
    run('test-supabase-storage-live');
  }
  receipt.measurements = require('./f05-measurements.cjs')(measurementsPath, true);
  receipt.status = 'PASS';
  receipt.passed = true;
} catch (error) {
  receipt.status = 'FAIL';
  receipt.error = error.message;
  process.exitCode = 1;
  console.error(error.message);
} finally {
  receipt.completedAt = new Date().toISOString();
  save();
  console.log(JSON.stringify(receipt, null, 2));
}
