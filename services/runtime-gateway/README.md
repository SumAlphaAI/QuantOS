# runtime-gateway

Authenticated F07 Runtime HTTP service and PostgreSQL recovery worker.

The service requires independent BFF and Runtime logins, verified TLS, a Supabase Storage key, and an HTTPS Terminal Origin. It supports the deterministic `runtime.fixture.v1` workflow. See the [F07 recovery Runbook](../../docs/runbooks/f07_runtime_recovery.md) for setup, accepted routes, failure handling and rollback.

Set `QUANTOS_OBSERVABILITY_ADDR=0.0.0.0:9091` to serve `/healthz`, `/readyz`,
Prometheus `/metrics`, and `/trace/<correlation-uuid>` with stable structured errors.
Set a per-replica `QUANTOS_TRACE_EXPORT_PATH` on durable storage; readiness fails
closed when that exporter is absent or unwritable.

The Runtime HTTP `/healthz` reports worker scan readiness; it is separate from the observability address. `make f07-db-check` is the fail-closed isolated Supabase PostgreSQL acceptance Gate.
