# capacity-monitor

F09 capacity collector. Use `--watch` for a long-running 60-second loop; it
reconnects to Supabase PostgreSQL on each tick. Each tick reads real
PostgreSQL outbox/DLQ state and combines it with
the last 15 minutes of persisted Realtime, query latency, materialized-view,
Storage, and Vault measurements, restores alert-window state, evaluates all
capacity rules, persists alerts, and atomically writes ADR JSON input.

The collector fails closed when any required external metric family has no
sample in the last 90 seconds. Metric producers insert only numeric values,
the metric name as source label, optional correlation IDs, and non-sensitive attributes
into `quantos.operational_metric_samples`; credentials and payloads are
forbidden.

One-shot development command and supervised scheduler command:

```sh
cargo run -p capacity-monitor -- --lookback-seconds 900
cargo run -p capacity-monitor -- --watch --lookback-seconds 900
make f09-adr-input
```

Keep the watch process running under a service supervisor. A failed tick
removes the previous ADR JSON and records a missing-coverage alert when the
database is available.
