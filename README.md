# SumAlpha QuantOS

Polyglot monorepo baseline for the QuantOS platform.

## Repository layout

- `proto/`: versioned protocol contracts and schema generation entrypoints.
- `crates/`: Rust domain crates and shared core libraries.
- `services/`: Rust service binaries built on top of the shared crates.
- `engines/`: Python engine SDK, mock engines, and engine contract tests.
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
- `replay-cli` now supports direct PostgreSQL replay via `DATABASE_URL`, with JSONL replay kept as a fallback for local fixtures.
- Root `.env` and `.env.local` are loaded automatically by `Makefile`; see [`.env.example`](./.env.example) and [`supabase/OPERATIONS.md`](./supabase/OPERATIONS.md).
- Realtime is treated as an optional wakeup or projection notification path only; workers must always recover by rescanning PostgreSQL outbox rows after missed notifications, disconnects, or restarts.
- Supabase Storage live verification requires `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`, and `QUANTOS_RUN_SUPABASE_STORAGE_TESTS=1`.
- `make db-reset` is destructive for the remote `quantos` schema and requires `QUANTOS_DB_RESET_CONFIRM=reset_remote_schema`.
- `node` is required for remote database commands.
