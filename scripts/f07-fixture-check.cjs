const fs = require('node:fs');
const { Client } = require('pg');

async function main() {
  if (!process.env.DATABASE_URL || !process.env.SUPABASE_URL || !process.env.QUANTOS_BFF_SSLROOTCERT) {
    throw new Error('DATABASE_URL, SUPABASE_URL and QUANTOS_BFF_SSLROOTCERT are required');
  }
  const url = new URL(process.env.DATABASE_URL);
  const api = new URL(process.env.SUPABASE_URL);
  const databaseRef = url.hostname.startsWith('db.')
    ? url.hostname.split('.')[1] : decodeURIComponent(url.username).split('.').at(-1);
  if (databaseRef !== api.hostname.split('.')[0] || !api.hostname.endsWith('.supabase.co')) {
    throw new Error('F07 fixture target must be the matching Supabase project');
  }
  const retire = process.argv.includes('--retire');
  if (retire && process.env.QUANTOS_F07_FIXTURE_RETIRE !== '1') {
    throw new Error('QUANTOS_F07_FIXTURE_RETIRE=1 is required');
  }
  const client = new Client({
    host: url.hostname, port: Number(url.port || 5432),
    user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
    database: url.pathname.slice(1) || 'postgres',
    ssl: { ca: fs.readFileSync(process.env.QUANTOS_BFF_SSLROOTCERT, 'utf8'), rejectUnauthorized: true },
    connectionTimeoutMillis: 10000,
  });
  await client.connect();
  try {
    if (retire) {
      await client.query('begin');
      try {
        const runResult = await client.query(`update quantos.workflow_runs as run
          set status='failed', completed_at=now(), lease_owner=null, lease_expires_at=null,
              attempt_id=null, last_error='F07 diagnostic fixture retired', updated_at=now()
          from quantos.tenants as tenant
          where run.tenant_id=tenant.id
            and tenant.slug ~ '^f07-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            and run.status in ('queued','running','cancel_requested')`);
        const toolResult = await client.query(`update quantos.tool_registry as tool
          set enabled=false, updated_at=now()
          from quantos.tenants as tenant
          where tool.tenant_id=tenant.id
            and tenant.slug ~ '^f07-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            and tool.enabled=true`);
        await client.query('commit');
        console.log(JSON.stringify({ retiredRuns: runResult.rowCount, disabledTools: toolResult.rowCount }));
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    }
    const tenants = Number((await client.query("select count(*) as n from quantos.tenants where slug like 'f07-%'")).rows[0].n);
    const users = Number((await client.query("select count(*) as n from auth.users where email like 'f07-%@example.com'")).rows[0].n);
    const pending = Number((await client.query(`select count(*) as n from quantos.workflow_runs as run
      join quantos.tenants as tenant on tenant.id=run.tenant_id
      where tenant.slug ~ '^f07-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and run.status in ('queued','running','cancel_requested')`)).rows[0].n);
    console.log(JSON.stringify({ schema: 'quantos-f07-fixture-retirement/v1', retainedAuditTenants: tenants, retainedTestUsers: users, pendingRuns: pending }));
    if (pending !== 0) throw new Error('F07 fixture runs are still active in target database');
  } finally {
    await client.end();
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
