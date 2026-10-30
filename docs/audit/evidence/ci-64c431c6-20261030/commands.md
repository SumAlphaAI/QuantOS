# Scoped checks and evidence boundaries

- `node scripts/check-pre01.mjs` (before/after register repair)
- `node scripts/pre04-inventory.mjs`
- `node --test scripts/tests/check-pre01.test.mjs scripts/pre04-gate-negative.mjs scripts/manual-database-policy.test.cjs`
- `node scripts/check-bff-generated.mjs`
- `node scripts/check-bff-contract-coverage.mjs`
- `node scripts/check-pre06.mjs`
- `node scripts/check-development-plans.mjs`
- `node scripts/test-rust-with-l02.mjs -p bff-gateway --test core_l04 --locked --offline r01_provenance_current_revocation_blocks_io_and_cold_policy_replay -- --nocapture` (original single-case diagnostic)
- `node scripts/test-rust-with-l02.mjs -p bff-gateway --test core_l04 --locked --offline -- --test-threads=4` (first ordinary mutex attempt interrupted; reentrant implementation process-suite result retained separately)
- `node scripts/test-rust-with-l02.mjs -p bff-gateway --test core_l04 --locked --offline core_l04_public_mtls_restart_replica_c10_and_four_controlled_drills`
- `node scripts/test-rust-with-l02.mjs -p bff-gateway --test core_l04 --locked --offline case_slot_reenters_and_retains_the_outer_lab` (corrected new regression only)
- `cargo test --offline --locked -p bff-gateway --test core_l04 -- --list`
- `cargo clippy --offline --locked -p bff-gateway --test core_l04 -- -D warnings`
- `cargo fmt --all -- --check`
- `node node_modules/eslint/bin/eslint.js tests/e2e/website.spec.ts scripts/pre04-gate-negative.mjs`
- Website package's exact Next build / pre03 receipt / client-secret steps via installed Node executables. First loopback SITE_ORIGIN attempt and final CI public SITE_ORIGIN attempt have distinct logs and results.
- `node node_modules/@playwright/test/cli.js test --config playwright.website.config.ts --project=chromium --project=webkit --workers=2 --retries=0`
- Firefox original case attempted locally; browser startup blocked before business test execution. A temporary headed/software-profile diagnostic also failed. No Firefox pass claimed.
- Original Gitleaks 8.28.0 complete-history entrypoint; before/after reports retained. Clean temporary history then new synthetic API-key/keyHash findings at two historical evidence paths: exit 0 then refusal exit 1.
- `git diff --check`

The process-suite source snapshot is reconstructed from the recorded scheduler-test-only patch, explicitly named as reconstructed. All bytes outside that newly added regression match the final source. The long suite's earlier scheduler-test assertion failure is retained as exit 101; a separate current-source command verifies its correction. Results are accounted by their actual scopes, without relabelling the failed suite PASS or repeating unaffected business scenarios solely for a test-self-correction.

No full unrelated workspace/release suite, real database, venue, deployment or push executed.
