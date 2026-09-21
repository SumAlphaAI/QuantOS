#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const text = (path) => readFileSync(resolve(root, path), 'utf8');
const inputs = {
  event: text('crates/quantos-event/src/lib.rs'),
  postgres: text('crates/quantos-event/src/pg.rs'),
  test: text('crates/quantos-event/tests/postgres_persistence.rs'),
  migration: text('supabase/migrations/20260921090000_f05_ledger_integrity_and_replay.sql'),
  replay: text('services/replay-cli/src/main.rs'),
  makefile: text('Makefile'),
  workflow: text('.github/workflows/ci.yml'),
  nightly: text('.github/workflows/f05-event-nightly.yml'),
  runbook: text('docs/runbooks/f05_db_polling_consumer_recovery.md'),
};

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
for (const marker of ['actor_id', 'causation_id']) {
  check(inputs.event.includes(`pub ${marker}`), `event protocol requires ${marker}`);
  check(inputs.postgres.includes(`event.${marker}.as_uuid()`), `PostgreSQL append persists ${marker}`);
}
for (const marker of [
  "lease_token = gen_random_uuid()",
  "and lease_token = $4",
  "and o.lease_token = $7",
  "and i.lease_token = $7",
  'PgEventStoreError::StaleLease',
]) check(inputs.postgres.includes(marker), `lease fencing includes ${marker}`);
check(inputs.migration.includes('event_log_append_only') && inputs.migration.includes('audit_entries_append_only'), 'event and audit ledgers reject mutation');
check(inputs.migration.includes('on delete restrict'), 'event truth cannot be cascade-deleted through its stream');
check(inputs.postgres.includes('where tenant_id = $1 and correlation_id = $2'), 'correlation query is tenant scoped');
check(inputs.replay.includes('tenant_id') && inputs.replay.includes('DeadLetterRequeue'), 'replay CLI requires tenant context and supports dead-letter requeue');
check(inputs.postgres.includes('pub fn requeue_dead_letter') && inputs.postgres.includes('event.dead_letter.requeued'), 'dead-letter replay is auditable');
check(inputs.postgres.includes('pub fn health_snapshot'), 'F05 operational health snapshot is implemented');
for (const marker of [
  'stale_outbox_and_inbox_lease_tokens_cannot_commit_after_reclaim',
  'correlation_queries_are_tenant_scoped_and_append_only_tables_reject_mutation',
  'postgres_ten_thousand_event_chain_is_lossless_and_eventually_consistent',
  'postgres_inbox_receipt_only_allows_one_side_effect_across_thousand_delivery_attempts',
  'QUANTOS_RUN_F05_POSTGRES_TESTS',
]) check(inputs.test.includes(marker), `F05 acceptance test includes ${marker}`);
check(inputs.makefile.includes('f05-check:') && inputs.makefile.includes('f05-db-check:') && inputs.makefile.includes('f05-target-check:'), 'Makefile exposes local, disposable-db and target F05 Gates');
check(inputs.workflow.includes('make f05-check') && inputs.workflow.includes('make f05-db-check'), 'main CI runs both F05 Gates');
check(inputs.nightly.includes('RUSTUP_TOOLCHAIN: nightly') && inputs.nightly.includes('--branch') && inputs.nightly.includes('check-f05-branch.mjs'), 'nightly F05 workflow enforces measured branch coverage');
check(inputs.runbook.includes('dead-letter-requeue') && inputs.runbook.includes('lease_token'), 'Runbook documents fenced dead-letter recovery');

if (failures.length) {
  failures.forEach((failure) => console.error(`FAIL  ${failure}`));
  process.exitCode = 1;
} else {
  console.log('F05 Gate PASS: provenance, lease fencing, append-only enforcement, tenant replay, dead-letter recovery, quantitative tests and CI wiring are present.');
}
