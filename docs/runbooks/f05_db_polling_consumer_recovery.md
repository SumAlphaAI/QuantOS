# F05 Database Polling Consumer Recovery

This runbook covers the early-stage F05 event pipeline where PostgreSQL is the source of truth and Supabase Realtime is only a wakeup or projection notification path.

## Core rules

1. `outbox_event` is the dispatch truth source. Never trust Realtime delivery as proof that an event was handled.
2. Workers claim rows with PostgreSQL row leases and `FOR UPDATE SKIP LOCKED`.
   Each claim has a fresh `lease_token`; an expired worker must never submit a
   side effect or acknowledgement with its old token.
3. `inbox_receipt` is the idempotency and retry ledger for each consumer.
4. `dead_letter_event` and `projection_checkpoint` are durable recovery anchors. Do not clear them manually during incident handling.

## Recovery flow

1. Confirm the worker process is healthy again and can reach PostgreSQL.
2. Inspect the oldest pending or leased rows:

```sql
select id, topic, status, attempts, available_at, lease_owner, lease_token,
       lease_expires_at, last_error
from quantos.outbox_event
where status in ('pending', 'leased')
order by available_at asc
limit 100;
```

3. If leases belong to dead workers, wait for `lease_expires_at` or restart the worker with the normal polling loop. Do not mark rows dispatched by hand.
4. Restart the polling worker. It must rescan `outbox_event`, reclaim expired leases, and rebuild progress from `projection_checkpoint`.
5. If a consumer keeps failing, inspect the matching `inbox_receipt` and `dead_letter_event` rows:

```sql
select consumer_name, event_id, status, attempts, next_attempt_at, lease_owner,
       lease_token, lease_expires_at, last_error
from quantos.inbox_receipt
where status in ('pending', 'processing', 'dead_letter')
order by next_attempt_at asc
limit 100;
```

```sql
select id, source, consumer_name, event_id, correlation_id, sequence, reason,
       status, replay_attempts, replayed_at, replayed_by, created_at
from quantos.dead_letter_event
order by created_at desc
limit 100;
```

6. After fixing the handler bug, inspect the tenant-scoped chain:

```bash
cargo run -p replay-cli -- correlation \
  --tenant-id "$TENANT_ID" \
  --correlation-id "$CORRELATION_ID" \
  --database-url "$DATABASE_URL"
```

7. Requeue the dead-letter group with an active operator actor. This command
   preserves the original rows, resets inbox/outbox state, and appends an audit
   record. It rejects cross-tenant actors and repeat replay:

```bash
cargo run -p replay-cli -- dead-letter-requeue \
  --tenant-id "$TENANT_ID" \
  --dead-letter-id "$DEAD_LETTER_ID" \
  --actor-id "$OPERATOR_ACTOR_ID" \
  --database-url "$DATABASE_URL"
```

8. Run the worker and verify that the outbox is dispatched, the inbox is
   applied, the checkpoint advanced once, and the dead-letter group is
   `replayed`. Realtime does not need to be replayed.

## Health and alerts

Workers expose the `PgEventStore::health_snapshot` counters. Export them as
structured metrics with tenant labels restricted to the operator boundary:

- alert when `oldest_outbox_age_seconds > 60` for five minutes;
- alert immediately when `expired_outbox_leases` or `expired_inbox_leases` is nonzero for two consecutive scans;
- alert when `pending_dead_letters > 0` for five minutes;
- track pending outbox/inbox, retry count, handler latency, replay latency and checkpoint lag on every scan;
- the health endpoint is unhealthy when database access fails or an expired lease persists beyond the next scan.

## Deployment and rollback

1. Apply all migrations to a disposable database with `make f05-db-check`.
   For an authorized isolated Supabase project or database branch, run
   `make f05-target-check`; it writes an exact-SHA, migration-digest receipt to
   `artifacts/f05/target.json` and fails if any target credential is absent.
   Set `QUANTOS_F05_TARGET_ISOLATED=1` only for a disposable Supabase project or
   database branch; the acceptance suite intentionally preserves append-only
   ledger rows.
2. Deploy migration `20260921090000_f05_ledger_integrity_and_replay.sql` before
   deploying writers that require actor, causation and lease tokens.
3. Start one canary worker, confirm backlog age decreases and stale-token
   rejection remains zero, then roll out the remaining workers.
4. Application rollback is forward-only: stop new workers and redeploy the
   previous binary while retaining the added nullable-at-runtime lease columns
   and provenance columns. Never drop the append-only triggers or ledger data.
5. If the previous binary cannot write the required actor/causation fields,
   keep writers stopped and roll forward with the corrected binary. Do not
   weaken the database constraints as an emergency workaround.

Known limit: target Supabase Storage and RLS acceptance requires an explicitly
authorized isolated project or database branch. A disposable local PostgreSQL
receipt does not establish that target result.

## What not to do

- Do not treat missing Realtime notifications as data loss.
- Do not subscribe clients directly to raw outbox, audit, or secret-bearing tables.
- Do not delete `inbox_receipt` rows to force a retry; use the normal replay path so idempotency evidence stays intact.
- Do not UPDATE, DELETE or TRUNCATE `event_log` or `audit_entries`; the database rejects these operations by design.

## Coverage and capacity acceptance

- Run `make f05-db-coverage` for full persistence coverage against a fresh
  loopback database. Nightly sets `RUSTUP_TOOLCHAIN=nightly` and
  `QUANTOS_F05_BRANCH=1` and enforces 85% measured branches.
- For the already approved disposable Supabase target, run
  `make QUANTOS_F05_TARGET_ISOLATED=1 QUANTOS_DB_RESET_CONFIRM=reset_remote_schema f05-target-coverage`.
  The Gate refuses to run without both confirmations, resets only the `quantos`
  schema, reapplies every repository migration, and then starts the tests. Keep
  credentials in `.env.local`; never copy them into receipts. This includes the
  live Storage round-trip as well as the local HTTP fault-injection suite.
- Capacity consumption uses the production polling API for 10,000 events.
  Keep the 30-second leases and five-second complete-query budget unchanged;
  a slow cross-region run is a failed measurement, not grounds to replace it
  with EXPLAIN timing or direct SQL acknowledgements.
- Archive `database.json` or `target.json`, `measurements.json`, `coverage.json`
  and `coverage-summary.json` from the same clean SHA. Core-only coverage or
  mock HTTP success cannot replace a full persistence/target receipt.
