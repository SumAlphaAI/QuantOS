import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse } from 'yaml';

const postgres = readFileSync('crates/quantos-event/src/pg.rs', 'utf8');
const migration = readFileSync('supabase/migrations/20260921090000_f05_ledger_integrity_and_replay.sql', 'utf8');

test('disposable F05 workflow consumers explicitly select their plaintext PostgreSQL transport', () => {
  for (const filename of ['.github/workflows/ci.yml', '.github/workflows/f05-event-nightly.yml']) {
    const workflow = parse(readFileSync(filename, 'utf8'));
    const consumers = Object.values(workflow.jobs).filter(job => job.steps.some(step => /\bmake f05-db-(?:check|coverage)\b/.test(step.run ?? '')));
    assert.ok(consumers.length, `${filename} must retain its F05 database Gate`);
    for (const job of consumers) {
      assert.match(job.services.postgres.image, /^postgres:/);
      const target = new URL(job.env.F02_PG_ADMIN_URL);
      assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname));
      assert.equal(target.searchParams.get('sslmode'), 'disable', `${filename} plaintext fixture must not depend on adapter TLS defaults`);
    }
  }
});

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
