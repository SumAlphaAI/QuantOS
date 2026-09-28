import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import YAML from 'yaml';
import { validateF09RuleContracts } from '../f09-rule-contract.mjs';

const legacy = YAML.parse(fs.readFileSync('docs/operations/f09_alert_rules.yaml', 'utf8'));
const capacity = YAML.parse(fs.readFileSync('docs/operations/f09_capacity_alert_rules.yaml', 'utf8'));
test('F09 rule semantics match the development-plan thresholds', () => {
  validateF09RuleContracts(legacy, capacity);
});
test('unchanged rule IDs cannot hide threshold, duration, count or severity drift', () => {
  for (const patch of [
    { id: 'realtime_quota_utilization', for_seconds: 900 },
    { id: 'storage_error_rate', condition: 'value > 0.1' },
    { id: 'risk_mv_freshness', consecutive_checks: 2 },
    { id: 'outbox_oldest_age', severity: 'warning' },
  ]) {
    const altered = structuredClone(capacity);
    Object.assign(altered.rules.find((r) => r.id === patch.id), patch);
    assert.throws(() => validateF09RuleContracts(legacy, altered));
  }
  const altered = structuredClone(legacy);
  altered.groups[0].rules.find((r) => r.id === 'realtime_quota_utilization').for = '15m';
  assert.throws(() => validateF09RuleContracts(altered, capacity));
});
