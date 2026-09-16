import assert from "node:assert/strict";
import test from "node:test";

import { loadR02Inputs, validateR02 } from "./check-r02.mjs";

const current = loadR02Inputs();

test("current R02 repository Gate passes", () => {
  const report = validateR02(current);
  assert.equal(report.status, "PASS", report.failures.join("\n"));
});

const destructiveProbe = (name, inputKey, from, to, expected) => test(name, () => {
  const inputs = { ...current, [inputKey]: current[inputKey].replace(from, to) };
  assert(validateR02(inputs).failures.includes(expected));
});

destructiveProbe("tenant rule binding deletion is rejected", "snapshot", "rule.tenant_id == snapshot.tenant_id", "true", "quality rules are bound to the snapshot tenant");
destructiveProbe("300 fixture regression is rejected", "snapshot", "for index in 0..300", "for index in 0..299", "300 invalid fixtures are exercised");
destructiveProbe("lineage Gate deletion is rejected", "snapshot", 'field: "lineage"', 'field: "removed_lineage"', 'quality Gate rejects incomplete field: "lineage"');
destructiveProbe("immutable insert regression is rejected", "postgres", "on conflict (tenant_id, content_hash) do nothing", "on conflict (tenant_id, content_hash) do update set quality = excluded.quality", "snapshot persistence uses immutable insert deduplication");
destructiveProbe("update trigger deletion is rejected", "immutableMigration", "before update on quantos.data_snapshots", "before update on quantos.removed_data_snapshots", "database rejects snapshot updates");
destructiveProbe("forced RLS deletion is rejected", "baseMigration", "alter table quantos.data_snapshots force row level security", "-- removed", "quantos.data_snapshots enables and forces RLS");
destructiveProbe("tenant query predicate deletion is rejected", "postgres", "where tenant_id = $1 and id = $2", "where id = $2", "snapshot query is tenant scoped: where tenant_id = $1 and id = $2");
destructiveProbe("P95 bound weakening is rejected", "postgresTest", "p95.as_millis() < 300", "p95.as_millis() < 301", "live PostgreSQL check enforces query P95 under 300ms");
destructiveProbe("default Gate live-test regression is rejected", "makefile", "cargo test -p quantos-storage --lib", "cargo test -p quantos-storage", "default R02 Gate remains local-only");
destructiveProbe("R02 status regression is rejected", "plan", /(- task_id: `R02`[\s\S]*?- development_status: `)COMPLETED(`)/, "$1PARTIAL$2", "R02 development status is COMPLETED");
destructiveProbe("R01 dependency regression is rejected", "plan", /(- task_id: `R01`[\s\S]*?- development_status: `)COMPLETED(`)/, "$1PARTIAL$2", "dependency R01 is COMPLETED");
