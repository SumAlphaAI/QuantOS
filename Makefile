SHELL := /bin/bash
.PHONY: f07-db-check f07-recovery-diagnostic f07-coverage-diagnostic f07-gateway-test f07-target-service-acceptance f07-fixture-check f07-fixture-retire f07-forward-migration f08-check f08-nightly-check
export UV_BUILD_CONSTRAINT := $(CURDIR)/engines/build-constraints.txt

ifneq ($(QUANTOS_SKIP_ENV),1)
ifneq (,$(wildcard .env))
include .env
export
endif

ifneq (,$(wildcard .env.local))
include .env.local
export
endif

endif

.PHONY: f05-db-coverage f05-target-coverage toolchain-check f01-check f01-clean-room-check f04-check f05-check f05-db-check f05-target-check f05-coverage build-python bootstrap bootstrap-rust bootstrap-python bootstrap-node lint lint-rust lint-python lint-web test test-rust test-python test-web test-browser coverage-rust coverage-rust-branch coverage-python coverage-web build build-rust build-web test-f05-live test-f09-live test-supabase-storage-live ensure-node lockfile-check proto-deps-update proto-generate proto-check proto-compat-check bff-contract-check bff-provider-test quality-gate-self-test f01-reproducibility-check r01-check r02-check r02-live-check db-apply db-reset db-migration-check db-schema-diff db-replay-check rls-policy-test license-check sca-check waiver-check tp-intake-check build-manifest sbom sign-artifacts verify-artifact-signatures observability-check f09-capacity-snapshot f09-adr-input tp01-vibe-readonly-check tp01-vibe-repository-check tp01-vibe-bootstrap tp01-vibe-provision tp01-vibe-monitor tp01-vibe-sync tp01-vibe-canary tp01-vibe-rollback ci-local

bootstrap: toolchain-check
	$(MAKE) -j3 bootstrap-rust bootstrap-python bootstrap-node

toolchain-check:
	node scripts/check-toolchains.mjs

bootstrap-rust:
	cargo fetch --locked

bootstrap-python:
	uv sync --locked --project engines --all-packages --all-groups

bootstrap-node:
	pnpm install --frozen-lockfile

lockfile-check:
	bash ./scripts/check-lockfiles.sh

proto-deps-update:
	node_modules/.bin/buf dep update

proto-generate:
	bash ./scripts/generate-proto.sh

proto-check:
	bash ./scripts/check-proto.sh
	$(MAKE) proto-compat-check

proto-compat-check:
	pnpm --filter @sumalpha/api-client build
	node scripts/check-proto-compatibility.mjs

development-plan-check:
	pnpm check:development-plans
	pnpm test:development-plans

.PHONY: development-plan-check

bff-contract-check:
	pnpm check:bff-a1-development
	pnpm check:bff-compatibility
	pnpm test:bff-remediation
	pnpm check:bff-openapi
	pnpm check:bff-generated
	pnpm check:bff-contract-coverage
	pnpm check:bff-fe-000
	pnpm test:bff-fe-000
	pnpm check:bff-fe-001
	pnpm test:bff-fe-001
	pnpm check:bff-fe-007
	pnpm test:bff-fe-007

bff-provider-test:
	cargo test -p bff-gateway

quality-gate-self-test:
	node --test scripts/f06-test-identity-context.test.cjs scripts/runtime-startup-evidence.test.cjs
	bash ./scripts/check-secrets.sh
	node ./scripts/test-quality-gates.mjs

f01-check:
	node scripts/check-f01.mjs
	node --test scripts/f01-gate-negative.mjs
	node --test scripts/capture-build-outputs.test.mjs
	node --test scripts/webpack-module-ids.test.mjs

build-python:
	uv sync --locked --project engines --all-packages --all-groups
	uv build --project engines --python engines/.venv/bin/python --all-packages --wheel --no-build-isolation --out-dir artifacts/python

f01-clean-room-check:
	node scripts/verify-reproducible-builds.mjs --mode clean-room --output artifacts/reproducibility/f01-clean-room.json

f01-reproducibility-check:
	node ./scripts/verify-reproducible-builds.mjs --runs 3 --output artifacts/reproducibility/f01-build-digests.json

