const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');
const { Client } = require('pg');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'artifacts/f09/disposable-database.json');
const receipt = {
  schema: 'quantos-f09-disposable-gate/v1',
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  dirty: Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim()),
  targetClass: 'disposable-loopback-postgresql',
  status: 'RUNNING',
  checks: [],
  startedAt: new Date().toISOString(),
};

function save() {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(receipt, null, 2)}\n`);
}

function run(command, args, env = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: 'inherit',
  });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed with ${result.status}`);
}

async function main() {
  save();
  if (receipt.dirty) throw new Error('F09 disposable Gate requires a clean exact-SHA checkout');
  const url = new URL(process.env.F02_PG_ADMIN_URL ?? '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('F09 disposable Gate requires a loopback PostgreSQL admin URL');
  }
  const admin = new Client({ connectionString: url.toString() });
  await admin.connect();
  const name = `f09_acceptance_${crypto.randomBytes(6).toString('hex')}`;
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
    await client.query(`create schema auth; create schema extensions; create schema storage;
      create table auth.users(id uuid primary key);
      create table storage.buckets(id text primary key, name text not null, public boolean not null default false);
      create function auth.uid() returns uuid language sql stable as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
      grant usage on schema auth to authenticated,anon,service_role;`);
    run(process.execPath, ['scripts/db-cli.cjs', 'apply'], { DATABASE_URL: target.toString() });
    receipt.checks.push('fresh migration replay');
    run(process.execPath, ['scripts/db-cli.cjs', 'live-rls'], { DATABASE_URL: target.toString() });
    receipt.checks.push('RLS and privileged-path catalog');
    run('cargo', ['test', '-p', 'quantos-observability', '--test', 'postgres_capacity_monitor', '--locked', '--', '--test-threads=1', '--nocapture'], {
      DATABASE_URL: target.toString(), QUANTOS_RUN_F09_POSTGRES_TESTS: '1',
    });
    receipt.checks.push('live metrics, restart-safe alert windows, redaction and persisted alerts');
    receipt.status = 'PASS';
  } finally {
    if (client) await client.end();
    await admin.query(`drop database if exists ${name} with (force)`);
    await admin.end();
  }
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
