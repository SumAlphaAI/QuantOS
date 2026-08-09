# quantos-observability

Local observability primitives for F09.

Current scope:

- correlation-indexed trace records for write paths
- structured logs with recursive secret redaction
- a dependency-light deployable HTTP surface shared by service binaries:
  `/healthz`, `/readyz`, Prometheus `/metrics`, correlation-addressable `/trace/<uuid>`,
  and a stable JSON error envelope with no environment or secret serialization
- an append-only JSONL exporter selected with `QUANTOS_TRACE_EXPORT_PATH`; trace
  queries return the persisted records for the requested service/correlation
  rather than synthesizing a trace context
- capacity threshold evaluation for outbox, realtime, read models, storage, and secrets
- fault injection helpers for database, event consumer, and engine recovery tests
- ADR evidence report generation
