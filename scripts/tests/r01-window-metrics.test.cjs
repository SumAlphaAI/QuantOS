const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), zlib = require('node:zlib'), crypto = require('node:crypto');
const { elapsed, ackIndex, measurements, sourceAlerts, assess, assessFailed } = require('../r01-window-metrics.cjs');
const tick = { event_id: 'tick-1', event_kind: 'market.tick.recorded', source_tick_id: 'BTCUSDT:agg:123',
  event_time: '2026-10-04T00:00:00.000000000Z', received_at: '2026-10-04T00:00:02.000000001Z',
  detected_at: '2026-10-04T00:00:02.000000002Z', symbol: 'BTCUSDT', quality: 'degraded' };
const page = { kind: 'binance_page_committed', events: [tick], write: { commit_ack_at: '2026-10-04T00:00:07.000000002Z' } };
test('ACK measurement retains the nanosecond that crosses the five second limit', () => {
  const r = measurements([tick], ackIndex([page]));
  assert.equal(r.clocks_ms.receive_to_ack_ms.gt_5000, 1);
  assert.equal(r.clocks_ms.detection_to_ack_ms.gt_5000, 0);
  assert.equal(r.clocks_ms.source_age_ms.gt_2000, 1);
  assert.ok(elapsed(page.write.commit_ack_at, tick.received_at) > 5000);
});
test('progress, ingested_at and duplicate attempts cannot substitute for exact ACK', () => {
  assert.equal(ackIndex([{ kind: 'worker_progress', event_id: tick.event_id, at: page.write.commit_ack_at },
    { kind: 'binance_watchdog_committed', event_id: 'duplicate', inserted: false }]).size, 0);
  assert.throws(() => measurements([tick], new Map()), /R01_ACK_TARGET_MISSING/);
  assert.throws(() => ackIndex([{ ...page, write: { ingested_at: page.write.commit_ack_at } }]), /R01_ACK_TIMESTAMP/);
});
test('duplicate ACK identities and mismatched target payloads fail closed', () => {
  assert.throws(() => ackIndex([page, page]), /R01_ACK_AMBIGUOUS/);
  assert.throws(() => measurements([{ ...tick, source_tick_id: 'BTCUSDT:agg:124' }], ackIndex([page])), /R01_ACK_TARGET_FIELDS/);
});
test('native source facts require ACKs and duplicate checkpoints remain visible', () => {
  const row = { event_id: 'watch-1', event_kind: 'market.source.freshness_degraded', source_symbol: 'BTCUSDT', last_response_at: tick.received_at };
  const receipt = { ...row, kind: 'binance_watchdog_committed', inserted: true, producer: 'native',
    source_identity: 'watchdog:freshness:v2:BTCUSDT:2026-10-04T00:00:02.000Z',
    origin_at: '2026-10-04T00:00:04.000000001Z', detected_at: '2026-10-04T00:00:04.100000002Z', write: page.write };
  assert.throws(() => sourceAlerts([row], new Map()), /R01_SOURCE_ACK_MISSING/);
  const other = { ...row, event_id: 'watch-2' };
  const result = sourceAlerts([row, other], ackIndex([receipt, { ...receipt, event_id: other.event_id }]));
  assert.equal(result.duplicate_response_checkpoints, 1);
  assert.equal(result.measured_by_producer.native, 2);
});
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'r01-metrics-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const run = path.join(root, 'run'), target = path.join(root, 'target'); fs.mkdirSync(run); fs.mkdirSync(target);
  const sha = b => crypto.createHash('sha256').update(b).digest('hex');
  const r = { status: 'PASS_BOUNDED_INTEGRITY', fixture: false, runtime_seconds: 1800, actorActive: false,
    authorization: { symbols: ['BTCUSDT', 'ETHUSDT'], sample_seconds: 15 }, tenant: 'owned-tenant', actor: 'owned-actor',
    delivery: { outbox: 2, applied: 2, pending: 0 }, cursors: [{ unique_ticks: '1' }],
    started_at: '2026-10-04T00:00:00Z', stopped_at: '2026-10-04T00:30:00Z' };
  const receipt = Buffer.from(JSON.stringify(r)); fs.writeFileSync(path.join(run, 'receipt.json'), receipt);
  const metadata = { status: 'PASS_READ_ONLY_READBACK', readOnly: 'on', writes: false, actorActive: false, transactionEnd: 'ROLLBACK',
    tenant: r.tenant, actor: r.actor, delivery: r.delivery, sourceReceiptSha256: sha(receipt), files: {} };
  const anomaly = { ...tick, event_id: 'anomaly-1', event_kind: 'market.tick.freshness_degraded' };
  for (const [name, rows] of [['target-events.json.gz', [tick, anomaly]], ['target-source-receipts.json.gz', []]]) {
    const raw = Buffer.from(JSON.stringify(rows)), gz = zlib.gzipSync(raw); fs.writeFileSync(path.join(target, name), gz);
    metadata.files[name] = { sha256: sha(gz), rawSha256: sha(raw), rows: rows.length };
  }
  const phase = { ...page, events: [tick, anomaly], build_ms: 1, transport: { headers_ms: 1, body_ms: 1, decode_ms: 1,
    request_started_at: tick.event_time, headers_received_at: tick.received_at, body_completed_at: tick.received_at, decoded_at: tick.detected_at },
    write: { ...page.write, started_at: tick.detected_at, begin_ms: 1, set_local_ms: 1, sql_ms: 1, commit_ms: 1, total_ms: 4 } };
  fs.writeFileSync(path.join(run, 'commit-evidence.jsonl'), JSON.stringify(phase) + '\n');
  fs.writeFileSync(path.join(run, 'samples.jsonl'), JSON.stringify({ at: '2026-10-04T00:00:15Z', due_lag_ms: 0, missed_periods: 0,
    health: { ready: true, checked_at: '2026-10-04T00:00:12Z' }, effective_health: { ready: false, age_ms: 3000 },
    cursors: [], counts: { pending: 0 } }) + '\n');
  fs.writeFileSync(path.join(run, 'worker-BTCUSDT.trace.jsonl'), '{}\n');
  const save = () => fs.writeFileSync(path.join(target, 'target-readback.json'), JSON.stringify(metadata)); save();
  return { run, target, metadata, save };
}
test('freshness, stale health and submission violations remain failures despite pending zero', t => {
  const f = fixture(t), r = assess(f.run, f.target);
  assert.equal(r.delivery.pending, 0);
  assert.equal(r.freshness_acceptance, 'DEGRADED');
  assert.equal(r.natural_submission_limit, 'FAIL_OR_UNMEASURED');
  assert.equal(r.sampling.ready_running, 1);
  assert.equal(r.sampling.effective_ready, 0);
  assert.equal(r.status, 'ASSESSED_B01_OPEN_PARTIAL');
});
test('readback corruption, active actor and missing phase data are rejected', t => {
  const f = fixture(t);
  f.metadata.actorActive = true; f.save(); assert.throws(() => assess(f.run, f.target), /R01_METRICS_TARGET_PROVENANCE/);
  f.metadata.actorActive = false; f.save();
  fs.appendFileSync(path.join(f.target, 'target-events.json.gz'), 'tamper');
  assert.throws(() => assess(f.run, f.target));
});
test('malformed traces and absent exact evidence cannot silently reduce the measured denominator', t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.run, 'worker-BTCUSDT.trace.jsonl'), '{bad\n');
  assert.throws(() => assess(f.run, f.target), /R01_METRICS_TRACE_INVALID/);
  fs.writeFileSync(path.join(f.run, 'worker-BTCUSDT.trace.jsonl'), '{}\n');
  fs.writeFileSync(path.join(f.run, 'commit-evidence.jsonl'), '');
  assert.throws(() => assess(f.run, f.target), /R01_METRICS_ACK_COUNTS/);
});
test('lossless JSONL compression preserves the complete offline result', t => {
  const f = fixture(t), before = assess(f.run, f.target);
  for (const name of ['commit-evidence.jsonl', 'samples.jsonl', 'worker-BTCUSDT.trace.jsonl']) {
    const file = path.join(f.run, name); fs.writeFileSync(file + '.gz', zlib.gzipSync(fs.readFileSync(file))); fs.unlinkSync(file);
  }
  assert.deepEqual(assess(f.run, f.target), before);
});
test('missing phase durations and UTC boundaries are never reported as zero cost', t => {
  const f = fixture(t), file = path.join(f.run, 'commit-evidence.jsonl'), original = JSON.parse(fs.readFileSync(file));
  const changed = structuredClone(original); delete changed.write.sql_ms;
  fs.writeFileSync(file, JSON.stringify(changed) + '\n'); assert.throws(() => assess(f.run, f.target), /R01_METRICS_PHASE_MISSING/);
  delete original.transport.decoded_at;
  fs.writeFileSync(file, JSON.stringify(original) + '\n'); assert.throws(() => assess(f.run, f.target), /R01_METRICS_PHASE_CLOCK_MISSING/);
});
test('a failed window retains target facts with unknown ACK even when delivery is complete', t => {
  const f = fixture(t), sha = b => crypto.createHash('sha256').update(b).digest('hex');
  const failure = Buffer.from(JSON.stringify({ status: 'FAIL', tenant: f.metadata.tenant, actor: f.metadata.actor, reason: 'R01_WINDOW_SUPERVISOR_EXIT' }));
  fs.writeFileSync(path.join(f.run, 'failure.json'), failure);
  fs.writeFileSync(path.join(f.run, 'config.json'), JSON.stringify({ tenant: f.metadata.tenant, actor: f.metadata.actor,
    fixture: false, runtime_seconds: 1800, symbols: ['BTCUSDT', 'ETHUSDT'] }));
  const eventFile = path.join(f.target, 'target-events.json.gz'), rows = JSON.parse(zlib.gunzipSync(fs.readFileSync(eventFile)));
  rows.push({ event_id: 'unknown-ack', event_kind: 'market.source.monitor_degraded', source_symbol: 'BTCUSDT' });
  const raw = Buffer.from(JSON.stringify(rows)), archive = zlib.gzipSync(raw); fs.writeFileSync(eventFile, archive);
  f.metadata.files['target-events.json.gz'] = { sha256: sha(archive), rawSha256: sha(raw), rows: 3 };
  f.metadata.delivery = { outbox: 3, applied: 3, pending: 0 }; f.metadata.status = 'READ_ONLY_FAILED_WINDOW_SNAPSHOT';
  f.metadata.sourceWindowStatus = 'FAIL'; f.metadata.sourceReceiptSha256 = sha(failure); f.save();
  fs.appendFileSync(path.join(f.run, 'commit-evidence.jsonl'), JSON.stringify({ kind: 'supervisor_started', at: '2026-10-04T00:00:00Z' }) + '\n'
    + JSON.stringify({ kind: 'supervisor_stopped', at: '2026-10-04T00:01:00Z' }) + '\n');
  const result = assessFailed(f.run, f.target);
  assert.equal(result.status, 'FAIL_WINDOW_PARTIAL_MEASUREMENT'); assert.equal(result.exact_ack_events, 2);
  assert.equal(result.unknown_ack_events.length, 1); assert.equal(result.delivery.pending, 0);
  assert.equal(result.source_alerts['market.source.monitor_degraded'].origin_to_ack_ms.missing, 1);
  assert.equal(result.source_alerts['market.source.monitor_degraded'].origin_to_ack_ms.max, null);
  f.metadata.sourceWindowStatus = 'PASS'; f.save(); assert.throws(() => assessFailed(f.run, f.target), /R01_FAILED_METRICS_PROVENANCE/);
});

test('source alert clocks must match the immutable detection and approved threshold', () => {
  const row = { event_id: 'source-clock', event_kind: 'market.source.freshness_degraded', source_symbol: 'BTCUSDT',
    last_response_at: '2026-10-04T00:00:02.000Z', occurred_at: '2026-10-04 00:00:04.100000+00' };
  const r = { kind: 'binance_watchdog_committed', event_id: row.event_id, event_kind: row.event_kind, inserted: true, producer: 'native',
    source_identity: 'watchdog:freshness:v2:BTCUSDT:2026-10-04T00:00:02.000Z',
    origin_at: '2026-10-04T00:00:04.000999Z', detected_at: '2026-10-04T00:00:04.100000999Z', write: page.write };
  assert.equal(sourceAlerts([row], ackIndex([r])).response_checkpoints, 1);
  assert.throws(() => sourceAlerts([row], ackIndex([{ ...r, origin_at: '2026-10-04T00:00:04.001Z' }])), /R01_SOURCE_THRESHOLD_ORIGIN/);
  assert.throws(() => sourceAlerts([row], ackIndex([{ ...r, detected_at: '2026-10-04T00:00:04.100001Z' }])), /R01_SOURCE_TARGET_DETECTION/);
});
