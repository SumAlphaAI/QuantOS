import assert from 'node:assert/strict';

// Development-plan thresholds; deployed metric sources and notifications are
// separately accepted in L04. Zero duration means alert on the first breach.
const rules = [
  ['outbox_oldest_age', 60, 900, 0, 'critical'],
  ['dead_letter_ratio', 0.001, 0, 0, 'critical'],
  ['realtime_projection_delay', 5, 900, 0, 'warning'],
  ['realtime_quota_utilization', 0.7, 0, 0, 'warning'],
  ['risk_query_p95_ms', 300, 900, 0, 'critical'],
  ['portfolio_query_p95_ms', 300, 900, 0, 'critical'],
  ['risk_mv_freshness', 60, 0, 3, 'critical'],
  ['ops_aggregate_freshness', 300, 0, 3, 'critical'],
  ['storage_error_rate', 0.01, 0, 0, 'critical'],
  ['secret_rotation_failed', 0, 0, 0, 'critical'],
  ['secret_read_failed', 0, 0, 0, 'critical'],
];

export function validateF09RuleContracts(legacy, capacity) {
  const legacyRules = legacy.groups.flatMap((g) => g.rules);
  assert.deepEqual(legacyRules.map((r) => r.id).sort(), rules.map((r) => r[0]).sort());
  assert.deepEqual(capacity.rules.map((r) => r.id).sort(), rules.map((r) => r[0]).sort());
  assert.equal(capacity.evaluation_interval_seconds, 60);
  for (const [id, threshold, duration, consecutive, severity] of rules) {
    const old = legacyRules.find((r) => r.id === id);
    const current = capacity.rules.find((r) => r.id === id);
    const oldCondition = old.expr.match(/^\S+ (>|==) ([\d.]+)$/);
    const currentCondition = current.condition.match(/^value (>) ([\d.]+)$/);
    assert.ok(oldCondition && currentCondition, `${id}: unrecognized condition`);
    assert.equal(Number(currentCondition[2]), threshold, `${id}: threshold drift`);
    const boolean = id === 'secret_rotation_failed' || id === 'secret_read_failed';
    assert.equal(oldCondition[1], boolean ? '==' : '>', `${id}: operator drift`);
    assert.equal(Number(oldCondition[2]), boolean ? 1 : threshold, `${id}: legacy threshold drift`);
    assert.equal(old.for ?? '0m', `${duration / 60}m`, `${id}: legacy duration drift`);
    assert.equal(current.for_seconds ?? 0, duration, `${id}: duration drift`);
    assert.equal(old.consecutive ?? 0, consecutive, `${id}: legacy count drift`);
    assert.equal(current.consecutive_checks ?? 0, consecutive, `${id}: count drift`);
    assert.equal(old.severity, severity, `${id}: legacy severity drift`);
    assert.equal(current.severity, severity, `${id}: severity drift`);
  }
}
