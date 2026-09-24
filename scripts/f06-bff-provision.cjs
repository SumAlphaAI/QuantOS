const { Client } = require('pg');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const loginRole = 'quantos_bff_login';

async function main() {
  if (process.env.QUANTOS_F06_ISOLATED_PROJECT !== '1') {
    throw Error('set QUANTOS_F06_ISOLATED_PROJECT=1 only for the confirmed isolated project');
  }
  const operatorUrl = new URL(process.env.DATABASE_URL);
  const authUrl = new URL(process.env.SUPABASE_URL);
  const projectRef = authUrl.hostname.split('.')[0];
  const databaseRef = operatorUrl.hostname.startsWith('db.')
    ? operatorUrl.hostname.split('.')[1]
    : decodeURIComponent(operatorUrl.username).split('.').at(-1);
  if (projectRef !== databaseRef || operatorUrl.port !== '5432') {
    throw Error('database and Auth project must match and use direct/session port 5432');
  }
  const envPath = path.resolve('.env.local');
  const existingEnv = fs.readFileSync(envPath, 'utf8');
  if (/^QUANTOS_BFF_DATABASE_URL=/m.test(existingEnv)) {
    throw Error('QUANTOS_BFF_DATABASE_URL already exists; refusing to overwrite it');
  }
  const caPath = process.env.QUANTOS_BFF_SSLROOTCERT;
  if (!caPath || !path.isAbsolute(caPath) || !fs.statSync(caPath).isFile()) {
    throw Error('QUANTOS_BFF_SSLROOTCERT must point to an existing absolute PEM path');
  }
  const password = crypto.randomBytes(32).toString('hex');
  const sslmode = operatorUrl.searchParams.get('sslmode');
  const connection = {
    host: operatorUrl.hostname,
    port: Number(operatorUrl.port),
    user: decodeURIComponent(operatorUrl.username),
    password: decodeURIComponent(operatorUrl.password),
    database: operatorUrl.pathname.slice(1) || 'postgres',
    connectionTimeoutMillis: 10000,
  };
  // Fail before creating a persistent login if the endpoint cannot be
  // authenticated using the project CA and hostname.
  const verified = new Client({ ...connection,
    ssl: { ca: fs.readFileSync(caPath, 'utf8'), rejectUnauthorized: true },
  });
  await verified.connect();
  await verified.end();
  const client = new Client({ ...connection,
    ssl: sslmode === 'disable' ? undefined : { rejectUnauthorized: sslmode === 'verify-full' },
  });
  await client.connect();
  try {
    const row = (await client.query(`select
      (select rolcreaterole from pg_roles where rolname=current_user) as can_create_roles,
      exists(select 1 from pg_roles where rolname='quantos_bff' and not rolcanlogin) as bff_group_exists,
      exists(select 1 from pg_roles where rolname=$1) as login_exists`, [loginRole])).rows[0];
    if (!row.can_create_roles || !row.bff_group_exists || row.login_exists) {
      throw Error('operator lacks role setup permission, BFF group is absent, or login already exists');
    }
    await client.query('begin');
    try {
      await client.query(`create role ${loginRole} with login noinherit nosuperuser
        nocreatedb nocreaterole noreplication nobypassrls password '${password}'`);
      await client.query(`grant quantos_bff to ${loginRole}`);
      const role = (await client.query(`select
        pg_has_role($1,'quantos_bff','SET') as can_set_bff,
        pg_has_role($1,'quantos_execution_gateway','SET') as can_set_execution,
        pg_has_role($1,'service_role','MEMBER') as service_member`, [loginRole])).rows[0];
      if (!role.can_set_bff || role.can_set_execution || role.service_member) {
        throw Error('new login did not pass role separation checks');
      }
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
  } finally {
    await client.end();
  }

  const bffUrl = new URL(operatorUrl);
  bffUrl.username = operatorUrl.hostname.startsWith('db.')
    ? loginRole : `${loginRole}.${projectRef}`;
  bffUrl.password = password;
  bffUrl.search = '';
  bffUrl.searchParams.set('sslmode', 'verify-full');
  bffUrl.searchParams.set('sslrootcert', caPath);
  const nextEnv = `${existingEnv.trimEnd()}\nQUANTOS_BFF_DATABASE_URL=${bffUrl.toString()}\n`;
  const temporaryPath = `${envPath}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, nextEnv, { mode: 0o600, flag: 'wx' });
  fs.renameSync(temporaryPath, envPath);
  fs.chmodSync(envPath, 0o600);
  console.log(JSON.stringify({
    status: 'BFF_LOGIN_CREATED',
    loginRole,
    bffMembershipOnly: true,
    localUrlConfigured: true,
    verifiedTlsStillRequired: true,
  }));
}

main().catch(error => {
  console.error(`F06 BFF provision failed: ${error.message}`);
  process.exitCode = 1;
});
