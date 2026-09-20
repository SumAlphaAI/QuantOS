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
- `make proto-generate`: regenerate against the committed `buf.lock`
- `make proto-deps-update`: explicitly update `buf.lock` for a separately reviewed dependency change
- `make proto-check`: regenerate, compile every standalone JSON Schema, verify planned schema coverage, reject generated drift, and run Buf breaking checks

All remote plugins in `buf.gen.yaml` are version-pinned. The generated JSON Schema files are self-contained and include their transitive OpenAPI definitions.
