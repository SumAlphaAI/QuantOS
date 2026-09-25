const { Client } = require('pg');
const fs = require('node:fs');

const resolver = 'quantos.resolve_execution_vault_secret(text,text,timestamp with time zone,uuid)';
const legacyFunctions = [
  'quantos.resolve_execution_secret_ref(text)',
  'quantos.resolve_execution_secret_reference(text,text,text)',
  'quantos.resolve_execution_vault_secret(text,text,timestamp with time zone)',
];

async function main() {
  const url = new URL(process.env.QUANTOS_EXECUTION_DATABASE_URL);
  if (url.searchParams.get('sslmode') !== 'verify-full') {
    throw Error('Execution login requires sslmode=verify-full');
  }
  const caPath = url.searchParams.get('sslrootcert');
  if (!caPath || !fs.statSync(caPath).isFile()) {
    throw Error('Execution login requires an existing CA file');
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
      pg_has_role(session_user,'quantos_execution_gateway','SET') as execution,
      pg_has_role(session_user,'quantos_bff','SET') as bff,
      pg_has_role(session_user,'quantos_runtime','SET') as runtime,
      pg_has_role(session_user,'service_role','MEMBER') as service_member,
      (select rolbypassrls or rolsuper from pg_roles where rolname=session_user) as privileged`)).rows[0];
    if (!role.execution || role.bff || role.runtime || role.service_member || role.privileged) {
      throw Error('Execution login failed separation or privilege checks');
    }
    await client.query('set role quantos_execution_gateway');
    const privileges = (await client.query(`select
      has_function_privilege(current_role,$1,'EXECUTE') as resolver,
      has_function_privilege(current_role,$2,'EXECUTE') as legacy_name,
      has_function_privilege(current_role,$3,'EXECUTE') as legacy_reference,
      has_function_privilege(current_role,$4,'EXECUTE') as legacy_vault,
      has_schema_privilege(current_role,'vault','USAGE') as vault_schema`,
    [resolver, ...legacyFunctions])).rows[0];
    if (!privileges.resolver || privileges.legacy_name || privileges.legacy_reference ||
        privileges.legacy_vault || privileges.vault_schema) {
      throw Error('Execution role has a legacy or direct Vault decryption path');
    }
    const value = (await client.query(`select quantos.resolve_execution_vault_secret($1,$2,$3,$4) as value`,
      ['invalid-session', 'invalid-secret', new Date(Date.now() + 60000),
        '00000000-0000-0000-0000-000000000000'])).rows[0].value;
    if (value !== null) throw Error('Unknown Execution session resolved a secret');
    console.log(JSON.stringify({ status: 'PASS', verifiedTls: true,
      executionRoleOnly: true, activeResolverGranted: true,
      legacyFunctionsRevoked: true, directVaultViewDenied: true,
      unknownSessionDenied: true }));
  } finally {
    await client.end();
  }
}

main().catch(error => {
  console.error(`F06 Execution login check failed: ${error.message}`);
  process.exitCode = 1;
});
