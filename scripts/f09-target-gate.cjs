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
  startedAt: new Date().toISOString(),
};

function save() {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`);
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, env: process.env, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed with ${result.status}`);
}

async function main() {
  save();
  if (dirty) throw new Error('F09 target Gate requires a clean exact-SHA checkout');
  const rawDatabase = process.env.DATABASE_URL;
  const rawApi = process.env.SUPABASE_URL;
  if (!rawDatabase || !rawApi) throw new Error('DATABASE_URL and SUPABASE_URL are required');
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
    if (receipt.migrationHead !== '20260927090000_f09_metric_quality.sql') {
      throw new Error('F09 target migration is not current');
    }
  } finally {
    await client.end();
  }
  receipt.checks.push('same source migration ledger and checksums');
  run('make', ['test-f09-live']);
  receipt.checks.push('live capacity, fault recovery and redaction tests');
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
