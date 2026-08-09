# runtime-gateway

Bootstrap service binary for the QuantOS runtime surface.

The current baseline validates workspace composition and shared crate wiring, and exposes the bootstrap hooks used to create auth and runtime stores from `DATABASE_URL`.

Set `QUANTOS_OBSERVABILITY_ADDR=0.0.0.0:9091` to serve `/healthz`, `/readyz`,
Prometheus `/metrics`, and `/trace/<correlation-uuid>` with stable structured errors.
Set a per-replica `QUANTOS_TRACE_EXPORT_PATH` on durable storage; readiness fails
closed when that exporter is absent or unwritable.
