#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) {
      continue;
    }
    args.set(value.slice(2), argv[index + 1]);
    index += 1;
  }
  return args;
}

function requireArg(args, key) {
  const value = args.get(key);
  if (!value) {
    throw new Error(`missing required argument --${key}`);
  }
  return value;
}

function renderList(items) {
  if (!items || items.length === 0) {
    return "- none";
  }
  return items.map((item) => `- ${item}`).join("\n");
}

const args = parseArgs(process.argv.slice(2));
const inputPath = requireArg(args, "input");
const outputPath = requireArg(args, "output");
const templatePath = path.resolve(
  "docs/templates/f09_capacity_adr_template.md",
);

const template = fs.readFileSync(templatePath, "utf8");
const payload = JSON.parse(fs.readFileSync(inputPath, "utf8"));

const snapshotThresholds = {
  outbox_oldest_age_secs: "> 60s for 15m",
  dead_letter_ratio: "> 0.001",
  realtime_projection_delay_secs: "> 5s for 15m",
  realtime_quota_utilization: "> 0.70 for 15m",
  risk_query_p95_ms: "> 300ms for 15m",
  portfolio_query_p95_ms: "> 300ms for 15m",
  risk_mv_freshness_secs: "> 60s for 3 checks",
  ops_aggregate_freshness_secs: "> 300s for 3 checks",
  storage_error_rate: "> 0.01",
  secret_rotation_failed: "must be false",
  secret_read_failed: "must be false",
};

const metricRows = Object.entries(payload.snapshot ?? {})
  .map(
    ([name, value]) =>
      `| ${name} | ${JSON.stringify(value)} | ${snapshotThresholds[name] ?? "review"} |`,
  )
  .join("\n");

const traceRows = (payload.traceEvidence ?? [])
  .map(
    (trace) =>
      `- \`${trace.subsystem}/${trace.operation}\` \`${trace.status}\` @ ${trace.recorded_at} (${trace.correlation_id})`,
  )
  .join("\n");

const content = template
  .replace("{{generated_at}}", payload.generated_at ?? "unknown")
  .replace("{{incident_window}}", payload.incident_window ?? "unknown")
  .replace("{{alert_ids}}", (payload.alerts ?? []).map((alert) => alert.rule_id).join(", ") || "none")
  .replace("{{correlation_ids}}", (payload.correlation_ids ?? []).join(", ") || "none")
  .replace("{{summary}}", payload.summary ?? "No summary provided.")
  .replace("{{metric_rows}}", metricRows || "| none | none | none |")
  .replace("{{db_fault_result}}", payload.db_fault_result ?? "unknown")
  .replace(
    "{{event_consumer_fault_result}}",
    payload.event_consumer_fault_result ?? "unknown",
  )
  .replace("{{engine_fault_result}}", payload.engine_fault_result ?? "unknown")
  .replace(
    "{{secret_redaction_verified}}",
    String(payload.secret_redaction_verified ?? false),
  )
  .replace("{{metric_sources}}", renderList(payload.metric_sources ?? []))
  .replace("{{trace_rows}}", traceRows || "- none")
  .replace(
    "{{recommended_actions}}",
    renderList(payload.recommended_actions ?? []),
  );

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, content);
