// Foreground supervisor. Secrets are inherited, never persisted in configuration or logs.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { parseArgs } = require('node:util');
const { targetUrl, client, connectionMode } = require('./lib/r01-db.cjs');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const canonical = value => JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)));
const hash = value => 'sha256:' + crypto.createHash('sha256').update(canonical(value)).digest('hex');
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);

function validateConfig(c) {
  if (c.schema !== 'quantos-binance-supervisor/v1' || !uuid(c.tenant) || !uuid(c.actor)
      || !/^[a-zA-Z0-9._-]{1,128}$/.test(c.provider) || typeof c.approvals !== 'string'
      || !Array.isArray(c.symbols) || !c.symbols.length || c.symbols.length > 2
      || new Set(c.symbols).size !== c.symbols.length || c.symbols.some(s => !['BTCUSDT', 'ETHUSDT'].includes(s))
      || (c.capture_commit_evidence !== undefined && typeof c.capture_commit_evidence !== 'boolean')
      || (c.fixture !== undefined && typeof c.fixture !== 'boolean')) throw Error('R01_SUPERVISOR_CONFIG');
  c = { worker_iterations: 1000, poll_ms: 1000, max_failures: 5, runtime_seconds: 0,
    log_bytes: 1048576, log_files: 5, fixture: false, capture_commit_evidence: false, ...c };
  for (const [key, min, max] of [['worker_iterations', 1, 1000], ['poll_ms', 1000, 60000],
    ['max_failures', 1, 20], ['runtime_seconds', 0, 86400], ['log_bytes', 4096, 10485760], ['log_files', 1, 10]]) {
    if (!Number.isSafeInteger(c[key]) || c[key] < min || c[key] > max) throw Error('R01_SUPERVISOR_CONFIG');
  }
  if (!path.isAbsolute(c.log_dir)) throw Error('R01_SUPERVISOR_LOG_PATH');
  return c;
}
function approval(c) {
  const bytes = fs.readFileSync(c.approvals);
  if (bytes.length > 1048576) throw Error('R01_APPROVAL_SIZE');
  const rows = JSON.parse(bytes), p = Array.isArray(rows) && rows.find(p => p.provider === c.provider);
  if (!p || p.enabled !== true || !(Date.parse(p.expires_at) > Date.now()) || !p.license_label
      || !p.approval_version || !p.approval_reference || (!c.fixture && rows.some(r => r.approval_reference?.startsWith('fixture:')))
      || !Number.isSafeInteger(p.freshness_sla_secs) || p.freshness_sla_secs < 1 || p.freshness_sla_secs > 2
      || c.symbols.some(s => !/^[A-Z0-9]+\/[A-Z0-9]+$/.test(p.instruments?.[s] || ''))) throw Error('R01_APPROVAL_REQUIRED');
  return p;
}
class RotatingLog {
  constructor(file, bytes, count) { this.file = file; this.bytes = bytes; this.count = count; fs.mkdirSync(path.dirname(file), { recursive: true }); }
  rotate() {
    if (!fs.existsSync(this.file) || fs.statSync(this.file).size < this.bytes) return;
    fs.rmSync(this.file + '.' + this.count, { force: true });
    for (let i = this.count - 1; i >= 1; i--) if (fs.existsSync(this.file + '.' + i)) fs.renameSync(this.file + '.' + i, this.file + '.' + (i + 1));
    fs.renameSync(this.file, this.file + '.1');
  }
  write(value) { this.rotate(); fs.appendFileSync(this.file, JSON.stringify(value) + '\n'); }
}
function exitPolicy(policy, signal, failures) {
  if (policy?.code === 'BINANCE_RATE_LIMIT') {
    const n = policy.retry_after_secs;
    return Number.isSafeInteger(n) && n >= 0 && n <= 604800 && policy.retryable === true
      ? { restart: true, wait_ms: Math.max(1000, n * 1000) } : { restart: false, wait_ms: 0 };
  }
  if (!signal && policy?.retryable !== true) return { restart: false, wait_ms: 0 };
  return { restart: true, wait_ms: Math.min(60000, 1000 * 2 ** Math.min(failures - 1, 6)) };
}
function terminalCode(error) {
  return error instanceof SyntaxError || error.code?.startsWith('ERR_PARSE_ARGS')
    || /^R01_(APPROVAL|SUPERVISOR_CONFIG|SUPERVISOR_LOG_PATH|ACTOR_REQUIRED|WORKER_RESTART_BLOCKED|POOL_MODE|SUPABASE_REQUIRED|SHARED_POOL_REQUIRED|DATABASE_CONFIG)/.test(error.message)
    || error.code === 'ENOENT' ? 78 : 1;
}

