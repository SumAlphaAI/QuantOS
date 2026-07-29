# Scripts

Shared repository automation scripts live here so local commands and CI use the same checks.

Current database checks:

- `check-migration-filenames.sh`: validates Supabase migration naming and ordering.
- `check-rls-baseline.sh`: validates baseline Supabase conventions such as RLS, `auth.users`, UUID defaults, and `timestamptz`.
- `check-live-rls.sh`: validates RLS enablement, `FORCE ROW LEVEL SECURITY`, and default-deny policy posture on the remote database reached through `DATABASE_URL`.
- `db-apply.sh`: applies pending migrations to the remote PostgreSQL target.
- `db-reset.sh`: recreates the remote `quantos` schema and reapplies repository migrations.
- `db-schema-diff.sh`: compares the remote migration ledger with repository migrations.
- `db-cli.cjs`: shared Node/PostgreSQL runner for all remote database commands.

F02 supply-chain and CI scripts:

- `check-lockfiles.sh`: verifies the repository keeps Cargo, pnpm, and uv lockfiles committed.
- `check-proto.sh`: validates the `proto/` workspace shape and protects future contract onboarding.
- `check-node-licenses.mjs`: enforces the npm license allowlist in `security/node-license-allowlist.json`.
- `check-python-audit.sh`: runs Python dependency vulnerability checks from the uv workspace export.
- `check-sca-waivers.mjs`: validates waiver schema and expiry in `security/sca-waivers.json`.
- `generate-build-manifest.mjs`: writes a traceable build manifest with commit, toolchain, and lockfile digests.
- `generate-sbom.sh`: generates the repository SBOM artifact entrypoint used by CI.
- `sign-artifacts.sh`: signs generated build artifacts with either a configured key or deterministic SHA-256 fallback.
