# quantos-strategy

Strategy draft and parameter model for QuantOS.

## Scope

- versioned strategy drafts with monotonic head versions and immutable `StrategyDraftVersion` records
- manual and autosave save kinds sharing the same optimistic-concurrency rules
- conflict detection via `base_version` compare-and-swap (no silent overwrite)
- draft references restricted to approved `DataSnapshot` and Artifact records
- validation handoff gating: unauthorized actors, missing snapshots, missing artifacts, or failed strategy quality gates cannot initiate validation
- PostgreSQL persistence with `FOR UPDATE` head locking and Supabase migration `20260801090000_strategy_drafts` (RLS default deny, `auth.users` audit columns)
- v2 historical backtests bind Snapshot Artifact bytes, S01 immutable version, effective parameters, full source SHA, execution/runtime digests and explicit clock; close signals fill at the next open
- per-fill adverse slippage and fee accounting, terminal mark-to-market, finite input/cash checks, and generated universe/entry notional constraints
- look-ahead and data-leakage detection plus environment/input hashing for replayable `BacktestValidationReport` records
- immutable `StrategyRelease` publishing with content-hash dedupe, deterministic conflicts, and M3/M4 deployment policy limited to Paper/Shadow (unverified or unapproved releases can never deploy)
- Supabase migration `20260801100000_strategy_releases` for release/deployment persistence with RLS default deny and `auth.users` audit columns

## Validation

- `cargo test -p quantos-strategy`
- `DATABASE_URL=... cargo test -p quantos-strategy --test postgres_drafts --test postgres_releases`

S02 local scope, replay commands and deferred target obligations: [operations](../../docs/operations/s02-local-admission.md). Precise fill, accounting and provenance semantics: [ADR](../../docs/adr/20261015-s02-backtest-provenance.md). `DraftService::backtest` consumes trusted catalog references and verified AuthContext in-process; reports do not grant S03 release approval or prove Supabase persistence. Database tests require a separately authorized configured Supabase target; never start a local database.
