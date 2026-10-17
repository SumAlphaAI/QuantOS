# quantos-execution

TradeCommand issuance and approval state machine for QuantOS.

## Scope

- short-lived, signed, idempotent `TradeCommand` issuance from a valid R04 `TradeProposalRecord` + X02 `RiskDecision` (+ approval when required)
- approval state machine: signature verification via `ApprovalVerifier`, single-use approval consumption, and self-approval bans (approver can never be the proposal originator or requester)
- seven deterministic rejection classes: expired proposal, duplicate approval, self approval, stale data, kill switch, invalid strategy release, missing/denied approval
- command expiry is the minimum of proposal expiry, issuer TTL, and data freshness
- issuance is idempotent per tenant-scoped key: replays return the already-issued command
- each replay rechecks current kill switch, Release, Proposal/data validity and required approval; cached command expiry is never renewed
- the same tenant/key is bound to its first requester, full Proposal/decision snapshot and canonical order/approval intent; changed requester or payload returns `idempotency_conflict` rather than a second command
- data validity may be refreshed only while covering the original signed deadline; a shorter window is rejected, and expired/nonpositive command TTL returns `command_expired`
- valid approval replays verify the proof again without consuming it twice; failed/conflicting requests never consume a new approval
- order state machine with a legality table (`OrderStatus::can_transition_to`), append-only order facts, and `FillFact` records traceable to the issuing Command
- `paper::ExecutionGateway` over the `VenueAdapter` boundary (TP07 Nautilus attaches here): duplicate submits hit the downstream kernel exactly once, and cancel latency/rejections produce `CancelAudit` records
- `venue::TestnetVenueAdapter`: L01 approved-venue testnet plugin over the `TestnetTransport` boundary with order-intent/precision/rate-limit mapping, classified network/authentication/rate-limit failures, production endpoint/key bans, and deterministic `CompatReport` coverage over 200 normal/reject/cancel/partial-fill scenarios
- `zone` module (L02): restricted execution zone with static Vault secret references resolvable only by the Execution Gateway, service-session/command TTL enforcement, minimum-egress allowlists, mTLS identity checks, and credential rotation/revocation with a five-minute recovery window
- `dual` module (L03): M5 feature gate plus dual-approval policy — separation of duties, notional caps, symbol allowlists, MFA proofs, and approval TTLs — producing one signed audit entry per approver only after every check passes

## TP07 execution gateway (`gateway` module)

- the only path from an issued `TradeCommand` to an execution kernel; deployable via `services/execution-gateway`
- pre-boundary interception: precision (quantity/price scale + intent/price consistency), quantity/notional limits, venue allowlist, command expiry, kill switch — 100% of violations rejected before the kernel is called
- idempotent downstream submission: 1,000 replays with the same idempotency key produce exactly one kernel submission
- kernel isolation: kernels receive only sanitized `BoundaryCommand` values (no tenant/actor/session/decision/approval material)
- kernels: `PaperKernel` (default, replacement path) and `NautilusBoundaryAdapter` (out-of-process NautilusTrader over QuantOS-owned wire payloads; no Nautilus types in-process)
- Order/Fill kernel events map back to the QuantOS-owned schema

## Validation

- `cargo test -p quantos-execution`
- TTL correctness is deterministic and runs by default; P95 is an ignored release-only test, invoked by `make research-release-performance-smokes` or `cargo test -p quantos-execution --lib p95 -- --ignored`

The issuer is an in-memory domain boundary. This cache fix does not establish
initial risk/Proposal/tenant authority, real MFA/signature authenticity,
cross-process persistence, Supabase acceptance or production trading access.
Callers must supply trusted observation time and authoritative safety state.
Proposal snapshots and string-valued order amounts bind exactly after canonical
JSON encoding; retries must use the original immutable snapshot and representation.

## X03 local command authority

`authority::AtomicCommandIssuer` pins actual R04 records, binds F06 identity,
checks current X01/S03/X02 risk under the kill mutex, and atomically consumes a
CAS-approved token with one HMAC-signed idempotent `SignedCommand` and audit.
Clones share state. Legacy root issuer/approval/command checksums remain fixture
compatibility APIs and convey no authority. No HTTP/venue route or implicit
conversion is added. See [local workflow](../../docs/operations/x03-local-admission.md)
and [design](../../docs/adr/20261017-x03-atomic-command-issuer.md).

`make x03-check` is focused preflight. Under the 2026-10-17 phased testing rule,
`make x03-assess-local` records 12 current-function/impact checks with exact input
hashes and reasons; it does not recurse upstream gates or run full workspace/three
builds. Function DEVELOPMENT readiness, business integration and release acceptance
are tracked separately. See [phased testing](../../docs/operations/phased-testing.md). Supabase,
durable distributed consumption/recovery, key custody, downstream TP07 dispatch,
representative P95 <200ms, target security/load/soak/CI and formal confirmation
remain separate NOT_RUN obligations.

## TP07 downstream ownership

`dispatch::SignedExecutionGateway` consumes keyed X03 commands with current-risk
revalidation, scoped idempotency, issuer-owned consumer claims, uncertain-outcome
quarantine and validated Order/Fill projection. `process_kernel::PaperProcessKernel`
uses a real bounded owned child process; upstream Nautilus remains unexecuted.
Legacy checksum gateways are compatibility fixtures. See the
[TP07 procedure](../../docs/operations/tp07-local-admission.md).
