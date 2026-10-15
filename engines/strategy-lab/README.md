# quantos-strategy-lab

TP06 controlled strategy generation engine.

## Scope

- QuantOS-native engine manifest exposing `strategy.generate.v1`
- deterministic fixture-backed `StrategyDraftArtifact` output plus `StaticCheckArtifact`
- bounded prompt intake: order/secret/network/deploy intents are rejected at the adapter boundary
- static analysis over generated rule specs; failed checks mark drafts `release_eligible=false`
- generated drafts replay through the S02 backtest pipeline via `GeneratedStrategyAdapter` in `quantos-strategy`

## Validation

- `uv run --locked --all-packages pytest tests/test_strategy_lab_contract.py tests/test_strategy_lab_development.py` (from `engines/`)
- `cargo test -p quantos-engine-manager --test python_strategy_lab` (from repo root)

The replaceable `StrategyGenerator` protocol returns data-only `StrategyLabFixture` specifications;
QuantOS always runs the static checker afterwards. The native fixture provider is an owned
reference, not a natural language model or an adopted upstream checkout. The declared DSL is
`momentum(close, lookback=N)` only; no generated source is executed.

Execute and completed StreamExecute atomically retain exactly a draft/check Artifact pair in
process memory. Trusted host code can read back immutable copies by tenant/workspace/id;
`artifact://` references describe this local store, not an uploaded Supabase object. Replays
are idempotent, changed bytes at the same ID conflict, and cancellation prevents late commit.
Server-verified actor metadata must be supplied by the Engine host. Process memory is not a
durable or bounded production store. The allowlist and inert fixture provider prove local
behavior; live-provider credentials, OS egress isolation, real Storage, deployment and release
acceptance require separate target evidence. No order, secret, network or deployment tool is
passed to the generator. A replacement is trusted host code, not a Python sandbox.
