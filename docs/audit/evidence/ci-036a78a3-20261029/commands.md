# Scoped validation commands

- `node scripts/pre04-inventory.mjs` before and after maintenance; exit 1 (3 mismatches), then exit 0.
- `node scripts/pre04-render-fields.mjs`
- `node --test scripts/pre04-gate-negative.mjs scripts/manual-database-policy.test.cjs`
- `cargo test --offline --locked -p bff-gateway --test auth_settings_provider --test audit_export_provider`
- `cargo test --offline --locked -p bff-gateway --lib live::settings_policy::tests`
- `node scripts/test-rust-with-l02.mjs -p bff-gateway --test core_l04 --locked --offline` (loopback permission)
- `node scripts/check-pre01.mjs`
- `node scripts/check-pre06.mjs`
- `node scripts/check-bff-contract-coverage.mjs`
- `node scripts/check-bff-generated.mjs`
- `node scripts/check-development-plans.mjs`
- `git diff --check`

Source review: locate original lib.rs blob by exact SHA256, diff 10d13870..036a78a3, verify current last-change 41344ffc; programmatically compare all baseline fields, historical receipts and field dictionary body.

Initial pnpm wrapper interrupted with exit 130 without a validator result; use its registered Node entrypoint. No database, full workspace/release suite, push or deployment performed.
