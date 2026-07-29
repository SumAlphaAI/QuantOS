# proto

Versioned QuantOS protocol contracts live here.

Current v1 packages:

- `quantos/common/v1`: shared metadata, identity, and primitive domain references
- `quantos/research/v1`: `DataSnapshot` and `ResearchArtifact`
- `quantos/strategy/v1`: `StrategyRelease` and `Signal`
- `quantos/trading/v1`: `TradeProposal`, `RiskDecision`, `TradeCommand`, `Order`, `Fill`, `Position`
- `quantos/engine/v1`: Engine RPC contract
- `quantos/events/v1`: event ledger API and event envelope

Generation entrypoints:

- `buf.yaml`: workspace, dependencies, lint, and breaking-change policy
- `buf.gen.yaml`: Rust, Python, TypeScript, and OpenAPI generation template
