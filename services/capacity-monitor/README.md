# capacity-monitor

One-shot F09 capacity collector intended to run every minute as a scheduled
job. Each invocation reads real PostgreSQL outbox/DLQ state, combines it with
the last 15 minutes of persisted Realtime, query latency, materialized-view,
Storage, and Vault measurements, restores alert-window state, evaluates all
capacity rules, persists alerts, and atomically writes ADR JSON input.

The collector fails closed when any required external metric family has no
sample in the lookback window. Metric producers insert only numeric values,
safe source labels, optional correlation IDs, and non-sensitive attributes
into `quantos.operational_metric_samples`; credentials and payloads are
forbidden.

Example scheduler command:

```sh
cargo run -p capacity-monitor -- --lookback-seconds 900
make f09-adr-input
```
