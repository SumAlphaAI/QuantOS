# quantos-reconcile

X05 Shadow observations, Decimal virtual accounting, order/fill/position/ledger reconciliation and proof-bound exception closure.

- `shadow::ShadowRunner` accepts current scoped Shadow identity, X02 RiskGuard and X01/S03 sources; advice is non-executable and virtual fills recheck current risk atomically. It holds no issuer, venue or execution adapter.
- `model::Seed` bootstraps a declared flat window or a validated X01 opening position/cash basis. Decimal accounting supports long/short closure/reversal, fees and mark-valued exposure.
- `reconciliation::from_x04_portfolio` verifies/replays supplied X04 facts/anchor and validates X01 projection. It is strictly read-only and requires trusted backend scope/source/cash admission. Zero fees require no FX conversion even with a different currency label; nonzero fees must match the scope quote unit.
- `exceptions::ReconciliationService` detects all twenty `BreakKind` classes with source/entity/value/time evidence, independently checks each book's internal accounting, deduplicates runs/cases, and enforces current permissions/CAS/ack/latest repaired-source proof before close. A repeated difference reopens the case and revokes day close.
- Hash-anchored action journals restore local idempotency, reports and exception state by replay. Limits: 10000 actions and 8MiB; capacity refuses before mutation. Persistent/distributed transactions and scheduling remain unaccepted.
- The `quantos-reconcile --x05-offline-reconcile` binary is a strict bounded supplied-data worker. It exposes no order operations, filesystem/DB/network/credential loader or exception mutation endpoint.
- Root reexports and `legacy` retain historical floating-point fixture compatibility; they are not the trusted X05 service.

Use `make x05-check` or `make x05-assess-local` for current feature/impact scope, not recursive upstream gates. `make x05-local-check` validates evidence; release remains refused without actual target/formal evidence. Actual authorized market feeds, ten actual trading days, target 20-class/15-minute performance, Supabase/RLS and deployed recovery/identity/OS/CI remain NOT_RUN.

See [procedure](../../docs/operations/x05-local-admission.md) and [ADR](../../docs/adr/20261017-x05-shadow-reconciliation.md).
