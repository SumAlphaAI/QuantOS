// Offline measurement of an owned window. No database writes or inferred ACKs.
const fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib'), crypto = require('node:crypto');
const { stats, parseJsonl, sampling } = require('./r01-freshness-assessment.cjs');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
function instant(value) {
  const ms = typeof value === 'string' ? Date.parse(value) : NaN;
  if (!Number.isFinite(ms)) return null;
  const fraction = /\.(\d+)(?:Z|[+-]\d{2}(?::?\d{2})?)$/.exec(value);
  return BigInt(ms) * 1000000n + BigInt(fraction ? fraction[1].padEnd(9, '0').slice(3, 9) : '0');
}
function elapsed(end, start) {
  const a = instant(end), b = instant(start);
  return a === null || b === null ? NaN : Number(a - b) / 1000000;
}
function ackIndex(records) {
  const index = new Map();
  function add(event, ack, receipt) {
    if (!event.event_id) throw Error('R01_ACK_EVENT_ID');
    if (index.has(event.event_id)) throw Error('R01_ACK_AMBIGUOUS');
    if (instant(ack) === null) throw Error('R01_ACK_TIMESTAMP');
    index.set(event.event_id, { event, ack, receipt });
  }
  for (const r of records) {
    if (r.kind === 'binance_page_committed') {
      if (!Array.isArray(r.events) || !r.write) throw Error('R01_ACK_PAGE');
      for (const e of r.events) add(e, r.write.commit_ack_at, r);
    } else if (['binance_watchdog_committed', 'alert_committed'].includes(r.kind) && r.inserted === true) {
      add(r, r.write?.commit_ack_at || r.commit_ack_at, r);
    }
  }
  return index;
}
function measurements(events, index) {
  const clocks = { source_age_ms: [], processing_to_detection_ms: [], source_age_at_detection_ms: [],
    detection_to_ack_ms: [], receive_to_ack_ms: [], source_age_at_ack_ms: [] };
  for (const e of events) {
    const a = index.get(e.event_id);
    if (!a || a.event.event_kind !== e.event_kind) throw Error('R01_ACK_TARGET_MISSING');
    for (const k of ['source_tick_id', 'event_time', 'received_at', 'detected_at']) {
      if (a.event[k] !== e[k]) throw Error('R01_ACK_TARGET_FIELDS');
    }
    clocks.source_age_ms.push(elapsed(e.received_at, e.event_time));
    clocks.processing_to_detection_ms.push(elapsed(e.detected_at, e.received_at));
    clocks.source_age_at_detection_ms.push(elapsed(e.detected_at, e.event_time));
    clocks.detection_to_ack_ms.push(elapsed(a.ack, e.detected_at));
    clocks.receive_to_ack_ms.push(elapsed(a.ack, e.received_at));
    clocks.source_age_at_ack_ms.push(elapsed(a.ack, e.event_time));
  }
  return { events: events.length, degraded: events.filter(e => e.quality === 'degraded').length,
    clocks_ms: Object.fromEntries(Object.entries(clocks).map(([k, v]) => [k, stats(v, events.length)])),
    semantics: 'Event weighted; received_at is response headers; exact client COMMIT ACK, not ingested_at or progress; cross-clock source age is uncorrected.' };
}
function sourceAlerts(events, index, sources) {
  const groups = new Map(), kinds = new Map(), producers = {};
  const sourceIds = sources && new Map(sources.map(s => [s.source_tick_id, s]));
  for (const e of events.filter(e => e.event_kind !== 'market.tick.recorded' && !e.source_tick_id)) {
    const a = index.get(e.event_id);
    if (!a || a.event.event_kind !== e.event_kind) throw Error('R01_SOURCE_ACK_MISSING');
    const r = a.receipt, producer = r.producer || 'supervisor';
    // PostgreSQL stores microseconds; the native UTC receipt may retain nanoseconds.
    if (e.occurred_at && (!(elapsed(r.detected_at, e.occurred_at) >= 0) || elapsed(r.detected_at, e.occurred_at) >= 0.001)) throw Error('R01_SOURCE_TARGET_DETECTION');
    if (!Number.isFinite(elapsed(r.detected_at, r.origin_at)) || elapsed(r.detected_at, r.origin_at) < 0) throw Error('R01_SOURCE_ORIGIN_CLOCK');
    if (e.event_kind === 'market.source.freshness_degraded' && e.last_response_at) {
      const threshold = elapsed(r.origin_at, e.last_response_at);
      // Immutable checkpoint has millisecond precision; native origin keeps the DB fraction.
      if (!(threshold >= 2000 && threshold < 2001)) throw Error('R01_SOURCE_THRESHOLD_ORIGIN');
    }
    if (sourceIds && Number(sourceIds.get(r.source_identity)?.event_count) !== 1) throw Error('R01_SOURCE_IDENTITY_RECEIPT');
    producers[producer] = (producers[producer] || 0) + 1;
    if (!kinds.has(e.event_kind)) kinds.set(e.event_kind, []);
    kinds.get(e.event_kind).push({ origin: elapsed(a.ack, r.origin_at), detection: elapsed(a.ack, r.detected_at),
      origin_to_detection: elapsed(r.detected_at, r.origin_at) });
    if (e.event_kind === 'market.source.freshness_degraded' && e.last_response_at) {
      const expected = `watchdog:freshness:v2:${e.source_symbol}:${new Date(Date.parse(e.last_response_at)).toISOString()}`;
      if (r.source_identity !== expected) throw Error('R01_SOURCE_SHARED_IDENTITY');
      const key = `${e.source_symbol}:${Date.parse(e.last_response_at)}`;
      groups.set(key, (groups.get(key) || 0) + 1);
    }
  }
  return { measured_by_producer: producers, by_kind: Object.fromEntries([...kinds].map(([kind, rows]) => [kind, {
    events: rows.length, origin_to_ack_ms: stats(rows.map(r => r.origin)), detection_to_ack_ms: stats(rows.map(r => r.detection)),
    origin_to_detection_ms: stats(rows.map(r => r.origin_to_detection)) }])),
    response_checkpoints: groups.size, duplicate_response_checkpoints: [...groups.values()].filter(n => n > 1).length,
    semantics: 'Freshness origin = last response + approved 2s; monitor origin = query start; these are not a measured physical outage instant. Startup has no response checkpoint.' };
}
function assess(run, target) {
  const inputs = {};
  function bytes(dir, name) {
    const file = path.join(dir, name);
    const b = fs.existsSync(file) ? fs.readFileSync(file) : zlib.gunzipSync(fs.readFileSync(file + '.gz'));
    inputs[file] = sha(b); return b;
  }
  const receiptRaw = bytes(run, 'receipt.json'), r = JSON.parse(receiptRaw);
  if (r.status !== 'PASS_BOUNDED_INTEGRITY' || r.fixture !== false || r.runtime_seconds !== 1800
      || r.actorActive !== false || JSON.stringify(r.authorization.symbols) !== JSON.stringify(['BTCUSDT', 'ETHUSDT'])) throw Error('R01_METRICS_SCOPE');
  const metadata = JSON.parse(bytes(target, 'target-readback.json'));
  if (metadata.status !== 'PASS_READ_ONLY_READBACK' || metadata.readOnly !== 'on' || metadata.writes !== false
      || metadata.actorActive !== false || metadata.transactionEnd !== 'ROLLBACK' || metadata.tenant !== r.tenant
      || metadata.actor !== r.actor || metadata.sourceReceiptSha256 !== sha(receiptRaw)
      || metadata.delivery?.pending !== 0 || metadata.delivery.outbox !== r.delivery.outbox
      || metadata.delivery.applied !== r.delivery.applied) throw Error('R01_METRICS_TARGET_PROVENANCE');
  function rows(name) {
    const gz = bytes(target, name), raw = zlib.gunzipSync(gz), value = JSON.parse(raw), expected = metadata.files[name];
    if (sha(gz) !== expected.sha256 || sha(raw) !== expected.rawSha256 || value.length !== expected.rows) throw Error('R01_METRICS_TARGET_HASH');
    return value;
  }
  const events = rows('target-events.json.gz'), sources = rows('target-source-receipts.json.gz');
  const commits = parseJsonl(bytes(run, 'commit-evidence.jsonl')), samples = parseJsonl(bytes(run, 'samples.jsonl'));
  if (commits.bad.length || samples.bad.length) throw Error('R01_METRICS_JSONL');
  const index = ackIndex(commits.records), targetIds = new Set(events.map(e => e.event_id));
  if (events.length !== r.delivery.outbox || index.size !== events.length || [...index.keys()].some(id => !targetIds.has(id))) throw Error('R01_METRICS_ACK_COUNTS');
  const ticks = events.filter(e => e.event_kind === 'market.tick.recorded');
  if (ticks.length !== r.cursors.reduce((n, c) => n + Number(c.unique_ticks), 0)) throw Error('R01_METRICS_TICKS');
  const pages = commits.records.filter(e => e.kind === 'binance_page_committed');
  const phases = { headers_ms: e => e.transport?.headers_ms, body_ms: e => e.transport?.body_ms,
    decode_ms: e => e.transport?.decode_ms, build_ms: e => e.build_ms,
    begin_ms: e => e.write?.begin_ms, set_local_ms: e => e.write?.set_local_ms,
    sql_ms: e => e.write?.sql_ms, commit_ms: e => e.write?.commit_ms, total_ms: e => e.write?.total_ms };
  const phaseStats = Object.fromEntries(Object.entries(phases).map(([name, f]) => [name, stats(pages.map(f), pages.length)]));
  if (Object.values(phaseStats).some(s => s.missing || s.negative)) throw Error('R01_METRICS_PHASE_MISSING');
  const utcPhaseFields = ['request_started_at', 'headers_received_at', 'body_completed_at', 'decoded_at'];
  const utcPhases = pages.map(p => [...utcPhaseFields.map(k => p.transport?.[k]), p.write?.started_at, p.write?.commit_ack_at]);
  if (utcPhases.some(xs => xs.some(x => instant(x) === null))) throw Error('R01_METRICS_PHASE_CLOCK_MISSING');
  const utcOrderViolations = utcPhases.filter(xs => xs.some((x, i) => i > 0 && elapsed(x, xs[i - 1]) < 0)).length;
  const requestIntervals = Object.fromEntries(r.authorization.symbols.map(symbol => {
    const starts = pages.filter(p => p.symbol === symbol).map(p => p.transport.request_started_at);
    return [symbol, stats(starts.slice(1).map((x, i) => elapsed(x, starts[i])))];
  }));
  const traces = fs.readdirSync(run).filter(n => /\.trace\.jsonl(?:\.\d+)?(?:\.gz)?$/.test(n) || /^final-dispatch-trace\.jsonl(?:\.gz)?$/.test(n)).map(n => n.replace(/\.gz$/, '')).sort().map(name => {
    const parsed = parseJsonl(bytes(run, name)); return { file: name, lines: parsed.lines, invalid_lines: parsed.bad };
  });
  if (!traces.length || traces.some(t => t.invalid_lines.length)) throw Error('R01_METRICS_TRACE_INVALID');
  const tickAnomalies = measurements(events.filter(e => e.event_kind.startsWith('market.tick.') && e.event_kind !== 'market.tick.recorded'), index);
  const alerts = sourceAlerts(events, index, sources);
  const running = samples.records.filter(s => Date.parse(s.at) >= Date.parse(r.started_at) && Date.parse(s.at) <= Date.parse(r.stopped_at));
  const duration = (a, b) => stats(running.map(s => elapsed(s[b], s[a])), running.length);
  const source = measurements(ticks, index);
  const naturalLimits = Object.values(alerts.by_kind).every(k => !k.origin_to_ack_ms.missing && !k.origin_to_ack_ms.gt_5000 && !k.origin_to_ack_ms.negative)
    && !tickAnomalies.clocks_ms.receive_to_ack_ms.missing && !tickAnomalies.clocks_ms.receive_to_ack_ms.gt_5000 && !tickAnomalies.clocks_ms.receive_to_ack_ms.negative;
  return { schema: 'quantos-r01-window-metrics/v1', status: 'ASSESSED_B01_OPEN_PARTIAL', verified_inputs: inputs,
    authorization: r.authorization, tenant: r.tenant, actor: r.actor, actorActive: metadata.actorActive,
    exact_ack_events: index.size, ticks: source, by_symbol: Object.fromEntries(r.authorization.symbols.map(symbol => [symbol, measurements(ticks.filter(e => e.symbol === symbol), index)])),
    natural_tick_anomalies: tickAnomalies, natural_source_alerts: alerts,
    natural_submission_limit: !tickAnomalies.events && !Object.keys(alerts.by_kind).length ? 'NOT_OBSERVED'
      : naturalLimits ? 'PASS_MEASURED_ORIGINS_LE_5S' : 'FAIL_OR_UNMEASURED',
    physical_fault_to_commit: 'SEPARATE_CONTROLLED_FAULT_RECEIPT_REQUIRED',
    phases: { pages: pages.length, utc_phase_order_violations: utcOrderViolations, request_start_intervals_utc_ms: requestIntervals,
      weighting: 'One observation per committed HTTP page; local durations are monotonic; implicit commit is included in SQL time.', milliseconds: phaseStats },
    sampling: { ...sampling(samples.records, r), effective_ready: running.filter(s => s.effective_health?.ready === true).length,
      effective_ready_percent: running.length ? 100 * running.filter(s => s.effective_health?.ready === true).length / running.length : null,
      deadline_lag_ms: stats(running.map(s => s.due_lag_ms), running.length), missed_periods: running.reduce((sum, s) => sum + s.missed_periods, 0),
      cursor_query_ms: duration('cursor_query_started_at', 'cursor_query_completed_at'), counts_query_ms: duration('counts_query_started_at', 'counts_query_completed_at'),
      health_read_to_completion_ms: duration('health_read_at', 'at') },
    duplicate_watchdog_attempts: commits.records.filter(e => e.kind === 'alert_duplicate' || e.kind === 'binance_watchdog_committed' && e.inserted === false).length,
    clock_observations: commits.records.filter(e => e.kind === 'binance_clock_observation'),
    clock_semantics: 'RTT offset bounds only; no timestamp correction, NTP synchronization or provider precision certification.',
    trace_integrity: traces, freshness_acceptance: source.clocks_ms.source_age_at_detection_ms.gt_2000 ? 'DEGRADED' : 'NO_OBSERVED_DEGRADED_TICKS',
    delivery: metadata.delivery, pending_acceptance: ['24h/new scope', 'Linux/systemd', 'parent-launcher/host death notifications', 'commercial license', 'remote same-SHA CI'] };
}
function assessFailed(run, target) {
  const verified = {};
  const read = (dir, name) => {
    const file = path.join(dir, name), raw = fs.existsSync(file) ? fs.readFileSync(file) : zlib.gunzipSync(fs.readFileSync(file + '.gz'));
    verified[file] = sha(raw); return raw;
  };
  const failureBytes = read(run, 'failure.json'), failure = JSON.parse(failureBytes);
  const config = JSON.parse(read(run, 'config.json')), metadata = JSON.parse(read(target, 'target-readback.json'));
  if (failure.status !== 'FAIL' || config.fixture !== false || config.runtime_seconds !== 1800
      || JSON.stringify(config.symbols) !== JSON.stringify(['BTCUSDT', 'ETHUSDT'])
      || metadata.status !== 'READ_ONLY_FAILED_WINDOW_SNAPSHOT' || metadata.sourceWindowStatus !== 'FAIL'
      || metadata.readOnly !== 'on' || metadata.writes !== false || metadata.actorActive !== false
      || metadata.transactionEnd !== 'ROLLBACK' || metadata.sourceReceiptSha256 !== sha(failureBytes)
      || metadata.tenant !== failure.tenant || metadata.actor !== failure.actor
      || config.tenant !== failure.tenant || config.actor !== failure.actor) throw Error('R01_FAILED_METRICS_PROVENANCE');
  const gz = read(target, 'target-events.json.gz'), raw = zlib.gunzipSync(gz), events = JSON.parse(raw), expected = metadata.files['target-events.json.gz'];
  if (sha(gz) !== expected.sha256 || sha(raw) !== expected.rawSha256 || events.length !== expected.rows
      || events.length !== metadata.delivery.outbox) throw Error('R01_FAILED_METRICS_TARGET_HASH');
  const commits = parseJsonl(read(run, 'commit-evidence.jsonl')), samples = parseJsonl(read(run, 'samples.jsonl'));
  if (commits.bad.length || samples.bad.length) throw Error('R01_FAILED_METRICS_JSONL');
  const index = ackIndex(commits.records), targetIds = new Set(events.map(e => e.event_id));
  if ([...index.keys()].some(id => !targetIds.has(id))) throw Error('R01_FAILED_METRICS_EXTRA_ACK');
  const ticks = events.filter(e => e.event_kind === 'market.tick.recorded');
  const anomalies = events.filter(e => e.event_kind.startsWith('market.tick.') && e.event_kind !== 'market.tick.recorded');
  // Known target fields are checked; missing ACKs remain in every expected denominator.
  measurements(events.filter(e => e.source_tick_id && index.has(e.event_id)), index);
  function partialClocks(rows) {
    const ack = e => index.get(e.event_id)?.ack;
    return { events: rows.length, degraded: rows.filter(e => e.quality === 'degraded').length,
      source_age_ms: stats(rows.map(e => elapsed(e.received_at, e.event_time)), rows.length),
      processing_to_detection_ms: stats(rows.map(e => elapsed(e.detected_at, e.received_at)), rows.length),
      source_age_at_detection_ms: stats(rows.map(e => elapsed(e.detected_at, e.event_time)), rows.length),
      receive_to_ack_ms: stats(rows.map(e => elapsed(ack(e), e.received_at)), rows.length),
      detection_to_ack_ms: stats(rows.map(e => elapsed(ack(e), e.detected_at)), rows.length) };
  }
  const sourceEvents = events.filter(e => !e.source_tick_id);
  const sourceByKind = Object.fromEntries([...new Set(sourceEvents.map(e => e.event_kind))].map(kind => {
    const rows = sourceEvents.filter(e => e.event_kind === kind);
    return [kind, { events: rows.length, origin_to_ack_ms: stats(rows.map(e => elapsed(index.get(e.event_id)?.ack, index.get(e.event_id)?.receipt.origin_at)), rows.length) }];
  }));
  const start = commits.records.find(e => e.kind === 'supervisor_started'), end = commits.records.findLast(e => e.kind === 'supervisor_stopped');
  if (!start || !end) throw Error('R01_FAILED_METRICS_LIFECYCLE');
  return { schema: 'quantos-r01-failed-window-metrics/v1', status: 'FAIL_WINDOW_PARTIAL_MEASUREMENT', failure,
    verified_inputs: verified, tenant: failure.tenant, actor: failure.actor, actorActive: false,
    runtime_budget_seconds: 1800, started_at: start.at, stopped_at: end.at, observed_elapsed_ms: elapsed(end.at, start.at),
    target_events: events.length, exact_ack_events: index.size,
    unknown_ack_events: events.filter(e => !index.has(e.event_id)).map(e => ({ event_id: e.event_id, event_kind: e.event_kind, symbol: e.symbol || e.source_symbol })),
    ticks: partialClocks(ticks), natural_tick_anomalies: partialClocks(anomalies), source_alerts: sourceByKind,
    sampling: { ...sampling(samples.records, { started_at: start.at, stopped_at: end.at, authorization: { symbols: config.symbols, sample_seconds: 15 } }),
      effective_ready: samples.records.filter(s => s.effective_health?.ready === true).length,
      missed_periods: samples.records.reduce((n, s) => n + s.missed_periods, 0) },
    unconfirmed_attempts: commits.records.filter(e => e.kind === 'alert_commit_unconfirmed'), delivery: metadata.delivery,
    acceptance: 'FAIL; cannot accumulate short runs or use a later pass to erase this failure; missing ACK is UNKNOWN, not zero latency' };
}
if (require.main === module) {
  const failedWindow = process.argv.includes('--failed-window');
  const [run, target, out] = process.argv.slice(2).filter(x => x !== '--failed-window');
  try {
    if (!run || !target || !out) throw Error('R01_METRICS_ARGUMENTS');
    const result = (failedWindow ? assessFailed : assess)(path.resolve(run), path.resolve(target));
    fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ status: result.status, exact_ack_events: result.exact_ack_events,
      natural_submission_limit: result.natural_submission_limit, freshness_acceptance: result.freshness_acceptance }));
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
module.exports = { instant, elapsed, ackIndex, measurements, sourceAlerts, assess, assessFailed };
