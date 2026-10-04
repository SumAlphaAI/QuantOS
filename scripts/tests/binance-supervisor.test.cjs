const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { Supervisor, validateConfig, approval, RotatingLog, exitPolicy, terminalCode, canonical, hash } = require('../binance-supervisor.cjs');
const { targetUrl, connectionMode } = require('../lib/r01-db.cjs');
const config = () => ({ schema: 'quantos-binance-supervisor/v1', tenant: '00000000-0000-0000-0000-000000000001',
  actor: '00000000-0000-0000-0000-000000000002', provider: 'binance.spot.aggtrades', approvals: 'unused',
  symbols: ['BTCUSDT'], log_dir: '/private/tmp/r01-test' });
test('pool selection preserves target identity and is never implicit', () => {
  const database = 'postgres://user:unused@aws-0-test.pooler.supabase.com:5432/postgres?sslmode=verify-full';
  assert.equal(new URL(targetUrl({ DATABASE_URL: database })).port, '5432');
  const before = new URL(database), after = new URL(targetUrl({ DATABASE_URL: database, QUANTOS_R01_POOL_MODE: 'transaction' }));
  assert.equal(after.port, '6543'); after.port = before.port; assert.equal(after.toString(), before.toString());
  assert.equal(connectionMode(targetUrl({ DATABASE_URL: database, QUANTOS_R01_POOL_MODE: 'transaction' })), 'transaction');
  for (const env of [{}, { DATABASE_URL: 'postgres://x@localhost/db' }, { DATABASE_URL: database, QUANTOS_R01_POOL_MODE: 'arbitrary' },
    { DATABASE_URL: 'postgres://x@db.project.supabase.co:5432/db', QUANTOS_R01_POOL_MODE: 'transaction' }]) assert.throws(() => targetUrl(env), /R01_/);
});
test('rate waits are never shortened and fatal errors do not restart', () => {
  assert.deepEqual(exitPolicy({ code: 'BINANCE_RATE_LIMIT', retry_after_secs: 12, retryable: true }, null, 1), { restart: true, wait_ms: 12000 });
  for (const n of [null, -1, 1.5, 604801, '12']) assert.equal(exitPolicy({ code: 'BINANCE_RATE_LIMIT', retry_after_secs: n, retryable: true }, null, 1).restart, false);
  assert.equal(exitPolicy({ code: 'BINANCE_FATAL', retryable: false }, null, 1).restart, false);
  assert.equal(exitPolicy(null, 'SIGKILL', 20).wait_ms, 60000);
  assert.equal(terminalCode(Error('R01_WORKER_RESTART_BLOCKED')), 78);
  assert.equal(terminalCode(Error('R01_APPROVAL_REVOKED')), 78);
  assert.equal(terminalCode(new SyntaxError('configuration')), 78);
  assert.equal(terminalCode(Error('R01_ALERT_DATABASE')), 1);
});
test('configuration bounds and approval expiry/revocation fail closed', () => {
  validateConfig(config());
  for (const bad of [{ symbols: [] }, { symbols: ['BTCUSDT', 'BTCUSDT'] }, { symbols: ['OTHER'] }, { fixture: 'true' },
    { poll_ms: 1 }, { max_failures: 0 }, { runtime_seconds: -1 }, { log_files: 100 }, { log_dir: 'relative' }, { actor: 'bad' }]) assert.throws(() => validateConfig({ ...config(), ...bad }), /R01_/);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'r01-approval-')), file = path.join(root, 'approval.json');
  const p = { provider: 'binance.spot.aggtrades', enabled: true, expires_at: '2099-01-01T00:00:00Z', freshness_sla_secs: 2,
    license_label: 'internal-evaluation', approval_version: 'v1', approval_reference: 'docs/approval.md', instruments: { BTCUSDT: 'BTC/USDT' } };
  try { fs.writeFileSync(file, JSON.stringify([p])); assert.equal(approval({ ...config(), approvals: file }).provider, p.provider);
    for (const invalid of [{ enabled: false }, { expires_at: '2000-01-01' }, { freshness_sla_secs: 3 }, { approval_reference: 'fixture:test' }, { instruments: {} }]) {
      fs.writeFileSync(file, JSON.stringify([{ ...p, ...invalid }])); assert.throws(() => approval({ ...config(), approvals: file }), /R01_/);
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test('logs rotate with bounded retention and deterministic payload hash', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'r01-logs-')), file = path.join(root, 'log');
  try { const log = new RotatingLog(file, 20, 2); for (let i = 0; i < 10; i++) log.write({ counter: i });
    assert.equal(fs.readdirSync(root).length, 3); assert.match(fs.readFileSync(file, 'utf8'), /counter/);
    assert.equal(canonical({ z: null, a: 'x' }), '{"a":"x","z":null}'); assert.equal(hash({ a: 'x', z: null }), hash({ z: null, a: 'x' }));
    assert.match(hash({ a: 'x' }), /^sha256:[a-f0-9]{64}$/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test('read timeouts degrade health and circuit-break without retrying writes', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'r01-read-circuit-')), file = path.join(root, 'approval.json');
  fs.writeFileSync(file, JSON.stringify([{ provider: 'binance.spot.aggtrades', enabled: true, expires_at: '2099-01-01T00:00:00Z', freshness_sla_secs: 2,
    license_label: 'fixture', approval_version: 'v1', approval_reference: 'fixture:test', instruments: { BTCUSDT: 'BTC/USDT' } }]));
  let reads = 0, alerts = 0, failed;
  const state = { stopping: false, config: { ...config(), approvals: file, fixture: true, max_failures: 2 },
    watchDb: { query: async () => { reads++; throw Error('Query read timeout'); } }, replaceWatchClient: async () => {}, record() {}, writeHealth() {},
    enqueueAlert(kind) { assert.equal(kind, 'market.source.monitor_degraded'); alerts++; }, fail(code) { failed = code; this.stopping = true; } };
  try { await Supervisor.prototype.watch.call(state); assert.equal(reads, 2); assert.equal(alerts, 1); assert.equal(failed, 'R01_WATCH_READ_CIRCUIT'); assert.equal(state.ready, false); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test('timed-out read connection is discarded before recovery without retrying writes', async () => {
  const order = [], replacement = { async connect() { order.push('connect'); } };
  const state = { stopping: false, watchDb: { async end() { order.push('end'); assert.equal(state.watchDb, null); } },
    makeWatchClient() { order.push('new'); return replacement; }, record(kind) { order.push(kind); } };
  await Supervisor.prototype.replaceWatchClient.call(state);
  assert.deepEqual(order, ['end', 'new', 'connect', 'monitor_connection_replaced']); assert.equal(state.watchDb, replacement);
});
test('supervisor uses the native canonical freshness identity and records post-append ACK', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'r01-shared-id-')), file = path.join(root, 'approval.json');
  fs.writeFileSync(file, JSON.stringify([{ provider: 'binance.spot.aggtrades', enabled: true, expires_at: '2099-01-01T00:00:00Z', freshness_sla_secs: 2,
    license_label: 'fixture', approval_version: 'v1', approval_reference: 'fixture:test', instruments: { BTCUSDT: 'BTC/USDT' } }]));
  let sourceId, payload;
  const state = { config: { ...config(), approvals: file, fixture: true }, alerts: [], record() {},
    alertDb: { query: async cfg => { const args = cfg.values; sourceId = args[3]; payload = JSON.parse(args[5])[0].payload; return { rows: [{ inserted: true }] }; } } };
  const checkpoint = '2026-10-04T00:00:00.123Z';
  try { await Supervisor.prototype.persistAlert.call(state, 'market.source.freshness_degraded', 'BTCUSDT', checkpoint,
    { reason: 'binance_poll_unavailable', last_response_at: checkpoint }, Date.now());
    assert.equal(sourceId, 'watchdog:freshness:v2:BTCUSDT:' + checkpoint);
    assert.equal(payload.last_response_at, checkpoint); assert.equal(payload.producer, undefined);
    assert.equal(state.alerts[0].producer, 'supervisor'); assert.ok(state.alerts[0].append_ms >= 0);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test('bounded acceptance ACK evidence fails closed instead of rotating away unmeasured events', () => {
  const state = { config: { capture_commit_evidence: true }, log: { write() {} }, evidenceBytes: 134217728, failure: null, stopping: false };
  Supervisor.prototype.record.call(state, 'binance_page_committed', { input: 1 });
  assert.equal(state.failure, 'R01_COMMIT_EVIDENCE_LIMIT'); assert.equal(state.stopping, true);
});
test('ACK confirmation timeout never substitutes for the five-second origin acceptance limit', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'r01-alert-budget-')), file = path.join(root, 'approval.json');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(file, JSON.stringify([{ provider: 'binance.spot.aggtrades', enabled: true, expires_at: '2099-01-01T00:00:00Z', freshness_sla_secs: 2,
    license_label: 'fixture', approval_version: 'v1', approval_reference: 'fixture:test', instruments: { BTCUSDT: 'BTC/USDT' } }]));
  let now = 10000, budget, violation; t.mock.method(Date, 'now', () => now);
  const state = { config: { ...config(), approvals: file, fixture: true }, alerts: [], record(kind, fields) { if (kind === 'alert_sla_missed') violation = fields; },
    alertDb: { async query(cfg) { budget = cfg.query_timeout; now += 3100; return { rows: [{ inserted: true }] }; } } };
  await Supervisor.prototype.persistAlert.call(state, 'market.source.monitor_degraded', 'BTCUSDT', 'monitor:test', { reason: 'monitor_read_timeout' }, 8000);
  assert.equal(budget, 5000); assert.equal(state.alerts[0].remaining_origin_budget_ms, 3000);
  assert.equal(state.alerts[0].elapsed_ms, 5100); assert.equal(violation.acceptance, 'FAIL_SLA_OR_CLOCK');
  now = 20000;
  await Supervisor.prototype.persistAlert.call(state, 'market.source.freshness_degraded', 'BTCUSDT', 'recovery:test',
    { last_response_at: '1970-01-01T00:00:01.000Z', reason: 'binance_poll_unavailable' }, 3000);
  assert.equal(budget, 5000); assert.equal(state.alerts[1].elapsed_ms, 20100); assert.equal(violation.elapsed_ms, 20100);
});
test('uncertain alert write is identified without retry or fabricated ACK', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'r01-alert-unknown-')), file = path.join(root, 'approval.json');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(file, JSON.stringify([{ provider: 'binance.spot.aggtrades', enabled: true, expires_at: '2099-01-01T00:00:00Z', freshness_sla_secs: 2,
    license_label: 'fixture', approval_version: 'v1', approval_reference: 'fixture:test', instruments: { BTCUSDT: 'BTC/USDT' } }]));
  const records = []; let calls = 0;
  const state = { config: { ...config(), approvals: file, fixture: true }, alerts: [], record(kind, fields) { records.push({ kind, ...fields }); },
    alertDb: { async query() { calls++; throw Error('Query read timeout'); } } };
  await assert.rejects(Supervisor.prototype.persistAlert.call(state, 'market.source.monitor_degraded', 'BTCUSDT', 'monitor:test', { reason: 'monitor_read_timeout' }, Date.now() - 2000), /R01_ALERT_PERSISTENCE/);
  assert.equal(calls, 1); assert.equal(state.alerts.length, 0); assert.equal(records[0].kind, 'alert_commit_unconfirmed');
  assert.ok(records[0].attempted_event_id); assert.equal(records[0].event_id, undefined);
  assert.equal(records[0].error_code, 'CLIENT_QUERY_TIMEOUT');
});
