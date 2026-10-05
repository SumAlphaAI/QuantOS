// Actual Supabase + native supervisor/worker. Fixture faults and real-source process faults are separate.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), http = require('node:http');
const { spawn, spawnSync } = require('node:child_process');
const { parseArgs } = require('node:util');
const { targetUrl, client, connectionMode } = require('./lib/r01-db.cjs');
const { Supervisor } = require('./binance-supervisor.cjs');
const { elapsed: preciseElapsed } = require('./r01-window-metrics.cjs');
const { confirmedAlert, anomalyElapsed } = require('./r01-supervision-evidence.cjs');
const delay = ms => new Promise(r => setTimeout(r, ms));
const { values } = parseArgs({ options: { live: { type: 'boolean', default: false } } });
const out = path.resolve(process.env.QUANTOS_R01_EVIDENCE_DIR || 'artifacts/r01-supervision'); fs.mkdirSync(out, { recursive: true });
if (fs.readdirSync(out).length) throw Error('R01_SUPERVISION_EVIDENCE_NOT_EMPTY');
const sourceFiles = ['scripts/binance-supervisor.cjs', 'scripts/lib/r01-db.cjs', 'scripts/r01-supervision-check.cjs',
  'scripts/r01-supervision-evidence.cjs', 'scripts/r01-window-metrics.cjs',
  'services/market-ingestor/src/binance.rs', 'services/market-ingestor/src/main.rs', 'services/market-ingestor/src/cli.rs',
  'crates/quantos-observability/src/service.rs', 'crates/quantos-event/src/pg.rs', 'crates/quantos-market/src/durable.rs',
  'docs/provider-approvals/20261003-binance-public-evaluation.json', 'docs/provider-approvals/20261003-binance-public-evaluation.md'];
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const hashes = () => Object.fromEntries(sourceFiles.map(f => [f, digest(fs.readFileSync(f))]));
const before = hashes(), owned = [], cases = []; let db, child, server, mode = 'good', injected = [], config, exit;
let logs = out;
const env = { ...process.env, DATABASE_URL: targetUrl() };
function records() {
  const lines = fs.readdirSync(logs).filter(f => /^supervisor\.jsonl(?:\.\d+)?$/.test(f) || f === 'commit-evidence.jsonl').flatMap(f => fs.readFileSync(path.join(logs, f), 'utf8').trim().split('\n').filter(Boolean));
  return [...new Set(lines)].map(s => JSON.parse(s));
}
async function until(predicate, timeout = 60000) {
  const started = Date.now();
  while (Date.now() - started < timeout) { const r = await predicate(); if (r) return r; if (exit && !predicate.allowExit) throw Error('R01_SUPERVISOR_EARLY_EXIT'); await delay(100); }
  throw Error('R01_SUPERVISION_TIMEOUT');
}
async function cursor() { return (await db.query('select initial_id,next_id,last_response_at from quantos.binance_ingestion_cursor where tenant_id=$1 and provider=$2 and symbol=$3', [config.tenant, config.provider, 'BTCUSDT'])).rows[0]; }
async function progress(after = 0) { return until(() => records().find(r => r.kind === 'worker_progress' && Date.parse(r.at) > after)); }
async function committed(name, origin, predicate) {
  const r = await until(() => records().map(r => confirmedAlert(r, origin)).find(r => r && predicate(r)));
  const elapsed = anomalyElapsed(r, origin);
  const row = (await db.query('select event_kind,payload,payload_hash,sequence,occurred_at from quantos.event_log where tenant_id=$1 and event_id=$2', [config.tenant, r.event_id])).rows[0];
  if (!row || row.event_kind !== r.event_kind || r.inserted !== true || !Number.isFinite(elapsed) || elapsed < 0 || elapsed > 5000) throw Error('R01_ANOMALY_SLA_FAILED');
  cases.push({ name, status: 'PASS', fixture: !values.live, fault_at: new Date(origin).toISOString(), commit_ack_at: r.commit_ack_at,
    elapsed_ms: elapsed, event_id: r.event_id, producer: r.producer, readback: row });
  console.log(JSON.stringify({ name, elapsed_ms: elapsed, status: 'PASS' })); return r;
}
async function fault(kind) {
  injected = []; const changedAt = Date.now(); mode = kind;
  fs.appendFileSync(path.join(out, 'fault-injections.jsonl'), JSON.stringify({ kind, changedAt: new Date(changedAt).toISOString() }) + '\n');
  const response = await until(() => injected[0]);
  return { ...response, changedAt };
}
async function drain() {
  const leases = (await db.query("select coalesce(max(extract(epoch from (lease_expires_at-now())))*1000,0)::int wait_ms from quantos.outbox_event where tenant_id=$1 and status='leased'", [config.tenant])).rows[0].wait_ms;
  if (leases > 0) await delay(Math.min(31000, leases + 500));
  const r = spawnSync('target/debug/market-ingestor', ['dispatch', '--tenant', config.tenant, '--consumer', 'binance-supervisor-v1', '--limit', '1000'],
    { env: { ...env, QUANTOS_TRACE_EXPORT_PATH: path.join(out, 'final-dispatch-trace.jsonl') }, encoding: 'utf8' });
  fs.writeFileSync(path.join(out, 'final-dispatch.log'), r.stdout + r.stderr); if (r.status !== 0) throw Error('R01_FINAL_DISPATCH');
  const counts = (await db.query("select (select count(*)::int from quantos.outbox_event where tenant_id=$1 and status!='dispatched') pending,(select count(*)::int from quantos.outbox_event where tenant_id=$1) outbox,(select count(*)::int from quantos.inbox_receipt where tenant_id=$1 and consumer_name='binance-supervisor-v1' and status='applied') applied", [config.tenant])).rows[0];
  if (counts.pending || counts.outbox !== counts.applied) throw Error('R01_DELIVERY_FAILED');
  const checkpoints = (await db.query("select e.aggregate_type||':'||e.aggregate_id stream_key,max(e.sequence)::text expected,c.last_sequence::text actual from quantos.event_log e left join quantos.projection_checkpoint c on c.tenant_id=e.tenant_id and c.consumer_name='binance-supervisor-v1' and c.stream_key=e.aggregate_type||':'||e.aggregate_id where e.tenant_id=$1 group by e.aggregate_type,e.aggregate_id,c.last_sequence", [config.tenant])).rows;
  if (!checkpoints.length || checkpoints.some(c => c.actual !== c.expected)) throw Error('R01_CHECKPOINT_FAILED'); return { ...counts, checkpoints };
}
async function stop() {
  if (child && !exit) { child.kill('SIGTERM'); await Promise.race([new Promise(r => child.once('close', r)), delay(15000)]); if (!exit) { child.kill('SIGKILL'); throw Error('R01_SUPERVISOR_STOP_FAILED'); } }
}
async function main() {
  const build = spawnSync('cargo', ['build', '-p', 'market-ingestor', '--locked'], { env, encoding: 'utf8' });
  fs.writeFileSync(path.join(out, 'build.log'), build.stdout + build.stderr); if (build.status !== 0) throw Error('R01_BUILD_FAILED');
  db = client(env.DATABASE_URL, 'quantos-r01-supervision-validation'); await db.connect();
  const tenant = crypto.randomUUID(), actor = crypto.randomUUID(); owned.push({ tenant, actor });
  await db.query("insert into quantos.tenants(id,slug,name) values($1,$2,'R01 supervised bounded evaluation')", [tenant, 'r01-supervision-' + tenant]);
  await db.query("insert into quantos.actors(id,tenant_id,actor_kind,display_name,service_name) values($1,$2,'service','R01 supervised evaluation',$3)", [actor, tenant, 'r01-supervision-' + actor]);
  const provider = values.live ? 'binance.spot.aggtrades' : 'fixture.supervised.' + crypto.randomUUID();
  let approvals = path.resolve('docs/provider-approvals/20261003-binance-public-evaluation.json');
  if (!values.live) {
    const p = JSON.parse(fs.readFileSync(approvals))[0]; p.provider = provider; p.approval_reference = 'fixture:supervisor-target';
    p.expires_at = '2099-01-01T00:00:00Z'; p.license_label = 'fixture-only'; p.dataset = 'fixture.supervised.aggregate.v1';
    approvals = path.join(out, 'fixture-approval.json'); fs.writeFileSync(approvals, JSON.stringify([p], null, 2) + '\n');
    server = http.createServer((req, res) => {
      const q = new URL(req.url, 'http://localhost').searchParams, id = Number(q.get('fromId') || 1000), at = Date.now();
      const selected = mode;
      if (selected !== 'good') {
        const fault = { at, id, mode: selected }; injected.push(fault);
        fs.appendFileSync(path.join(out, 'fault-responses.jsonl'), JSON.stringify(fault) + '\n');
      }
      if (selected === '503') { res.writeHead(503); res.end('{}'); return; }
      if (selected === 'timeout') { setTimeout(() => res.destroy(), 4500); return; }
      if (selected === '429') { mode = 'good'; res.writeHead(429, { 'Retry-After': '3' }); res.end('{}'); return; }
      if (selected === 'malformed') { res.end('{}'); return; }
      const T = selected === 'stale' ? at - 60000 : at;
      if (selected === 'badprice' || selected === 'stale') mode = 'good';
      if (selected === 'draining') {
        mode = 'good';
        setTimeout(() => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify([{ a: id, p: '100.1250', q: '1.00', T, f: id, l: id, m: false }])); }, 350);
        return;
      }
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify([{ a: id, p: selected === 'badprice' ? '-1' : '100.1250', q: '1.00', T, f: id, l: id, m: false }]));
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r)); env.QUANTOS_BINANCE_REST_BASE_URL = 'http://127.0.0.1:' + server.address().port + '/';
  } else env.QUANTOS_BINANCE_REST_BASE_URL = 'https://data-api.binance.vision/';
  config = { schema: 'quantos-binance-supervisor/v1', tenant, actor, provider, approvals, symbols: ['BTCUSDT'], fixture: !values.live,
    capture_commit_evidence: true, log_dir: out, worker_iterations: 1000, poll_ms: 1000, runtime_seconds: 600, log_bytes: 16384, log_files: 5 };
  const cfg = path.join(out, 'config.json'); fs.writeFileSync(cfg, JSON.stringify(config, null, 2) + '\n');
  child = spawn(process.execPath, ['scripts/binance-supervisor.cjs', '--config', cfg], { env, stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = ''; child.stderr.on('data', c => { stderr = (stderr + c.toString()).slice(-4096); });
  child.on('close', (code, signal) => { exit = { code, signal, stderr }; });
  await progress();
  if (!values.live) {
    for (const kind of ['503', 'timeout']) {
      await progress(Date.now()); const f = await fault(kind);
      await committed(kind + '_transport', f.changedAt, r => r.event_kind === 'market.source.freshness_degraded'); mode = 'good'; await progress(Date.now());
    }
    for (const [kind, eventKind] of [['badprice', 'market.tick.quality_failed'], ['stale', 'market.tick.freshness_degraded']]) {
      const f = await fault(kind); const p = await until(() => records().find(r => r.kind === 'binance_page_committed'
        && r.events?.some(e => e.event_kind === eventKind && e.source_tick_id === 'BTCUSDT:agg:' + f.id)));
      const rows = (await db.query("select event_id,event_kind,payload from quantos.event_log where tenant_id=$1 and event_kind=$2 and payload->>'source_tick_id'=$3", [tenant, eventKind, 'BTCUSDT:agg:' + f.id])).rows;
      const elapsed = preciseElapsed(p.write.commit_ack_at, new Date(f.at).toISOString()); if (rows.length !== 1 || elapsed < 0 || elapsed > 5000) throw Error('R01_TICK_SLA_FAILED');
      if (!p.events.some(e => e.event_id === rows[0].event_id)) throw Error('R01_ACK_ID_MISMATCH');
      cases.push({ name: kind, status: 'PASS', fixture: true, fault_at: new Date(f.at).toISOString(), commit_ack_at: p.write.commit_ack_at, elapsed_ms: elapsed, event: rows[0], measurement: 'native COMMIT ACK captured before stdout; response-send origin; exact event_id target readback' });
    }
    const rate = await fault('429'); await committed('rate_limit_exit', rate.at, r => r.event_kind === 'market.source.worker_stopped');
    const backoff = await until(() => records().find(r => r.kind === 'worker_backoff' && Date.parse(r.at) >= rate.at && r.code === 'BINANCE_RATE_LIMIT'));
    await progress(Date.parse(backoff.at)); const starts = records().filter(r => r.kind === 'worker_started' && Date.parse(r.at) >= Date.parse(backoff.at));
    if (!starts.length || Date.parse(starts[0].at) - Date.parse(backoff.at) < 3000) throw Error('R01_RATE_WAIT_SHORTENED');
    cases.push({ name: 'retry_after_respected', status: 'PASS', requested_ms: 3000, actual_ms: Date.parse(starts[0].at) - Date.parse(backoff.at) });
  }
  // Genuine process fault on the owned native child; live mode keeps the official endpoint and fixture=false.
  await progress(Date.now()); let health = JSON.parse(fs.readFileSync(path.join(out, 'health.json')));
  const worker = health.workers[0].pid, stopped = Date.now();
  process.kill(worker, 'SIGSTOP');
  fs.appendFileSync(path.join(out, 'process-faults.jsonl'), JSON.stringify({ signal: 'SIGSTOP', pid: worker, at: new Date(stopped).toISOString() }) + '\n');
  const initial = await cursor();
  await committed('worker_suspended', stopped, r => r.event_kind === 'market.source.freshness_degraded');
  const killed = Date.now(); process.kill(worker, 'SIGKILL');
  fs.appendFileSync(path.join(out, 'process-faults.jsonl'), JSON.stringify({ signal: 'SIGKILL', pid: worker, at: new Date(killed).toISOString() }) + '\n');
  await committed('worker_killed', killed, r => r.event_kind === 'market.source.worker_stopped'); await progress(killed);
  const resumed = (await db.query("select c.initial_id,c.next_id,c.last_response_at,(select coalesce(jsonb_agg(source_tick_id),'[]'::jsonb) from quantos.market_source_receipt r where r.tenant_id=c.tenant_id and r.provider=c.provider and r.source_tick_id like 'BTCUSDT:agg:%') ids from quantos.binance_ingestion_cursor c where c.tenant_id=$1 and c.provider=$2 and c.symbol='BTCUSDT'", [tenant, provider])).rows[0];
  if (BigInt(resumed.next_id) <= BigInt(initial.next_id)) throw Error('R01_RESUME_FAILED');
  const ids = resumed.ids.map(id => BigInt(id.split(':')[2])).sort((a, b) => a < b ? -1 : a > b ? 1 : 0); delete resumed.ids;
  if (BigInt(ids.length) !== BigInt(resumed.next_id) - BigInt(resumed.initial_id) || ids.some((id, i) => id !== BigInt(resumed.initial_id) + BigInt(i))) throw Error('R01_RECOVERY_ID_GAP');
  cases.push({ name: 'resume_identity_span', status: 'PASS', initial, resumed, uniqueTicks: ids.length });
  if (!values.live) {
    const bad = await fault('malformed'); await committed('malformed_quality', bad.at, r => r.event_kind === 'market.source.quality_degraded');
    await until(() => exit || false).catch(e => { if (!exit) throw e; });
    if (exit.code !== 78 || records().some(r => r.kind === 'worker_backoff' && Date.parse(r.at) > bad.at)) throw Error('R01_FATAL_RESTARTED');
  } else { await stop(); if (exit.code !== 0) throw Error('R01_STOP_FAILED'); }
  if (!values.live) {
    mode = 'good'; exit = null; logs = path.join(out, 'rotation'); fs.mkdirSync(logs, { recursive: true });
    const rotationLogs = logs;
    logs = path.join(out, 'graceful'); fs.mkdirSync(logs); exit = undefined;
    config = { ...config, log_dir: logs, worker_iterations: 1000 }; fs.writeFileSync(cfg, JSON.stringify(config, null, 2) + '\n');
    child = spawn(process.execPath, ['scripts/binance-supervisor.cjs', '--config', cfg], { env, stdio: ['ignore', 'ignore', 'ignore'] });
    child.on('close', (code, signal) => { exit = { code, signal }; });
    await progress(); const inflight = await fault('draining'), requestedStop = Date.now(); await stop();
    const ack = records().find(r => r.kind === 'binance_page_committed' && r.events?.some(e => e.source_tick_id === 'BTCUSDT:agg:' + inflight.id));
    const targetPage = (await db.query("select event_id from quantos.event_log where tenant_id=$1 and event_kind='market.tick.recorded' and payload->>'source_tick_id'=$2", [tenant, 'BTCUSDT:agg:' + inflight.id])).rows;
    if (exit.code !== 0 || !ack || Date.parse(ack.write.commit_ack_at) < requestedStop || targetPage.length !== 1
        || !ack.events.some(e => e.event_id === targetPage[0].event_id) || BigInt((await cursor()).next_id) !== BigInt(inflight.id) + 1n) throw Error('R01_GRACEFUL_ACK_FAILED');
    cases.push({ name: 'graceful_stop_retains_inflight_page_ack', status: 'PASS', requested_stop_at: new Date(requestedStop).toISOString(),
      commit_ack_at: ack.write.commit_ack_at, event_id: targetPage[0].event_id, next_id: String(inflight.id + 1) });
    logs = rotationLogs; exit = undefined;
    config = { ...config, log_dir: logs, worker_iterations: 1 }; fs.writeFileSync(cfg, JSON.stringify(config, null, 2) + '\n');
    child = spawn(process.execPath, ['scripts/binance-supervisor.cjs', '--config', cfg], { env, stdio: ['ignore', 'ignore', 'ignore'] });
    child.on('close', (code, signal) => { exit = { code, signal }; });
    await until(() => records().filter(r => r.kind === 'worker_progress').length >= 2);
    if (records().filter(r => r.kind === 'worker_started').length < 2 || records().some(r => r.event_kind === 'market.source.worker_stopped')) throw Error('R01_NORMAL_ROTATION_FAILED');
    cases.push({ name: 'normal_iteration_rotation', status: 'PASS', starts: records().filter(r => r.kind === 'worker_started').length });
    const p = JSON.parse(fs.readFileSync(approvals)); p[0].enabled = false; const revokedAt = Date.now(); fs.writeFileSync(approvals, JSON.stringify(p, null, 2) + '\n');
    await until(() => exit || false).catch(e => { if (!exit) throw e; });
    if (exit.code !== 78 || !records().some(r => r.code === 'R01_APPROVAL_REVOKED')) throw Error('R01_APPROVAL_REVOKE_FAILED');
    cases.push({ name: 'approval_revocation_stops_workers', status: 'PASS', revoked_at: new Date(revokedAt).toISOString() });
    const health = JSON.parse(fs.readFileSync(path.join(logs, 'health.json')));
    if (health.workers.some(w => w.pid !== null) || health.ready !== false) throw Error('R01_OWNED_WORKER_LEAK');
    // Real target read timeout: pg_sleep holds only this owned read connection.
    // The production monitor must discard it before reading the same target again.
    p[0].enabled = true; fs.writeFileSync(approvals, JSON.stringify(p, null, 2) + '\n');
    logs = path.join(out, 'read-recovery'); fs.mkdirSync(logs); exit = undefined; child = undefined;
    config = { ...config, log_dir: logs, worker_iterations: 1000 };
    const supervisor = new Supervisor(config); supervisor.env.QUANTOS_BINANCE_REST_BASE_URL = env.QUANTOS_BINANCE_REST_BASE_URL;
    const factory = supervisor.makeWatchClient.bind(supervisor); let injectedRead = false, readOrigin, runError;
    supervisor.makeWatchClient = () => {
      const connection = factory(), query = connection.query.bind(connection);
      connection.query = (sql, ...args) => {
        if (!injectedRead && typeof sql === 'string' && sql.startsWith('select symbol,last_response_at')) {
          injectedRead = true; readOrigin = Date.now();
          fs.writeFileSync(path.join(logs, 'read-injection.json'), JSON.stringify({ target: 'configured Supabase', writes: false,
            delay_ms: 3000, origin_at: new Date(readOrigin).toISOString() }) + '\n');
          return query('select pg_sleep(3)');
        }
        return query(sql, ...args);
      };
      return connection;
    };
    const running = supervisor.run().catch(e => { runError = e; exit = { code: 1 }; });
    try {
      await until(() => records().some(r => r.kind === 'monitor_connection_replaced')
        && JSON.parse(fs.readFileSync(path.join(logs, 'health.json'))).ready === true);
      await committed('configured_read_timeout_alert', readOrigin, r => r.event_kind === 'market.source.monitor_degraded');
      const replacements = records().filter(r => r.kind === 'monitor_connection_replaced').length;
      if (replacements !== 1 || records().some(r => r.kind === 'supervisor_failure')) throw Error('R01_READ_RECOVERY_FAILED');
      cases.push({ name: 'configured_read_connection_recovery', status: 'PASS', injected_delay_ms: 3000, replacements,
        ready_after_real_cursor_read: true, writes_retried: false });
    } finally { supervisor.stopping = true; await running; }
    if (runError) throw runError;
    const recoveredHealth = JSON.parse(fs.readFileSync(path.join(logs, 'health.json')));
    if (recoveredHealth.workers.some(w => w.pid !== null) || recoveredHealth.failure) throw Error('R01_READ_RECOVERY_STOP_FAILED');
  }
  const duplicates = (await db.query("select count(*)::int groups from (select payload->>'symbol',payload->>'last_response_at',count(*) from quantos.event_log where tenant_id=$1 and event_kind='market.source.freshness_degraded' and payload->>'last_response_at' is not null group by 1,2 having count(*)>1) d", [tenant])).rows[0].groups;
  if (duplicates !== 0) throw Error('R01_SHARED_WATCHDOG_DUPLICATE');
  cases.push({ name: 'shared_watchdog_single_fact_per_checkpoint', status: 'PASS', duplicate_groups: duplicates });
  const delivery = await drain();
  await db.query('update quantos.actors set is_active=false where id=$1 and tenant_id=$2', [actor, tenant]);
  if (JSON.stringify(before) !== JSON.stringify(hashes())) throw Error('R01_SOURCE_CHANGED');
  const receipt = { schema: 'quantos-r01-supervision/v1', status: 'PASS', sourceCommit: spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim(),
    workingTreeModified: spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).stdout.trim().length > 0,
    sourceHashes: before, binarySha256: digest(fs.readFileSync('target/debug/market-ingestor')), target: 'configured Supabase PostgreSQL', connectionMode: connectionMode(env.DATABASE_URL),
    provider: values.live ? 'Binance public REST' : 'loopback injected source', fixture: !values.live, tenant, actor, actorActive: false,
    cases, max_anomaly_elapsed_ms: Math.max(...cases.filter(c => c.elapsed_ms !== undefined).map(c => c.elapsed_ms)), threshold_ms: 5000,
    measurement: 'fault injection / bad response send to native transaction commit ACK or supervisor append ACK; target event readback required', delivery,
    longRunning24h: 'NOT RUN', supervisorProcessDeath: 'requires external service manager', commercialLicense: 'NOT VERIFIED' };
  fs.writeFileSync(path.join(out, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n'); console.log(JSON.stringify({ status: 'PASS', cases: cases.length, max_anomaly_elapsed_ms: receipt.max_anomaly_elapsed_ms }));
}
main().catch(e => { fs.writeFileSync(path.join(out, 'failure.json'), JSON.stringify({ status: 'FAIL', reason: /^R01_/.test(e.message) ? e.message : 'ENVIRONMENT_FAILURE', databaseCode: /^[0-9A-Z]{5}$/.test(e.code || '') ? e.code : undefined, cases }, null, 2) + '\n'); console.error(/^R01_/.test(e.message) ? e.message : 'R01_ENVIRONMENT_FAILURE'); process.exitCode = 1; })
  .finally(async () => { await stop().catch(() => {}); if (server) await new Promise(r => server.close(r)); if (db) { for (const o of owned) await db.query('update quantos.actors set is_active=false where id=$1 and tenant_id=$2', [o.actor, o.tenant]); await db.end(); } });
