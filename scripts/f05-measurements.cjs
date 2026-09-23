const fs = require('node:fs');
module.exports = function readMeasurements(path, hostedTarget = false) {
  const value = JSON.parse(fs.readFileSync(path, 'utf8'));
  for (const name of ['eventCount', 'uniqueSideEffects', 'dispatched', 'appliedReceipts']) {
    if (value[name] !== 10000) throw new Error(`F05 measured ${name} must equal 10000`);
  }
  const expectedScope = hostedTarget ? 'target-event-id-client-retrieval' : 'complete-client-retrieval';
  if (value.checkpointNextSequence !== 10001 || value.consumerPath !== 'PgEventStore::poll_outbox_once' || value.lookupScope !== expectedScope) throw new Error('F05 measurement scope/checkpoint mismatch');
  if (!Number.isFinite(value.correlationLookupMillis) || value.correlationLookupMillis < 0 || (!hostedTarget && value.correlationLookupMillis > 5000)) throw new Error('F05 retrieval exceeds its measured budget or has no duration');
  if (!Number.isFinite(value.consumptionMillis) || value.consumptionMillis <= 0) throw new Error('F05 consumption duration is missing');
  return value;
};
