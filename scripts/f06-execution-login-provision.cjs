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
  if (/^QUANTOS_EXECUTION_DATABASE_URL=/m.test(existingEnv)) {
    throw Error('QUANTOS_EXECUTION_DATABASE_URL already exists; refusing to overwrite it');
  }
  const caPath = process.env.QUANTOS_BFF_SSLROOTCERT;
  if (!caPath || !path.isAbsolute(caPath) || !fs.statSync(caPath).isFile()) {
    throw Error('QUANTOS_BFF_SSLROOTCERT must point to an existing absolute PEM path');
  }
  const client = new Client({
    host: operatorUrl.hostname,
    port: Number(operatorUrl.port),
    user: decodeURIComponent(operatorUrl.username),
    password: decodeURIComponent(operatorUrl.password),
    database: operatorUrl.pathname.slice(1) || 'postgres',
    ssl: { ca: fs.readFileSync(caPath, 'utf8'), rejectUnauthorized: true },
    connectionTimeoutMillis: 10000,
  });
  await client.connect();
  const loginRole = 'quantos_execution_login';
  try {
    const state = (await client.query(`select
      (select rolcreaterole from pg_roles where rolname=current_user) as can_create_roles,
      exists(select 1 from pg_roles where rolname='quantos_execution_gateway' and not rolcanlogin) as execution_group_exists,
      exists(select 1 from pg_roles where rolname=$1) as login_exists,
      has_function_privilege('quantos_execution_gateway',
        'quantos.resolve_execution_vault_secret(text,text,timestamp with time zone,uuid)','EXECUTE') as resolver_granted`,
    [loginRole])).rows[0];
    if (!state.can_create_roles || !state.execution_group_exists || state.login_exists || !state.resolver_granted) {
      throw Error('Execution role/function is absent, login already exists, or operator lacks permission');
    }
    const password = crypto.randomBytes(32).toString('hex');
    await client.query('begin');
    try {
      await client.query(`create role ${loginRole} with login noinherit nosuperuser
        nocreatedb nocreaterole noreplication nobypassrls password '${password}'`);
      await client.query(`grant quantos_execution_gateway to ${loginRole}`);
      const role = (await client.query(`select
        pg_has_role($1,'quantos_execution_gateway','SET') as execution,
        pg_has_role($1,'quantos_bff','SET') as bff,
        pg_has_role($1,'quantos_runtime','SET') as runtime,
        pg_has_role($1,'service_role','MEMBER') as service_member`, [loginRole])).rows[0];
      if (!role.execution || role.bff || role.runtime || role.service_member) {
        throw Error('Execution login did not pass role separation checks');
      }
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
    const executionUrl = new URL(operatorUrl);
    executionUrl.username = operatorUrl.hostname.startsWith('db.')
      ? loginRole : `${loginRole}.${projectRef}`;
    executionUrl.password = password;
    executionUrl.search = '';
    executionUrl.searchParams.set('sslmode', 'verify-full');
    executionUrl.searchParams.set('sslrootcert', caPath);
    const temporaryPath = `${envPath}.${process.pid}.tmp`;
    fs.writeFileSync(temporaryPath,
      `${existingEnv.trimEnd()}\nQUANTOS_EXECUTION_DATABASE_URL=${executionUrl.toString()}\n`,
      { mode: 0o600, flag: 'wx' });
    fs.renameSync(temporaryPath, envPath);
    fs.chmodSync(envPath, 0o600);
    console.log(JSON.stringify({ status: 'EXECUTION_LOGIN_CREATED',
      executionMembershipOnly: true, localUrlConfigured: true, verifiedTlsRequired: true }));
  } finally {
    await client.end();
  }
}

main().catch(error => {
  console.error(`F06 Execution login provision failed: ${error.message}`);
  process.exitCode = 1;
});
