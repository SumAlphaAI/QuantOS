const { Client } = require('pg');
const fs = require('node:fs');

async function main() {
  const url = new URL(process.env.QUANTOS_RUNTIME_DATABASE_URL);
  if (url.searchParams.get('sslmode') !== 'verify-full') {
    throw Error('Runtime login requires sslmode=verify-full');
  }
  const caPath = url.searchParams.get('sslrootcert');
  if (!caPath || !fs.statSync(caPath).isFile()) {
    throw Error('Runtime login requires an existing CA file');
  }
  const client = new Client({
    host: url.hostname,
    port: Number(url.port || 5432),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1) || 'postgres',
    ssl: { ca: fs.readFileSync(caPath, 'utf8'), rejectUnauthorized: true },
    connectionTimeoutMillis: 10000,
  });
  await client.connect();
  try {
    const role = (await client.query(`select
      pg_has_role(session_user,'quantos_runtime','SET') as runtime,
      pg_has_role(session_user,'quantos_bff','SET') as bff,
      pg_has_role(session_user,'quantos_execution_gateway','SET') as execution,
      pg_has_role(session_user,'service_role','MEMBER') as service_member,
      (select rolbypassrls or rolsuper from pg_roles where rolname=session_user) as privileged`)).rows[0];
    if (!role.runtime || role.bff || role.execution || role.service_member || role.privileged) {
      throw Error('Runtime login failed separation or privilege checks');
    }
    await client.query('set role quantos_runtime');
    await client.query('select id from quantos.runtime_sessions limit 0');
    let denied = false;
    try {
      await client.query('select quantos.resolve_execution_vault_secret($1,$2,$3,$4)',
        ['invalid-session', 'invalid-secret', new Date(),
          '00000000-0000-0000-0000-000000000000']);
    } catch (error) {
      denied = error.code === '42501';
      if (!denied) throw error;
    }
    if (!denied) throw Error('Runtime role could invoke Vault resolver');
    console.log(JSON.stringify({ status: 'PASS', verifiedTls: true,
      runtimeRoleOnly: true, runtimeTablesReadable: true,
      vaultResolverDeniedSqlstate: '42501' }));
  } finally {
    await client.end();
  }
}

main().catch(error => {
  console.error(`F06 Runtime login check failed: ${error.message}`);
  process.exitCode = 1;
});
