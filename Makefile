SHELL := /bin/bash

ifneq (,$(wildcard .env))
include .env
export
endif

ifneq (,$(wildcard .env.local))
include .env.local
export
endif

.PHONY: bootstrap bootstrap-rust bootstrap-python bootstrap-node lint lint-rust lint-python lint-web test test-rust test-python test-web build build-rust build-web test-f05-live test-supabase-storage-live ensure-node lockfile-check proto-generate proto-check db-apply db-reset db-migration-check db-schema-diff rls-policy-test license-check sca-check waiver-check build-manifest sbom sign-artifacts observability-check f09-adr-input tp01-vibe-monitor tp01-vibe-sync tp01-vibe-canary tp01-vibe-rollback ci-local

bootstrap: bootstrap-rust bootstrap-python bootstrap-node

bootstrap-rust:
	cargo fetch --locked

bootstrap-python:
	uv sync --project engines --all-packages

bootstrap-node:
	corepack enable pnpm
	pnpm install --frozen-lockfile

lockfile-check:
	bash ./scripts/check-lockfiles.sh

proto-generate:
	bash ./scripts/generate-proto.sh

proto-check:
	bash ./scripts/check-proto.sh

lint: lint-rust lint-python lint-web

lint-rust:
	cargo fmt --check
	cargo clippy --workspace --all-targets -- -D warnings

lint-python:
	uv run --project engines --all-packages ruff check .

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

test-f05-live:
	cargo test -p quantos-event --test postgres_persistence -- --nocapture
	cargo test -p quantos-storage --test postgres_persistence -- --nocapture

test-supabase-storage-live:
	cargo test -p quantos-storage --test supabase_storage_integration -- --nocapture

test-python:
	uv run --project engines --all-packages pytest

test-web:
	pnpm test

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

build-manifest:
	node ./scripts/generate-build-manifest.mjs --output artifacts/build/build-manifest.json

sbom:
	bash ./scripts/generate-sbom.sh

sign-artifacts:
	bash ./scripts/sign-artifacts.sh artifacts/build/build-manifest.json artifacts/sbom/quantos.spdx.json

f09-adr-input: ensure-node
        node ./scripts/generate-f09-adr-input.mjs --input artifacts/observability/f09-alerts.json --output artifacts/observability/f09-capacity-adr.md

tp01-vibe-monitor: ensure-node
	node ./scripts/check-vibe-upstream.mjs --baseline ./third_party/vibe-trading/baseline.lock.json --json-output ./artifacts/third_party/vibe-trading/upstream-candidates.json --markdown-output ./artifacts/third_party/vibe-trading/upstream-candidates.md

tp01-vibe-sync: ensure-node
	node ./scripts/sync-vibe.mjs --baseline ./third_party/vibe-trading/baseline.lock.json --patch-queue ./forks/vibe-trading/patch-queue/queue.json --candidate-report ./artifacts/third_party/vibe-trading/upstream-candidates.json --json-output ./artifacts/third_party/vibe-trading/sync-vibe/summary.json --markdown-output ./artifacts/third_party/vibe-trading/sync-vibe/summary.md --decision-dir ./artifacts/third_party/vibe-trading/sync-vibe/decisions --issue-dir ./artifacts/third_party/vibe-trading/sync-vibe/issues

tp01-vibe-canary: ensure-node build-manifest
	node ./scripts/tp01-vibe-canary.mjs --policy ./third_party/vibe-trading/canary-policy.json --scenario ./scripts/fixtures/tp01-vibe-canary/healthy-7d.json --output-dir ./artifacts/third_party/vibe-trading/canary/current --build-manifest ./artifacts/build/build-manifest.json && bash ./scripts/sign-artifacts.sh ./artifacts/third_party/vibe-trading/canary/current/release-manifest.json ./artifacts/third_party/vibe-trading/canary/current/drill-report.md

tp01-vibe-rollback: ensure-node
	node ./scripts/tp01-vibe-rollback.mjs --state ./artifacts/third_party/vibe-trading/canary/current/rollout-state.json --action rollback --reason "operator initiated rollback" --output-state ./artifacts/third_party/vibe-trading/canary/current/rollout-state.json --output-report ./artifacts/third_party/vibe-trading/canary/current/rollback-action.md

ci-local: lockfile-check proto-check db-migration-check lint test build
