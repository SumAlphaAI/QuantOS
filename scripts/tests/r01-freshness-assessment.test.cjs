const test = require('node:test'), assert = require('node:assert/strict');
const { stats, tickClocks, parseJsonl, sampling, clocksForTicks, progressIndex, naturalAlerts } = require('../r01-freshness-assessment.cjs');
const iso = n => new Date(n).toISOString();
test('source-age, processing and commit observation have separate origins; absent clocks stay unknown', () => {
  const c = tickClocks({ event_time: iso(0), received_at: iso(4000), detected_at: iso(4005) }, 6000);
  assert.equal(c.source_age_ms, 4000); assert.equal(c.processing_to_detection_ms, 5);
  assert.equal(c.source_age_at_detection_ms, 4005); assert.equal(c.detection_to_progress_ms, 1995);
  assert.equal(c.source_age_at_progress_ms, 6000);
  assert.ok(Number.isNaN(tickClocks({ event_time: iso(0) }).source_age_ms));
  assert.equal(stats([NaN], 1).missing, 1); assert.equal(stats([NaN]).p95, null);
});
test('submillisecond freshness threshold and signed clock skew are retained', () => {
  const c = tickClocks({ event_time: iso(0), received_at: '1970-01-01T00:00:02.000001Z', detected_at: '1970-01-01T00:00:02.000002Z' });
  assert.equal(stats([c.source_age_at_detection_ms]).gt_2000, 1);
  const nano = tickClocks({ event_time: iso(0), received_at: '1970-01-01T00:00:02.000000001Z', detected_at: '1970-01-01T00:00:02.000000002Z' });
  assert.equal(stats([nano.source_age_at_detection_ms]).gt_2000, 1);
  const skew = tickClocks({ event_time: iso(200), received_at: iso(100), detected_at: iso(101) });
  assert.equal(skew.source_age_ms, -100); assert.equal(stats([skew.source_age_ms]).negative, 1);
});
test('page ID range joins unique commit progress; ambiguous or missing progress never yields a measured ACK', () => {
  const row = { event_id: 'e', source_tick_id: 'BTCUSDT:agg:10', quality: 'degraded', event_time: iso(0), received_at: iso(1), detected_at: iso(2) };
  const p = progressIndex([{ kind: 'worker_progress', symbol: 'BTCUSDT', input: 2, next_id: '12', at: iso(500) }]);
  assert.equal(clocksForTicks([row], p).clocks_ms.detection_to_progress_ms.max, 498);
  assert.deepEqual(clocksForTicks([row], []).progress_missing_event_ids, ['e']);
  const duplicate = clocksForTicks([row], [...p, ...p]);
  assert.deepEqual(duplicate.progress_ambiguous_event_ids, ['e']); assert.equal(duplicate.clocks_ms.detection_to_progress_ms.measured, 0);
});
test('readiness excludes startup, counts stale health and cadence gaps without calling point samples uptime', () => {
  const r = { started_at: iso(1000), stopped_at: iso(60000), authorization: { symbols: ['BTCUSDT'], sample_seconds: 15 } };
  const sample = (at, checked, ready, last) => ({ at: iso(at), health: checked === null ? null : { checked_at: iso(checked), ready }, cursors: last === null ? [] : [{ symbol: 'BTCUSDT', last_response_at: iso(last) }], counts: { pending: 0 } });
  const s = sampling([sample(0, null, false, null), sample(5000, 2000, true, 2000), sample(45000, 44500, false, 44000)], r);
  assert.equal(s.pre_start, 1); assert.equal(s.ready_running_percent, 50); assert.equal(s.intervals_gt_twice_nominal, 1);
  assert.equal(s.health_file_age_at_sample_ms.gt_2000, 1); assert.equal(s.ready_health_but_later_cursor_stale_samples.length, 1);
  assert.equal(s.stop_after_last_sample_ms, 15000);
});
test('bad JSONL and non-object fragments are preserved as line/hash diagnostics', () => {
  const p = parseJsonl(Buffer.from('{"ok":1}\n{"broken":\n"fragment"\n'));
  assert.equal(p.records.length, 1); assert.equal(p.bad.length, 2);
  assert.deepEqual(p.bad.map(x => x.line), [2, 3]); assert.equal(p.bad[0].sha256.length, 64);
});
test('natural source alerts count paired checkpoints separately from events; unlogged ACK remains unmeasured', () => {
  const events = ['s', 'n'].map(event_id => ({ event_id, event_kind: 'market.source.freshness_degraded', source_symbol: 'BTCUSDT', last_response_at: iso(0) }));
  const sources = ['supervisor', 'binance'].map(p => ({ source_tick_id: `watchdog:${p}:BTCUSDT:checkpoint` }));
  const logs = [{ kind: 'alert_committed', event_kind: events[0].event_kind, inserted: true, event_id: 's', origin_at: iso(2000), detected_at: iso(2200), commit_ack_at: iso(2500), elapsed_ms: 500 }];
  const a = naturalAlerts(events, sources, logs);
  assert.equal(a.freshness_checkpoints_ms, 1); assert.equal(a.paired_checkpoints_ms, 1);
  assert.equal(a.source_events_without_ack_measurement, 1); assert.equal(a.by_kind[events[0].event_kind].origin_to_ack_ms.max, 500);
});
test('assessment rejects archive tampering and target actor lifecycle mismatches before reporting results', () => {
  const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
  const { assess } = require('../r01-freshness-assessment.cjs');
  const root = path.resolve(__dirname, '../..'), scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'r01-assessment-'));
  try {
    const window = path.join(scratch, 'window'), target = path.join(scratch, 'target');
    fs.cpSync(path.join(root, 'docs/audit/evidence/r01-window-20261004'), window, { recursive: true });
    fs.cpSync(path.join(root, 'docs/audit/evidence/r01-freshness-20261004/target-attempt-01'), target, { recursive: true });
    const metaFile = path.join(target, 'target-readback.json'), meta = JSON.parse(fs.readFileSync(metaFile));
    fs.writeFileSync(metaFile, JSON.stringify({ ...meta, actorActive: true }));
    assert.throws(() => assess(window, target), /R01_TARGET_PROVENANCE/);
    fs.writeFileSync(metaFile, JSON.stringify(meta));
    fs.appendFileSync(path.join(window, 'attempt-01/receipt.json'), ' ');
    assert.throws(() => assess(window, target), /R01_ARCHIVE_HASH/);
  } finally { fs.rmSync(scratch, { recursive: true, force: true }); }
});
test('readback configuration failure is retained and a nonempty attempt cannot replace its failure', () => {
  const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), { spawnSync } = require('node:child_process');
  const root = path.resolve(__dirname, '../..'), scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'r01-readback-failure-'));
  try {
    const out = path.join(scratch, 'attempt'), args = ['scripts/r01-freshness-readback.cjs', 'docs/audit/evidence/r01-window-20261004', out];
    const options = { cwd: root, env: { ...process.env, DATABASE_URL: '' }, encoding: 'utf8' };
    assert.equal(spawnSync(process.execPath, args, options).status, 1);
    const before = fs.readFileSync(path.join(out, 'failure.json'));
    const failure = JSON.parse(before);
    assert.equal(failure.reason, 'R01_DATABASE_CONFIG'); assert.equal(failure.writes, false);
    assert.equal(failure.newLiveWindow, 'NOT RUN');
    assert.equal(spawnSync(process.execPath, args, options).status, 1);
    assert.deepEqual(fs.readFileSync(path.join(out, 'failure.json')), before);
    assert.equal(fs.existsSync(path.join(out, 'target-readback.json')), false);
  } finally { fs.rmSync(scratch, { recursive: true, force: true }); }
});
