const assert = require('node:assert/strict');
// Observe server policy only. Never issue SET or a write to bypass a read-only target.
async function inspectTargetWritability(client) {
  const row = (await client.query(`select current_setting('transaction_read_only') as transaction_read_only,
    current_setting('default_transaction_read_only') as default_transaction_read_only,
    pg_is_in_recovery() as in_recovery`)).rows[0];
  assert(row && ['on', 'off'].includes(row.transaction_read_only) &&
    ['on', 'off'].includes(row.default_transaction_read_only) && typeof row.in_recovery === 'boolean',
  'target database writability observation is incomplete');
  return { schema: 'quantos-target-database-writability/v1',
    transactionReadOnly: row.transaction_read_only, defaultTransactionReadOnly: row.default_transaction_read_only,
    inRecovery: row.in_recovery, status: row.transaction_read_only === 'off' &&
      row.default_transaction_read_only === 'off' && !row.in_recovery ? 'WRITABLE' : 'READ_ONLY' };
}
function requireWritableTarget(observation) {
  if (observation.status !== 'WRITABLE') throw Object.assign(
    Error('TARGET_DATABASE_READ_ONLY: configured Supabase target cannot support Auth or fixture writes'),
    { code: 'TARGET_DATABASE_READ_ONLY' });
}
module.exports = { inspectTargetWritability, requireWritableTarget };
