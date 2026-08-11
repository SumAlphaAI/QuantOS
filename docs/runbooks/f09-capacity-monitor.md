# F09 Capacity Monitor Runbook

Run `capacity-monitor` once per minute with `DATABASE_URL`,
`QUANTOS_TRACE_EXPORT_PATH`, and a durable `QUANTOS_F09_EVIDENCE_PATH`.
Window state and alerts live in PostgreSQL, so a restarted or rescheduled job
continues the original 15-minute and three-check windows.

## Metric producer contract

Producers call `quantos.record_operational_metric` with a numeric value, a
stable source label, an optional correlation ID, and non-sensitive attributes:

- Realtime subscriber/projection worker: end-to-end delay and current quota
  utilization.
- Risk and portfolio query boundaries: one latency sample per completed query.
- Risk MV and operations refresh jobs: age in seconds after every refresh
  check, including successful checks.
- Storage adapter: `0` for every successful upload/download/delete and `1` for
  every failed operation; the monitor computes the window error rate.
- Execution Gateway: `0`/`1` for every rotation check and controlled Vault
  read. RLS restricts this role to the two secret metric names.

Never place a credential, request payload, secret reference, session, or token
in metric attributes. SQL intake rejects sensitive keys and the Rust recorder
also recursively redacts them.

## Scheduled evaluation

```sh
make f09-capacity-snapshot
make f09-adr-input
```

The first command fails closed if any of the nine externally produced metric
families is absent from the lookback window. It directly derives outbox age and
DLQ ratio from PostgreSQL truth tables, restores alert state, persists alerts,
and atomically publishes JSON evidence. The second command renders the complete
snapshot, alert IDs, correlations, metric sources, and remediation actions into
the capacity ADR template.

After a failure, first restore the missing producer or database connection. Do
not substitute zeros: an absent metric is unknown, not healthy.
