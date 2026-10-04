// Owned, bounded real-source evaluation. Never creates a local database or production actor.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const { parseArgs } = require('node:util');
const { targetUrl, client, connectionMode } = require('./lib/r01-db.cjs');
const { approval } = require('./binance-supervisor.cjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const permissions = ['public-market-read', 'append-market-facts', 'dispatch-market-facts'];
const forbidden = ['trading', 'withdrawals', 'customer-display', 'redistribution', 'commercial-use', 'permanent-production'];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function validateScope(s, p, now = Date.now()) {
  if (s.schema !== 'quantos-binance-evaluation-scope/v1' || s.enabled !== true
      || s.provider !== 'binance.spot.aggtrades' || s.purpose !== 'internal-engineering-evaluation'
      || s.environment !== 'foreground-existing-supabase' || s.endpoint !== 'https://data-api.binance.vision/'
      || !same(s.symbols, ['BTCUSDT', 'ETHUSDT']) || s.runtime_seconds !== 1800 || s.sample_seconds !== 15
      || s.poll_ms !== 1000 || s.worker_iterations !== 100 || s.max_source_ticks !== 200000 || s.max_events !== 500000
      || !same(s.permissions, permissions) || !same(s.forbidden_uses, forbidden)
      || s.actor_lifecycle !== 'create-owned-service-actor-and-deactivate-on-exit'
      || s.retention !== 'retain-immutable-evaluation-facts-in-existing-supabase'
      || !s.scope_id || !s.authorization_evidence || !s.approval_file || !s.approval_reference || !s.approval_version
      || !(Date.parse(s.expires_at) > now) || p.provider !== s.provider || p.enabled !== true
      || s.approval_reference !== p.approval_reference || s.approval_version !== p.approval_version
      || s.expires_at !== p.expires_at || s.symbols.some(x => !p.instruments?.[x])) throw Error('R01_WINDOW_SCOPE');
  return s;
}
function loadScope(file, starting = false) {
  if (fs.statSync(file).size > 1048576) throw Error('R01_WINDOW_SCOPE');
  const s = JSON.parse(fs.readFileSync(file));
  if (typeof s.approval_file !== 'string' || fs.statSync(s.approval_file).size > 1048576) throw Error('R01_WINDOW_SCOPE');
  const p = JSON.parse(fs.readFileSync(s.approval_file)).find(x => x.provider === s.provider);
  validateScope(s, p || {});
  approval({ provider: s.provider, approvals: s.approval_file, symbols: s.symbols, fixture: false });
  if (starting && Date.parse(s.expires_at) < Date.now() + (s.runtime_seconds + 120) * 1000) throw Error('R01_WINDOW_EXPIRY_BUDGET');
  return s;
}
function records(dir) {
  return fs.readdirSync(dir).filter(f => /^supervisor\.jsonl(?:\.\d+)?$/.test(f)).flatMap(f =>
    fs.readFileSync(path.join(dir, f), 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)));
}
function resources(pids) {
  const r = spawnSync('ps', ['-o', 'pid=,rss=,pcpu=', '-p', pids.join(',')], { encoding: 'utf8', timeout: 2000 });
  return r.status === 0 ? r.stdout.trim().split('\n').filter(Boolean).map(line => {
    const [pid, rss_kib, cpu_percent] = line.trim().split(/\s+/).map(Number); return { pid, rss_kib, cpu_percent };
  }) : [];
}
async function main(scopeFile, out) {
  const s = loadScope(scopeFile, true); fs.mkdirSync(out, { recursive: true });
  if (fs.readdirSync(out).length) throw Error('R01_WINDOW_EVIDENCE_NOT_EMPTY');
  const sourceFiles = ['scripts/r01-window-check.cjs', 'scripts/binance-supervisor.cjs', 'scripts/lib/r01-db.cjs',
    'services/market-ingestor/src/binance.rs', 'services/market-ingestor/src/main.rs', 'services/market-ingestor/src/cli.rs',
    'crates/quantos-event/src/pg.rs', 'crates/quantos-market/src/lib.rs', 'crates/quantos-market/src/durable.rs', 'Cargo.lock',
    scopeFile, s.approval_file, s.approval_reference];
  const hashes = () => Object.fromEntries(sourceFiles.map(f => [f, digest(fs.readFileSync(f))]));
  const before = hashes(), env = { ...process.env, DATABASE_URL: targetUrl(), QUANTOS_BINANCE_REST_BASE_URL: s.endpoint };
  const binary = path.resolve('target/debug/market-ingestor');
  const build = spawnSync('cargo', ['build', '-p', 'market-ingestor', '--locked'], { encoding: 'utf8' });
  fs.writeFileSync(path.join(out, 'build.log'), build.stdout + build.stderr); if (build.status !== 0) throw Error('R01_WINDOW_BUILD');
  const binaryHash = digest(fs.readFileSync(binary));
  const db = client(env.DATABASE_URL, 'quantos-r01-window'); let child, exit, tenant, actor, failure, result;
  let samples = 0, first, last, steadyTicks = 0;
  const append = (name, x) => fs.appendFileSync(path.join(out, name), JSON.stringify(x) + '\n');
  async function stop() {
    if (child && !exit) {
      child.kill('SIGTERM'); const limit = Date.now() + 30000;
      while (!exit && Date.now() < limit) await delay(100);
      if (!exit) { child.kill('SIGKILL'); throw Error('R01_WINDOW_STOP_TIMEOUT'); }
    }
  }
  const signal = () => { failure = 'R01_WINDOW_INTERRUPTED'; child?.kill('SIGTERM'); };
  process.on('SIGTERM', signal); process.on('SIGINT', signal);
  try {
    await db.connect(); tenant = crypto.randomUUID(); actor = crypto.randomUUID();
    await db.query("insert into quantos.tenants(id,slug,name) values($1,$2,'R01 owned 30 minute window')", [tenant, 'r01-window-' + tenant]);
    await db.query("insert into quantos.actors(id,tenant_id,actor_kind,display_name,service_name) values($1,$2,'service','R01 bounded evaluation',$3)", [actor, tenant, 'r01-window-' + actor]);
    fs.writeFileSync(path.join(out, 'owned-scope.json'), JSON.stringify({ tenant, actor, scope_id: s.scope_id }, null, 2) + '\n');
    const config = { schema: 'quantos-binance-supervisor/v1', tenant, actor, provider: s.provider, approvals: path.resolve(s.approval_file),
      symbols: s.symbols, runtime_seconds: s.runtime_seconds, poll_ms: s.poll_ms, worker_iterations: s.worker_iterations,
      log_dir: out, log_bytes: 1048576, log_files: 5, fixture: false };
    const cfg = path.join(out, 'config.json'); fs.writeFileSync(cfg, JSON.stringify(config, null, 2) + '\n');
    child = spawn(process.execPath, ['scripts/binance-supervisor.cjs', '--config', cfg, '--binary', binary], { env, stdio: ['ignore', 'ignore', 'ignore'] });
    child.on('error', () => { exit = { code: null, reason: 'spawn_error' }; });
    child.on('close', (code, signal) => { exit = { code, signal }; });
    const budget = Date.now() + (s.runtime_seconds + 60) * 1000; let nextSample = 0;
    while (!exit && !failure && Date.now() < budget) {
      // Both policy identity and enabled/expiry are enforced throughout this owned window.
      if (!same(loadScope(scopeFile), s)) throw Error('R01_WINDOW_SCOPE_CHANGED');
      if (Date.now() >= nextSample) {
        let health = null; const h = path.join(out, 'health.json'); if (fs.existsSync(h)) health = JSON.parse(fs.readFileSync(h));
        const rows = (await db.query("select symbol,initial_id::text,next_id::text,last_response_at from quantos.binance_ingestion_cursor where tenant_id=$1 and provider=$2 order by symbol", [tenant, s.provider])).rows;
        const counts = (await db.query("select (select count(*)::int from quantos.market_source_receipt where tenant_id=$1 and source_tick_id like '%:agg:%') ticks,(select count(*)::int from quantos.event_log where tenant_id=$1) events,(select count(*)::int from quantos.outbox_event where tenant_id=$1 and status!='dispatched') pending", [tenant])).rows[0];
        const pids = [child.pid, ...(health?.workers || []).map(w => w.pid)].filter(Number.isInteger);
        const sample = { at: new Date().toISOString(), health, cursors: rows, counts, resources: resources(pids) }; append('samples.jsonl', sample);
        samples++; first ||= sample; last = sample; steadyTicks = counts.ticks;
        if (counts.ticks >= s.max_source_ticks || counts.events >= s.max_events) throw Error('R01_WINDOW_RESOURCE_LIMIT');
        console.log(JSON.stringify({ kind: 'window_sample', at: sample.at, samples, ready: health?.ready || false, ...counts }));
        nextSample = Date.now() + s.sample_seconds * 1000;
      }
      await delay(250);
    }
    if (failure) throw Error(failure);
    if (!exit) throw Error('R01_WINDOW_RUNTIME_BUDGET');
    if (exit.code !== 0) throw Error('R01_WINDOW_SUPERVISOR_EXIT');
    const logs = records(out), start = logs.find(r => r.kind === 'supervisor_started'), end = logs.findLast(r => r.kind === 'supervisor_stopped');
    const elapsed = start && end ? Date.parse(end.at) - Date.parse(start.at) : 0;
    if (elapsed < s.runtime_seconds * 1000 || samples < Math.floor(s.runtime_seconds / s.sample_seconds) * 0.9) throw Error('R01_WINDOW_TOO_SHORT');
    const health = JSON.parse(fs.readFileSync(path.join(out, 'health.json')));
    if (health.workers.some(w => w.pid !== null) || health.ready || health.failure) throw Error('R01_WINDOW_WORKER_LEAK');
    // Drain only this tenant, preserving F05 leases. It is distinct from the measured running window.
    const lease = (await db.query("select coalesce(max(extract(epoch from (lease_expires_at-now())))*1000,0)::int wait_ms from quantos.outbox_event where tenant_id=$1 and status='leased'", [tenant])).rows[0].wait_ms;
    if (lease > 0) await delay(Math.min(31000, lease + 500));
    let delivery;
    for (let n = 0; n < 30; n++) {
      const c = (await db.query("select (select count(*)::int from quantos.outbox_event where tenant_id=$1 and status!='dispatched') pending,(select count(*)::int from quantos.outbox_event where tenant_id=$1) outbox,(select count(*)::int from quantos.inbox_receipt where tenant_id=$1 and consumer_name='binance-supervisor-v1' and status='applied') applied", [tenant])).rows[0];
      delivery = c; if (!c.pending) break;
      const dispatch = spawnSync(binary, ['dispatch', '--tenant', tenant, '--consumer', 'binance-supervisor-v1', '--limit', '1000'],
        { env: { ...env, QUANTOS_TRACE_EXPORT_PATH: path.join(out, 'final-dispatch-trace.jsonl') }, encoding: 'utf8', timeout: 30000 });
      append('drain.jsonl', { at: new Date().toISOString(), before: c, code: dispatch.status });
      if (dispatch.status !== 0) throw Error('R01_WINDOW_DRAIN');
    }
    if (delivery.pending || delivery.outbox !== delivery.applied) throw Error('R01_WINDOW_DELIVERY');
    const cursors = (await db.query("select c.symbol,c.initial_id::text,c.next_id::text,c.last_response_at,(select count(*)::text from quantos.market_source_receipt r where r.tenant_id=c.tenant_id and r.provider=c.provider and r.source_tick_id like c.symbol||':agg:%') unique_ticks,(select min(split_part(source_tick_id,':',3)::bigint)::text from quantos.market_source_receipt r where r.tenant_id=c.tenant_id and r.provider=c.provider and r.source_tick_id like c.symbol||':agg:%') minimum_id,(select max(split_part(source_tick_id,':',3)::bigint)::text from quantos.market_source_receipt r where r.tenant_id=c.tenant_id and r.provider=c.provider and r.source_tick_id like c.symbol||':agg:%') maximum_id from quantos.binance_ingestion_cursor c where tenant_id=$1 and provider=$2 order by symbol", [tenant, s.provider])).rows;
    if (cursors.length !== s.symbols.length || cursors.some(c => BigInt(c.unique_ticks) <= 0n || BigInt(c.unique_ticks) !== BigInt(c.next_id) - BigInt(c.initial_id)
      || c.minimum_id !== c.initial_id || BigInt(c.maximum_id) + 1n !== BigInt(c.next_id))) throw Error('R01_WINDOW_ID_GAP');
    const checkpoints = (await db.query("select e.aggregate_type||':'||e.aggregate_id stream_key,max(e.sequence)::text expected,c.last_sequence::text actual from quantos.event_log e left join quantos.projection_checkpoint c on c.tenant_id=e.tenant_id and c.consumer_name='binance-supervisor-v1' and c.stream_key=e.aggregate_type||':'||e.aggregate_id where e.tenant_id=$1 group by e.aggregate_type,e.aggregate_id,c.last_sequence", [tenant])).rows;
    if (!checkpoints.length || checkpoints.some(c => c.actual !== c.expected)) throw Error('R01_WINDOW_CHECKPOINT');
    const rotations = Object.fromEntries(s.symbols.map(symbol => [symbol, { starts: logs.filter(r => r.kind === 'worker_started' && r.symbol === symbol).length,
      normal_exits: logs.filter(r => r.kind === 'worker_exit' && r.symbol === symbol && r.code === 0).length }]));
    if (Object.values(rotations).some(x => x.starts < 2 || x.normal_exits < 1)) throw Error('R01_WINDOW_ROTATION');
    if (!same(before, hashes()) || digest(fs.readFileSync(binary)) !== binaryHash) throw Error('R01_WINDOW_SOURCE_CHANGED');
    const anomalies = (await db.query("select event_kind,count(*)::int count from quantos.event_log where tenant_id=$1 and event_kind not in ('market.tick.recorded') group by event_kind order by event_kind", [tenant])).rows;
    result = { schema: 'quantos-r01-window/v1', status: 'PASS', sourceCommit: spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim(), workingTreeModified: true,
      sourceHashes: before, binarySha256: binaryHash, target: 'configured Supabase PostgreSQL', connectionMode: connectionMode(env.DATABASE_URL), provider: s.provider, fixture: false,
      authorization: s, tenant, actor, actorActive: false, runtime_seconds: s.runtime_seconds, started_at: start.at, stopped_at: end.at, observed_elapsed_ms: elapsed,
      samples, steadyTicks, cursors, rotations, delivery, checkpoints, anomalies, anomalySla: 'NOT REVALIDATED_BY_SOAK', longRunning24h: 'NOT RUN', systemdDeployment: 'NOT RUN', commercialLicense: 'NOT VERIFIED' };
  } catch (error) { failure = /^R01_/.test(error.message) ? error.message : 'R01_WINDOW_ENVIRONMENT'; }
  finally {
    try { await stop(); } catch { failure ||= 'R01_WINDOW_STOP_TIMEOUT'; }
    if (actor) {
      try { await db.query('update quantos.actors set is_active=false where id=$1 and tenant_id=$2', [actor, tenant]);
        const row = (await db.query('select is_active from quantos.actors where id=$1 and tenant_id=$2', [actor, tenant])).rows[0];
        if (row?.is_active !== false) throw Error('inactive');
      } catch { failure ||= 'R01_WINDOW_ACTOR_CLEANUP'; }
    }
    await db.end().catch(() => {}); process.off('SIGTERM', signal); process.off('SIGINT', signal);
    if (failure) fs.writeFileSync(path.join(out, 'failure.json'), JSON.stringify({ status: 'FAIL', reason: failure, tenant, actor, exit, samples, last }, null, 2) + '\n');
    else fs.writeFileSync(path.join(out, 'receipt.json'), JSON.stringify(result, null, 2) + '\n');
  }
  if (failure) throw Error(failure);
  console.log(JSON.stringify({ status: 'PASS', samples, observed_elapsed_ms: result.observed_elapsed_ms, uniqueTicks: result.cursors.map(c => ({ symbol: c.symbol, count: c.unique_ticks })) }));
}
if (require.main === module) {
  const { values } = parseArgs({ options: { scope: { type: 'string' } } });
  main(values.scope || 'docs/provider-approvals/20261004-binance-window-scope.json',
    path.resolve(process.env.QUANTOS_R01_EVIDENCE_DIR || 'artifacts/r01-window')).catch(() => { console.error('R01_WINDOW_FAILED'); process.exitCode = 1; });
}
module.exports = { validateScope, loadScope };
