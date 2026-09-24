const { Client } = require('pg');
const crypto = require('node:crypto');

const functionName = 'quantos.resolve_execution_vault_secret(text,text,timestamp with time zone)';
const assert = (condition, message) => { if (!condition) throw Error(message); };

async function main() {
  assert(process.env.QUANTOS_F06_TARGET_ISOLATED === '1', 'F06 Vault Gate requires QUANTOS_F06_TARGET_ISOLATED=1');
  assert(process.env.DATABASE_URL, 'F06 Vault Gate requires DATABASE_URL');
  const url = new URL(process.env.DATABASE_URL);
  const sslmode = url.searchParams.get('sslmode');
  const client = new Client({
    host: url.hostname,
    port: url.port ? Number(url.port) : 5432,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, '') || 'postgres',
    ssl: sslmode === 'disable' ? undefined :
      { rejectUnauthorized: sslmode === 'verify-full' || sslmode === 'verify-ca' },
  });
  await client.connect();
  const checks = [];
  try {
    const role = (await client.query(`select current_user,
      pg_has_role(current_user, 'quantos_execution_gateway', 'SET') as can_set_gateway,
      to_regclass('vault.decrypted_secrets') is not null as vault_available`)).rows[0];
    assert(role.vault_available, 'Supabase Vault decrypted view is unavailable');
    const privileges = (await client.query(`select
      has_function_privilege('authenticated',$1,'EXECUTE') as authenticated,
      has_function_privilege('anon',$1,'EXECUTE') as anon,
      has_function_privilege('service_role',$1,'EXECUTE') as service_role,
      has_function_privilege('quantos_bff',$1,'EXECUTE') as bff,
      has_function_privilege('quantos_engine',$1,'EXECUTE') as engine,
      has_function_privilege('quantos_execution_gateway',$1,'EXECUTE') as gateway,
      has_table_privilege('authenticated','vault.decrypted_secrets','SELECT') as authenticated_view,
      has_table_privilege('anon','vault.decrypted_secrets','SELECT') as anon_view,
      has_table_privilege('service_role','vault.decrypted_secrets','SELECT') as service_role_view,
      has_table_privilege('quantos_bff','vault.decrypted_secrets','SELECT') as bff_view,
      has_table_privilege('quantos_engine','vault.decrypted_secrets','SELECT') as engine_view,
      has_table_privilege('quantos_execution_gateway','vault.decrypted_secrets','SELECT') as gateway_view,
      has_schema_privilege('service_role','vault','USAGE') as service_role_vault_schema,
      pg_has_role('service_role','pg_read_all_data','MEMBER') as service_role_read_all,
      pg_has_role('quantos_bff','service_role','MEMBER') as bff_service_member,
      pg_has_role('quantos_engine','service_role','MEMBER') as engine_service_member`, [functionName])).rows[0];
    const appMatrixOk = privileges.gateway && !privileges.authenticated && !privileges.anon &&
      !privileges.service_role && !privileges.authenticated_view && !privileges.anon_view &&
      !privileges.gateway_view && !privileges.bff && !privileges.engine &&
      !privileges.bff_view && !privileges.engine_view &&
      !privileges.bff_service_member && !privileges.engine_service_member;
    assert(appMatrixOk, `Vault application privilege matrix failed: ${JSON.stringify(privileges)}`);
    checks.push('application function and decrypted view privilege matrix');

    await client.query('begin');
    try {
      if (!role.can_set_gateway) {
        // Grant only inside this rollback-only test transaction. The managed
        // gateway login must be provisioned separately in its target runtime.
        const quoted = `"${role.current_user.replaceAll('"', '""')}"`;
        await client.query(`grant quantos_execution_gateway to ${quoted}`);
      }
      const tenant = crypto.randomUUID(), user = crypto.randomUUID(), workspace = crypto.randomUUID();
      const account = crypto.randomUUID(), actor = crypto.randomUUID();
      const suffix = crypto.randomBytes(8).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex');
      const plaintext = crypto.randomBytes(24).toString('hex');
      const vaultId = (await client.query('select vault.create_secret($1,$2) as id',
        [plaintext, `f06-gate-${suffix}`])).rows[0].id;
      await client.query('insert into quantos.tenants(id,slug,name) values($1,$2,$3)',
        [tenant, `f06-gate-${suffix}`, 'F06 isolated Gate']);
      await client.query("insert into quantos.workspaces(id,tenant_id,slug,name,is_primary) values($1,$2,'primary','Primary',true)",
        [workspace, tenant]);
      await client.query("insert into quantos.accounts(id,tenant_id,workspace_id,venue,external_account_ref,name,mode) values($1,$2,$3,'paper',$4,'F06 account','paper')",
        [account, tenant, workspace, `f06-gate-${suffix}`]);
      await client.query("insert into quantos.actors(id,tenant_id,actor_kind,display_name,service_name) values($1,$2,'service','F06 Gateway',$3)",
        [actor, tenant, `f06-gate-${suffix}`]);
      await client.query("insert into quantos.actor_capabilities(tenant_id,actor_id,workspace_id,account_id,capability,mode_scope) values($1,$2,$3,$4,'execution.operate','paper')",
        [tenant, actor, workspace, account]);
      await client.query("insert into quantos.secret_references(tenant_id,workspace_id,account_id,secret_name,vault_path,required_capability,rotation_state) values($1,$2,$3,'f06.test',$4,'execution.operate','active')",
        [tenant, workspace, account, `vault://${vaultId}`]);
      await client.query("insert into quantos.execution_service_sessions(tenant_id,actor_id,account_id,session_token_hash,allowed_capability,expires_at) values($1,$2,$3,$4,'execution.operate',now()+interval '5 minutes')",
        [tenant, actor, account, tokenHash]);
      await client.query('set local role quantos_execution_gateway');
      const resolve = async (expires) => (await client.query(
        `select quantos.resolve_execution_vault_secret($1,$2,$3) as value`,
        [tokenHash, 'f06.test', expires])).rows[0].value;
      assert(await resolve(new Date(Date.now()+60000)) === plaintext, 'Gateway did not resolve the active scoped Vault secret');
      assert(await resolve(new Date(Date.now()-1000)) === null, 'Expired command resolved a secret');
      checks.push('gateway allowed; expired command rejected');
      await client.query('reset role');
      await client.query("update quantos.secret_references set rotation_state='revoked' where tenant_id=$1", [tenant]);
      await client.query('set local role quantos_execution_gateway');
      assert(await resolve(new Date(Date.now()+60000)) === null, 'Revoked secret resolved');
      checks.push('revoked reference rejected');
      await client.query('reset role');
      await client.query("update quantos.secret_references set rotation_state='active' where tenant_id=$1", [tenant]);
      await client.query("update quantos.execution_service_sessions set revoked_at=now() where tenant_id=$1", [tenant]);
      await client.query('set local role quantos_execution_gateway');
      assert(await resolve(new Date(Date.now()+60000)) === null, 'Revoked service session resolved');
      checks.push('revoked service session rejected');
      await client.query('reset role');
      for (const deniedRole of ['anon', 'authenticated', 'quantos_bff', 'quantos_engine']) {
        const quoted = `"${role.current_user.replaceAll('"', '""')}"`;
        await client.query(`grant ${deniedRole} to ${quoted}`);
        for (const sql of [
          'select decrypted_secret from vault.decrypted_secrets limit 1',
          'select quantos.resolve_execution_vault_secret($1,$2,$3)',
        ]) {
          await client.query('savepoint f06_denial');
          try {
            await client.query(`set local role ${deniedRole}`);
            await client.query(sql, sql.includes('resolve_execution')
              ? [tokenHash, 'f06.test', new Date(Date.now()+60000)] : []);
            throw Error(`${deniedRole} reached a Vault decryption path`);
          } catch (error) {
            if (error.code !== '42501') throw error;
          } finally {
            await client.query('rollback to savepoint f06_denial');
            await client.query('release savepoint f06_denial');
          }
        }
      }
      checks.push('8/8 actual SQL denials for UI, user, BFF and Engine roles');
    } finally {
      await client.query('rollback');
    }
    console.log(JSON.stringify({
      status:'PASS', checks, secretMaterialLogged:false,
      platformServiceRoleViewException: privileges.service_role_view,
      applicationRolesHoldServiceRole:false,
    }));
  } finally { await client.end(); }
}

main().catch(error => { console.error(`F06 Vault Gate failed: ${error.message}`); process.exitCode=1; });
