// Read-only assessment of an existing owned window; never starts ingestion or changes actors.
const fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib'), crypto = require('node:crypto');
const { targetUrl, client, connectionMode } = require('./lib/r01-db.cjs');
const digest = b => crypto.createHash('sha256').update(b).digest('hex');
async function main(windowDir, out, failedWindow = false) {
  const receiptPath = path.join(windowDir, failedWindow ? 'attempt-01/failure.json' : 'attempt-01/receipt.json');
  const receiptBytes = fs.readFileSync(receiptPath), r = JSON.parse(receiptBytes);
  if (failedWindow) {
    const c = JSON.parse(fs.readFileSync(path.join(windowDir, 'attempt-01/config.json')));
    const owned = JSON.parse(fs.readFileSync(path.join(windowDir, 'attempt-01/owned-scope.json')));
    if (r.status !== 'FAIL' || c.fixture !== false || c.runtime_seconds !== 1800
        || JSON.stringify(c.symbols) !== JSON.stringify(['BTCUSDT', 'ETHUSDT'])
        || r.tenant !== c.tenant || r.actor !== c.actor || owned.tenant !== r.tenant || owned.actor !== r.actor) throw Error('R01_READBACK_FAILED_SCOPE');
    r.provider = c.provider;
  } else if (r.fixture !== false || r.authorization?.runtime_seconds !== 1800 || !r.tenant || !r.actor) throw Error('R01_READBACK_SCOPE');
  fs.mkdirSync(out, { recursive: true });
  if (fs.readdirSync(out).length) throw Error('R01_READBACK_EVIDENCE_NOT_EMPTY');
  let db, phase = 'connect';
  const evidence = { schema: 'quantos-r01-freshness-readback/v1', sourceReceiptSha256: digest(receiptBytes),
    tenant: r.tenant, actor: r.actor, target: 'configured Supabase PostgreSQL', connectionMode: 'UNKNOWN',
    newLiveWindow: 'NOT RUN', writes: false, files: {}, ...(failedWindow ? { sourceWindowStatus: 'FAIL', sourceEvidenceFile: 'attempt-01/failure.json' } : {}) };
  const save = (name, rows) => {
    const raw = Buffer.from(JSON.stringify(rows) + '\n'), archive = zlib.gzipSync(raw);
    fs.writeFileSync(path.join(out, name), archive, { flag: 'wx' });
    evidence.files[name] = { sha256: digest(archive), rawSha256: digest(raw), rows: rows.length };
  };
  try {
    const url = targetUrl(); evidence.connectionMode = connectionMode(url);
    db = client(url, 'quantos-r01-freshness-read-only', 20000);
    await db.connect();
    await db.query('begin isolation level repeatable read read only');
    evidence.readOnly = (await db.query('show transaction_read_only')).rows[0].transaction_read_only;
    const events = []; let cursor = null, pages = 0;
    // Bound each response while retaining one repeatable-read snapshot and exact ordering.
    while (true) {
      phase = `events_page_${pages}`;
      const page = (await db.query(`select aggregate_type,aggregate_id,event_id::text,event_kind,sequence::text,
      occurred_at::text,ingested_at::text,payload->>'provider_symbol' symbol,
      payload->>'source_tick_id' source_tick_id,payload->>'event_time' event_time,
      payload->>'received_at' received_at,payload->>'detected_at' detected_at,
      payload->>'quality' quality,payload->>'anomaly_reason' anomaly_reason,
      payload->>'symbol' source_symbol,payload->>'last_response_at' last_response_at,
      payload->>'reason' source_reason from quantos.event_log e
      where e.tenant_id=$1 and ($2::text is null or (e.aggregate_type,e.aggregate_id,e.sequence,e.event_id)>($2::text,$3::text,$4::bigint,$5::uuid))
      order by e.aggregate_type,e.aggregate_id,e.sequence,e.event_id limit 500`,
      [r.tenant, cursor?.aggregate_type || null, cursor?.aggregate_id || null, cursor?.sequence || '0', cursor?.event_id || null])).rows;
      pages++;
      for (const { aggregate_type, aggregate_id, ...row } of page) events.push(row);
      if (events.length > 500000) throw Error('R01_READBACK_EVENT_LIMIT');
      if (page.length < 500) break;
      cursor = page.at(-1);
    }
    evidence.eventPagination = { mode: 'keyset', page_size: 500, pages };
    phase = 'source_receipts';
    const sources = (await db.query(`select source_tick_id,event_count,event_time::text,created_at::text
      from quantos.market_source_receipt where tenant_id=$1 and provider=$2
      and source_tick_id like 'watchdog:%' order by source_tick_id`, [r.tenant, r.provider])).rows;
    evidence.actorActive = (await db.query('select is_active from quantos.actors where tenant_id=$1 and id=$2', [r.tenant, r.actor])).rows[0]?.is_active;
    evidence.delivery = (await db.query(`select
      (select count(*)::int from quantos.outbox_event where tenant_id=$1) outbox,
      (select count(*)::int from quantos.outbox_event where tenant_id=$1 and status!='dispatched') pending,
      (select count(*)::int from quantos.inbox_receipt where tenant_id=$1 and consumer_name='binance-supervisor-v1' and status='applied') applied`, [r.tenant])).rows[0];
    await db.query('rollback'); evidence.transactionEnd = 'ROLLBACK';
    save('target-events.json.gz', events); save('target-source-receipts.json.gz', sources);
    if (evidence.readOnly !== 'on' || evidence.actorActive !== false || (!failedWindow && (events.length !== r.delivery.outbox
      || evidence.delivery.outbox !== r.delivery.outbox || evidence.delivery.pending !== 0 || evidence.delivery.applied !== r.delivery.applied))) throw Error('R01_READBACK_MISMATCH');
    if (failedWindow && events.length !== evidence.delivery.outbox) throw Error('R01_READBACK_FAILED_COUNTS');
    evidence.status = failedWindow ? 'READ_ONLY_FAILED_WINDOW_SNAPSHOT' : 'PASS_READ_ONLY_READBACK';
    evidence.checked_at = new Date().toISOString();
    fs.writeFileSync(path.join(out, 'target-readback.json'), JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ status: evidence.status, events: events.length, actorActive: evidence.actorActive }));
  } catch (error) {
    if (db) await db.query('rollback').catch(() => {});
    evidence.status = 'FAIL'; evidence.reason = /^R01_/.test(error.message) ? error.message : 'R01_READBACK_ENVIRONMENT';
    evidence.checked_at = new Date().toISOString(); evidence.failedPhase = phase;
    evidence.errorCode = error.message === 'Query read timeout' ? 'CLIENT_QUERY_TIMEOUT' : /^[0-9A-Z]{5}$/.test(error.code || '') ? error.code : 'QUERY_OR_CONNECTION_FAILURE';
    fs.writeFileSync(path.join(out, 'failure.json'), JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
    throw Error(evidence.reason);
  } finally { if (db) await db.end().catch(() => {}); }
}
if (require.main === module) {
  const failedWindow = process.argv.includes('--failed-window');
  const [input, out] = process.argv.slice(2).filter(x => x !== '--failed-window');
  if (!input || !out) { console.error('usage: r01-freshness-readback.cjs WINDOW_DIR NEW_EMPTY_DIR'); process.exitCode = 1; }
  else main(path.resolve(input), path.resolve(out), failedWindow).catch(() => { console.error('R01_READBACK_FAILED'); process.exitCode = 1; });
}
module.exports = { main };
