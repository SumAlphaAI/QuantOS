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

export function loadR02Inputs() {
  return {
    plan: text("docs/SumAlpha-QuantOS-Development-Plan.md"),
    snapshot: text("crates/quantos-storage/src/snapshot.rs"),
    postgres: text("crates/quantos-storage/src/pg.rs"),
    storage: text("crates/quantos-storage/src/supabase_storage.rs"),
    postgresTest: text("crates/quantos-storage/tests/postgres_persistence.rs"),
    baseMigration: text("supabase/migrations/20260731100000_data_snapshots_and_quality_gate.sql"),
    immutableMigration: text("supabase/migrations/20260916140000_r02_snapshot_immutability.sql"),
    makefile: text("Makefile"),
    workflow: text(".github/workflows/ci.yml"),
    summaryExists: existsSync(resolve(root, "docs/R02-summary.md")),
    evidenceExists: existsSync(resolve(root, "docs/audit/R02-acceptance-evidence-2026-09-16.md")),
  };
}

export function validateR02(inputs) {
  const failures = [];
  const check = (condition, message) => { if (!condition) failures.push(message); };

  check(taskStatus(inputs.plan, "R01") === "COMPLETED", "dependency R01 is COMPLETED");
  check(taskStatus(inputs.plan, "F06") === "COMPLETED", "dependency F06 is COMPLETED");
  check(taskStatus(inputs.plan, "R02") === "COMPLETED", "R02 development status is COMPLETED");

  for (const marker of [
    "DataSnapshotRecord", "SnapshotWindow", "SnapshotSourceRef", "SnapshotLineageEntry",
    "SnapshotQualityGate", "canonical_json_bytes", "content_hash", "expires_at",
  ]) check(inputs.snapshot.includes(marker), `snapshot contract implements ${marker}`);
  check(inputs.snapshot.includes("rule.tenant_id == snapshot.tenant_id"), "quality rules are bound to the snapshot tenant");
  for (const marker of ['field: "sources"', 'field: "source_license"', 'field: "lineage"']) {
    check(inputs.snapshot.includes(marker), `quality Gate rejects incomplete ${marker}`);
  }
  check(inputs.snapshot.includes("for index in 0..300"), "300 invalid fixtures are exercised");
  check(inputs.snapshot.includes("data_snapshot_hash_is_stable_for_equivalent_inputs"), "equivalent input hash stability is tested");
  check(inputs.snapshot.includes("snapshot_gate_fails_closed_for_cross_tenant_rules_and_incomplete_lineage"), "cross-tenant and incomplete-lineage failures are tested");

  check(inputs.postgres.includes("on conflict (tenant_id, content_hash) do nothing"), "snapshot persistence uses immutable insert deduplication");
  check(!inputs.postgres.includes("quality = quantos.data_snapshots.quality"), "snapshot persistence has no no-op update bypass");
  for (const marker of [
    "where tenant_id = $1 and id = $2",
    "where tenant_id = $1 and content_hash = $2",
    "where tenant_id = $1\n               and symbols @> $2",
  ]) check(inputs.postgres.includes(marker), `snapshot query is tenant scoped: ${marker}`);
  check(inputs.postgresTest.includes("QUANTOS_RUN_R02_POSTGRES_TESTS"), "live PostgreSQL check has explicit opt-in fail-closed behavior");
  check(inputs.postgresTest.includes("p95.as_millis() < 300"), "live PostgreSQL check enforces query P95 under 300ms");

  for (const table of ["quantos.data_snapshots", "quantos.data_snapshot_quality_rules"]) {
    check(inputs.baseMigration.includes(`alter table ${table} enable row level security`) && inputs.baseMigration.includes(`alter table ${table} force row level security`), `${table} enables and forces RLS`);
  }
  check((inputs.baseMigration.match(/quantos\.is_tenant_member\(tenant_id\)/g) ?? []).length >= 2, "snapshot and quality-rule member policies are tenant bound");
  check(inputs.immutableMigration.includes("trg_data_snapshots_reject_update") && inputs.immutableMigration.includes("before update on quantos.data_snapshots"), "database rejects snapshot updates");

  check(inputs.storage.includes("validate_payload_hash(&manifest.content_hash, &payload)") && inputs.storage.includes("upload_and_register"), "object storage validates payload hashes before registration");
  check(inputs.makefile.includes("r02-check:") && inputs.makefile.includes("r02-live-check:"), "Makefile exposes local and live R02 Gates");
  check(inputs.makefile.includes("cargo test -p quantos-storage --lib"), "default R02 Gate remains local-only");
  check(inputs.workflow.includes("make r02-check"), "main CI runs the R02 source Gate");
  check(inputs.summaryExists && inputs.evidenceExists, "R02 summary and acceptance evidence are checked in");

  return { status: failures.length ? "FAIL" : "PASS", failures };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = validateR02(loadR02Inputs());
  if (report.failures.length) {
    report.failures.forEach((failure) => console.error(`FAIL  ${failure}`));
    process.exitCode = 1;
  } else {
    console.log("R02 Gate PASS: deterministic immutable snapshots, tenant-bound quality Gate, 300 rejection fixtures, RLS migration, storage hash validation and live-check wiring.");
  }
}
