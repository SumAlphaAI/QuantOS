const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const {assertUuidDefaults, explicitKeys} = require('./db-uuid-defaults.cjs');
test('exact BFF business identities may require an explicit UUID', () => {
  assertUuidDefaults([...explicitKeys].map(key => {const [table_name,column_name] = key.split('.');return {table_name,column_name};}));
  const migration = fs.readFileSync('supabase/migrations/20261003090000_bff_a2_identity_settings.sql','utf8');
  for (const key of explicitKeys) {
    const [table,column] = key.split('.');
    const body = migration.split(`create table quantos.${table} (`)[1]?.split('\n);')[0];
    assert(body, `explicit identity table missing ${table}`);
    assert.match(body, new RegExp(`\\b${column} uuid (primary key|not null)`));
    assert(!new RegExp(`\\b${column} uuid[^\\n]*default`).test(body),key);
  }
});
test('exceptions never permit another key or a broad BFF table prefix', () => {
  for (const row of [{table_name:'event_log',column_name:'id'},{table_name:'bff_security_commands',column_name:'other_key'},{table_name:'bff_new_commands',column_name:'idempotency_key'}]) assert.throws(() => assertUuidDefaults([row]), /must define database defaults/);
});
