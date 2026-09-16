SHELL := /bin/bash

ifneq (,$(wildcard .env))
include .env
export
endif

ifneq (,$(wildcard .env.local))
include .env.local
export
endif

.PHONY: bootstrap bootstrap-rust bootstrap-python bootstrap-node lint lint-rust lint-python lint-web test test-rust test-python test-web test-browser coverage-rust coverage-python coverage-web build build-rust build-web test-f05-live test-f09-live test-supabase-storage-live ensure-node lockfile-check proto-generate proto-check bff-contract-check bff-provider-test quality-gate-self-test f01-reproducibility-check db-apply db-reset db-migration-check db-schema-diff db-replay-check rls-policy-test license-check sca-check waiver-check tp-intake-check build-manifest sbom sign-artifacts verify-artifact-signatures observability-check f09-capacity-snapshot f09-adr-input tp01-vibe-readonly-check tp01-vibe-repository-check tp01-vibe-bootstrap tp01-vibe-provision tp01-vibe-monitor tp01-vibe-sync tp01-vibe-canary tp01-vibe-rollback ci-local

bootstrap: bootstrap-rust bootstrap-python bootstrap-node

bootstrap-rust:
	cargo fetch --locked

bootstrap-python:
	uv sync --frozen --project engines --all-packages

bootstrap-node:
	corepack enable pnpm
	pnpm install --frozen-lockfile

lockfile-check:
	bash ./scripts/check-lockfiles.sh

proto-generate:
	bash ./scripts/generate-proto.sh

proto-check:
	bash ./scripts/check-proto.sh

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
	node ./scripts/check-secrets.mjs
	node ./scripts/test-quality-gates.mjs

f01-reproducibility-check:
	node ./scripts/verify-reproducible-builds.mjs --runs 3 --output artifacts/reproducibility/f01-build-digests.json

lint: lint-rust lint-python lint-web

lint-rust:
	cargo fmt --check
	cargo clippy --workspace --all-targets -- -D warnings

lint-python:
	uv run --project engines --all-packages ruff check .
	uv run --project engines --all-packages pyright --project engines

coverage-python:
	uv run --project engines --all-packages pytest --cov=engines --cov-config=engines/pyproject.toml --cov-report=term-missing

coverage-web:
	pnpm coverage:web

coverage-rust:
	cargo llvm-cov --package quantos-core --package quantos-risk --package quantos-execution --all-features --fail-under-lines 90 --fail-under-regions 85 --summary-only

lint-web:
	pnpm lint
	pnpm typecheck

test: test-rust test-python test-web

build: build-rust build-web

build-rust:
	cargo build --workspace

build-web:
	pnpm build

test-rust:
	cargo test --workspace

observability-check:
	cargo test -p quantos-observability
	uv run --project engines --all-packages pytest engines/tests/test_engine_observability.py
	node ./scripts/test-f09-adr-input.mjs

test-f09-live:
	cargo test -p quantos-observability --test postgres_capacity_monitor -- --test-threads=1 --nocapture

test-f05-live:
	cargo test -p quantos-event --test postgres_persistence -- --test-threads=1 --nocapture
	cargo test -p quantos-storage --test postgres_persistence -- --test-threads=1 --nocapture

test-supabase-storage-live:
	QUANTOS_RUN_SUPABASE_STORAGE_TESTS=1 cargo test -p quantos-storage --test supabase_storage_integration -- --nocapture

test-python:
	uv run --project engines --all-packages pytest

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
	cargo deny check licenses bans sources
	node ./scripts/check-node-licenses.mjs

sca-check:
	cargo deny check advisories
	bash ./scripts/check-python-audit.sh
	pnpm audit --prod --audit-level=high

waiver-check:
	node ./scripts/check-sca-waivers.mjs

tp-intake-check:
	node ./scripts/check-tp-intake.mjs

build-manifest:
	node ./scripts/generate-build-manifest.mjs --output artifacts/build/build-manifest.json

sbom:
	bash ./scripts/generate-sbom.sh

sign-artifacts:
	bash ./scripts/sign-artifacts.sh artifacts/build/build-manifest.json artifacts/sbom/quantos.spdx.json

verify-artifact-signatures:
	bash ./scripts/verify-artifact-signatures.sh artifacts/build/build-manifest.json artifacts/sbom/quantos.spdx.json

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

tp01-vibe-canary: ensure-node build-manifest
	node ./scripts/tp01-vibe-canary.mjs --policy ./third_party/vibe-trading/canary-policy.json --scenario ./scripts/fixtures/tp01-vibe-canary/healthy-7d.json --output-dir ./artifacts/third_party/vibe-trading/canary/current --build-manifest ./artifacts/build/build-manifest.json && bash ./scripts/sign-artifacts.sh ./artifacts/third_party/vibe-trading/canary/current/release-manifest.json ./artifacts/third_party/vibe-trading/canary/current/drill-report.md

tp01-vibe-rollback: ensure-node
	node ./scripts/tp01-vibe-rollback.mjs --state ./artifacts/third_party/vibe-trading/canary/current/rollout-state.json --action rollback --reason "operator initiated rollback" --output-state ./artifacts/third_party/vibe-trading/canary/current/rollout-state.json --output-report ./artifacts/third_party/vibe-trading/canary/current/rollback-action.md

ci-local: lockfile-check proto-check bff-contract-check db-migration-check lint test build
