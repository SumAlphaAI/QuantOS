const fs = require('node:fs');
module.exports = function readMeasurements(path) {
  const value = JSON.parse(fs.readFileSync(path, 'utf8'));
  for (const name of ['eventCount', 'uniqueSideEffects', 'dispatched', 'appliedReceipts']) {
    if (value[name] !== 10000) throw new Error(`F05 measured ${name} must equal 10000`);
  }
  if (value.checkpointNextSequence !== 10001 || value.consumerPath !== 'PgEventStore::poll_outbox_once' || value.lookupScope !== 'complete-client-retrieval') throw new Error('F05 measurement scope/checkpoint mismatch');
  if (!Number.isFinite(value.correlationLookupMillis) || value.correlationLookupMillis < 0 || value.correlationLookupMillis > 5000) throw new Error('F05 complete retrieval exceeds five seconds or has no measured duration');
  if (!Number.isFinite(value.consumptionMillis) || value.consumptionMillis <= 0) throw new Error('F05 consumption duration is missing');
  return value;
};
