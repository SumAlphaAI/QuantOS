# replay-cli

Inspect a tenant-scoped event chain or requeue a pending dead letter. Tenant ID
is mandatory so a service-role connection cannot merge two tenants that reuse a
correlation ID.

```bash
cargo run -p replay-cli -- correlation \
  --tenant-id "$TENANT_ID" \
  --correlation-id "$CORRELATION_ID" \
  --database-url "$DATABASE_URL"

cargo run -p replay-cli -- dead-letter-requeue \
  --tenant-id "$TENANT_ID" \
  --dead-letter-id "$DEAD_LETTER_ID" \
  --actor-id "$OPERATOR_ACTOR_ID" \
  --database-url "$DATABASE_URL"
```

`correlation` also accepts `--input events.jsonl`; tenant and correlation
filters remain mandatory. Output includes actor and direct cause. Requeue
requires an active actor in the same tenant, resets the matching inbox/outbox
through the normal fenced path, marks the dead-letter group replayed and appends
an audit entry. Repeating the same replay is rejected.

Normal commands export JSONL traces through `QUANTOS_TRACE_EXPORT_PATH`. Setting
`QUANTOS_OBSERVABILITY_ADDR` runs the shared operational HTTP surface instead.
