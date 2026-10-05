const { test } = require('node:test');
const assert = require('node:assert/strict');
const { confirmedAlert, anomalyElapsed } = require('./r01-supervision-evidence.cjs');
const origin = Date.parse('2026-10-05T15:12:26.751Z');
const native = { kind: 'binance_watchdog_committed', producer: 'native', inserted: true,
  detected_at: '2026-10-05T15:12:28.666348691Z', event_id: 'owned-event',
  event_kind: 'market.source.freshness_degraded', write: { commit_ack_at: '2026-10-05T15:12:28.785975198Z' } };
test('native watchdog winner is observed when the supervisor append is duplicate', () => {
  const records = [{ ...native, kind: 'alert_duplicate' }, native];
  const result = records.map(r => confirmedAlert(r, origin)).find(Boolean);
  assert.equal(result.producer, 'native');
  assert.equal(result.event_id, native.event_id);
  assert.equal(result.commit_ack_at, native.write.commit_ack_at);
});
test('supervisor winner retains its exact ACK', () => {
  const record = { ...native, kind: 'alert_committed', producer: 'supervisor', commit_ack_at: native.write.commit_ack_at };
  assert.equal(confirmedAlert(record, origin).commit_ack_at, record.commit_ack_at);
});
test('native nanoseconds cannot round a late ACK into the five-second SLA', () => {
  const late = confirmedAlert({ ...native, write: { commit_ack_at: '2026-10-05T15:12:31.751000001Z' } }, origin);
  assert.equal(Date.parse(late.commit_ack_at) - origin, 5000);
  assert(anomalyElapsed(late, origin) > 5000);
  const exact = { ...late, commit_ack_at: '2026-10-05T15:12:31.751000000Z' };
  assert.equal(anomalyElapsed(exact, origin), 5000);
  assert(Number.isNaN(anomalyElapsed({ commit_ack_at: 'invalid' }, origin)));
});
test('duplicates, unconfirmed appends, missing ACKs and old events cannot pass', () => {
  for (const record of [{ ...native, inserted: false }, { ...native, kind: 'alert_duplicate' },
    { ...native, kind: 'alert_commit_unconfirmed' }, { ...native, write: {} },
    { ...native, detected_at: 'invalid' }, { ...native, detected_at: new Date(origin - 1).toISOString() }]) {
    assert.equal(confirmedAlert(record, origin), null);
  }
});
