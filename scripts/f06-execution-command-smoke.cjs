const { Client } = require('pg');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const assert = (condition, message) => { if (!condition) throw Error(message); };
const projectRef = url => new URL(url).hostname.split('.')[0];

async function main() {
  assert(process.env.QUANTOS_F06_ISOLATED_PROJECT === '1' &&
    process.env.QUANTOS_F06_TARGET_ISOLATED === '1',
  'F06 command smoke requires both isolated-project guards');
  for (const name of ['DATABASE_URL', 'SUPABASE_URL', 'QUANTOS_EXECUTION_DATABASE_URL']) {
    assert(process.env[name], `${name} is required`);
  }
  const operatorUrl = new URL(process.env.DATABASE_URL);
  const executionUrl = new URL(process.env.QUANTOS_EXECUTION_DATABASE_URL);
  const ref = projectRef(process.env.SUPABASE_URL);
  const databaseRef = operatorUrl.hostname.startsWith('db.')
    ? operatorUrl.hostname.split('.')[1] : decodeURIComponent(operatorUrl.username).split('.').at(-1);
  const executionRef = executionUrl.hostname.startsWith('db.')
    ? executionUrl.hostname.split('.')[1] : decodeURIComponent(executionUrl.username).split('.').at(-1);
  assert(ref === databaseRef && ref === executionRef && operatorUrl.port === '5432' &&
    executionUrl.port === '5432', 'operator, Execution and Auth targets must match at port 5432');
  assert(executionUrl.searchParams.get('sslmode') === 'verify-full',
    'Execution URL must require verify-full');
  const caPath = executionUrl.searchParams.get('sslrootcert');
  assert(caPath && path.isAbsolute(caPath) && fs.statSync(caPath).isFile(),
    'Execution URL must carry an absolute trusted CA path');
  const client = new Client({
    host: operatorUrl.hostname,
    port: 5432,
    user: decodeURIComponent(operatorUrl.username),
    password: decodeURIComponent(operatorUrl.password),
    database: operatorUrl.pathname.slice(1) || 'postgres',
    ssl: { ca: fs.readFileSync(caPath, 'utf8'), rejectUnauthorized: true },
    connectionTimeoutMillis: 10000,
  });
  await client.connect();
  const fixture = {
    tenant: crypto.randomUUID(), workspace: crypto.randomUUID(), account: crypto.randomUUID(),
    actor: crypto.randomUUID(), suffix: crypto.randomBytes(8).toString('hex'),
    sessionHash: crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex'),
  };
  let vaultId;
  let committed = false;
  let cleaned = false;
  let reusedTenant = false;
  const scenarios = [];
  const cleanFixture = async (tenantId, secretId) => {
    const ledgers = (await client.query(`select
      (select count(*) from quantos.event_log where tenant_id=$1) as events,
      (select count(*) from quantos.audit_entries where tenant_id=$1) as audits`,
    [tenantId])).rows[0];
    assert(ledgers.events === '0' && ledgers.audits === '0',
      'F06 fixture has audit or event facts and cannot be removed automatically');
    await client.query('begin');
    try {
      for (const table of ['execution_service_sessions', 'secret_references',
        'actor_capabilities', 'actors', 'accounts', 'workspaces']) {
        await client.query(`delete from quantos.${table} where tenant_id=$1`, [tenantId]);
      }
      if (secretId) await client.query('delete from vault.secrets where id=$1', [secretId]);
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
    const remaining = (await client.query(`select
      (select count(*) from quantos.execution_service_sessions where tenant_id=$1) as sessions,
      (select count(*) from quantos.secret_references where tenant_id=$1) as secret_refs,
      (select count(*) from quantos.actor_capabilities where tenant_id=$1) as capabilities,
      (select count(*) from quantos.actors where tenant_id=$1) as actors,
      (select count(*) from quantos.accounts where tenant_id=$1) as accounts,
      (select count(*) from quantos.workspaces where tenant_id=$1) as workspaces,
      (select count(*) from vault.secrets where id=$2) as secrets`,
    [tenantId, secretId || crypto.randomUUID()])).rows[0];
    assert(Object.values(remaining).every(value => value === '0'),
      'isolated command fixture data cleanup was incomplete');
  };
  const probe = scenario => {
    const child = spawnSync(path.resolve('target/debug/execution-gateway'), ['--f06-paper-probe'], {
      env: { ...process.env, QUANTOS_F06_PROBE_SCENARIO: scenario,
        QUANTOS_F06_PROBE_ACCOUNT_ID: fixture.account,
        QUANTOS_F06_PROBE_SESSION_HASH: fixture.sessionHash,
        QUANTOS_F06_PROBE_SECRET_NAME: 'f06.paper' },
      encoding: 'utf8', timeout: 30000,
    });
    assert(child.status === 0, `Execution ${scenario} probe failed with exit ${child.status}`);
    const result = JSON.parse(child.stdout.trim());
    assert(result.status === 'PASS' && result.scenario === scenario &&
      result.downstreamSubmissions === (scenario === 'active' ? 1 : 0),
    `Execution ${scenario} probe returned an invalid result`);
    scenarios.push(scenario);
  };
  try {
    const role = (await client.query(`select
      has_table_privilege(current_user,'vault.secrets','DELETE') as can_clean_vault`)).rows[0];
    assert(role.can_clean_vault,
      'operator must be able to fully clean the isolated Vault fixture');
    const existing = (await client.query(`select tenant.id,
      (select vault_path from quantos.secret_references
       where tenant_id=tenant.id and secret_name='f06.paper') as vault_path
      from quantos.tenants as tenant where tenant.slug like 'f06-command-%'`)).rows;
    assert(existing.length <= 1, 'multiple F06 command tenants require manual review');
    if (existing.length === 1) {
      fixture.tenant = existing[0].id;
      reusedTenant = true;
      const oldId = existing[0].vault_path?.match(/^vault:\/\/([0-9a-f-]{36})$/)?.[1];
      assert(!existing[0].vault_path || oldId, 'existing F06 Vault reference is malformed');
      await cleanFixture(fixture.tenant, oldId);
    }
    await client.query('begin');
    try {
      vaultId = (await client.query('select vault.create_secret($1,$2) as id',
        [crypto.randomBytes(24).toString('hex'), `f06-command-${fixture.suffix}`])).rows[0].id;
      if (!reusedTenant) {
        await client.query('insert into quantos.tenants(id,slug,name) values($1,$2,$3)',
          [fixture.tenant, `f06-command-${fixture.suffix}`, 'F06 command smoke']);
      }
      await client.query("insert into quantos.workspaces(id,tenant_id,slug,name,is_primary) values($1,$2,'primary','Primary',true)",
        [fixture.workspace, fixture.tenant]);
      await client.query("insert into quantos.accounts(id,tenant_id,workspace_id,venue,external_account_ref,name,mode) values($1,$2,$3,'paper',$4,'F06 paper account','paper')",
        [fixture.account, fixture.tenant, fixture.workspace, `f06-command-${fixture.suffix}`]);
      await client.query("insert into quantos.actors(id,tenant_id,actor_kind,display_name,service_name) values($1,$2,'service','F06 Execution',$3)",
        [fixture.actor, fixture.tenant, `f06-command-${fixture.suffix}`]);
      await client.query("insert into quantos.actor_capabilities(tenant_id,actor_id,workspace_id,account_id,capability,mode_scope) values($1,$2,$3,$4,'execution.operate','paper')",
        [fixture.tenant, fixture.actor, fixture.workspace, fixture.account]);
      await client.query("insert into quantos.secret_references(tenant_id,workspace_id,account_id,secret_name,vault_path,required_capability,rotation_state) values($1,$2,$3,'f06.paper',$4,'execution.operate','active')",
        [fixture.tenant, fixture.workspace, fixture.account, `vault://${vaultId}`]);
      await client.query("insert into quantos.execution_service_sessions(tenant_id,actor_id,account_id,session_token_hash,allowed_capability,expires_at) values($1,$2,$3,$4,'execution.operate',now()+interval '5 minutes')",
        [fixture.tenant, fixture.actor, fixture.account, fixture.sessionHash]);
      await client.query('commit');
      committed = true;
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
    probe('active');
    probe('account_mismatch');
    probe('expired');
    await client.query("update quantos.secret_references set rotation_state='rotating' where tenant_id=$1",
      [fixture.tenant]);
    probe('reference_rotating');
    await client.query("update quantos.secret_references set rotation_state='revoked' where tenant_id=$1",
      [fixture.tenant]);
    probe('reference_revoked');
    await client.query("update quantos.execution_service_sessions set revoked_at=now() where tenant_id=$1",
      [fixture.tenant]);
    probe('session_revoked');
  } finally {
    try {
      if (committed) {
        await cleanFixture(fixture.tenant, vaultId);
        cleaned = true;
      }
    } finally { await client.end(); }
  }
  assert(cleaned && scenarios.length === 6, 'F06 command smoke did not complete');
  console.log(JSON.stringify({ status: 'PASS', liveRestrictedVaultCall: true,
    paperKernelSubmission: 1, deniedKernelSubmissions: 0,
    scenarios, fixtureDataCleaned: cleaned, emptyIsolatedTenantRetained: true,
    secretMaterialLogged: false,
    x03IssuerOrTransportAcceptance: 'NOT_TESTED' }));
}

main().catch(error => {
  console.error(`F06 command smoke failed: ${error.message}`);
  process.exitCode = 1;
});
