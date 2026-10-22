const assert = require('node:assert/strict');

// This table contains transient operational telemetry. Immutable event/audit
// ledgers, workflow state, artifacts and capacity alerts are outside this policy.
const retentionDays = 7;
const batchLimit = 5000;
const expiredCountSql = `select count(*)::text as expired
  from quantos.operational_metric_samples where observed_at < $1`;
const pruneSql = `with expired as (
  select id from quantos.operational_metric_samples
  where observed_at < $1 order by observed_at, id
  limit $2 for update skip locked
)
delete from quantos.operational_metric_samples as sample
using expired where sample.id = expired.id`;

async function maintainMetrics(client, { apply = false, now = new Date(), days = retentionDays, limit = batchLimit } = {}) {
  assert(Number.isInteger(days) && days >= 1 && days <= 365, 'retention days must be 1..365');
  assert(Number.isInteger(limit) && limit >= 1 && limit <= batchLimit, 'batch limit must be 1..5000');
  assert(Number.isFinite(now.getTime()), 'valid maintenance time required');
  const cutoff = new Date(now.getTime() - days * 86400000);
  const before = Number((await client.query(expiredCountSql, [cutoff])).rows[0].expired);
  let deleted = 0;
  if (apply) deleted = (await client.query(pruneSql, [cutoff, limit])).rowCount;
  return { status: apply ? 'APPLIED_BOUNDED_BATCH' : 'READ_ONLY', retentionDays: days,
    cutoff: cutoff.toISOString(), batchLimit: limit, expiredBefore: before, deleted,
    remainingEstimate: before - deleted };
}
module.exports = { maintainMetrics, expiredCountSql, pruneSql, retentionDays, batchLimit };
