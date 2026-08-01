# quantos-risk

Deterministic pre/post-trade risk engine and kill switch for QuantOS.

## Scope

- pre-trade rule chain: global/account kill switch, venue health, account state, strategy release validity (verified/approved/target), data freshness, duplicate idempotency keys, precision, per-order notional, leverage, symbol concentration, approval threshold
- post-trade rules: kill switch, daily loss limit, post-fill leverage
- signed `RiskDecision` outputs carrying verdict, hit rules, limit ids, signer, reason, and deterministic signature hash
- risk inputs composed from X01 `PortfolioSnapshot` (`PortfolioRiskInput::from_snapshot`) and S03 `StrategyRelease` (`ReleaseRiskInput::from`)
- global and account-level kill switch API with immediate deny propagation

## Validation

- `cargo test -p quantos-risk`
