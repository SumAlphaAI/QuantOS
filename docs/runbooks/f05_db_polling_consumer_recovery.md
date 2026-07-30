# F05 Database Polling Consumer Recovery

This runbook covers the early-stage F05 event pipeline where PostgreSQL is the source of truth and Supabase Realtime is only a wakeup or projection notification path.

## Core rules

1. `outbox_event` is the dispatch truth source. Never trust Realtime delivery as proof that an event was handled.
2. Workers claim rows with PostgreSQL row leases and `FOR UPDATE SKIP LOCKED`.
3. `inbox_receipt` is the idempotency and retry ledger for each consumer.
4. `dead_letter_event` and `projection_checkpoint` are durable recovery anchors. Do not clear them manually during incident handling.

## Recovery flow

1. Confirm the worker process is healthy again and can reach PostgreSQL.
2. Inspect the oldest pending or leased rows:

```sql
select id, topic, status, attempts, available_at, lease_owner, lease_expires_at, last_error
from quantos.outbox_event
where status in ('pending', 'leased')
order by available_at asc
limit 100;
```

3. If leases belong to dead workers, wait for `lease_expires_at` or restart the worker with the normal polling loop. Do not mark rows dispatched by hand.
4. Restart the polling worker. It must rescan `outbox_event`, reclaim expired leases, and rebuild progress from `projection_checkpoint`.
5. If a consumer keeps failing, inspect the matching `inbox_receipt` and `dead_letter_event` rows:

```sql
select consumer_name, event_id, status, attempts, next_attempt_at, lease_owner, last_error
from quantos.inbox_receipt
where status in ('pending', 'processing', 'dead_letter')
order by next_attempt_at asc
limit 100;
```

```sql
select source, consumer_name, event_id, correlation_id, sequence, reason, created_at
from quantos.dead_letter_event
order by created_at desc
limit 100;
```

6. After fixing the handler bug, replay from PostgreSQL by correlation ID or by re-queuing the affected dead-letter flow through the normal application path. Realtime does not need to be replayed.

## What not to do

- Do not treat missing Realtime notifications as data loss.
- Do not subscribe clients directly to raw outbox, audit, or secret-bearing tables.
- Do not delete `inbox_receipt` rows to force a retry; use the normal replay path so idempotency evidence stays intact.
