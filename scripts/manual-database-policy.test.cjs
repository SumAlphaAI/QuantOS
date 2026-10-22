const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync, rmSync, readFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');
const { parse } = require('yaml');
const { loadLocalDatabaseEnvironment, requireManualDatabaseRun, requireDatabaseHeadroom } = require('./lib/manual-database-policy.cjs');
const { maintainMetrics } = require('./lib/database-hygiene.cjs');

test('unattended events cannot opt into full database maintenance', () => {
  assert.throws(() => requireManualDatabaseRun({}), /MANUAL_F05_F07_REQUIRED/);
  for (const event of ['push', 'pull_request', 'schedule']) assert.throws(() => requireManualDatabaseRun({ QUANTOS_MANUAL_F05_F07: '1', GITHUB_EVENT_NAME: event }), /cannot run/);
  for (const event of [undefined, 'workflow_dispatch']) requireManualDatabaseRun({ QUANTOS_MANUAL_F05_F07: '1', GITHUB_EVENT_NAME: event });
  for (const file of ['f05-event-nightly.yml', 'f07-runtime-nightly.yml']) {
    const workflow = parse(readFileSync('.github/workflows/' + file, 'utf8'));
    assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
    for (const job of Object.values(workflow.jobs)) {
      assert.match(job.if, /inputs.confirm_full_database_run/);
      assert.equal(job.env.QUANTOS_MANUAL_F05_F07, '1');
    }
  }
});
test('entry scripts refuse before connecting, resetting or replacing historical receipts', () => {
  for (const file of ['f05-db-gate.cjs', 'f05-target-gate.cjs', 'f07-db-gate.cjs', 'f07-target-service-acceptance.cjs']) {
    const result = spawnSync(process.execPath, ['scripts/' + file], { env: { ...process.env, QUANTOS_MANUAL_F05_F07: '', DATABASE_URL: 'invalid' }, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /MANUAL_F05_F07_REQUIRED/);
  }
});
test('Make entry points refuse before builds, connections and full coverage', () => {
  for (const target of ['f05-coverage', 'f05-db-check', 'f05-target-check', 'test-f05-live', 'f07-db-check', 'f07-recovery-diagnostic', 'f07-coverage-diagnostic', 'f07-gateway-test', 'f07-target-service-acceptance', 'f07-forward-migration']) {
    const result = spawnSync('make', ['-s', target], { env: { ...process.env, QUANTOS_SKIP_ENV: '1', QUANTOS_MANUAL_F05_F07: '' }, encoding: 'utf8' });
    assert.notEqual(result.status, 0, target);
    assert.match(result.stderr, /MANUAL_F05_F07_REQUIRED/, target);
  }
});
test('latest local target overrides stale exports without copying unrelated secrets', () => {
  const directory = mkdtempSync(join(tmpdir(), 'quantos-target-'));
  try {
    const file = join(directory, '.env.local');
    writeFileSync(file, 'DATABASE_URL="postgres://current"\nSUPABASE_URL=https://current.supabase.co\nOTHER_SECRET=not-for-export\n');
    const env = { DATABASE_URL: 'postgres://retired', RETAIN: 'yes' };
    loadLocalDatabaseEnvironment(env, file);
    assert.deepEqual(env, { DATABASE_URL: 'postgres://current', SUPABASE_URL: 'https://current.supabase.co', RETAIN: 'yes' });
  } finally { rmSync(directory, { recursive: true }); }
});
test('retained fixture campaigns stop at the database budget', async () => {
  for (const bytes of [256 * 1024 * 1024, 1600000000]) await assert.rejects(requireDatabaseHeadroom({ query: async () => ({ rows: [{ bytes: String(bytes) }] }) }), /DATABASE_FIXTURE_BUDGET/);
  assert.equal(await requireDatabaseHeadroom({ query: async () => ({ rows: [{ bytes: '10000000' }] }) }), 10000000);
});
test('metric maintenance defaults read-only, rejects unsafe limits and bounds each write', async () => {
  const queries = [];
  const client = { query: async (sql, params) => { queries.push({ sql, params }); return /delete from/i.test(sql) ? { rowCount: 5000 } : { rows: [{ expired: '12000' }] }; } };
  assert.equal((await maintainMetrics(client)).deleted, 0);
  assert.equal(queries.length, 1);
  const result = await maintainMetrics(client, { apply: true });
  assert.equal(result.remainingEstimate, 7000);
  assert.match(queries.at(-1).sql, /limit \$2 for update skip locked/);
  for (const options of [{ days: 0 }, { limit: 5001 }]) await assert.rejects(maintainMetrics(client, options));
});