class Supervisor {
  constructor(config, binary = path.resolve('target/debug/market-ingestor')) {
    this.config = validateConfig(config); this.binary = path.resolve(binary); approval(this.config);
    this.databaseUrl = targetUrl(); this.instance = crypto.randomUUID(); this.stopping = false;
    this.workers = new Map(); this.alerted = new Map(); this.alerts = [];
    this.pendingAlerts = new Set(); this.failure = null;
    this.log = new RotatingLog(path.join(this.config.log_dir, 'supervisor.jsonl'), this.config.log_bytes, this.config.log_files);
    this.commitEvidence = path.join(this.config.log_dir, 'commit-evidence.jsonl');
    this.evidenceBytes = fs.existsSync(this.commitEvidence) ? fs.statSync(this.commitEvidence).size : 0;
    this.env = { ...process.env, DATABASE_URL: this.databaseUrl };
    delete this.env.QUANTOS_OBSERVABILITY_ADDR;
  }
  record(kind, fields = {}) {
    const row = { kind, at: new Date().toISOString(), instance: this.instance, ...fields };
    try {
      this.log.write(row);
      if (this.config.capture_commit_evidence && ['supervisor_started', 'supervisor_stopped', 'supervisor_failure', 'worker_started', 'worker_exit', 'binance_page_committed', 'binance_watchdog_committed', 'binance_clock_observation', 'alert_committed', 'alert_duplicate', 'alert_commit_unconfirmed', 'alert_sla_missed'].includes(kind)) {
        const bytes = Buffer.from(JSON.stringify(row) + '\n');
        if (this.evidenceBytes + bytes.length > 134217728) { this.failure ||= 'R01_COMMIT_EVIDENCE_LIMIT'; this.stopping = true; return; }
        fs.appendFileSync(this.commitEvidence, bytes); this.evidenceBytes += bytes.length;
      }
    } catch { this.failure ||= 'R01_LOG_PERSISTENCE'; this.stopping = true; }
  }
  fail(code) { if (!this.failure) { this.failure = code; this.record('supervisor_failure', { code }); } this.stopping = true; }
  launch(symbol, previous = {}) {
    if (this.stopping) return;
    const state = { symbol, launchedAt: Date.now(), failures: previous.failures || 0, policy: null, child: null, nextStart: Infinity, cursor: previous.cursor };
    const c = this.config, args = ['binance-rest', '--approvals', c.approvals, '--provider', c.provider,
      '--tenant', c.tenant, '--actor', c.actor, '--symbol', symbol, '--iterations', String(c.worker_iterations), '--poll-ms', String(c.poll_ms)];
    if (c.fixture) args.push('--fixture');
    const trace = path.join(c.log_dir, `worker-${symbol}.trace.jsonl`);
    new RotatingLog(trace, c.log_bytes, c.log_files).rotate();
    const child = spawn(this.binary, args, { env: { ...this.env, QUANTOS_TRACE_EXPORT_PATH: trace, QUANTOS_BINANCE_STOP_STDIN: '1' }, stdio: ['pipe', 'pipe', 'pipe'] });
    child.stdin.on('error', () => {}); // A normally exited worker may close its owned pipe first.
    state.child = child; this.workers.set(symbol, state); this.record('worker_started', { symbol, pid: child.pid });
    let buffer = '';
    child.stdout.on('data', chunk => {
      buffer += chunk.toString();
      if (buffer.length > 2097152) { buffer = ''; this.fail('R01_WORKER_OUTPUT_LIMIT'); return; }
      for (let index; (index = buffer.indexOf('\n')) !== -1;) {
        const line = buffer.slice(0, index); buffer = buffer.slice(index + 1);
        try {
          const value = JSON.parse(line);
          if (value.kind === 'binance_exit') state.policy = value.policy;
          if (['binance_page_committed', 'binance_watchdog_committed', 'binance_clock_observation'].includes(value.kind) && value.symbol === symbol) {
            this.record(value.kind, value);
          }
        } catch { /* Native progress is a bounded public counter. */ }
        const match = /^binance symbol=(BTCUSDT|ETHUSDT) input=(\d+) next_id=(\d+) /.exec(line);
        if (match && match[1] === symbol) { state.failures = 0; state.cursor = match[3]; this.record('worker_progress', { symbol, input: Number(match[2]), next_id: match[3] }); }
      }
    });
    // The native CLI owns a sanitized trace; arbitrary stderr must not become an operational secret sink.
    child.stderr.resume();
    child.on('error', () => this.fail('R01_WORKER_SPAWN'));
    child.on('close', (code, signal) => {
      state.child = null; const observed = Date.now(); this.record('worker_exit', { symbol, code, signal });
      if (this.stopping) return;
      if (code === 0) { state.failures = 0; state.nextStart = observed + 250; return; }
      state.failures++;
      const quality = ['BINANCE_RESPONSE_SCHEMA', 'BINANCE_SOURCE_GAP', 'BINANCE_TIMESTAMP', 'BINANCE_RESPONSE_LIMIT', 'BINANCE_PAGE_LIMIT', 'BINANCE_ID_OVERFLOW'].includes(state.policy?.code);
      this.enqueueAlert(quality ? 'market.source.quality_degraded' : 'market.source.worker_stopped', symbol,
        `exit:${crypto.randomUUID()}`, { reason: quality ? state.policy.code : 'worker_exit', signal: signal || null, exit_code: code }, observed);
      const policy = exitPolicy(state.policy, signal, state.failures);
      if (!policy.restart || state.failures > c.max_failures) { this.fail('R01_WORKER_RESTART_BLOCKED'); return; }
      state.nextStart = observed + policy.wait_ms;
      this.record('worker_backoff', { symbol, wait_ms: policy.wait_ms, code: state.policy?.code || 'PROCESS_SIGNAL' });
    });
  }
  enqueueAlert(kind, symbol, identity, details, origin) {
    const work = this.persistAlert(kind, symbol, identity, details, origin).catch(() => this.fail('R01_ALERT_PERSISTENCE'));
    this.pendingAlerts.add(work); work.finally(() => this.pendingAlerts.delete(work)); return work;
  }
  makeWatchClient() {
    const db = client(this.databaseUrl, 'quantos-binance-watch', 2000);
    db.on('error', () => { if (!this.stopping && this.watchDb === db) this.fail('R01_WATCH_DATABASE'); });
    return db;
  }
  async replaceWatchClient() {
    const previous = this.watchDb; this.watchDb = null;
    // pg query_timeout does not cancel an active backend query. End the read-only
    // connection before retrying, so new reads cannot queue behind that query.
    await previous.end().catch(() => {});
    if (this.stopping) return;
    this.watchDb = this.makeWatchClient();
    await this.watchDb.connect();
    this.record('monitor_connection_replaced');
  }
  async persistAlert(kind, symbol, identity, details, origin) {
    approval(this.config);
    const payload = { provider: this.config.provider, symbol, quality: 'degraded', ...details };
    const eventId = crypto.randomUUID(), correlation = crypto.randomUUID(), occurred = new Date().toISOString();
    const event = { event_id: eventId, tenant_id: this.config.tenant, actor_id: this.config.actor,
      correlation_id: correlation, causation_id: eventId, aggregate_type: 'market', aggregate_id: this.config.provider + ':source',
      sequence: 1, event_kind: kind, schema_version: 'v2', occurred_at: occurred, payload, payload_hash: hash(payload) };
    const sourceIdentity = kind === 'market.source.freshness_degraded' && details.last_response_at
      ? `watchdog:freshness:v2:${symbol}:${details.last_response_at}` : `watchdog:supervisor:${symbol}:${identity}`;
    const appendClock = performance.now();
    const remaining = Math.floor(5000 - (Date.now() - origin));
    // Confirmation timeout and the origin-to-ACK acceptance limit are different clocks.
    // Retain an actual late ACK instead of cutting it off at the SLA boundary.
    const queryBudget = 5000;
    let r;
    try {
      if (!Number.isFinite(remaining) || remaining > 5000) throw Error('R01_ALERT_DEADLINE_OR_CLOCK');
      // Per-query timeout includes pg's connection queue; no retry after an uncertain result.
      r = await this.alertDb.query({ text: 'select inserted,first_sequence from quantos.append_market_source($1,$2,$3,$4,$5,$6::jsonb)',
        values: [this.config.tenant, this.config.actor, this.config.provider, sourceIdentity, hash(payload), JSON.stringify([event])], query_timeout: queryBudget });
    } catch (error) {
      this.record('alert_commit_unconfirmed', { event_kind: kind, symbol, attempted_event_id: eventId, source_identity: sourceIdentity,
        origin_at: new Date(origin).toISOString(), detected_at: occurred, query_budget_ms: Number.isFinite(queryBudget) ? queryBudget : null,
        remaining_origin_budget_ms: Number.isFinite(remaining) ? remaining : null,
        append_ms: performance.now() - appendClock, outcome: 'NO_CONFIRMED_ACK_DO_NOT_RETRY',
        error_code: /^[0-9A-Z]{5}$/.test(error.code || '') ? error.code : error.message === 'Query read timeout' ? 'CLIENT_QUERY_TIMEOUT'
          : error.message === 'R01_ALERT_DEADLINE_OR_CLOCK' ? 'DEADLINE_OR_CLOCK' : 'QUERY_FAILURE' });
      throw Error('R01_ALERT_PERSISTENCE');
    }
    if (!r.rows[0].inserted) { this.record('alert_duplicate', { event_kind: kind, symbol, source_identity: sourceIdentity, producer: 'supervisor' }); return; }
    const committed = Date.now(), receipt = { kind: 'alert_committed', event_kind: kind, symbol, event_id: eventId,
      producer: 'supervisor', source_identity: sourceIdentity, append_ms: performance.now() - appendClock,
      confirmation_timeout_ms: queryBudget, remaining_origin_budget_ms: remaining,
      inserted: r.rows[0].inserted, origin_at: new Date(origin).toISOString(), detected_at: occurred, commit_ack_at: new Date(committed).toISOString(), elapsed_ms: committed - origin };
    this.alerts.push(receipt); if (this.alerts.length > 100) this.alerts.shift(); this.record('alert_committed', receipt);
    if (receipt.elapsed_ms > 5000 || receipt.elapsed_ms < 0) this.record('alert_sla_missed', {
      event_kind: kind, symbol, event_id: eventId, source_identity: sourceIdentity, origin_at: receipt.origin_at,
      commit_ack_at: receipt.commit_ack_at, elapsed_ms: receipt.elapsed_ms, acceptance: 'FAIL_SLA_OR_CLOCK' });
  }
  async watch() {
    let readFailures = 0;
    while (!this.stopping) {
      let p;
      try { p = approval(this.config); } catch { this.fail('R01_APPROVAL_REVOKED'); return; }
      let rows;
      const readStarted = Date.now();
      try {
        rows = (await this.watchDb.query('select symbol,last_response_at from quantos.binance_ingestion_cursor where tenant_id=$1 and provider=$2 and symbol=any($3::text[])',
          [this.config.tenant, this.config.provider, this.config.symbols])).rows;
      } catch (error) {
        if (this.stopping) return;
        if (error.message !== 'Query read timeout') throw error;
        this.healthQuery = { query_started_at: new Date(readStarted).toISOString(), query_completed_at: new Date().toISOString(), status: 'FAILED_TIMEOUT' };
        this.ready = false; readFailures++; this.record('monitor_read_timeout', { consecutive: readFailures });
        if (readFailures === 1) for (const symbol of this.config.symbols) this.enqueueAlert('market.source.monitor_degraded', symbol,
          `monitor:${crypto.randomUUID()}`, { reason: 'monitor_read_timeout' }, readStarted);
        this.writeHealth();
        if (readFailures >= this.config.max_failures) { this.fail('R01_WATCH_READ_CIRCUIT'); return; }
        // Only a read is retried. Never retry an uncertain append/commit or hide a missed SLA.
        await this.replaceWatchClient();
        await delay(250); continue;
      }
      readFailures = 0;
      if (this.stopping) return;
      for (const symbol of this.config.symbols) {
        const state = this.workers.get(symbol), row = rows.find(r => r.symbol === symbol);
        const last = row ? new Date(row.last_response_at).getTime() : this.startedAt;
        const origin = last + p.freshness_sla_secs * 1000, key = row ? new Date(last).toISOString() : 'startup:' + this.instance;
        if (Date.now() > origin && this.alerted.get(symbol) !== key) {
          this.alerted.set(symbol, key);
          this.enqueueAlert('market.source.freshness_degraded', symbol, key,
            { reason: 'binance_poll_unavailable', last_response_at: row ? new Date(last).toISOString() : null }, origin);
        }
        if (state && !state.child && Date.now() >= state.nextStart) this.launch(symbol, state);
      }
      this.healthQuery = { query_started_at: new Date(readStarted).toISOString(), query_completed_at: new Date().toISOString(),
        status: 'SUCCESS', sources: rows.map(r => ({ symbol: r.symbol, last_response_at: new Date(r.last_response_at).toISOString() })) };
      this.ready = rows.length === this.config.symbols.length && rows.every(r => Date.now() - new Date(r.last_response_at).getTime() <= p.freshness_sla_secs * 1000)
        && [...this.workers.values()].every(s => s.child);
      this.writeHealth();
      await delay(250);
    }
  }
  writeHealth() {
    const value = { schema: 'quantos-binance-supervisor-health/v1', checked_at: new Date().toISOString(),
      started_at: this.startedAt ? new Date(this.startedAt).toISOString() : null, instance: this.instance, supervisor_pid: process.pid, status: this.failure ? 'failed' : this.stopping ? 'stopping' : 'running',
      query: this.healthQuery || null, ready: !this.stopping && !this.failure && !!this.ready, connectionMode: connectionMode(this.databaseUrl), workers: [...this.workers.values()].map(s => ({ symbol: s.symbol, pid: s.child?.pid || null, nextStart: Number.isFinite(s.nextStart) ? s.nextStart : null, failures: s.failures, next_id: s.cursor || null })),
      latestAlerts: this.alerts, failure: this.failure };
    const file = path.join(this.config.log_dir, 'health.json'); fs.writeFileSync(file + '.tmp', JSON.stringify(value, null, 2) + '\n'); fs.renameSync(file + '.tmp', file);
  }
  async dispatch() {
    while (!this.stopping) {
      approval(this.config);
      const trace = path.join(this.config.log_dir, 'dispatch.trace.jsonl');
      new RotatingLog(trace, this.config.log_bytes, this.config.log_files).rotate();
      const child = spawn(this.binary, ['dispatch', '--tenant', this.config.tenant, '--consumer', 'binance-supervisor-v1', '--limit', '1000'], { env: { ...this.env, QUANTOS_TRACE_EXPORT_PATH: trace }, stdio: ['ignore', 'ignore', 'ignore'] });
      this.dispatchChild = child;
      this.record('dispatch_started', { pid: child.pid });
      const deadline = setTimeout(() => { child.kill('SIGKILL'); if (!this.stopping) this.fail('R01_DISPATCH_TIMEOUT'); }, 20000);
      const status = await new Promise(resolve => { child.on('error', () => resolve(null)); child.on('close', code => resolve(code)); });
      clearTimeout(deadline);
      this.dispatchChild = null;
      if (status !== 0 && !this.stopping) { this.fail('R01_DISPATCH_FAILED'); return; }
      this.record('dispatch_completed'); await delay(1000);
    }
  }
  async run() {
    this.watchDb = this.makeWatchClient();
    this.alertDb = client(this.databaseUrl, 'quantos-binance-alert', 2000);
    this.alertDb.on('error', () => this.fail('R01_ALERT_DATABASE'));
    let loops = [], timer; const stop = () => { this.stopping = true; };
    process.on('SIGTERM', stop); process.on('SIGINT', stop);
    try {
      await this.watchDb.connect(); await this.alertDb.connect();
      const actor = (await this.watchDb.query("select id from quantos.actors where id=$1 and tenant_id=$2 and is_active and actor_kind='service'", [this.config.actor, this.config.tenant])).rows;
      if (actor.length !== 1) throw Error('R01_ACTOR_REQUIRED');
      this.startedAt = Date.now(); this.record('supervisor_started', { connectionMode: connectionMode(this.databaseUrl), fixture: this.config.fixture });
      for (const symbol of this.config.symbols) this.launch(symbol);
      if (this.config.runtime_seconds) timer = setTimeout(stop, this.config.runtime_seconds * 1000);
      loops = [this.watch(), this.dispatch()].map(p => p.catch(() => { if (!this.stopping) this.fail('R01_SUPERVISOR_LOOP'); }));
      while (!this.stopping) await delay(100);
    } catch (error) { this.fail(error.message === 'R01_ACTOR_REQUIRED' ? 'R01_ACTOR_REQUIRED' : 'R01_SUPERVISOR_START'); }
    finally {
      clearTimeout(timer); this.stopping = true;
      const children = [...this.workers.values()].map(s => s.child).filter(Boolean);
      const closed = children.map(c => c.exitCode !== null || c.signalCode !== null ? Promise.resolve() : new Promise(r => c.once('close', r)));
      children.filter(c => c.exitCode === null && c.signalCode === null).forEach(c => c.stdin.end('stop\n'));
      await new Promise(resolve => {
        const deadline = setTimeout(resolve, 15000);
        Promise.all(closed).then(() => { clearTimeout(deadline); resolve(); });
      });
      const forced = children.filter(c => c.exitCode === null && c.signalCode === null);
      if (forced.length) { this.fail('R01_WORKER_STOP_TIMEOUT'); forced.forEach(c => c.kill('SIGKILL')); }
      await Promise.all(closed);
      // Let the owned dispatcher finish its existing F05 transaction; its deadline still applies.
      await Promise.allSettled(loops); await Promise.allSettled([...this.pendingAlerts]);
      await Promise.allSettled([this.watchDb?.end(), this.alertDb.end()]);
      process.off('SIGTERM', stop); process.off('SIGINT', stop); this.writeHealth(); this.record('supervisor_stopped', { failure: this.failure });
    }
    if (this.failure) throw Error(this.failure);
  }
}
if (require.main === module) {
  (async () => { const { values } = parseArgs({ options: { config: { type: 'string' }, binary: { type: 'string' } } });
    if (!values.config) throw Error('R01_SUPERVISOR_CONFIG_REQUIRED');
    const config = JSON.parse(fs.readFileSync(values.config)); await new Supervisor(config, values.binary).run();
  })().catch(error => { console.error('R01_SUPERVISOR_FAILED'); process.exitCode = terminalCode(error); });
}
module.exports = { Supervisor, RotatingLog, exitPolicy, terminalCode, validateConfig, approval, canonical, hash };
