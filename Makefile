SHELL := /bin/bash
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

bff-contract-check:
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
	bash ./scripts/check-secrets.sh
	node ./scripts/test-quality-gates.mjs

f01-check:
	node scripts/check-f01.mjs
	node --test scripts/f01-gate-negative.mjs

build-python:
	uv sync --locked --project engines --all-packages --all-groups
	uv build --project engines --python engines/.venv/bin/python --all-packages --wheel --no-build-isolation --out-dir artifacts/python

f01-clean-room-check:
	node scripts/verify-reproducible-builds.mjs --mode clean-room --output artifacts/reproducibility/f01-clean-room.json

f01-reproducibility-check:
	node ./scripts/verify-reproducible-builds.mjs --runs 3 --output artifacts/reproducibility/f01-build-digests.json

r01-check:
	node ./scripts/check-r01.mjs
	node --test ./scripts/r01-gate-negative.mjs
	cargo test -p quantos-market
	cargo test -p market-ingestor

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
	uv run --locked --project engines --all-packages ruff check .
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
	cargo test -p quantos-observability
	uv run --locked --project engines --all-packages pytest engines/tests/test_engine_observability.py
	node ./scripts/test-f09-adr-input.mjs

test-f09-live:
	cargo test -p quantos-observability --test postgres_capacity_monitor -- --test-threads=1 --nocapture

test-f05-live:
	@test -n "$$DATABASE_URL" || (echo "DATABASE_URL is required for the F05 PostgreSQL acceptance Gate." >&2; exit 1)
	QUANTOS_RUN_F05_POSTGRES_TESTS=1 cargo test -p quantos-event --test postgres_persistence --locked -- --test-threads=1 --nocapture
	QUANTOS_RUN_F05_POSTGRES_TESTS=1 cargo test -p quantos-storage --test postgres_persistence --locked -- --test-threads=1 --nocapture

f06-live-check:
	@test -n "$$DATABASE_URL" || (echo "DATABASE_URL is required for the F06 PostgreSQL Gate." >&2; exit 1)
	QUANTOS_RUN_F06_POSTGRES_TESTS=1 QUANTOS_F06_TOPOLOGY=$${QUANTOS_F06_TOPOLOGY:-developer_remote} cargo test -p quantos-auth --test postgres_auth_context --locked -- --test-threads=1 --nocapture

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

f06-bff-login-check:
	@test -n "$$QUANTOS_BFF_DATABASE_URL" || (echo "QUANTOS_BFF_DATABASE_URL is required." >&2; exit 1)
	QUANTOS_RUN_F06_BFF_LOGIN_TESTS=1 cargo test -p quantos-auth --test postgres_auth_context dedicated_bff_login_uses_verified_tls_and_narrow_role --locked -- --exact --nocapture

f06-auth-preflight:
	@node scripts/f06-auth-preflight.cjs

f06-test-identity-provision:
	@node scripts/f06-test-identity-provision.cjs

f06-bff-live-smoke:
	cargo build -p bff-gateway --locked
	@node scripts/f06-bff-live-smoke.cjs

f06-acceptance-gate:
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
	node --test scripts/f02-gate-negative.mjs scripts/f02-a11-gate-negative.mjs
