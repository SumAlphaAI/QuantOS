const { Client } = require('pg');

async function main() {
  if (!process.env.DATABASE_URL || !process.env.SUPABASE_URL) {
    throw Error('DATABASE_URL and SUPABASE_URL are required');
  }
  const database = new URL(process.env.DATABASE_URL);
  const supabase = new URL(process.env.SUPABASE_URL);
  const databaseRef = database.hostname.startsWith('db.')
    ? database.hostname.split('.')[1]
    : decodeURIComponent(database.username).split('.').at(-1);
  const authRef = supabase.hostname.split('.')[0];
  const sameProject = databaseRef === authRef;
  const sslmode = database.searchParams.get('sslmode');
  const client = new Client({
    host: database.hostname,
    port: Number(database.port || 5432),
    user: decodeURIComponent(database.username),
    password: decodeURIComponent(database.password),
    database: database.pathname.slice(1) || 'postgres',
    ssl: sslmode === 'disable' ? undefined : { rejectUnauthorized: sslmode === 'verify-full' },
    connectionTimeoutMillis: 10000,
  });
  await client.connect();
  try {
    const row = (await client.query(`select
      current_user as operator_login,
      (select rolcreaterole from pg_roles where rolname=current_user) as can_create_roles,
      exists(select 1 from pg_roles where rolname='quantos_bff' and not rolcanlogin) as bff_group_exists,
      exists(select 1 from pg_roles where rolname='quantos_bff_login') as bff_login_exists,
      current_setting('server_version_num')::int as server_version_num`)).rows[0];
    console.log(JSON.stringify({
      status: sameProject && row.bff_group_exists && row.can_create_roles
        ? 'READY_FOR_CONFIGURATION' : 'BLOCKED',
      sameProject,
      databaseConnectionMode: database.port === '6543' ? 'transaction_pooler' : 'session_or_direct',
      databaseSslMode: sslmode,
      canCreateRoles: row.can_create_roles,
      bffGroupExists: row.bff_group_exists,
      bffLoginExists: row.bff_login_exists,
      postgresMajor: Math.floor(row.server_version_num / 10000),
      hasPublishableKey: Boolean(process.env.SUPABASE_PUBLISHABLE_KEY),
      hasBffDatabaseUrl: Boolean(process.env.QUANTOS_BFF_DATABASE_URL),
      hasTerminalOrigin: Boolean(process.env.QUANTOS_TERMINAL_ORIGIN),
    }));
    if (!sameProject || !row.bff_group_exists || !row.can_create_roles) process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch(error => {
  console.error(`F06 BFF preflight failed: ${error.message}`);
  process.exitCode = 1;
});
