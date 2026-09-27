#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, execFileSync } = require('node:child_process');
const { Client } = require('pg');

const root = path.resolve(__dirname, '..');
const scope = `f09-scheduler-${crypto.randomUUID()}`;
const tenantId = crypto.randomUUID(); // deliberately absent: no producer can fill this scope
const output = path.join(root, 'artifacts/f09/scheduler-sentinel.json');
const receiptPath = path.join(root, 'artifacts/f09/scheduler.json');
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const database = new URL(process.env.DATABASE_URL);
const ca = fs.readFileSync(process.env.QUANTOS_BFF_SSLROOTCERT, 'utf8');
const client = new Client({
  host: database.hostname, port: Number(database.port || 5432),
  user: decodeURIComponent(database.username), password: decodeURIComponent(database.password),
  database: database.pathname.slice(1) || 'postgres',
  ssl: { ca, rejectUnauthorized: true }, connectionTimeoutMillis: 10000,
});

async function main() {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.rmSync(output, { force: true });
  await client.connect();
  const child = spawn(path.join(root, 'target/debug/capacity-monitor'), [
    '--watch', '--scope', scope, '--tenant-id', tenantId, '--output', output,
  ], { cwd: root, env: { ...process.env, QUANTOS_OBSERVABILITY_ADDR: '' } });
  let logs = '';
  child.stdout.on('data', (chunk) => { logs += chunk.toString(); });
  child.stderr.on('data', (chunk) => { logs += chunk.toString(); });
  let ticks = 0;
  try {
    const deadline = Date.now() + 125000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error(`scheduler stopped before two ticks: ${child.exitCode}`);
      const rows = await client.query(
        `select count(*)::int as count from quantos.capacity_alerts
         where scope = $1 and rule_id = 'metric_coverage_missing'`, [scope],
      );
      ticks = rows.rows[0].count;
      if (ticks >= 2) break;
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    if (ticks < 2) throw new Error(`scheduler produced only ${ticks} missing-coverage tick(s)`);
    if (fs.existsSync(output)) throw new Error('stale ADR evidence survived missing metrics');
    if (!logs.includes('metric coverage is stale or missing')) {
      throw new Error('scheduler did not report the missing producer');
    }
    fs.writeFileSync(receiptPath, `${JSON.stringify({
      schema: 'quantos-f09-scheduler-smoke/v1', sourceCommit, scope,
      targetClass: 'test-supabase-postgresql', status: 'PASS',
      observedMissingCoverageTicks: ticks, staleAdrEvidence: false,
      completedAt: new Date().toISOString(),
    }, null, 2)}\n`);
    console.log(`F09 scheduler smoke PASS: ${ticks} real Supabase missing-coverage ticks`);
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => { if (child.exitCode !== null) resolve(); else child.once('exit', resolve); });
    await client.query('delete from quantos.capacity_alerts where scope = $1', [scope]);
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