r01-check:
	node ./scripts/check-r01.mjs
	node --test ./scripts/r01-gate-negative.mjs ./scripts/r01-coverage-negative.mjs ./scripts/tests/binance-supervisor.test.cjs ./scripts/tests/r01-window.test.cjs ./scripts/tests/r01-window-metrics.test.cjs ./scripts/tests/r01-commit-evidence.test.cjs ./scripts/r01-supervision-evidence.test.cjs
	cargo test -p quantos-market --lib --locked
	cargo test -p market-ingestor --locked
	$(MAKE) r01-mutation-check

r01-binance-target-check:
	node ./scripts/r01-binance-target-check.cjs

r01-binance-live-check:
	node ./scripts/r01-binance-live-check.cjs

.PHONY: r01-supervision-check r01-supervision-live-check
r01-supervision-check:
	node ./scripts/r01-supervision-check.cjs

r01-supervision-live-check:
	node ./scripts/r01-supervision-check.cjs --live

r01-mutation-check:
	node ./scripts/r01-mutation-check.mjs

r01-live-check:
	node ./scripts/r01-live-check.cjs

r01-coverage:
	QUANTOS_R01_COVERAGE=1 node ./scripts/r01-live-check.cjs
	node ./scripts/check-r01-coverage.mjs artifacts/r01/coverage.json

r01-nightly-coverage:
	RUSTUP_TOOLCHAIN=nightly QUANTOS_R01_COVERAGE=1 QUANTOS_R01_BRANCH=1 node ./scripts/r01-live-check.cjs
	node ./scripts/check-r01-coverage.mjs artifacts/r01/coverage.json --require-branches

r02-check:
	node ./scripts/check-r02.mjs
	node --test ./scripts/r02-gate-negative.mjs
	cargo test -p quantos-storage --lib
	cargo test -p quantos-strategy -p quantos-runtime --lib

r02-live-check:
	@test -n "$$DATABASE_URL" || (echo "DATABASE_URL is required for the R02 PostgreSQL persistence, RLS, and P95 check." >&2; exit 1)
	QUANTOS_RUN_R02_POSTGRES_TESTS=1 cargo test -p quantos-storage --test postgres_persistence -- --test-threads=1 --nocapture

lint: lint-rust lint-python lint-web

lint-rust:
	cargo fmt --check
	cargo clippy --workspace --all-targets -- -D warnings

lint-python:
	uv run --locked --project engines --all-packages ruff check . --extend-exclude third_party/vibe-trading/upstream-src
	uv run --locked --project engines --all-packages pyright --project engines

coverage-python:
	uv run --locked --project engines --all-packages pytest --cov=engines --cov-config=engines/pyproject.toml --cov-report=term-missing

coverage-web:
	pnpm coverage:web

coverage-rust:
	cargo llvm-cov --package quantos-core --all-features --release --fail-under-lines 90 --fail-under-regions 90 --summary-only
	cargo llvm-cov --package quantos-core --package quantos-risk --package quantos-execution --all-features --fail-under-lines 90 --fail-under-regions 85 --summary-only

coverage-rust-branch:
	cargo llvm-cov --package quantos-core --all-features --release --branch --json --output-path target/f04-branch-coverage.json
	node scripts/check-f04-branch.mjs target/f04-branch-coverage.json

f04-check:
	node --test scripts/f04-gate-negative.mjs
	cargo test -p quantos-core -p quantos-testkit --locked
	node scripts/check-f04.mjs
	cargo llvm-cov --package quantos-core --all-features --release --fail-under-lines 90 --fail-under-regions 90 --summary-only

f05-coverage:
	cargo llvm-cov --package quantos-event --package quantos-storage --lib --ignore-filename-regex '(pg|supabase_storage)\.rs' --fail-under-lines 90 --fail-under-regions 85 --summary-only

f05-check:
	node scripts/check-f05.mjs
	node --test scripts/f05-gate-negative.mjs scripts/f05-coverage.test.mjs
	cargo test -p quantos-event -p quantos-storage --lib --locked
	$(MAKE) f05-coverage

f05-db-coverage:
	QUANTOS_F05_COVERAGE=1 $(MAKE) f05-db-check

f05-target-coverage:
	QUANTOS_F05_COVERAGE=1 $(MAKE) f05-target-check

f05-db-check:
	@test -n "$$F02_PG_ADMIN_URL" || (echo "F02_PG_ADMIN_URL is required for the disposable F05 PostgreSQL Gate." >&2; exit 1)
	node scripts/f05-db-gate.cjs

