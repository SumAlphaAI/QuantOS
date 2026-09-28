#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const temporaryDirectory = fs.mkdtempSync(
  path.join(os.tmpdir(), "quantos-f09-adr-"),
);
const output = path.join(temporaryDirectory, "capacity-adr.md");

try {
  execFileSync(
    process.execPath,
    [
      "./scripts/generate-f09-adr-input.mjs",
      "--input",
      "./scripts/fixtures/f09-capacity/complete-window.json",
      "--output",
      output,
    ],
    { stdio: "pipe" },
  );
  const rendered = fs.readFileSync(output, "utf8");
  for (const expected of [
    "outbox_oldest_age_secs",
    "dead_letter_ratio",
    "realtime_projection_delay_secs",
    "risk_query_p95_ms",
    "portfolio_query_p95_ms",
    "risk_mv_freshness_secs",
    "ops_aggregate_freshness_secs",
    "storage_error_rate",
    "secret_rotation_failed",
    "secret_read_failed",
    "storage-adapter",
    "execution-gateway",
  ]) {
    assert.ok(rendered.includes(expected), `ADR output omitted ${expected}`);
  }
  assert.ok(!rendered.includes("{{"), "ADR output contains unresolved template fields");
  const pending = JSON.parse(
    fs.readFileSync("./scripts/fixtures/f09-capacity/complete-window.json", "utf8"),
  );
  pending.db_fault_result = "NOT RUN / NO RECEIPT";
  pending.event_consumer_fault_result = "NOT RUN / NO RECEIPT";
  pending.engine_fault_result = "NOT RUN / NO RECEIPT";
  pending.secret_redaction_verified = false;
  pending.traceEvidence = [];
  const pendingInput = path.join(temporaryDirectory, "pending.json");
  fs.writeFileSync(pendingInput, JSON.stringify(pending));
  execFileSync(process.execPath, [
    "./scripts/generate-f09-adr-input.mjs", "--input", pendingInput,
    "--output", output,
  ]);
  const pendingRendered = fs.readFileSync(output, "utf8");
  assert.ok(pendingRendered.includes("NOT RUN / NO RECEIPT"));
  assert.ok(pendingRendered.includes("Secret redaction verified: `false`"));
  assert.ok(pendingRendered.includes("## Trace Evidence\n\n- none"));
  console.log("F09 ADR input generation checks passed.");
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}
