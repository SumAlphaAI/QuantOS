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

### ProtoJSON compatibility

Rust ProtoJSON implementations are generated locally from `buf build` descriptors with
pinned `pbjson-build 0.7.0`. `scripts/patch-protojson.py` adapts enum fields to proto3
open-enum semantics: known values retain names, unknown i32 values retain numbers.
Both generation and drift checks run this step. `make proto-compat-check` exchanges
11,000 fixtures and three frozen v1 golden fixtures across all six binary and six
ProtoJSON language directions, including all nine event payloads. Unknown binary
fields may be discarded by prost; the gate requires known-field semantic preservation,
not unknown-field retention. Unknown JSON fields/names and malformed inputs are rejected.

The golden corpus under `scripts/fixtures/proto-compat/v1` was authored separately from
the TypeScript fixture builder and encoded using Python. It is a regression baseline
introduced on 2026-09-20, not evidence of compatibility with an earlier released SDK.
Do not regenerate it in tests. To deliberately revise it, retain the old version and
add a new version with independently reviewed JSON and binary values.
