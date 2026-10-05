// Either producer may win the shared watchdog's idempotent append.
// Only a confirmed insertion with a native COMMIT ACK is eligible.
function confirmedAlert(record, origin) {
  if (!['alert_committed', 'binance_watchdog_committed'].includes(record.kind)
      || record.inserted !== true || !record.event_id || !record.event_kind) return null;
  const detected = Date.parse(record.detected_at);
  const ack = record.commit_ack_at || record.write?.commit_ack_at;
  if (!Number.isFinite(detected) || detected < origin || !Number.isFinite(Date.parse(ack))) return null;
  return { ...record, commit_ack_at: ack, producer: record.producer || 'supervisor' };
}
module.exports = { confirmedAlert };
