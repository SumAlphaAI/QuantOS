#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const text = (relative) => readFileSync(resolve(root, relative), "utf8");

function taskStatus(plan, taskId) {
  const match = plan.match(new RegExp("- task_id: `" + taskId + "`([\\s\\S]*?)(?=\\n<a id=|$)"));
  return match?.[1].match(/- development_status: `([^`]+)`/)?.[1] ?? null;
}

export function loadR01Inputs() {
  return {
    plan: text("docs/SumAlpha-QuantOS-Development-Plan.md"),
    source: text("crates/quantos-market/src/lib.rs"),
    crate: text("crates/quantos-market/Cargo.toml"),
    service: text("services/market-ingestor/src/main.rs"),
    fixture: JSON.parse(text("crates/quantos-market/fixtures/market_replay_catalog.json")),
    workspace: text("Cargo.toml"),
    makefile: text("Makefile"),
    workflow: text(".github/workflows/ci.yml"),
    summaryExists: existsSync(resolve(root, "docs/R01-summary.md")),
    evidenceExists: existsSync(resolve(root, "docs/audit/R01-acceptance-evidence-2026-09-16.md")),
  };
}

export function validateR01(inputs) {
  const failures = [];
  const check = (condition, message) => { if (!condition) failures.push(message); };

  check(taskStatus(inputs.plan, "F03") === "COMPLETED", "dependency F03 is COMPLETED");
  check(taskStatus(inputs.plan, "F05") === "COMPLETED", "dependency F05 is COMPLETED");
  check(taskStatus(inputs.plan, "R01") === "COMPLETED", "R01 development status is COMPLETED");
  check(inputs.workspace.includes('"crates/quantos-market"') && inputs.workspace.includes('"services/market-ingestor"'), "workspace includes quantos-market and market-ingestor");
  check(inputs.crate.includes('quantos-event = { path = "../quantos-event"'), "quantos-market writes through quantos-event");

  check(inputs.fixture.count === 100_000, "replay fixture contains exactly 100000 ticks");
  check(inputs.fixture.duplicate_every > 0 && inputs.fixture.out_of_order_every > 1, "replay fixture injects duplicates and out-of-order ticks");
  check(inputs.fixture.stale_every > 0 && inputs.fixture.quality_fail_every > 0, "replay fixture injects freshness and quality failures");

  for (const marker of ["ApprovedProviderRegistry", "MARKET_PROVIDER_NOT_APPROVED", "normalized_symbol", "event_time", "received_at", "license_label", "MarketEventKind", "to_recorded_event", "AppendOnlyLedger"]) {
    check(inputs.source.includes(marker), `market contract implements ${marker}`);
  }
  check(inputs.source.includes("character.is_ascii_alphanumeric() || matches!(character, '/' | '-' | '_')"), "symbol normalization rejects unexpected punctuation");
  check(inputs.source.includes("price.value() <= Decimal::ZERO") && inputs.source.includes("volume.value() <= Decimal::ZERO"), "non-positive price and volume fail quality");
  check(inputs.source.indexOf("self.seen_tick_ids.insert(deduplication_key)") > inputs.source.indexOf("Quantity::parse_str(&tick.volume)"), "deduplication keys are committed only after tick validation");
  check(inputs.source.includes("Duration::from_secs(5)"), "anomaly emission test enforces the five-second bound");

  for (const testName of [
    "replay_dataset_ingests_one_hundred_thousand_ticks_without_parse_failures",
    "out_of_order_and_duplicate_ticks_are_deduplicated",
    "freshness_and_quality_anomalies_emit_events_within_five_seconds",
    "rejects_unapproved_providers_and_normalizes_symbols",
    "invalid_ticks_do_not_poison_deduplication_and_negative_values_fail_quality",
  ]) check(inputs.source.includes(testName), `quantos-market test covers ${testName}`);

  for (const marker of ["GenerateReplay", "IngestReplay", "default_approved_providers", "ingest_batch", "run_observed_command"]) {
    check(inputs.service.includes(marker), `market-ingestor implements ${marker}`);
  }
  check(inputs.makefile.includes("r01-check:") && inputs.makefile.includes("node ./scripts/check-r01.mjs") && inputs.makefile.includes("node --test ./scripts/r01-gate-negative.mjs") && inputs.makefile.includes("cargo test -p quantos-market"), "Makefile exposes replayable R01 positive and negative checks");
  check(inputs.workflow.includes("make r01-check"), "main CI runs the R01 Gate");
  check(inputs.summaryExists && inputs.evidenceExists, "R01 summary and acceptance evidence are checked in");

  return { status: failures.length ? "FAIL" : "PASS", failures };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = validateR01(loadR01Inputs());
  if (report.failures.length) {
    report.failures.forEach((failure) => console.error(`FAIL  ${failure}`));
    process.exitCode = 1;
  } else {
    console.log("R01 Gate PASS: approved-provider ingestion, strict normalization, 100000-tick replay, deduplication, anomaly emission and event-ledger wiring checks.");
  }
}
