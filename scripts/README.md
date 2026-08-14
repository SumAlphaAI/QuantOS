# Scripts

Shared repository automation scripts live here so local commands and CI use the same checks.

BFF contract generation and gates:

- `generate-bff-contracts.mjs`: generates the typed BFF client contract, bundled component JSON Schema, operation manifest, and MSW handlers from `bff/openapi/quantos-bff.v1.yaml`.
- `check-bff-generated.mjs`: regenerates those artifacts in a temporary directory and fails on any byte-level drift.
- `check-bff-openapi.mjs`: validates the frozen OpenAPI structure, local references, operation IDs, command idempotency headers, and SSE resume parameters.
- `check-bff-contract-coverage.mjs`: verifies every frozen operation and component is represented in generated artifacts and every operation is referenced by the page API coverage register.
- `check-g0-records.mjs`: rejects stale G0 contradictions, an unchecked six-party decision, or post-G0 ledger rows without owner, calendar date, and compatibility strategy.

Current database checks:

- `check-migration-filenames.sh`: validates Supabase migration naming and ordering.
- `check-rls-baseline.sh`: validates baseline Supabase conventions such as RLS, `auth.users`, UUID defaults, and `timestamptz`.
- `check-live-rls.sh`: validates RLS enablement, `FORCE ROW LEVEL SECURITY`, and default-deny policy posture on the remote database reached through `DATABASE_URL`.
- `db-apply.sh`: applies pending migrations to the remote PostgreSQL target.
- `db-reset.sh`: recreates the remote `quantos` schema and reapplies repository migrations.
- `db-schema-diff.sh`: compares the remote migration ledger with repository migrations.
- `node scripts/db-cli.cjs replay-check`: replays every migration inside a transaction against a randomized isolated schema, validates that tables were created, and always rolls back.
- `db-cli.cjs`: shared Node/PostgreSQL runner for all remote database commands.

F02 supply-chain and CI scripts:

- `check-lockfiles.sh`: verifies the repository keeps Cargo, pnpm, and uv lockfiles committed.
- `check-proto.sh`: validates the `proto/` workspace shape and protects future contract onboarding.
- `check-node-licenses.mjs`: enforces the npm license allowlist in `security/node-license-allowlist.json`.
- `check-python-audit.sh`: runs Python dependency vulnerability checks from the uv workspace export.
- `check-vibe-upstream.mjs`: checks TP01's locked `HKUDS/Vibe-Trading` baseline against upstream `main` and release tags, then writes candidate reports without updating dependencies.
- `sync-vibe-lib.mjs`: shared classification and rendering helpers for TP01-E sync decisions.
- `sync-vibe.mjs`: classifies TP01 sync candidates into `S0`-`S3`, writes decision records and candidate issue drafts, and can block CI when required.
- `tp01-vibe-rollout-lib.mjs`: shared canary, alert, drill, and rollback helpers for TP01-F.
- `tp01-vibe-canary.mjs`: evaluates TP01 canary scenarios, writes rollout state and release manifests, and emits drill evidence.
- `tp01-vibe-rollback.mjs`: performs a one-command disable or rollback transition for the current TP01 rollout state.
- `check-sca-waivers.mjs`: validates waiver schema and expiry in `security/sca-waivers.json`.
- `generate-build-manifest.mjs`: writes a traceable build manifest with commit, toolchain, and lockfile digests.
- `verify-reproducible-builds.mjs`: performs independent Rust release,
  TypeScript dist, and Python wheel builds and fails unless every component
  digest matches across the configured run count.
- `check-tp-intake.mjs`: validates TP02-TP05 immutable baseline/license/dependency
  evidence and capability inventories, and rejects unapproved upstream packages
  from the Python production lock.
- `sign-artifacts.sh`: emits local SHA-256 integrity files by default; release CI
  sets `QUANTOS_REQUIRE_FORMAL_SIGNATURE=1` and fails closed unless
  `QUANTOS_SIGNING_KEY` is available for HMAC-SHA256.
- `verify-artifact-signatures.sh`: recomputes HMAC-SHA256 with the CI signing
  key and rejects missing, empty, or mismatched formal signatures.
- `generate-sbom.sh`: generates the repository SBOM artifact entrypoint used by CI.
