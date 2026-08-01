# SumAlpha QuantOS

Polyglot monorepo baseline for the QuantOS platform.

## Repository layout

- `proto/`: versioned protocol contracts and schema generation entrypoints.
- `crates/`: Rust domain crates and shared core libraries.
- `services/`: Rust service binaries built on top of the shared crates.
- `engines/`: Python engine SDK, mock engines, and engine contract tests.
- `third_party/`: locked upstream intake ledgers and read-only reference evidence.
- `forks/`: controlled fork governance baselines and patch-queue policy.
- `plugins/`: future venue, data, notification, and tool plugins.
- `apps/website/`: public-facing website shell for `sumalpha.ai`.
- `apps/terminal/`: shared web Terminal application for `app.sumalpha.ai`.
- `apps/terminal-desktop/`: desktop shell for the shared Terminal application.
- `packages/`: shared TypeScript packages for UI, domain UI, API clients, platform bridges, and config.
- `supabase/`: SQL migrations, remote database conventions, and PostgreSQL test fixtures for the hosted Supabase platform.
- `policy/sql/`: catalog-level SQL policy audits for default-deny tenant access checks.
- `deploy/`: placeholder directory for future remote deployment manifests and infrastructure automation.
- `docs/`: architecture, technical solution, and execution plan documents.

## Toolchain baseline

- Rust: pinned via `rust-toolchain.toml`
- Python package management: pinned via `uv`
- Node package management: pinned via `packageManager` and Corepack-managed `pnpm`

## Common commands

- `make bootstrap`
- `make lockfile-check`
- `make proto-check`
- `make lint`
- `make test`
- `make build`
- `make build-web`
- `make test-f05-live`
- `make test-supabase-storage-live`
- `make waiver-check`
- `make build-manifest`
- `make tp01-vibe-monitor`
- `make db-apply`
- `make db-reset`
- `make db-migration-check`
- `make db-schema-diff`
- `make rls-policy-test`
- `cargo run -p replay-cli -- --correlation-id <uuid> --database-url "$DATABASE_URL"`

## Notes

- The current baseline intentionally keeps each language surface minimal so F01 can verify workspace wiring quickly.
- F02 adds CI, SBOM generation, build manifest generation, supply-chain checks, and artifact signing entrypoints.
- Database commands target the hosted Supabase PostgreSQL instance referenced by `DATABASE_URL`; no local Supabase stack is required.
- F05 adds append-only event ledger, `outbox_event` / `inbox_receipt` / `dead_letter_event` / `projection_checkpoint`, PostgreSQL polling consumers with row leases, audit, artifact, schema-registry, and Supabase Storage adapter baselines through Rust crates plus Supabase migrations.
- F06 adds `quantos-auth` / `quantos-policy`, `auth.users`-anchored actor/workspace/account mappings, deterministic capability checks, and service-only secret allowlist functions for Execution Gateway.
- F07 adds `quantos-runtime`, persistent workflow runs/sessions/checkpoints, leased task claiming, cancellation/timeout audit hooks, and Artifact bindings that deduplicate recovery paths after worker restarts.
- F08 adds `quantos-engine-manager`, Python engine SDK gRPC helpers, a UDS-backed `mock-engine`, cross-language contract tests for `GetMetadata/Health/Execute/StreamExecute/Cancel`, crash backoff recovery, and deterministic deadline handling.
- F09 adds `quantos-observability`, local trace/metrics/structured-log primitives, fault injection coverage, capacity alert evaluation, and ADR evidence templates for outbox, read model, storage, and secret health.
- R01 adds `quantos-market` and `market-ingestor`, approved-provider gating, normalized market tick contracts, deterministic replay dataset generation, duplicate/out-of-order deduplication, and freshness/quality anomaly events written as `MarketEvent`.
- R02 extends `quantos-storage` with immutable `DataSnapshot` metadata, lineage capture, PostgreSQL-backed quality rules, snapshot hash deduplication, and snapshot queries guarded by Supabase RLS.
- R03 extends `quantos-runtime` with research orchestration over Engine Manager, snapshot quality gating, stream-event capture, deterministic `ResearchArtifact` repository records, fast cancel confirmation, and replay-friendly checkpointing.
- R04 extends `quantos-runtime` with Signal and TradeProposal orchestration over `llmquant` and `trading-agents`, schema validation, counter-view capture, proposal expiry gates, and replay-safe proposal records with no order-side effects.
- S01 adds `quantos-strategy`, versioned strategy drafts with optimistic-concurrency conflict detection, manual/autosave versioning, approved DataSnapshot/Artifact reference gating, validation handoff rules, and Supabase migration `20260801090000_strategy_drafts` with default-deny RLS and `auth.users` audit columns.
- S02 extends `quantos-strategy` with a deterministic backtest adapter: fixed DataSnapshot binding and clock, fee/slippage cost model, access-logged look-ahead detection, snapshot freshness leakage detection, and `BacktestValidationReport` records carrying costs, environment hash, and input hash.
- TP06 adds `engines/strategy-lab`, a controlled strategy generator exposing `strategy.generate.v1` that writes only `StrategyDraftArtifact`/`StaticCheckArtifact` outputs, rejects order/secret/network/deploy prompt intents, blocks Release on static check failures, and replays through the S02 backtest pipeline via `GeneratedStrategyAdapter`.
- S03 extends `quantos-strategy` with immutable `StrategyRelease` publishing (source/image digests, parameter/data/backtest hashes, approval), content-hash dedupe with deterministic conflicts, an M3/M4 deployment policy limited to Paper/Shadow that rejects unverified or unapproved releases, and Supabase migration `20260801100000_strategy_releases` with default-deny RLS.
- X01 adds `quantos-portfolio` and `portfolio-rebuild`, a rebuildable portfolio read model (positions, valuation, realized/unrealized P&L, exposure, account state, data-as-of) projected from order/fill events, golden-snapshot verified after 10k-event replays, and persisted to Supabase PostgreSQL via migration `20260801110000_portfolio_projection` with default-deny RLS.
- `replay-cli` now supports direct PostgreSQL replay via `DATABASE_URL`, with JSONL replay kept as a fallback for local fixtures.
- Root `.env` and `.env.local` are loaded automatically by `Makefile`; see [`.env.example`](./.env.example) and [`supabase/OPERATIONS.md`](./supabase/OPERATIONS.md).
- Realtime is treated as an optional wakeup or projection notification path only; workers must always recover by rescanning PostgreSQL outbox rows after missed notifications, disconnects, or restarts.
- Supabase Storage live verification requires `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`, and `QUANTOS_RUN_SUPABASE_STORAGE_TESTS=1`.
- `make db-reset` is destructive for the remote `quantos` schema and requires `QUANTOS_DB_RESET_CONFIRM=reset_remote_schema`.
- `node` is required for remote database commands.
