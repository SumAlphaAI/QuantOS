# F07 Runtime deployment and recovery

## Supported scope

The first live worker executes only `runtime.fixture.v1` with a registered `runtime.fixture` tool and `research.write` capability. It creates a deterministic JSON Artifact in Supabase Storage, then records its manifest and completes the run. Unknown workflow kinds are rejected at the HTTP boundary; a queued unknown kind is retried to its durable failure limit. Research/strategy Engine execution remains governed by their own task acceptance.

## Before start

1. Apply migrations through `20260924102000_f07_runtime_hardening.sql` to an isolated database. Check `quantos_runtime` is a no-login role and the application login can set **only** that role. Do not use the operator, BFF or Execution login for the Runtime process.
2. Set `QUANTOS_RUNTIME_DATABASE_URL` to that login with `sslmode=verify-full` and a verified CA. Set `QUANTOS_BFF_DATABASE_URL` to the independent BFF login, also with strict TLS. Set `SUPABASE_URL`, `QUANTOS_RUNTIME_STORAGE_KEY` and the exact HTTPS `QUANTOS_TERMINAL_ORIGIN`. The Storage key needs access only to `quantos-artifacts`; provision and rotate it through the environment secret manager.
3. Set `QUANTOS_RUNTIME_BIND` (default `127.0.0.1:4020`). The runtime HTTP routes use the existing `quantos_session` BFF cookie, verify the authenticated actor on every request, and require the exact Terminal Origin for writes. Keep TLS termination and external routing at the approved ingress.
4. Run `make f07-db-check` against the isolated Supabase PostgreSQL project using `DATABASE_URL`, `SUPABASE_URL` and `QUANTOS_BFF_SSLROOTCERT`. The Gate verifies both URLs identify the same project, validates TLS with the CA, applies checksum-guarded forward migrations, runs RLS and F07 recovery/performance/coverage tests, and writes `artifacts/f07/database.json`. It uses unique fixture identifiers and retires any unfinished fixture runs before exit; append-only audit entries and their tenant/user fixtures remain for evidence. It never resets the project or requires a local PostgreSQL instance. The dedicated F07 Nightly workflow uses the same target class and requires `F07_DATABASE_URL`, `F07_SUPABASE_URL` and `F07_CA_PEM` secrets. Missing target configuration fails the Gate.
5. Run `cargo fmt --check`, `cargo clippy -p quantos-runtime -p runtime-gateway --all-targets --locked -- -D warnings` and `cargo test -p quantos-runtime --lib --locked`. Archive a same-full-SHA CI/target receipt and coverage result before promoting.

## Health and recovery

- `/healthz` returns 204 only after a worker scan succeeds; 503 means the worker has not started or its last scan failed. `QUANTOS_OBSERVABILITY_ADDR`, when configured, exposes the shared observability service separately.
- The worker polls PostgreSQL every 500 ms. On restart it scans persisted queued, running and cancel-requested rows. Expired leases can be reclaimed; each claim receives a new attempt ID. Stale attempts cannot update checkpoints, bindings or terminal state. The worker reuploads the same content-addressed Artifact on replay, then records a unique run binding.
- A cancel request writes audit in the same transaction as the state change. The worker finalizes pending cancellations, and timeout sweep writes its own audit. Failed supported work is retried with bounded exponential backoff; exhausted attempts become `failed`.
- If `/healthz` remains 503, inspect structured service errors and database connectivity, the Runtime role membership, TLS CA, Storage authorization and outbox/worker backlog. Do not rewrite workflow rows manually. Restarting the binary is safe after the cause is fixed; leases expire and are reclaimed.

## Rollback

Stop new scheduling at ingress, let in-flight leases expire, and restore the previous binary only if it understands the additive F07 columns and policies. Do not drop the migration while runs or artifact bindings exist. Preserve `workflow_runs`, checkpoints, bindings and audit entries for replay. Re-enable the new binary after the cause is fixed and verify one recovered run and its Artifact content hash before reopening scheduling.

## Acceptance boundary

The local Rust tests and code-level Gate do not prove a deployed HTTP route, real Supabase Storage round trip, target RLS or F06 identity acceptance. Record these separately with the exact source SHA. F07 is not accepted while F06 remains unaccepted or the same-SHA F07 receipt is missing.
