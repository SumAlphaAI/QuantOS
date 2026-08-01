# quantos-strategy-lab

TP06 controlled strategy generation engine.

## Scope

- QuantOS-native engine manifest exposing `strategy.generate.v1`
- deterministic fixture-backed `StrategyDraftArtifact` output plus `StaticCheckArtifact`
- bounded prompt intake: order/secret/network/deploy intents are rejected at the adapter boundary
- static analysis over generated rule specs; failed checks mark drafts `release_eligible=false`
- generated drafts replay through the S02 backtest pipeline via `GeneratedStrategyAdapter` in `quantos-strategy`

## Validation

- `uv run pytest ../tests/test_strategy_lab_contract.py` (from `engines/`)
- `cargo test -p quantos-engine-manager --test python_strategy_lab` (from repo root)
