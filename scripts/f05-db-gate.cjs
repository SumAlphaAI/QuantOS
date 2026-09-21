const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync, execFileSync } = require('node:child_process');
const { Client } = require('pg');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/f05/database.json');
const migrationDirectory = path.join(root, 'supabase/migrations');
const migrationDigest = crypto.createHash('sha256');
for (const filename of fs.readdirSync(migrationDirectory).filter((name) => name.endsWith('.sql')).sort()) {
  migrationDigest.update(filename);
  migrationDigest.update(fs.readFileSync(path.join(migrationDirectory, filename)));
}
const receipt = {
  schema: 'quantos-f05-acceptance/v1',
  status: 'RUNNING',
  passed: false,
  targetClass: 'disposable-loopback-postgresql',
  source: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  dirty: Boolean(execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { cwd: root, encoding: 'utf8' }).trim()),
  migrationDigest: `sha256:${migrationDigest.digest('hex')}`,
  startedAt: new Date().toISOString(),
  acceptance: {
    eventCount: 10_000,
    concurrentDeliveryAttempts: 1_000,
    correlationLookupBudgetSeconds: 5,
    rlsRoles: ['anon', 'authenticated', 'service_role'],
    storageRoundTrip: 'not-applicable',
  },
  checks: [],
};

function save() {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`);
}

function run(command, args, env = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed`);
}

async function main() {
  save();
  if (receipt.dirty) throw new Error('F05 database acceptance requires a clean exact-SHA checkout');
  const url = new URL(process.env.F02_PG_ADMIN_URL ?? '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('F05 database Gate requires an explicitly provided disposable loopback PostgreSQL');
  }
  const admin = new Client({ connectionString: url.toString() });
  await admin.connect();
  const name = `f05_acceptance_${crypto.randomBytes(6).toString('hex')}`;
  const target = new URL(url);
  target.pathname = `/${name}`;
  let client;
  try {
    for (const role of ['authenticated', 'anon', 'service_role']) {
      await admin.query(`do $$ begin if not exists(select from pg_roles where rolname='${role}') then create role ${role} nologin; end if; end $$`);
    }
    await admin.query(`create database ${name}`);
    client = new Client({ connectionString: target.toString() });
    await client.connect();
    await client.query(`create schema auth; create schema extensions;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
      grant usage on schema auth to authenticated,anon,service_role;`);
    run(process.execPath, ['scripts/db-cli.cjs', 'apply'], { DATABASE_URL: target.toString() });
    receipt.checks.push('fresh migration rebuild');
    run(process.execPath, ['scripts/db-cli.cjs', 'live-rls'], { DATABASE_URL: target.toString() });
    receipt.checks.push('RLS, FORCE RLS, policy and privileged-path catalog checks');

    run('cargo', ['test', '-p', 'quantos-event', '--test', 'postgres_persistence', '--locked', '--', '--test-threads=1', '--nocapture'], {
      DATABASE_URL: target.toString(),
      QUANTOS_RUN_F05_POSTGRES_TESTS: '1',
    });
    receipt.checks.push('fencing, tenant replay, append-only, dead-letter replay, realtime recovery, 1,000 concurrency and 10,000-event consistency');

    run('cargo', ['test', '-p', 'quantos-storage', '--test', 'postgres_persistence', '--locked', '--', '--test-threads=1', '--nocapture'], {
      DATABASE_URL: target.toString(),
      QUANTOS_RUN_F05_POSTGRES_TESTS: '1',
    });
    receipt.checks.push('PostgreSQL artifact, schema-registry and snapshot persistence');
    receipt.status = 'PASS';
    receipt.passed = true;
  } finally {
    if (client) await client.end();
    await admin.query(`drop database if exists ${name} with (force)`);
    await admin.end();
  }
}

main()
  .catch((error) => {
    receipt.status = 'FAIL';
    receipt.error = error.message;
    process.exitCode = 1;
    console.error(error.message);
  })
  .finally(() => {
    receipt.completedAt = new Date().toISOString();
    save();
    console.log(JSON.stringify(receipt, null, 2));
  });