f07-db-check:
	@test -n "$$DATABASE_URL" -a -n "$$SUPABASE_URL" || (echo "DATABASE_URL and SUPABASE_URL are required for the F07 Supabase Gate." >&2; exit 1)
	node scripts/f07-db-gate.cjs

f07-recovery-diagnostic:
	@test -n "$$DATABASE_URL" -a -n "$$SUPABASE_URL" || (echo "DATABASE_URL and SUPABASE_URL are required for F07 recovery diagnostics." >&2; exit 1)
	QUANTOS_F07_RECOVERY_DIAGNOSTIC=1 node scripts/f07-db-gate.cjs

f07-coverage-diagnostic:
	@test -n "$$DATABASE_URL" -a -n "$$SUPABASE_URL" || (echo "DATABASE_URL and SUPABASE_URL are required for F07 coverage diagnostics." >&2; exit 1)
	QUANTOS_F07_COVERAGE_DIAGNOSTIC=1 node scripts/f07-db-gate.cjs

f07-gateway-test:
	@test -n "$$DATABASE_URL" || (echo "DATABASE_URL is required for the F07 gateway test." >&2; exit 1)
	QUANTOS_F07_DB_REQUIRED=1 cargo test -p runtime-gateway --bin runtime-gateway --locked gateway_executes_owned_run_and_retrieves_verified_artifact -- --nocapture

f07-target-service-acceptance:
	cargo build -p bff-gateway -p runtime-gateway --locked
	@node scripts/f07-target-service-acceptance.cjs

f07-fixture-check:
	node scripts/f07-fixture-check.cjs

f07-fixture-retire:
	QUANTOS_F07_FIXTURE_RETIRE=1 node scripts/f07-fixture-check.cjs --retire

f07-forward-migration:
	QUANTOS_F07_MIGRATION_ONLY=1 node scripts/f07-db-gate.cjs

f08-check:
	cargo fmt --check
	cargo clippy -p quantos-engine-manager --all-targets --locked -- -D warnings
	cargo test -p quantos-engine-manager --locked
	uv run --locked --project engines --all-packages ruff check . --extend-exclude third_party/vibe-trading/upstream-src
	uv run --locked --project engines --all-packages pyright --project engines
	uv run --locked --project engines --all-packages pytest engines/tests --cov=quantos_engine_sdk --cov=mock_engine --cov-config=engines/pyproject.toml --cov-report=json:target/f08-python-coverage.json --cov-report=term-missing
	node scripts/check-f08-python-coverage.mjs target/f08-python-coverage.json
	cargo llvm-cov -p quantos-engine-manager --locked --json --output-path target/f08-rust-coverage.json
	node scripts/check-f08-rust-coverage.mjs target/f08-rust-coverage.json
	node --test scripts/f08-coverage-negative.mjs

f08-nightly-check:
	cargo +nightly llvm-cov --branch -p quantos-engine-manager --locked --json --output-path target/f08-rust-nightly-coverage.json
	node scripts/check-f08-rust-coverage.mjs target/f08-rust-nightly-coverage.json --require-branches
	F08_COVERAGE_MODE=nightly node --test scripts/f08-coverage-negative.mjs

f05-target-check:
	node scripts/f05-target-gate.cjs

lint-web:
	pnpm lint
	pnpm typecheck

test: test-rust test-python test-web

build: build-rust build-web build-python

build-rust:
	cargo build --workspace --locked

build-web:
	pnpm build

test-rust:
	cargo test --workspace --locked

observability-check:
	cargo test -p quantos-observability --lib --locked
	cargo test -p bff-gateway --lib f09_trace_tests --locked
	cargo test -p runtime-gateway --bin runtime-gateway f09_trace_tests --locked
	cargo build -p market-ingestor -p portfolio-rebuild --locked
	node scripts/f09-batch-trace-smoke.cjs
	uv run --locked --project engines --all-packages pytest engines/tests/test_engine_observability.py engines/tests/test_mock_engine_recovery.py
	node ./scripts/test-f09-adr-input.mjs
	node ./scripts/check-f09-observability-config.mjs
	node --test scripts/tests/f09-rule-contract.test.mjs

test-f09-live:
	@test -n "$$DATABASE_URL" || (echo "DATABASE_URL is required for the F09 PostgreSQL Gate." >&2; exit 1)
	QUANTOS_RUN_F09_POSTGRES_TESTS=1 cargo test -p quantos-observability --test postgres_capacity_monitor --locked -- --test-threads=1 --skip restricted_runtime_role_records_only_real_storage_outcomes --nocapture

