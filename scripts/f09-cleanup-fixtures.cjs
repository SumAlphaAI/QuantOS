const fs = require('node:fs');
const { Client } = require('pg');

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? '');
  const caPath = process.env.QUANTOS_BFF_SSLROOTCERT;
  if (!url.hostname.endsWith('.supabase.com') || !caPath || !fs.existsSync(caPath)) {
    throw new Error('test Supabase connection and CA certificate are required');
  }
  const client = new Client({
    host: url.hostname, port: Number(url.port || 5432),
    user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
    database: url.pathname.slice(1) || 'postgres',
    ssl: { ca: fs.readFileSync(caPath, 'utf8'), rejectUnauthorized: true },
    connectionTimeoutMillis: 10000,
  });
  await client.connect();
  try {
    const rows = (await client.query(`select id, slug from quantos.tenants
      where slug like 'f09-live-%' or slug like 'f09-fault-%'`)).rows;
    console.log(`F09 isolated test tenant candidates: ${rows.length}`);
    if (process.argv.includes('--apply')) {
      await client.query('begin');
      try {
        for (const row of rows) {
          await client.query('delete from quantos.capacity_alerts where scope = $1', [row.slug]);
          await client.query('delete from quantos.capacity_alert_window_state where scope = $1', [row.slug]);
          await client.query('delete from quantos.operational_metric_samples where tenant_id = $1', [row.id]);
        }
        await client.query('commit');
        console.log(`Removed transient F09 metrics and alerts for ${rows.length} test tenants; append-only events and tenants remain.`);
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`${error.code || error.name}: ${error.message}`);
  process.exitCode = 1;
});
