# Supabase Workspace

This directory is the source of truth for QuantOS database bootstrap and migration assets.

## Layout

- `migrations/`: ordered SQL migrations applied to the hosted Supabase PostgreSQL instance.
- `tests/`: SQL and policy fixtures for future database-level checks.
- `seed.sql`: optional seed data entrypoint for controlled non-production targets. Keep production secrets out of this file.

## Migration Naming Convention

All migration files must follow:

```text
YYYYMMDDHHMMSS_slug.sql
```

Rules:

1. Use a 14-digit UTC timestamp prefix.
2. Use a lowercase snake_case slug that describes one logical change.
3. Create a new migration for every schema or policy change; do not edit a migration that has already been applied outside local throwaway environments.
4. Keep each migration focused on one bounded change set: schema, index, policy, trigger, or seed bootstrap.

## Database Conventions

- User identity anchors to Supabase `auth.users(id)`.
- User-visible tenant tables must enable RLS and define explicit policies.
- UUID primary keys and foreign keys should default to `gen_random_uuid()` where generated in the database.
- Business timestamps should use `timestamptz`.
- Domain tables live under the `quantos` schema; Supabase-managed schemas such as `auth` remain external dependencies.
- Remote apply, reset, drift check, and live RLS verification use `DATABASE_URL` plus the repository Node/PostgreSQL runner.

## Common Commands

- `make db-apply`
- `make db-reset`
- `make db-migration-check`
- `make rls-policy-test`
- `make db-schema-diff`

`make db-reset` only runs when `QUANTOS_DB_RESET_CONFIRM=reset_remote_schema` is explicitly set.

See [`OPERATIONS.md`](./OPERATIONS.md) for the fixed `DATABASE_URL` and reset-guard workflow.
