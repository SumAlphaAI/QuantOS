# quantos-execution

TradeCommand issuance and approval state machine for QuantOS.

## Scope

- short-lived, signed, idempotent `TradeCommand` issuance from a valid R04 `TradeProposalRecord` + X02 `RiskDecision` (+ approval when required)
- approval state machine: signature verification via `ApprovalVerifier`, single-use approval consumption, and self-approval bans (approver can never be the proposal originator or requester)
- seven deterministic rejection classes: expired proposal, duplicate approval, self approval, stale data, kill switch, invalid strategy release, missing/denied approval
- command expiry is the minimum of proposal expiry, issuer TTL, and data freshness
- issuance is idempotent per tenant-scoped key: replays return the already-issued command
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
