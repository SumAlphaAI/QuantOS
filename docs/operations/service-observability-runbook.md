# Service Observability Runbook

## Contract

Every Rust service and Python Engine uses the same operations surface:

- `GET /healthz`: process liveness;
- `GET /readyz`: readiness, including a writable trace exporter;
- `GET /metrics`: Prometheus text metrics;
- `GET /trace/<correlation-uuid>`: records already persisted for this service and correlation;
- every HTTP error is a stable JSON envelope without environment values or credentials.

## Required deployment configuration

Assign every replica a distinct file on a durable or log-shipped volume:

```text
QUANTOS_TRACE_EXPORT_PATH=/var/lib/quantos/traces/<service>-<replica>.jsonl
QUANTOS_OBSERVABILITY_ADDR=0.0.0.0:9090
```

Do not share one file between replicas. Ship/rotate JSONL using the platform log
agent; retention and immutable archival belong to deployment policy. A replica
without a configured, writable exporter remains live but reports not-ready.

## Batch services

`market-ingestor`, `portfolio-rebuild`, and `replay-cli` export `started` plus
`succeeded` or `failed` during normal execution. With
`QUANTOS_OBSERVABILITY_ADDR` present, the same binary enters operations-server
mode instead of running a batch command. CLI and operation failures emit a
stable envelope whose correlation ID matches the exported failure trace.

## Python Engines

`quantos_engine_sdk.serve_engine` instruments all five RPCs centrally. Each RPC
exports a started/terminal pair under request `metadata.correlation_id`; failed
gRPC calls export `failed`. Engine authors do not add per-service HTTP code.

## Verification

```bash
make observability-check
```

The automated Engine test executes a real gRPC health request, reads its JSONL
records back through HTTP, and checks Prometheus readiness. Rust tests verify
the same persisted correlation query and secret-safe error contract.
