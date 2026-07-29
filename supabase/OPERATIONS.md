# Database Operations

QuantOS database commands operate against the hosted Supabase PostgreSQL instance referenced by `DATABASE_URL`. No local Supabase stack is used.

## Environment Variables

The repository supports `.env` and `.env.local` at the project root. `Makefile` loads them automatically before running database commands.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Native PostgreSQL connection string for the target Supabase project, branch, or controlled staging database. |
| `QUANTOS_DB_RESET_CONFIRM` | Only for `make db-reset` | Destructive reset guard. Must equal `reset_remote_schema` before the remote `quantos` schema can be dropped and recreated. |

Recommended operator workflow:

1. Keep a non-production `DATABASE_URL` in `.env.local`.
2. Leave `QUANTOS_DB_RESET_CONFIRM` empty by default.
3. Set `QUANTOS_DB_RESET_CONFIRM=reset_remote_schema` only for the specific reset invocation.
4. Remove or clear the reset guard immediately after the reset completes.

## Command Semantics

### `make db-apply`

Applies repository migrations in timestamp order to the remote database referenced by `DATABASE_URL`. Applied filenames are recorded in `quantos.schema_migrations`.

### `make db-reset`

Drops and recreates the remote `quantos` schema, then reapplies all repository migrations. This command is destructive and exits unless `QUANTOS_DB_RESET_CONFIRM=reset_remote_schema`.

### `make db-schema-diff`

Compares the repository migration filenames with the remote `quantos.schema_migrations` ledger. This is a read-only drift check and fails if the ledger is missing or differs from the repository.

### `make rls-policy-test`

Runs both layers of RLS validation:

- static migration checks in the repository,
- live checks against the remote PostgreSQL catalogs reached through `DATABASE_URL`.

## Connection Guidance

- Use a dedicated non-production Supabase project, branch database, or staging database for routine reset and migration verification.
- Keep `sslmode=require` in `DATABASE_URL`.
- Do not point `make db-reset` at a production database.
- Prefer service credentials only in controlled CI or operator environments.
- No local `psql` installation is required; the repository executes PostgreSQL checks through its Node runner.

## CI Usage

The repository workflow reads `DATABASE_URL` from GitHub Actions secrets when available. Static migration checks always run; live drift and RLS checks run only when the secret is configured.
