# quantos-execution

TradeCommand issuance and approval state machine for QuantOS.

## Scope

- short-lived, signed, idempotent `TradeCommand` issuance from a valid R04 `TradeProposalRecord` + X02 `RiskDecision` (+ approval when required)
- approval state machine: signature verification via `ApprovalVerifier`, single-use approval consumption, and self-approval bans (approver can never be the proposal originator or requester)
- seven deterministic rejection classes: expired proposal, duplicate approval, self approval, stale data, kill switch, invalid strategy release, missing/denied approval
- command expiry is the minimum of proposal expiry, issuer TTL, and data freshness
- issuance is idempotent per tenant-scoped key: replays return the already-issued command

## Validation

- `cargo test -p quantos-execution`
