const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { Supervisor, RotatingLog } = require('../binance-supervisor.cjs');
test('acceptance ACK and lifecycle survive operational log rotation without duplicate records', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'r01-ack-rotation-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const state = { config: { capture_commit_evidence: true }, log: new RotatingLog(path.join(root, 'log.jsonl'), 150, 2),
    commitEvidence: path.join(root, 'commit-evidence.jsonl'), evidenceBytes: 0, failure: null, stopping: false };
  const record = (kind, fields) => Supervisor.prototype.record.call(state, kind, fields);
  record('supervisor_started'); record('worker_started', { symbol: 'BTCUSDT' });
  for (let n = 0; n < 20; n++) {
    record('binance_page_committed', { events: [{ event_id: 'event-' + n }], write: { commit_ack_at: new Date().toISOString() } });
    record('worker_progress', { input: 1 });
  }
  record('worker_exit', { symbol: 'BTCUSDT', code: 0 }); record('supervisor_stopped');
  const rows = fs.readFileSync(state.commitEvidence, 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(rows.length, 24); assert.equal(rows[0].kind, 'supervisor_started');
  assert.equal(rows.at(-1).kind, 'supervisor_stopped');
  assert.equal(new Set(rows.filter(r => r.events).map(r => r.events[0].event_id)).size, 20);
  assert.equal(fs.readdirSync(root).filter(f => f.startsWith('log.jsonl')).length, 3);
  assert.equal(state.failure, null);
});
