const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const sql = readFileSync('supabase/migrations/20261015100000_s01_draft_integrity.sql', 'utf8');
// Static contract checks only: these do not assert PostgreSQL execution or RLS effectiveness.
test('S01 forward migration preserves original rows and applies forced RLS to both tables', () => {
  assert(!/drop table|truncate|delete from|disable row level/i.test(sql));
  for (const name of ['strategy_drafts', 'strategy_draft_versions']) {
    assert(sql.includes(`alter table quantos.${name} enable row level security`));
    assert(sql.includes(`alter table quantos.${name} force row level security`));
  }
  assert(sql.includes('quantos.is_workspace_member(workspace_id)'));
  assert(sql.includes('quantos.is_workspace_member(d.workspace_id)'));
});
test('S01 persistence guards pin audit, tenant, head CAS, snapshot and Artifact id/hash', () => {
  for (const contract of ['new.created_by_user is null', 'new.version <> d.head_version + 1', 'for update',
    'new.tenant_id', "s.quality = 'passed'", 's.expires_at > new.created_at',
    "a.artifact_id::text = r->>'artifact_id'", "a.content_hash = r->>'content_hash'",
    'S01 versions are immutable', 'S01 draft identity and audit lineage are immutable']) assert(sql.includes(contract), contract);
});

test('S01 immutable audit guards retain the historical FK user-deletion action only for nested triggers', () => {
  assert.equal((sql.match(/pg_trigger_depth\(\) > 1/g) || []).length, 2);
  assert.equal((sql.match(/old.created_by_user is not null and new.created_by_user is null/g) || []).length, 2);
  assert.equal((sql.match(/to_jsonb\(new\) - 'created_by_user'/g) || []).length, 2);
});
