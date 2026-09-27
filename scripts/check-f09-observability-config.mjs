#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import YAML from "yaml";

const legacy = YAML.parse(fs.readFileSync("docs/operations/f09_alert_rules.yaml", "utf8"));
const capacity = YAML.parse(fs.readFileSync("docs/operations/f09_capacity_alert_rules.yaml", "utf8"));
const dashboard = JSON.parse(fs.readFileSync("docs/operations/f09_capacity_dashboard.json", "utf8"));
const source = fs.readFileSync("crates/quantos-observability/src/lib.rs", "utf8");
const first = legacy.groups.flatMap((group) => group.rules.map((rule) => rule.id)).sort();
const second = capacity.rules.map((rule) => rule.id).sort();
const implementation = [...source.matchAll(/rule_id: "([a-z0-9_]+)"\.to_owned\(\)/g)]
  .map((match) => match[1]).sort();
const displayed = dashboard.panels.flatMap((panel) => [panel.metric, ...(panel.metrics ?? [])])
  .filter(Boolean);
const expectedMetrics = [
  "outbox_oldest_age_secs", "dead_letter_ratio", "realtime_projection_delay_secs",
  "realtime_quota_utilization", "risk_query_p95_ms", "portfolio_query_p95_ms",
  "risk_mv_freshness_secs", "ops_aggregate_freshness_secs", "storage_error_rate",
  "secret_rotation_failed", "secret_read_failed",
];
assert.deepEqual(first, second, "F09 alert YAML definitions drifted");
assert.deepEqual(first, implementation, "F09 alert YAML and Rust evaluator drifted");
assert.deepEqual([...displayed].sort(), [...expectedMetrics].sort(), "F09 dashboard omits a metric");
assert.equal(capacity.evaluation_interval_seconds, 60);
console.log("F09 alert rules and dashboard inventory agree with the evaluator.");
