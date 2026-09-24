# Database Operations

QuantOS database commands operate against the hosted Supabase PostgreSQL instance referenced by `DATABASE_URL`. No local Supabase stack is used.

## Environment Variables

The repository supports `.env` and `.env.local` at the project root. `Makefile` loads them automatically before running database commands.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Operator/migration connection string for the target Supabase project, branch, or controlled staging database. Never supply this URL to BFF or Execution Gateway. |
| `QUANTOS_BFF_DATABASE_URL` | Live BFF only | Dedicated login with membership only in `quantos_bff`, without `service_role`, superuser, BYPASSRLS, or Vault read privilege; `sslmode=verify-full` is mandatory. |
| `QUANTOS_EXECUTION_DATABASE_URL` | Live Execution only | Dedicated login with membership only in `quantos_execution_gateway`, without `service_role`, superuser, BYPASSRLS, or Vault read privilege; `sslmode=verify-full` is mandatory. |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `QUANTOS_TERMINAL_ORIGIN` | Live BFF only | Supabase Auth validation endpoint and the exact HTTPS Terminal origin. The publishable key is not a `service_role` key. |
| `QUANTOS_BFF_ENVIRONMENT` | Live BFF only | Explicit `dev`, `staging`, or `prod` value returned in the session contract. |
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

### `make db-replay-check`

Rewrites the repository migrations to a randomized `quantos_replay_*` schema, executes all migrations inside one database transaction, verifies that base tables were created, and always rolls the transaction back. This provides an empty-schema replay check without dropping or mutating the active `quantos` schema.

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

## L02 Execution Secret Zone Rotation Runbook

Applies to the restricted execution zone (`quantos_execution_gateway` role, `quantos.execution_secret_refs`, L01 venue credentials, and mTLS identities).

### Rules

- Secret material lives only in Supabase Vault. Code, fixtures, migrations, and reports must carry `vault://` / `secret://` references only — never key material. Dynamic Vault leases are intentionally not used.
- Only the Execution Gateway resolves plaintext through `quantos.resolve_execution_vault_secret(session_hash, secret_name, command_expiry)`. The previous `resolve_execution_secret_ref` overloads are revoked from application roles. Research engines, UI sessions, and ordinary BFF roles have no EXECUTE grant.
- Supabase's platform-managed `service_role` may retain direct `vault.decrypted_secrets` access. It is an **operator/platform exception only**; neither BFF nor Engine may hold it, including through inherited roles or a shared connection URL. Both services reject elevated login roles at startup.
- Egress from the execution zone is limited to the approved testnet venue host and the platform control plane (`EgressPolicy::execution_default`). Adding a host requires a reviewed change to the allowlist.
- Service sessions and issued commands carry TTLs; expired ones are rejected without retry.

### Credential rotation (target recovery ≤ 5 minutes)

1. Issue the new credential (certificate or Vault entry version) and register its fingerprint with the gateway out of band.
2. Deploy the new credential to the gateway; the previous credential remains valid for up to 5 minutes (`ROTATION_RECOVERY_WINDOW`) while connections drain.
3. Verify the gateway reports the new credential version as active and venue smoke checks pass.
4. Update `quantos.execution_secret_refs.rotated_at` for the rotated entry.
5. After at most 5 minutes, revoke the previous credential and set `revoked_at` if the entry is retired. Stale credentials are rejected automatically.

### Revocation (incident)

1. Set `quantos.execution_secret_refs.revoked_at = now()` for the compromised entry and revoke the matching mTLS identity.
2. All subsequent resolutions fail closed (`ZONE_SECRET_REVOKED` / `ZONE_MTLS_INVALID`); no cache path bypasses this.
3. Rotate in a fresh credential using the steps above, then clear the incident per the Operations runbook.

## F06 isolated acceptance and application login setup

Use separate login roles for BFF and Execution. An operator creates each login outside migrations and grants only `quantos_bff` or `quantos_execution_gateway` membership respectively. Set their connection URLs only in the corresponding service environment. Do not reuse `DATABASE_URL` or a Supabase `service_role` URL. The application checks the effective login and changes to its restricted role at startup.

The `DATABASE_URL` operator/test URL may use `sslmode=require` for existing isolated PostgreSQL Gates; this does not validate the server certificate. Live application URLs must use `sslmode=verify-full`. When the database uses a private CA, include its PEM file path as `sslrootcert` in the application URL. On 2026-09-24 the configured isolated pooler failed strict native TLS with “The validity period in the certificate exceeds the maximum allowed”; a separate Node/OpenSSL probe reported `SELF_SIGNED_CERT_IN_CHAIN`. A trusted CA chain or a verified endpoint is required before live BFF/Execution acceptance; do not weaken the live service check to make this endpoint pass.

On the approved isolated test database, run `make db-replay-check`, `make db-migration-check`, `make rls-policy-test`, `make f06-rls-check`, `make f06-vault-check`, and `make f06-live-check`. The Makefile loads `.env.local`; a direct `cargo test` does not. `f06-live-check` requires 100 samples and a declared `QUANTOS_F06_TOPOLOGY` (`developer_remote` or `same_region`). A green isolated SQL Gate does not prove deployed BFF/Execution, real OIDC, or same-region latency. Record those results against the exact source commit before changing F06 review status to `ACCEPTED`.