f09-target-check: ensure-node
	@test -n "$$DATABASE_URL" -a -n "$$SUPABASE_URL" || (echo "DATABASE_URL and SUPABASE_URL are required for F09 target acceptance." >&2; exit 1)
	node scripts/f09-target-gate.cjs

f09-source-coverage-check: ensure-node
	@test -n "$$DATABASE_URL" -a -n "$$SUPABASE_URL" -a -n "$$QUANTOS_BFF_SSLROOTCERT" || (echo "DATABASE_URL, SUPABASE_URL and QUANTOS_BFF_SSLROOTCERT are required for F09 source coverage." >&2; exit 1)
	node scripts/f09-source-coverage.cjs

test-f05-live:
	@test -n "$$DATABASE_URL" || (echo "DATABASE_URL is required for the F05 PostgreSQL acceptance Gate." >&2; exit 1)
	QUANTOS_RUN_F05_POSTGRES_TESTS=1 cargo test -p quantos-event --test postgres_persistence --locked -- --test-threads=1 --nocapture
	QUANTOS_RUN_F05_POSTGRES_TESTS=1 cargo test -p quantos-storage --test postgres_persistence --locked -- --test-threads=1 --nocapture

f06-live-check:
	@test -n "$$DATABASE_URL" || (echo "DATABASE_URL is required for the F06 PostgreSQL Gate." >&2; exit 1)
	QUANTOS_RUN_F06_POSTGRES_TESTS=1 cargo test -p quantos-auth --test postgres_auth_context --locked -- --test-threads=1 --nocapture

f06-auth-latency-check:
	@test -n "$$QUANTOS_BFF_DATABASE_URL" || (echo "QUANTOS_BFF_DATABASE_URL is required." >&2; exit 1)
	@test "$$QUANTOS_F06_TOPOLOGY" = developer_remote || (echo "F06 latency Gate only accepts QUANTOS_F06_TOPOLOGY=developer_remote." >&2; exit 1)
	@node scripts/f06-auth-latency-gate.cjs

f06-vault-check:
	@test -n "$$DATABASE_URL" || (echo "DATABASE_URL is required for the F06 Vault Gate." >&2; exit 1)
	QUANTOS_F06_TARGET_ISOLATED=1 node scripts/f06-vault-gate.cjs

f06-rls-check:
	@test -n "$$DATABASE_URL" || (echo "DATABASE_URL is required for F06 RLS test." >&2; exit 1)
	QUANTOS_RUN_F06_POSTGRES_TESTS=1 cargo test -p quantos-auth --test postgres_auth_context authenticated_role_cannot_read_other_tenant_workspace --locked -- --exact --nocapture

f06-denial-matrix:
	@test -n "$$DATABASE_URL" || (echo "DATABASE_URL is required for the F06 denial matrix." >&2; exit 1)
	QUANTOS_RUN_F06_POSTGRES_TESTS=1 cargo test -p quantos-auth --test postgres_auth_context f06_four_category_denial_matrix --locked -- --exact --nocapture

f06-bff-session-check:
	@test -n "$$DATABASE_URL" || (echo "DATABASE_URL is required for the F06 BFF session check." >&2; exit 1)
	QUANTOS_RUN_F06_POSTGRES_TESTS=1 cargo test -p quantos-auth --test postgres_auth_context bff_session_is_bound_to_its_primary_account_and_revocation --locked -- --exact --nocapture

f06-bff-preflight:
	@node scripts/f06-bff-preflight.cjs

f06-bff-provision:
	@node scripts/f06-bff-provision.cjs

f06-runtime-login-provision:
	@node scripts/f06-runtime-login-provision.cjs

f06-execution-login-provision:
	@node scripts/f06-execution-login-provision.cjs

f06-execution-login-check:
	@test -n "$$QUANTOS_EXECUTION_DATABASE_URL" || (echo "QUANTOS_EXECUTION_DATABASE_URL is required." >&2; exit 1)
	@node scripts/f06-execution-login-check.cjs

f06-execution-service-check:
	@test -n "$$QUANTOS_EXECUTION_DATABASE_URL" || (echo "QUANTOS_EXECUTION_DATABASE_URL is required." >&2; exit 1)
	cargo build -p execution-gateway --locked
	@target/debug/execution-gateway

