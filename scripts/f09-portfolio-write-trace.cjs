const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { Client } = require('pg');

const root = path.resolve(__dirname, '..');
const binary = path.join(root, 'target/debug/portfolio-rebuild');
const database = new URL(process.env.DATABASE_URL);
const ca = fs.readFileSync(process.env.QUANTOS_BFF_SSLROOTCERT, 'utf8');
const client = new Client({
  host: database.hostname, port: Number(database.port || 5432),
  user: decodeURIComponent(database.username), password: decodeURIComponent(database.password),
  database: database.pathname.slice(1) || 'postgres',
  ssl: { ca, rejectUnauthorized: true },
  connectionTimeoutMillis: 10000,
});
const tenantId = crypto.randomUUID();
const workspaceId = crypto.randomUUID();
const accountId = crypto.randomUUID();
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'f09-portfolio-write-'));
const replay = path.join(tempDir, 'replay.jsonl');
const trace = path.join(tempDir, 'trace.jsonl');

function command(args) {
  const result = spawnSync(binary, args, {
    cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, QUANTOS_TRACE_EXPORT_PATH: trace },
  });
  if (result.status !== 0) {
    throw new Error(`portfolio-rebuild ${args[0]} failed: ${(result.stderr || '').slice(0, 1000)}`);
  }
  return `${result.stdout || ''}${result.stderr || ''}`;
}

async function main() {
  await client.connect();
  try {
    await client.query('insert into quantos.tenants (id, slug, name) values ($1, $2, $3)',
      [tenantId, `f09-portfolio-${tenantId}`, 'F09 Portfolio Write']);
    await client.query(`insert into quantos.workspaces (id, tenant_id, slug, name, is_primary)
      values ($1, $2, 'primary', 'Primary', true)`, [workspaceId, tenantId]);
    await client.query(`insert into quantos.accounts
      (id, tenant_id, workspace_id, venue, external_account_ref, name, mode)
      values ($1, $2, $3, 'paper', $4, 'F09 Portfolio', 'paper')`,
    [accountId, tenantId, workspaceId, `f09-${accountId}`]);

    command(['generate-replay', '--output', replay, '--count', '20', '--account-id', accountId]);
    const output = command(['rebuild', '--input', replay, '--use-database-env',
      '--tenant-id', tenantId, '--account-id', accountId]);
    const correlationId = output.match(/persisted portfolio snapshot to PostgreSQL correlation_id=([0-9a-f-]{36})/)?.[1];
    const snapshotHash = output.match(/snapshot_hash=(sha256:[0-9a-f]{64})/)?.[1];
    const sequence = Number(output.match(/rebuilt events=(\d+)/)?.[1]);
    if (!correlationId || !snapshotHash || !Number.isInteger(sequence) || sequence < 20) {
      throw new Error(`portfolio write command did not report its business result and correlation ID: ${output.slice(0, 1000)}`);
    }
    const row = (await client.query(`select last_event_sequence, exposure_gross
      from quantos.portfolio_accounts where tenant_id = $1 and account_id = $2`,
    [tenantId, accountId])).rows;
    if (row.length !== 1 || Number(row[0].last_event_sequence) !== sequence ||
        Number(row[0].exposure_gross) <= 0) {
      throw new Error('portfolio business snapshot did not persist as reported');
    }
    const positions = (await client.query(`select count(*)::int as count
      from quantos.portfolio_positions where tenant_id = $1 and account_id = $2`,
    [tenantId, accountId])).rows[0].count;
    if (positions < 1) throw new Error('portfolio position projection did not persist');
    const records = fs.readFileSync(trace, 'utf8').trim().split('\n').map(JSON.parse)
      .filter((record) => record.service === 'portfolio-rebuild' &&
        record.correlation_id === correlationId && record.operation === 'portfolio.command');
    if (records.length !== 2 || records[0].status !== 'started' ||
        records[1].status !== 'succeeded') {
      throw new Error('portfolio persisted trace does not match completed business write');
    }
    if (fs.readFileSync(trace, 'utf8').includes(database.password)) {
      throw new Error('portfolio trace contains database credential');
    }
    console.log(JSON.stringify({ event: 'F09_PORTFOLIO_WRITE_TRACE_PASS', correlationId,
      snapshotHash, lastEventSequence: sequence, positionCount: positions }));
  } finally {
    await client.end();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
