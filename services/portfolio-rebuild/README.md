# portfolio-rebuild

Rebuild deterministic portfolio projections from event fixtures, optionally
compare or emit a golden snapshot, and persist a projection to PostgreSQL.

Normal commands export JSONL traces through `QUANTOS_TRACE_EXPORT_PATH`. Setting
`QUANTOS_OBSERVABILITY_ADDR` runs the shared health, metrics, correlation-trace,
and structured-error HTTP surface instead of a batch command.