f06-execution-command-smoke:
	@test -n "$$DATABASE_URL" || (echo "DATABASE_URL is required." >&2; exit 1)
	@test -n "$$QUANTOS_EXECUTION_DATABASE_URL" || (echo "QUANTOS_EXECUTION_DATABASE_URL is required." >&2; exit 1)
	cargo build -p execution-gateway --locked
	QUANTOS_F06_TARGET_ISOLATED=1 node scripts/f06-execution-command-smoke.cjs

f06-runtime-login-check:
	@test -n "$$QUANTOS_RUNTIME_DATABASE_URL" || (echo "QUANTOS_RUNTIME_DATABASE_URL is required." >&2; exit 1)
	@node scripts/f06-runtime-login-check.cjs

f06-runtime-live-smoke:
	cargo build -p bff-gateway -p runtime-gateway --locked
	@node scripts/f06-runtime-live-smoke.cjs

f06-bff-login-check:
	@test -n "$$QUANTOS_BFF_DATABASE_URL" || (echo "QUANTOS_BFF_DATABASE_URL is required." >&2; exit 1)
	QUANTOS_RUN_F06_BFF_LOGIN_TESTS=1 cargo test -p quantos-auth --test postgres_auth_context dedicated_bff_login_uses_verified_tls_and_narrow_role --locked -- --exact --nocapture

f06-auth-preflight:
	@node scripts/f06-auth-preflight.cjs

.PHONY: f06-test-identity-check f06-test-identity-restore
f06-test-identity-check:
	@node scripts/f06-test-identity-context.cjs

f06-test-identity-restore:
	@node scripts/f06-test-identity-context.cjs --restore-missing

f06-test-identity-provision:
	@node scripts/f06-test-identity-provision.cjs

f06-bff-live-smoke:
	cargo build -p bff-gateway --locked
	@node scripts/f06-bff-live-smoke.cjs

f06-acceptance-gate:
	node --test scripts/f06-test-identity-context.test.cjs scripts/runtime-startup-evidence.test.cjs
	node --test scripts/f06-acceptance-gate-negative.mjs
	node scripts/check-f06-acceptance.mjs

test-supabase-storage-live:
	@test -n "$$DATABASE_URL" || (echo "DATABASE_URL is required for the F05 Supabase Storage acceptance Gate." >&2; exit 1)
	@test -n "$$SUPABASE_URL" || (echo "SUPABASE_URL is required for the F05 Supabase Storage acceptance Gate." >&2; exit 1)
	@test -n "$$SUPABASE_SERVICE_ROLE_KEY" || (echo "SUPABASE_SERVICE_ROLE_KEY is required for the F05 Supabase Storage acceptance Gate." >&2; exit 1)
	QUANTOS_RUN_SUPABASE_STORAGE_TESTS=1 cargo test -p quantos-storage --test supabase_storage_integration -- --nocapture

test-python:
	uv run --locked --project engines --all-packages pytest

test-web:
	pnpm test

test-browser:
	pnpm test:browser

ensure-node:
	@command -v node >/dev/null 2>&1 || (echo "node is required for DATABASE_URL-driven PostgreSQL commands." >&2; exit 1)

db-apply: ensure-node
	bash ./scripts/db-apply.sh

db-reset: ensure-node
	bash ./scripts/db-reset.sh

db-migration-check:
	bash ./scripts/check-migration-filenames.sh
	bash ./scripts/check-rls-baseline.sh

db-schema-diff: ensure-node
	bash ./scripts/db-schema-diff.sh

db-replay-check: ensure-node
	node ./scripts/db-cli.cjs replay-check

rls-policy-test: ensure-node
	bash ./scripts/check-rls-baseline.sh
	bash ./scripts/check-live-rls.sh

license-check:
	@test "$$(cargo deny --version)" = "cargo-deny 0.20.2" || (echo "cargo-deny 0.20.2 required" >&2; exit 1)
	cargo deny --locked check licenses bans sources
	node ./scripts/check-node-licenses.mjs
	uv run --locked --project engines --all-packages --all-groups python scripts/check-python-licenses.py

sca-check:
	node --test scripts/tests/glib-backport.test.mjs scripts/braces-backport.test.mjs
	node scripts/check-sca.mjs

waiver-check:
	node ./scripts/check-sca-waivers.mjs

tp-intake-check:
	node ./scripts/check-tp-intake.mjs

build-manifest:
	node ./scripts/generate-build-manifest.mjs --output artifacts/release/manifest.json

sbom:
	bash ./scripts/generate-sbom.sh

