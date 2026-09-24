const { Client } = require('pg');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  if (process.env.QUANTOS_F06_ISOLATED_PROJECT !== '1') {
    throw Error('isolated test project confirmation is required');
  }
  const required = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  for (const name of required) if (!process.env[name]) throw Error(`${name} is required`);
  const database = new URL(process.env.DATABASE_URL);
  const auth = new URL(process.env.SUPABASE_URL);
  const databaseRef = database.hostname.startsWith('db.')
    ? database.hostname.split('.')[1]
    : decodeURIComponent(database.username).split('.').at(-1);
  if (databaseRef !== auth.hostname.split('.')[0]) throw Error('database and Auth project differ');
  const envPath = path.resolve('.env.local');
  const existingEnv = fs.readFileSync(envPath, 'utf8');
  if (/^QUANTOS_F06_TEST_(EMAIL|PASSWORD|USER_ID)=/m.test(existingEnv)) {
    throw Error('F06 test identity is already configured; refusing to overwrite it');
  }
  const suffix = crypto.randomUUID();
  const email = `quantos-f06-${suffix}@example.com`;
  const password = crypto.randomBytes(32).toString('hex');
  const tenantId = crypto.randomUUID();
  const workspaceId = crypto.randomUUID();
  const actorId = crypto.randomUUID();
  const accountId = crypto.randomUUID();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'content-type': 'application/json' };
  const created = await fetch(new URL('/auth/v1/admin/users', auth), {
    method: 'POST', headers,
    body: JSON.stringify({ email, password, email_confirm: true }),
    signal: AbortSignal.timeout(10000),
  });
  if (!created.ok) throw Error(`Auth Admin user creation returned HTTP ${created.status}`);
  const userId = (await created.json()).id;
  if (!/^[0-9a-f-]{36}$/i.test(userId)) {
    throw Error('Auth Admin did not return a user UUID');
  }
  const client = new Client({
    host: database.hostname,
    port: Number(database.port || 5432),
    user: decodeURIComponent(database.username),
    password: decodeURIComponent(database.password),
    database: database.pathname.slice(1) || 'postgres',
    ssl: { rejectUnauthorized: database.searchParams.get('sslmode') === 'verify-full' },
    connectionTimeoutMillis: 10000,
  });
  let committed = false;
  try {
    await client.connect();
    await client.query('begin');
    try {
      const slug = `f06-live-${suffix}`;
      await client.query('insert into quantos.tenants(id,slug,name) values($1,$2,$3)',
        [tenantId, slug, 'F06 isolated live test']);
      await client.query('insert into quantos.workspaces(id,tenant_id,slug,name,is_primary) values($1,$2,$3,$4,true)',
        [workspaceId, tenantId, 'primary', 'Primary test workspace']);
      await client.query("insert into quantos.accounts(id,tenant_id,workspace_id,venue,external_account_ref,name,mode) values($1,$2,$3,'paper',$4,'F06 paper account','paper')",
        [accountId, tenantId, workspaceId, slug]);
      await client.query("insert into quantos.tenant_memberships(tenant_id,user_id,role) values($1,$2,'operator')",
        [tenantId, userId]);
      await client.query("insert into quantos.actors(id,tenant_id,user_id,actor_kind,display_name) values($1,$2,$3,'user','F06 test actor')",
        [actorId, tenantId, userId]);
      await client.query("insert into quantos.workspace_memberships(tenant_id,workspace_id,actor_id,role) values($1,$2,$3,'operator')",
        [tenantId, workspaceId, actorId]);
      await client.query("insert into quantos.actor_capabilities(tenant_id,actor_id,workspace_id,account_id,capability,mode_scope) values($1,$2,$3,$4,'execution.operate','paper')",
        [tenantId, actorId, workspaceId, accountId]);
      await client.query('commit');
      committed = true;
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
    const nextEnv = `${existingEnv.trimEnd()}\nQUANTOS_F06_TEST_EMAIL=${email}\nQUANTOS_F06_TEST_PASSWORD=${password}\nQUANTOS_F06_TEST_USER_ID=${userId}\nQUANTOS_F06_TEST_TENANT_ID=${tenantId}\nQUANTOS_F06_TEST_ACCOUNT_ID=${accountId}\n`;
    const temporaryPath = `${envPath}.${process.pid}.tmp`;
    fs.writeFileSync(temporaryPath, nextEnv, { mode: 0o600, flag: 'wx' });
    fs.renameSync(temporaryPath, envPath);
    fs.chmodSync(envPath, 0o600);
    console.log(JSON.stringify({ status: 'TEST_IDENTITY_CREATED',
      authUserCreated: true, primaryContextCreated: true, credentialsStoredLocally: true }));
  } catch (error) {
    if (committed) {
      await client.query('delete from quantos.tenants where id=$1', [tenantId]).catch(() => {});
    }
    const removed = await fetch(new URL(`/auth/v1/admin/users/${userId}`, auth), {
      method: 'DELETE', headers, signal: AbortSignal.timeout(10000),
    }).catch(() => null);
    throw Error(`test identity setup failed; Auth cleanup HTTP ${removed?.status ?? 'unavailable'}; cause: ${error.message}`);
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch(error => {
  console.error(`F06 test identity provision failed: ${error.message}`);
  process.exitCode = 1;
});
