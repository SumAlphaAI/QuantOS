# quantos-portfolio

Rebuildable portfolio read model and risk input snapshot for QuantOS.

## Scope

- fill/mark-price event projection with sequence-gap and duplicate-event rejection
- position, valuation, realized/unrealized P&L, gross/net exposure, account state, and data-as-of time
- deterministic rebuilds from event replay with content-hashed `PortfolioSnapshot` golden comparisons
- PostgreSQL persistence in the controlled `quantos` schema via migration `20260801110000_portfolio_projection` (RLS default deny)
- `portfolio-rebuild` CLI for replay dataset generation, golden snapshot emission/verification, and optional PostgreSQL persistence

## Validation

- `cargo test -p quantos-portfolio`
- `cargo run -p portfolio-rebuild -- generate-replay --output replay.jsonl`
- `cargo run -p portfolio-rebuild -- rebuild --input replay.jsonl --golden crates/quantos-portfolio/tests/golden/portfolio_snapshot.json`
- `DATABASE_URL=... cargo test -p quantos-portfolio --test postgres_portfolio`
