# Executed scoped checks

- `node scripts/test-rust-with-l02.mjs -p bff-gateway --test core_l04 --locked --offline` (initial sandbox socket refusal retained; same command passed with loopback execution permission)
- `node scripts/test-bff-fe-001-mutations.mjs artifacts/ci-360bc59/bff001`
- `node scripts/test-bff-fe-007-mutations.mjs artifacts/ci-360bc59/bff007`
- `node --test scripts/test-rust-with-l02.test.mjs scripts/bff-fe-001-gate-negative.mjs scripts/bff-fe-007-gate-negative.mjs scripts/f09-migration-ledger.test.cjs scripts/manual-database-policy.test.cjs`
- `cargo test --offline --locked -p bff-gateway --test auth_settings_provider --test audit_export_provider`
- `cargo test --offline --locked -p bff-gateway --lib live::settings_policy::tests`
- `GITLEAKS_BIN=artifacts/tools/gitleaks bash scripts/check-secrets.sh`
- Same secret entrypoint against a temporary Git history, clean then synthetic API-key addition at the historical evidence path; exit 0 then exit 1 with exactly 1 finding.
- `node --check` on all four changed/new JavaScript files
- `make -n test-rust bff-provider-test` (wiring only)
- `git diff --check`

No database connection, full workspace suite, full F01 rebuild, push or deployment performed.
