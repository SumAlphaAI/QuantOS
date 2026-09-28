const { Client } = require('pg');
const fs = require('node:fs');
const crypto = require('node:crypto');
class ContextError extends Error {}
const assert = (condition, message) => { if (!condition) throw new ContextError(message); };

async function ensureContext(client, config, restore = false) {
  const { userId, tenantId, accountId, email } = config;
  await client.query('begin');
  try {
    const state = (await client.query(`select
      exists(select 1 from auth.users where id=$1 and email=$4) as auth,
      exists(select 1 from quantos.tenants where id=$2) as tenant,
      exists(select 1 from quantos.accounts where id=$3) as account`,
    [userId, tenantId, accountId, email])).rows[0];
    assert(state.auth, 'Configured Auth identity does not match; refusing context changes');
    const valid = async () => (await client.query(`select exists(
      select 1 from quantos.actors a
      join quantos.tenant_memberships tm on tm.tenant_id=a.tenant_id and tm.user_id=a.user_id
      join quantos.workspace_memberships wm on wm.tenant_id=a.tenant_id and wm.actor_id=a.id
      join quantos.workspaces w on w.id=wm.workspace_id and w.tenant_id=a.tenant_id
      join quantos.accounts ac on ac.workspace_id=w.id and ac.tenant_id=a.tenant_id
      join quantos.actor_capabilities c on c.actor_id=a.id and c.tenant_id=a.tenant_id
        and c.workspace_id=w.id and c.account_id=ac.id
      where a.user_id=$1 and a.tenant_id=$2 and ac.id=$3 and a.is_active and a.actor_kind='user'
        and w.is_primary and ac.mode='paper' and tm.role='operator' and wm.role='operator'
        and c.capability='execution.operate' and c.mode_scope='paper') as valid`,
    [userId, tenantId, accountId])).rows[0].valid;
    if (state.tenant || state.account) {
      assert(state.tenant && state.account && await valid(),
        'Existing test context conflicts or is incomplete; refusing to overwrite permissions');
      await client.query('commit');
      return { status: 'PASS', context: 'existing', credentialsUnchanged: true };
    }
    assert(restore, 'Test business context is missing after schema reset; run make f06-test-identity-restore with the approved test target');
    const workspaceId = crypto.randomUUID(), actorId = crypto.randomUUID();
    const slug = `f06-live-restored-${tenantId}`;
    await client.query('insert into quantos.tenants(id,slug,name) values($1,$2,$3)',
      [tenantId, slug, 'F06 restored test context']);
    await client.query("insert into quantos.workspaces(id,tenant_id,slug,name,is_primary) values($1,$2,'primary','Primary test workspace',true)", [workspaceId, tenantId]);
    await client.query("insert into quantos.accounts(id,tenant_id,workspace_id,venue,external_account_ref,name,mode) values($1,$2,$3,'paper',$4,'F06 paper account','paper')", [accountId, tenantId, workspaceId, slug]);
    await client.query("insert into quantos.tenant_memberships(tenant_id,user_id,role) values($1,$2,'operator')", [tenantId, userId]);
    await client.query("insert into quantos.actors(id,tenant_id,user_id,actor_kind,display_name) values($1,$2,$3,'user','F06 test actor')", [actorId, tenantId, userId]);
    await client.query("insert into quantos.workspace_memberships(tenant_id,workspace_id,actor_id,role) values($1,$2,$3,'operator')", [tenantId, workspaceId, actorId]);
    await client.query("insert into quantos.actor_capabilities(tenant_id,actor_id,workspace_id,account_id,capability,mode_scope) values($1,$2,$3,$4,'execution.operate','paper')", [tenantId, actorId, workspaceId, accountId]);
    assert(await valid(), 'Restored context did not pass verification');
    await client.query('commit');
    return { status: 'PASS', context: 'restored', credentialsUnchanged: true };
  } catch (error) { await client.query('rollback'); throw error; }
}

async function main() {
  assert(process.env.QUANTOS_F06_ISOLATED_PROJECT === '1', 'Approved test project confirmation is required');
  const url = new URL(process.env.DATABASE_URL);
  const ref = url.hostname.startsWith('db.') ? url.hostname.split('.')[1] : decodeURIComponent(url.username).split('.').at(-1);
  assert(ref === new URL(process.env.SUPABASE_URL).hostname.split('.')[0], 'Database and Auth projects differ');
  const config = { userId: process.env.QUANTOS_F06_TEST_USER_ID, tenantId: process.env.QUANTOS_F06_TEST_TENANT_ID,
    accountId: process.env.QUANTOS_F06_TEST_ACCOUNT_ID, email: process.env.QUANTOS_F06_TEST_EMAIL };
  assert(Object.values(config).every(Boolean), 'Existing configured test identity is required');
  const client = new Client({ host: url.hostname, port: Number(url.port || 5432),
    user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: url.pathname.slice(1),
    ssl: { ca: fs.readFileSync(process.env.QUANTOS_BFF_SSLROOTCERT, 'utf8'), rejectUnauthorized: true },
    connectionTimeoutMillis: 10000, query_timeout: 10000 });
  try { await client.connect(); console.log(JSON.stringify(await ensureContext(client, config, process.argv.includes('--restore-missing')))); }
  finally { await client.end(); }
}
module.exports = { ensureContext };
if (require.main === module) main().catch(error => {
  console.error(error instanceof ContextError ? error.message : 'F06 context database check failed; no credentials changed.');
  process.exitCode = 1;
});