sign-artifacts:
	bash ./scripts/sign-artifacts.sh artifacts/release/manifest.json

verify-artifact-signatures:
	bash ./scripts/verify-artifact-signatures.sh artifacts/release/manifest.json
	node scripts/verify-release.mjs artifacts/release "$$(git rev-parse HEAD)"

f09-capacity-snapshot:
	cargo run -p capacity-monitor -- --lookback-seconds 900

f09-adr-input: ensure-node
	node ./scripts/generate-f09-adr-input.mjs --input artifacts/observability/f09-alerts.json --output artifacts/observability/f09-capacity-adr.md

tp01-vibe-readonly-check: ensure-node
	node ./scripts/check-vibe-repositories.mjs --baseline ./third_party/vibe-trading/baseline.lock.json --remote-lock ./forks/vibe-trading/repository.lock.json --readonly ./third_party/vibe-trading/upstream-src --allow-missing-fork 1
	node ./scripts/test-vibe-repository-gate.mjs

tp01-vibe-repository-check: ensure-node
	node ./scripts/check-vibe-repositories.mjs --baseline ./third_party/vibe-trading/baseline.lock.json --remote-lock ./forks/vibe-trading/repository.lock.json --readonly ./third_party/vibe-trading/upstream-src --fork "$${QUANTOS_VIBE_FORK_PATH:-artifacts/third_party/vibe-trading/controlled-fork}"
	node ./scripts/provision-vibe-github-governance.mjs

tp01-vibe-bootstrap: ensure-node
	node ./scripts/bootstrap-vibe-repositories.mjs

tp01-vibe-provision: tp01-vibe-bootstrap
	node ./scripts/provision-vibe-github-governance.mjs --apply

tp01-vibe-monitor: ensure-node
	node ./scripts/check-vibe-upstream.mjs --baseline ./third_party/vibe-trading/baseline.lock.json --json-output ./artifacts/third_party/vibe-trading/upstream-candidates.json --markdown-output ./artifacts/third_party/vibe-trading/upstream-candidates.md

tp01-vibe-sync: ensure-node
	node ./scripts/sync-vibe.mjs --baseline ./third_party/vibe-trading/baseline.lock.json --patch-queue ./forks/vibe-trading/patch-queue/queue.json --candidate-report ./artifacts/third_party/vibe-trading/upstream-candidates.json --json-output ./artifacts/third_party/vibe-trading/sync-vibe/summary.json --markdown-output ./artifacts/third_party/vibe-trading/sync-vibe/summary.md --decision-dir ./artifacts/third_party/vibe-trading/sync-vibe/decisions --issue-dir ./artifacts/third_party/vibe-trading/sync-vibe/issues

tp01-vibe-canary: ensure-node
	node scripts/generate-build-manifest.mjs --metadata-only --output artifacts/build/build-manifest.json
	node ./scripts/tp01-vibe-canary.mjs --policy ./third_party/vibe-trading/canary-policy.json --scenario ./scripts/fixtures/tp01-vibe-canary/healthy-7d.json --output-dir ./artifacts/third_party/vibe-trading/canary/current --build-manifest ./artifacts/build/build-manifest.json && bash ./scripts/sign-artifacts.sh ./artifacts/third_party/vibe-trading/canary/current/release-manifest.json ./artifacts/third_party/vibe-trading/canary/current/drill-report.md

tp01-vibe-rollback: ensure-node
	node ./scripts/tp01-vibe-rollback.mjs --state ./artifacts/third_party/vibe-trading/canary/current/rollout-state.json --action rollback --reason "operator initiated rollback" --output-state ./artifacts/third_party/vibe-trading/canary/current/rollout-state.json --output-report ./artifacts/third_party/vibe-trading/canary/current/rollback-action.md

ci-local: lockfile-check proto-check bff-contract-check db-migration-check lint test build

.PHONY: f02-db-check f02-package f02-check
f02-db-check:
	node scripts/f02-db-gate.cjs

f02-package:
	cargo build --workspace --release --locked
	pnpm build
	$(MAKE) build-python sbom
	node scripts/package-release.mjs
	$(MAKE) build-manifest

f02-check:
	node --test scripts/f02-gate-negative.mjs scripts/f02-a11-gate-negative.mjs scripts/playwright-git-history.test.mjs

.PHONY: r01-window-check
r01-window-check:
	node ./scripts/r01-window-check.cjs
