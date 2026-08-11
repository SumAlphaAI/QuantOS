# services

Rust service binaries live here.

- `runtime-gateway`: bootstrap binary for auth/runtime store wiring against `quantos-core`, `quantos-auth`, and `quantos-runtime`.
- `market-ingestor`: generates deterministic market replay JSONL fixtures and ingests them through `quantos-market` into an append-only event ledger.
- `replay-cli`: replays PostgreSQL-backed event chains via `DATABASE_URL`, with JSONL fixtures kept as a fallback for local audit drills.
- `capacity-monitor`: scheduled F09 collector for real outbox/DLQ state, persisted operational samples, restart-safe alert windows, and ADR evidence.

All six Rust binaries use the shared `quantos-observability` contract. Batch
commands persist started/succeeded/failed records when
`QUANTOS_TRACE_EXPORT_PATH` is set; setting `QUANTOS_OBSERVABILITY_ADDR` runs
the health/readiness, Prometheus metrics, trace-query, and structured-error
surface. Readiness fails closed when the trace exporter is absent or unwritable.

Future tasks will add the remaining production scheduler, risk, and execution topology.
