# execution-gateway

TP07 execution boundary service for QuantOS.

## Scope

- the only path from an issued `TradeCommand` to an execution kernel
- pre-boundary interception: precision, quantity/notional limits, venue allowlist, command expiry, kill switch — 100% of violations rejected before the kernel is called
- idempotent downstream submission: replays with the same idempotency key return the existing receipt without touching the kernel
- kernel isolation: kernels receive only sanitized `BoundaryCommand` values (no tenant/actor/session/decision/approval material)
- kernels:
  - `PaperKernel` (default; documented replacement path)
  - `NautilusBoundaryAdapter` (out-of-process NautilusTrader over QuantOS-owned wire payloads; no Nautilus types in-process)
- Order/Fill kernel events map back to the QuantOS-owned schema

Gateway logic lives in `crates/quantos-execution/src/gateway.rs`; this service is the deployable bootstrap.

F06's isolated-project smoke uses `make f06-execution-command-smoke` after
setting `QUANTOS_F06_ISOLATED_PROJECT=1`. It creates a short-lived paper fixture,
calls the restricted Vault resolver from the running gateway process, verifies
one paper-kernel submission and negative cases, then deletes the test secret,
session, account, actor, workspace, and capability rows. The empty isolated
tenant is retained because the append-only event ledger forbids tenant DELETE. This
local diagnostic does not accept external orders or validate the X03 issuer.

Set `QUANTOS_OBSERVABILITY_ADDR=0.0.0.0:9090` to run the deployable operations
surface. It exposes `/healthz`, `/readyz`, Prometheus `/metrics`, and
`/trace/<correlation-uuid>`; invalid routes use the shared structured error envelope.
Set a per-replica `QUANTOS_TRACE_EXPORT_PATH` on durable storage; readiness fails
closed when that exporter is absent or unwritable.

## Validation

- `cargo test -p quantos-execution`
- `cargo test -p execution-gateway`
