const { Client } = require('pg');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  if (process.env.QUANTOS_F06_ISOLATED_PROJECT !== '1') {
    throw Error('set QUANTOS_F06_ISOLATED_PROJECT=1 only for the confirmed isolated project');
  }
  const operatorUrl = new URL(process.env.DATABASE_URL);
  const projectRef = new URL(process.env.SUPABASE_URL).hostname.split('.')[0];
  const databaseRef = operatorUrl.hostname.startsWith('db.')
    ? operatorUrl.hostname.split('.')[1]
    : decodeURIComponent(operatorUrl.username).split('.').at(-1);
  if (projectRef !== databaseRef || operatorUrl.port !== '5432') {
    throw Error('database and Auth project must match and use direct/session port 5432');
  }
  const envPath = path.resolve('.env.local');
  const existingEnv = fs.readFileSync(envPath, 'utf8');
  if (/^QUANTOS_RUNTIME_DATABASE_URL=/m.test(existingEnv)) {
    throw Error('QUANTOS_RUNTIME_DATABASE_URL already exists; refusing to overwrite it');
  }
  const caPath = process.env.QUANTOS_BFF_SSLROOTCERT;
  if (!caPath || !path.isAbsolute(caPath) || !fs.statSync(caPath).isFile()) {
    throw Error('QUANTOS_BFF_SSLROOTCERT must point to an existing absolute PEM path');
  }
  const connection = {
    host: operatorUrl.hostname,
    port: Number(operatorUrl.port),
    user: decodeURIComponent(operatorUrl.username),
    password: decodeURIComponent(operatorUrl.password),
    database: operatorUrl.pathname.slice(1) || 'postgres',
    ssl: { ca: fs.readFileSync(caPath, 'utf8'), rejectUnauthorized: true },
    connectionTimeoutMillis: 10000,
  };
  const client = new Client(connection);
  await client.connect();
  const loginRole = 'quantos_runtime_login';
  try {
    const row = (await client.query(`select
      (select rolcreaterole from pg_roles where rolname=current_user) as can_create_roles,
      exists(select 1 from pg_roles where rolname='quantos_runtime' and not rolcanlogin) as runtime_group_exists,
      exists(select 1 from pg_roles where rolname=$1) as login_exists,
      to_regclass('quantos.runtime_sessions') is not null as runtime_tables_exist`, [loginRole])).rows[0];
    if (!row.can_create_roles || !row.runtime_group_exists || row.login_exists || !row.runtime_tables_exist) {
      throw Error('Runtime role/migration is absent, login already exists, or operator lacks permission');
    }
    const password = crypto.randomBytes(32).toString('hex');
    await client.query('begin');
    try {
      await client.query(`create role ${loginRole} with login noinherit nosuperuser
        nocreatedb nocreaterole noreplication nobypassrls password '${password}'`);
      await client.query(`grant quantos_runtime to ${loginRole}`);
      const role = (await client.query(`select
        pg_has_role($1,'quantos_runtime','SET') as can_set_runtime,
        pg_has_role($1,'quantos_bff','SET') as can_set_bff,
        pg_has_role($1,'quantos_execution_gateway','SET') as can_set_execution,
        pg_has_role($1,'service_role','MEMBER') as service_member`, [loginRole])).rows[0];
      if (!role.can_set_runtime || role.can_set_bff || role.can_set_execution || role.service_member) {
        throw Error('Runtime login did not pass role separation checks');
      }
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
    const runtimeUrl = new URL(operatorUrl);
    runtimeUrl.username = operatorUrl.hostname.startsWith('db.') ? loginRole : `${loginRole}.${projectRef}`;
    runtimeUrl.password = password;
    runtimeUrl.search = '';
    runtimeUrl.searchParams.set('sslmode', 'verify-full');
    runtimeUrl.searchParams.set('sslrootcert', caPath);
    const temporaryPath = `${envPath}.${process.pid}.tmp`;
    fs.writeFileSync(temporaryPath,
      `${existingEnv.trimEnd()}\nQUANTOS_RUNTIME_DATABASE_URL=${runtimeUrl.toString()}\n`,
      { mode: 0o600, flag: 'wx' });
    fs.renameSync(temporaryPath, envPath);
    fs.chmodSync(envPath, 0o600);
    console.log(JSON.stringify({ status: 'RUNTIME_LOGIN_CREATED',
      runtimeMembershipOnly: true, localUrlConfigured: true, verifiedTlsRequired: true }));
  } finally {
    await client.end();
  }
}

main().catch(error => {
  console.error(`F06 Runtime login provision failed: ${error.message}`);
  process.exitCode = 1;
});
