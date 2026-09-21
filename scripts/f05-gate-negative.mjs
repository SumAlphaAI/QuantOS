import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const postgres = readFileSync('crates/quantos-event/src/pg.rs', 'utf8');
const migration = readFileSync('supabase/migrations/20260921090000_f05_ledger_integrity_and_replay.sql', 'utf8');

test('acknowledgements cannot be reduced to record-id updates', () => {
  for (const predicate of [
    "and lease_owner = $3\n               and lease_token = $4",
    "and o.lease_owner = $6\n               and o.lease_token = $7",
    "and i.lease_owner = $6\n               and i.lease_token = $7",
  ]) assert.ok(postgres.includes(predicate), predicate);
});

test('append-only protection covers update delete truncate and cascade deletion', () => {
  assert.match(migration, /before update or delete or truncate on quantos\.event_log/);
  assert.match(migration, /before update or delete or truncate on quantos\.audit_entries/);
  assert.match(migration, /foreign key \(stream_id\).*on delete restrict/s);
});

test('tenantless correlation and replay APIs are absent', () => {
  assert.doesNotMatch(postgres, /where correlation_id = \$1/);
  assert.match(postgres, /where tenant_id = \$1 and correlation_id = \$2/);
});

test('nightly branch gate rejects fabricated, empty and below-threshold reports', () => {
  const directory = mkdtempSync(join(tmpdir(), 'f05-branch-'));
  const report = (count, covered, percent = covered / count * 100) => ({
    data: [{ totals: { branches: { count, covered, percent } } }],
  });
  try {
    for (const [value, accepted] of [
      [report(100, 85), true],
      [report(100, 84), false],
      [report(0, 0, 0), false],
      [report(100, 1, 100), false],
      [{}, false],
    ]) {
      const path = join(directory, 'coverage.json');
      writeFileSync(path, JSON.stringify(value));
      const result = spawnSync(process.execPath, ['scripts/check-f05-branch.mjs', path]);
      assert.equal(result.status === 0, accepted, JSON.stringify(value));
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
