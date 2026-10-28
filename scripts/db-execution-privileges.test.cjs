// Offline catalog-contract tests; no PostgreSQL connection or privilege execution.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { liveRlsCheck } = require('./db-cli.cjs');
const functions = [
  'quantos.resolve_execution_secret_reference(text, text, text)',
  'quantos.resolve_execution_secret_ref(text)',
  'quantos.resolve_execution_vault_secret(text, text, timestamp with time zone, uuid)',
  'quantos.resolve_execution_vault_secret(text, text, timestamp with time zone)',
  'quantos.resolve_execution_zone_secret(text, text, timestamp with time zone, uuid, text, bigint)',
];
const roles = ['authenticated', 'anon', 'service_role', 'quantos_execution_gateway'];
const current = roles[3] + ':' + functions[4];
// A fixture/query-contract assertion must never masquerade as a policy refusal.
const boundaryRefusal = error => error.code !== 'ERR_ASSERTION' && /Vault|L02/.test(error.message);
function fixture({ grants = [current], tableSelect = false, badRow, catalogFailure } = {}) {
  let queried = false;
  const client = { async query(sql, params) {
    assert.match(sql.trim(), /^select\b/i, 'catalog check must remain read-only');
    if (!sql.includes('has_function_privilege')) {
      if (catalogFailure && sql.includes(catalogFailure)) return { rows: [{ table_name: 'quantos.unit_table' }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    }
    queried = true;
    assert.deepEqual(params, functions, 'query must bind all four retired signatures and the current L02 signature');
    const checks = [...sql.matchAll(/has_function_privilege\('([^']+)', \$(\d+), 'EXECUTE'\) as (\w+)/g)];
    const identities = checks.map(([, role, index]) => role + ':' + params[Number(index) - 1]);
    assert.deepEqual([...identities].sort(), roles.flatMap(role => functions.map(fn => role + ':' + fn)).sort());
    const row = Object.fromEntries(checks.map(([, role, index, column]) => [column, grants.includes(role + ':' + params[Number(index) - 1])]));
    assert.match(sql, /has_table_privilege\('service_role', 'quantos\.execution_secret_refs', 'SELECT'\) as service_role_table_select/);
    row.service_role_table_select = tableSelect;
    if (badRow) return badRow(row);
    return { rows: [row], rowCount: 1 };
  } };
  return { run: () => liveRlsCheck(fn => fn(client)), queried: () => queried };
}
test('current L02 effective privileges pass without a connection or a restored old grant', async () => {
  const f = fixture(); await f.run(); assert(f.queried());
});
for (const role of roles) for (const fn of functions.slice(0, 4)) {
  test('reject retired entry granted to ' + role + ': ' + fn, async () => {
    await assert.rejects(fixture({ grants: [current, role + ':' + fn] }).run(), boundaryRefusal);
  });
}
for (const role of roles.slice(0, 3)) test('reject current zone entry granted to ' + role, async () => {
  await assert.rejects(fixture({ grants: [current, role + ':' + functions[4]] }).run(), boundaryRefusal);
});
test('missing current gateway grant cannot fall back to the old command-bound grant', async () => {
  for (const grants of [[], [roles[3] + ':' + functions[2]]]) await assert.rejects(fixture({ grants }).run(), boundaryRefusal);
});
test('generic service role still cannot read the historical secret table', async () => {
  await assert.rejects(fixture({ tableSelect: true }).run(), /Vault/);
});
for (const [name, badRow] of [
  ['empty', () => ({ rows: [], rowCount: 0 })],
  ['duplicate', row => ({ rows: [row, row], rowCount: 2 })],
  ['missing denied field', row => { delete row.anon_legacy; return { rows: [row], rowCount: 1 }; }],
  ['null denied field', row => { row.anon_legacy = null; return { rows: [row], rowCount: 1 }; }],
  ['truthy allowed field', row => { row.gateway_zone = 'true'; return { rows: [row], rowCount: 1 }; }],
]) test('incomplete catalog result fails closed: ' + name, async () => {
  await assert.rejects(fixture({ badRow }).run(), /privilege catalog/);
});
for (const [sql, message] of [['relrowsecurity', /RLS is disabled/], ['relforcerowsecurity', /FORCE RLS/], ['pg_policies', /policies are missing/]]) {
  test('earlier table check still refuses before function privileges: ' + sql, async () => {
    const f = fixture({ catalogFailure: sql }); await assert.rejects(f.run(), message); assert(!f.queried());
  });
}
test('policy expectation follows the immutable L02 migration and preserves account/peer/version guards', () => {
  const sql = readFileSync('supabase/migrations/20261027090000_l02_bound_execution_zone.sql', 'utf8');
  for (const fn of ['resolve_execution_vault_secret(text,text,timestamptz,uuid)', 'resolve_execution_vault_secret(text,text,timestamptz)', 'resolve_execution_secret_ref(text)', 'resolve_execution_secret_reference(text,text,text)']) {
    assert(sql.includes('revoke all on function quantos.' + fn));
  }
  assert(sql.includes('grant execute on function quantos.resolve_execution_zone_secret(text,text,timestamptz,uuid,text,bigint)\n  to quantos_execution_gateway;'));
  for (const guard of ['session.account_id = input_command_account_id', 'session.execution_peer_fingerprint = input_peer_fingerprint', 'session.execution_credential_version = input_credential_version', 'credential.valid_until > observed_at', 'credential.retire_at > observed_at']) assert(sql.includes(guard), guard);
});
