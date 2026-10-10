# TradingAgents controlled decision adapter

TP04 exposes `decision.proposal.v1` through the five Engine RPCs over local UDS. QuantOS owns this deterministic committee/policy fixture adapter. The selected external TradingAgents reference is pinned in `third_party/tp04-trading-agents/baseline.lock.json`; its dependency descriptor is recorded, but the resolved upstream dependency audit is pending and `productionApproved=false`. This package does not import that upstream, call an LLM, or run live agents.

Research requests require the capability, account ID, versioned Signal, policy and portfolio IDs. Policy and portfolio IDs must match the authoritative Engine envelope. Signal tenant/workspace and Research mode must match the caller scope; version labels, a real-shaped model digest, finite confidence/strength, evidence and a positive time window are required. These are validated caller claims; no release, Signal Artifact, portfolio, policy or data bytes are fetched or authenticated here.

Every response is a `quantos.trading.v1.TradeProposal` with `executable=false`, evidence and explicit `counter_views`. Expiry is capped by both the input Signal validity and fixture TTL starting at Signal generation. This preserves historical Research replay; consumers must enforce live freshness, license, risk and authorization separately. Policy rules and monetary values are controlled fixture output, not an actual portfolio risk decision.

Two immutable committee/policy JSON bundles are atomically stored with complete byte SHA-256 and `mock-artifact://trading-agents/` refs. Reads and cancellation are scoped by tenant, workspace and actor. Request identity conflicts fail; same-content replay preserves Artifact identity across idempotency keys. Command/transport deadlines and cancellation stop before final Artifact publication. Storage and execution state are in-memory and not durable.

Only `query_signal`, `query_snapshot`, `query_artifact` labels are accepted; none executes. Recursive order/venue/secret/network/authority fields, unknown input keys and unapproved tools fail with fixed errors. Policy denials emit machine code and hashed caller scope without raw payload. Source import checks are static evidence, not an OS egress sandbox.

```sh
node engines/trading-agents/check-development.mjs --record
node scripts/provider-a1-receipts.mjs --assess-tp04 docs/audit/evidence/provider-a1-remediation-20261004/tp04-admission-20261010/attempt-01
node engines/trading-agents/check-development.mjs --admit
node engines/trading-agents/check-development.mjs --ready
```

The component recorder proves local engineering behavior. READY additionally requires the fresh strict dependency closure. Installed-wheel five RPC and <2s cancellation checks, 100 real UDS Proposal JSON Schema/double replay checks and a local Research UI response bridge are recorded with hashes. This does not establish deployed BFF HTTP/browser E2E, upstream safety/quality, persistent audit, production performance, hosted CI or formal ACCEPTED.
