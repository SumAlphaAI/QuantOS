# quantos-event

`quantos-event` owns the append-only event truth source, transactional outbox,
consumer inbox, dead-letter lifecycle and projection checkpoints.

## Invariants

- Every event carries `tenant_id`, `actor_id`, `correlation_id` and
  `causation_id`. A root event points `causation_id` to its own `event_id`.
- Event, audit and outbox rows are inserted in one PostgreSQL transaction.
- `event_log` and `audit_entries` reject UPDATE, DELETE and TRUNCATE in the
  database, including cascade attempts through an event stream.
- Every correlation and audit query requires the tenant ID.
- Outbox and inbox claims use `FOR UPDATE SKIP LOCKED`, expiry and a fresh
  `lease_token`. Completion must match the current owner and token. A handler
  receives the inbox claim so a downstream side effect can apply the same
  fencing token.
- Realtime is a wakeup channel. A database scan is always the recovery path.
- Dead letters are replayed through `replay-cli dead-letter-requeue`; the
  original event and receipt remain as audit evidence.

## Validation

- `make f05-check`: source contract, destructive negative probes, unit tests
  and core line/region coverage.
- `make f05-db-check`: fresh disposable PostgreSQL migration and all F05
  database acceptance scenarios. Requires a loopback `F02_PG_ADMIN_URL`.
- `make test-f05-live`: explicitly authorized target PostgreSQL verification;
  fails when `DATABASE_URL` is absent.
- `make test-supabase-storage-live`: target Supabase object round-trip; fails
  when the database URL, project URL or service-role credential is absent.

Operational thresholds and recovery commands are maintained in
`docs/runbooks/f05_db_polling_consumer_recovery.md`.
