import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCoverage, requiredFiles } from './check-f05-coverage.mjs';
const metric = (covered = 100) => ({ count: 100, covered, percent: covered });
const report = () => ({ data: [{ files: requiredFiles.map(filename => ({ filename, summary: { lines: metric(), regions: metric(), branches: metric() } })) }] });
test('full source inventory and thresholds are required', () => {
  assert.equal(checkCoverage(report(), true).scope.length, requiredFiles.length);
  for (const filename of requiredFiles) {
    const value = report(); value.data[0].files = value.data[0].files.filter(f => f.filename !== filename);
    assert.throws(() => checkCoverage(value, true), /requires exactly one/);
  }
  const duplicate = report(); duplicate.data[0].files.push(duplicate.data[0].files[0]);
  assert.throws(() => checkCoverage(duplicate), /exactly one/);
});
test('adapter coverage cannot be hidden in aggregate or fabricated', () => {
  for (const key of ['lines', 'regions']) {
    const value = report(); value.data[0].files.find(f => f.filename.endsWith('/supabase_storage.rs')).summary[key] = metric(0);
    assert.throws(() => checkCoverage(value), /below/);
  }
  for (const covered of [-1, 101, 50.5, NaN]) {
    const value = report(); value.data[0].files[0].summary.lines.covered = covered;
    assert.throws(() => checkCoverage(value), /Invalid/);
  }
  const inconsistent = report(); inconsistent.data[0].files[0].summary.lines.percent = 20;
  assert.throws(() => checkCoverage(inconsistent), /Inconsistent/);
  const noBranches = report(); noBranches.data[0].files.forEach(f => { f.summary.branches = { count: 0, covered: 0, percent: 0 }; });
  assert.throws(() => checkCoverage(noBranches, true), /branches below/);
  const low = report(); low.data[0].files.forEach(f => { f.summary.branches = metric(84); });
  assert.throws(() => checkCoverage(low, true), /branches below/);
});

test('quantitative acceptance rejects partial consumption and server-only timings', async () => {
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { default: validate } = await import('./f05-measurements.cjs');
  const dir = mkdtempSync(join(tmpdir(), 'f05-measured-'));
  const path = join(dir, 'measurement.json');
  const valid = { eventCount: 10000, uniqueSideEffects: 10000, dispatched: 10000, appliedReceipts: 10000, checkpointNextSequence: 10001, consumerPath: 'PgEventStore::poll_outbox_once', lookupScope: 'complete-client-retrieval', correlationLookupMillis: 40, consumptionMillis: 3000 };
  try {
    writeFileSync(path, JSON.stringify(valid)); assert.deepEqual(validate(path), valid);
    for (const change of [{ eventCount: 9999 }, { uniqueSideEffects: 1 }, { appliedReceipts: 0 }, { dispatched: 0 }, { checkpointNextSequence: 2 }, { lookupScope: 'postgres-explain' }, { consumerPath: 'bulk-sql' }, { correlationLookupMillis: 5001 }, { correlationLookupMillis: null }, { consumptionMillis: 0 }]) {
      writeFileSync(path, JSON.stringify({ ...valid, ...change })); assert.throws(() => validate(path));
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
