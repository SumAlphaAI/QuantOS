// Offline derivation only. Original archives and immutable target facts are never edited.
const fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib'), crypto = require('node:crypto');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const time = x => typeof x === 'string' && x.length ? Date.parse(x) : NaN;
// Date.parse truncates submillisecond Rust timestamps; retain their fraction for threshold comparisons.
function preciseTime(x) {
  const base = time(x), fraction = typeof x === 'string' ? /\.(\d+)(?:Z|[+-]\d{2}(?::?\d{2})?)$/.exec(x) : null;
  if (!Number.isFinite(base)) return null;
  return BigInt(base) * 1000000n + BigInt(fraction ? fraction[1].padEnd(9, '0').slice(3, 9) : '0');
}
function stats(values, expected = values.length) {
  const xs = values.filter(Number.isFinite).sort((a, b) => a - b);
  const q = p => xs.length ? xs[Math.max(0, Math.ceil(xs.length * p) - 1)] : null;
  const round = x => x === null || x === undefined ? null : Math.round(x * 1000) / 1000;
  return { measured: xs.length, missing: expected - xs.length, min: round(xs[0]), p50: round(q(.5)), p95: round(q(.95)), p99: round(q(.99)),
    max: round(xs.at(-1)), negative: xs.filter(x => x < 0).length,
    gt_2000: xs.filter(x => x > 2000).length, gt_5000: xs.filter(x => x > 5000).length };
}
function tickClocks(row, ack) {
  const event = preciseTime(row.event_time), received = preciseTime(row.received_at), detected = preciseTime(row.detected_at);
  const committed = Number.isFinite(ack) ? BigInt(ack) * 1000000n : null;
  const diff = (a, b) => a === null || b === null ? NaN : Number(a - b) / 1000000;
  return { source_age_ms: diff(received, event), processing_to_detection_ms: diff(detected, received),
    source_age_at_detection_ms: diff(detected, event), detection_to_progress_ms: diff(committed, detected),
    source_age_at_progress_ms: diff(committed, event), receive_to_progress_ms: diff(committed, received) };
}
function parseJsonl(raw) {
  const records = [], bad = [];
  const lines = raw.toString('utf8').split('\n'); if (lines.at(-1) === '') lines.pop();
  lines.forEach((line, i) => {
    try {
      const r = JSON.parse(line);
      if (!r || typeof r !== 'object' || Array.isArray(r)) throw Error('not_object');
      records.push(r);
    } catch { bad.push({ line: i + 1, bytes: Buffer.byteLength(line), sha256: sha(line) }); }
  });
  return { lines: lines.length, records, bad };
}
function sampling(samples, receipt) {
  const start = time(receipt.started_at), end = time(receipt.stopped_at), nominal = receipt.authorization.sample_seconds * 1000;
  const inside = samples.filter(s => time(s.at) >= start && time(s.at) <= end);
  const intervals = inside.slice(1).map((s, i) => time(s.at) - time(inside[i].at));
  const healthAges = inside.map(s => time(s.at) - time(s.health?.checked_at));
  const symbolSamples = Object.fromEntries(receipt.authorization.symbols.map(symbol => {
    const ages = inside.map(s => time(s.at) - time(s.cursors.find(c => c.symbol === symbol)?.last_response_at));
    return [symbol, { age_at_sample_ms: stats(ages, inside.length), within_2000: ages.filter(x => x >= 0 && x <= 2000).length }];
  }));
  const ready = inside.filter(s => s.health?.ready === true);
  const readyButLaterCursorStale = ready.filter(s => s.cursors.some(c => time(s.at) - time(c.last_response_at) > 2000));
  return { all_samples: samples.length, pre_start: samples.filter(s => time(s.at) < start).length,
    after_stop: samples.filter(s => time(s.at) > end).length, running_samples: inside.length,
    ready_all: samples.filter(s => s.health?.ready === true).length, ready_running: ready.length,
    ready_running_percent: inside.length ? 100 * ready.length / inside.length : null,
    unready_running: inside.filter(s => s.health?.ready === false).length,
    unknown_health_running: inside.filter(s => !s.health || typeof s.health.ready !== 'boolean').length,
    nominal_interval_ms: nominal, interval_ms: stats(intervals), intervals_gt_twice_nominal: intervals.filter(x => x > nominal * 2).length,
    total_cadence_excess_ms: intervals.reduce((sum, x) => sum + Math.max(0, x - nominal), 0),
    first_sample_after_start_ms: inside.length ? time(inside[0].at) - start : null,
    stop_after_last_sample_ms: inside.length ? end - time(inside.at(-1).at) : null,
    health_file_age_at_sample_ms: stats(healthAges, inside.length), symbol_samples: symbolSamples,
    ready_health_but_later_cursor_stale_samples: readyButLaterCursorStale.map(s => s.at),
    pending_max_sample: Math.max(...samples.map(s => s.counts.pending)),
    missing_health_timestamps: healthAges.filter(x => !Number.isFinite(x)).length,
    semantics: 'POINT_SAMPLES_NOT_UPTIME; health read before cursor/count SELECT; at recorded after queries; milliseconds resolution' };
}
function progressIndex(logs) {
  return logs.filter(r => r.kind === 'worker_progress' && Number.isSafeInteger(r.input) && r.input > 0)
    .map(r => ({ symbol: r.symbol, first: BigInt(r.next_id) - BigInt(r.input), next: BigInt(r.next_id), ack: time(r.at) }));
}
function clocksForTicks(rows, progress) {
  const missing = [], ambiguous = [], measurements = [], slowPages = new Map();
  for (const row of rows) {
    const idMatch = /^([^:]+):agg:(\d+)$/.exec(row.source_tick_id || '');
    const candidates = idMatch ? progress.filter(p => p.symbol === idMatch[1] && BigInt(idMatch[2]) >= p.first && BigInt(idMatch[2]) < p.next) : [];
    if (!candidates.length) missing.push(row.event_id);
    if (candidates.length > 1) ambiguous.push(row.event_id);
    const clocks = tickClocks(row, candidates.length === 1 ? candidates[0].ack : NaN);
    measurements.push(clocks);
    if (clocks.detection_to_progress_ms > 5000) {
      const p = candidates[0], key = `${p.symbol}:${p.next}`;
      if (!slowPages.has(key)) slowPages.set(key, { symbol: p.symbol, next_id: p.next.toString(), progress_at: new Date(p.ack).toISOString(), affected_events: 0 });
      slowPages.get(key).affected_events++;
    }
  }
  return { ticks: rows.length, degraded: rows.filter(r => r.quality === 'degraded').length,
    quality_counts: countBy(rows, r => r.quality || 'UNKNOWN'),
    clocks_ms: Object.fromEntries(Object.keys(tickClocks({})).map(key => [key, stats(measurements.map(m => m[key]), rows.length)])),
    progress_missing_event_ids: missing, progress_ambiguous_event_ids: ambiguous,
    detection_to_progress_over_5000_pages: [...slowPages.values()],
    semantics: 'received_at at response headers; detected_at before page SQL; progress log follows COMMIT ACK + stdout scheduling; ingested_at is transaction-start time, never ACK' };
}
function countBy(rows, key) { const out = {}; for (const r of rows) { const k = key(r); out[k] = (out[k] || 0) + 1; } return out; }
function naturalAlerts(events, sources, logs) {
  const acks = logs.filter(r => r.kind === 'alert_committed' && r.inserted === true);
  const knownIds = new Set(events.map(e => e.event_id));
  const unmatchedAcks = acks.filter(r => !knownIds.has(r.event_id));
  const ackIds = new Set(acks.map(r => r.event_id));
  const freshness = events.filter(e => e.event_kind === 'market.source.freshness_degraded');
  const groups = new Map();
  for (const e of freshness) {
    const checkpoint = e.last_response_at === null ? 'startup' : time(e.last_response_at);
    const key = `${e.source_symbol}:${checkpoint}`;
    if (!groups.has(key)) groups.set(key, { symbol: e.source_symbol, checkpoint, logged: 0, unlogged: 0 });
    groups.get(key)[ackIds.has(e.event_id) ? 'logged' : 'unlogged']++;
  }
  return { event_kind_counts: countBy(events.filter(e => e.event_kind !== 'market.tick.recorded'), e => e.event_kind),
    receipt_producers: countBy(sources, s => s.source_tick_id.startsWith('watchdog:supervisor:') ? 'supervisor' : s.source_tick_id.startsWith('watchdog:binance:') ? 'native' : 'UNKNOWN'),
    supervisor_ack_count: acks.length, supervisor_acks_missing_target: unmatchedAcks.map(r => r.event_id),
    by_kind: Object.fromEntries([...new Set(acks.map(r => r.event_kind))].map(kind => {
      const rs = acks.filter(r => r.event_kind === kind);
      return [kind, { count: rs.length, origin_to_ack_ms: stats(rs.map(r => time(r.commit_ack_at) - time(r.origin_at))),
        origin_to_detection_ms: stats(rs.map(r => time(r.detected_at) - time(r.origin_at))),
        detection_to_ack_ms: stats(rs.map(r => time(r.commit_ack_at) - time(r.detected_at))),
        elapsed_field_mismatch: rs.filter(r => time(r.commit_ack_at) - time(r.origin_at) !== r.elapsed_ms).length }];
    })),
    freshness_checkpoints_ms: groups.size, paired_checkpoints_ms: [...groups.values()].filter(g => g.logged > 0 && g.unlogged > 0).length,
    supervisor_only_checkpoints_ms: [...groups.values()].filter(g => g.logged > 0 && g.unlogged === 0).length,
    unlogged_only_checkpoints_ms: [...groups.values()].filter(g => g.logged === 0 && g.unlogged > 0).length,
    multiple_same_producer_checkpoints_ms: [...groups.values()].filter(g => g.logged > 1 || g.unlogged > 1).length,
    source_events_without_ack_measurement: freshness.filter(e => !ackIds.has(e.event_id)).length,
    monitor_read_timeout_log_count: logs.filter(r => r.kind === 'monitor_read_timeout').length,
    timing_semantics: 'freshness origin is last response + 2s, NOT physical fault occurrence; monitor origin is read start; native ACK unmeasured; checkpoint grouping truncates submillisecond precision, NOT outage count' };
}
function assess(windowDir, targetDir) {
  const index = JSON.parse(fs.readFileSync(path.join(windowDir, 'index.json')));
  const verified = [];
  function verifiedBytes(file) {
    const raw = fs.readFileSync(path.join(windowDir, file));
    if (sha(raw) !== index.sha256[file]) throw Error(`R01_ARCHIVE_HASH:${file}`);
    verified.push({ file, sha256: sha(raw) }); return raw;
  }
  const receipt = JSON.parse(verifiedBytes('attempt-01/receipt.json'));
  const manifest = JSON.parse(verifiedBytes('compression-manifest.json'));
  function archive(name) {
    const raw = zlib.gunzipSync(verifiedBytes('attempt-01/' + manifest[name].archive));
    if (sha(raw) !== manifest[name].originalSha256 || raw.length !== manifest[name].originalBytes) throw Error('R01_RAW_HASH');
    return parseJsonl(raw);
  }
  const samples = archive('samples.jsonl'), logs = archive('supervisor.jsonl'), traces = archive('trace.jsonl');
  if (samples.bad.length || logs.bad.length) throw Error('R01_PRIMARY_JSONL_INVALID');
  const metadata = JSON.parse(fs.readFileSync(path.join(targetDir, 'target-readback.json')));
  if (metadata.status !== 'PASS_READ_ONLY_READBACK' || metadata.tenant !== receipt.tenant || metadata.actor !== receipt.actor
    || metadata.readOnly !== 'on' || metadata.writes !== false || metadata.actorActive !== false || metadata.transactionEnd !== 'ROLLBACK'
    || metadata.delivery?.pending !== 0 || metadata.delivery.outbox !== receipt.delivery.outbox || metadata.delivery.applied !== receipt.delivery.applied
    || metadata.sourceReceiptSha256 !== sha(fs.readFileSync(path.join(windowDir, 'attempt-01/receipt.json')))) throw Error('R01_TARGET_PROVENANCE');
  function target(file) {
    const compressed = fs.readFileSync(path.join(targetDir, file)), raw = zlib.gunzipSync(compressed), rows = JSON.parse(raw);
    if (sha(compressed) !== metadata.files[file].sha256 || sha(raw) !== metadata.files[file].rawSha256 || rows.length !== metadata.files[file].rows) throw Error('R01_TARGET_HASH');
    return rows;
  }
  const events = target('target-events.json.gz'), sources = target('target-source-receipts.json.gz');
  const ticks = events.filter(e => e.event_kind === 'market.tick.recorded'), progress = progressIndex(logs.records);
  if (events.length !== receipt.delivery.outbox || ticks.length !== receipt.cursors.reduce((n, c) => n + Number(c.unique_ticks), 0)) throw Error('R01_TARGET_COUNTS');
  return { schema: 'quantos-r01-freshness-assessment/v1', status: 'ASSESSED_DEGRADED_B01_OPEN_PARTIAL',
    historical_window: { started_at: receipt.started_at, stopped_at: receipt.stopped_at, tenant: receipt.tenant, actor: receipt.actor,
      runtime_seconds: receipt.runtime_seconds, scope_id: receipt.authorization.scope_id, expires_at: receipt.authorization.expires_at },
    verified_inputs: verified, target_readback: metadata, sampling: sampling(samples.records, receipt),
    ticks: clocksForTicks(ticks, progress), by_symbol: Object.fromEntries(receipt.authorization.symbols.map(symbol =>
      [symbol, clocksForTicks(ticks.filter(t => t.symbol === symbol), progress)])),
    natural_tick_anomaly_progress: clocksForTicks(events.filter(e => e.event_kind === 'market.tick.freshness_degraded'), progress),
    natural_alerts: naturalAlerts(events, sources, logs.records),
    trace_integrity: { lines: traces.lines, valid_object_records: traces.records.length, invalid_lines: traces.bad,
      complete_trace_timing: 'UNAVAILABLE_CORRUPT_MULTI_PROCESS_JSONL; valid subset not representative' },
    formal_fault_to_commit_sla: 'NOT REVALIDATED_BY_THIS_ASSESSMENT',
    pending_acceptance: ['24h/new scope', 'Linux/systemd deployment', 'parent-launcher/host death notifications', 'commercial license', 'remote same-SHA CI'],
    new_live_window: 'NOT RUN', database_writes: false };
}
if (require.main === module) {
  const [windowDir, targetDir, output] = process.argv.slice(2);
  try {
    if (!windowDir || !targetDir || !output) throw Error('R01_ASSESSMENT_ARGUMENTS');
    const result = assess(path.resolve(windowDir), path.resolve(targetDir));
    fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ status: result.status, ticks: result.ticks.ticks, ready: result.sampling.ready_running_percent }));
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
module.exports = { stats, tickClocks, parseJsonl, sampling, progressIndex, clocksForTicks, naturalAlerts, assess };
