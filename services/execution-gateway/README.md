# execution-gateway

TP07 execution boundary service for QuantOS.

## Scope

- the only path from an issued `TradeCommand` to an execution kernel
- pre-boundary interception: precision, quantity/notional limits, venue allowlist, command expiry, kill switch — 100% of violations rejected before the kernel is called
- idempotent downstream submission: replays with the same idempotency key return the existing receipt without touching the kernel
- kernel isolation: kernels receive only sanitized `BoundaryCommand` values (no tenant/actor/session/decision/approval material)
- kernels:
  - `PaperKernel` (default; documented replacement path)
  - `NautilusBoundaryAdapter` (owned wire outbox; actual Nautilus runtime remains unexecuted/unadmitted; no upstream types in-process)
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

## X3 signed consumption and owned Paper process

`X03CommandService` is the trusted typed backend ingress for X03 `SignedCommand`.
It rechecks exact issuer binding, current identity/risk/sources, consumed approval,
expiry and kill state, including on replay. Clones share downstream dedupe; issuer
claims prevent a second gateway from consuming a submitted or uncertain command.
Errors after entering the kernel require reconciliation, never automatic resubmit
or fallback. Legacy `ExecutionCommandService` remains an F06 synthetic probe only.

`PaperProcessKernel` launches this binary with `--tp07-paper-kernel` over strict
64KiB JSON-line stdio, a PID/backend handshake, <=1s request budget, clean environment
and private working directory. Only opaque command/order wire crosses the boundary.
This is a real owned Paper process, not an executed Nautilus runtime or OS sandbox.
No public order HTTP route or production credential is enabled.

Run `make tp07-assess-local` for the 14 function/impact checks; `make tp07-local-check`
verifies scoped evidence, and `make tp07-release-check` refuses pending targets.
See [procedure](../../docs/operations/tp07-local-admission.md) and
[ADR](../../docs/adr/20261017-tp07-paper-dispatch-boundary.md).


## X04 cancellation and facts

`X03CommandService::cancel(auth, signed_command, stable_cancel_key, now)` controls
only this issuer-bound consumer's existing order. Permission revocation, foreign
scope, forged commands and another consumer are rejected before kernel I/O.
Cancellation remains authorized after command expiry/kill; GTD-terminal orders
produce audited refusal rather than a new submission. `order_history` is also
protected. Cancel replies carry correlation IDs, completion time, outcome/reason
and measured logical latency; uncertain transport blocks all new cancel keys for
that order until independent reconciliation.

Choose `PaperProcessKernel::spawn_resting` to run this binary with
`--x04-paper-resting-kernel`. The bounded protocol additionally supports owned
cancel wire and GTD expiry catch-up. Default Paper still fills immediately.
Append-only facts, hash/sequence/anchor replay, Decimal state and direct Fill to
Command provenance live in `quantos-execution`. This is local in-memory OMS
validation, not durable DB or deployed Nautilus acceptance.

`make x04-assess-local` records 16 function/impact check groups including 100000
mixed order events; `make x04-local-check` verifies current scoped evidence and
`make x04-release-check` refuses missing real target/formal evidence. No recursive
upstream revalidation is performed. See [X04 procedure](../../docs/operations/x04-local-admission.md).

## L02 protected host (local function scope)

`restricted_zone` supplies a real OpenSSL mutual-TLS peer boundary, exact DNS/port/address client allowlist, a trusted session/version registry, and a protected host around the L01 kernel. Session/account/certificate/version/expiry are rechecked before signing and again at dispatch. `DatabaseVaultSigner` uses only the new certificate/version-bound SQL function; it has no DATABASE_URL fallback.

The default service exposes no new order listener. `execution-gateway --l02-owned-zone-fixture` is an explicitly selected owned mode used only by owned subprocess tests, with temporary certificates, cleared environment, synthetic process-local HMAC material and a controlled fixture clock. It is not a deployed gateway or Vault broker. The signature hash is diagnostic, not execution authority or Binance HTTP authentication. See [L02 procedure](../../docs/operations/core-l02-current-function.md) and [rotation runbook](../../supabase/OPERATIONS.md#l02-execution-secret-zone-rotation-runbook).
