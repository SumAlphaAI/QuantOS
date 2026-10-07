# quantos-storage

Immutable DataSnapshot metadata, tenant-bound quality rules, PostgreSQL persistence, content-addressed artifacts and Supabase Storage recovery.

## Contracts

`DataSnapshotRecord` exposes read-only fields. Construction, deserialization, persistence, cold reads and Gate evaluation validate the canonical hash, derived expiry and chronology. Timestamps normalize to PostgreSQL microseconds before hashing; maximum age is 0–86400 seconds, each input vector at most 1024 entries and the canonical input at most 1 MiB. Strategy/Trading rules cannot disable quality, license or freshness checks. Research exceptions are explicit and do not grant commercial usage rights.

Snapshot and rule mutations require `SnapshotWriteContext` with an active tenant-bound actor, matching capability, correlation/causation IDs and a reason. Database mutations and audit entries commit atomically. Member reads use `quantos_snapshot_api`; authenticated roles do not receive direct table access. Legacy facts without verifiable canonical payload or valid references are retained and rejected on reads; issue a validated replacement instead of updating history.

Storage upload-and-register writes a durable intent before HTTP, prohibits overwrite and verifies an existing object's bytes. Registration failure retains the object and returns a recovery attempt ID. `reconcile_upload` retries GET/hash verification and registration; it never compensates by deleting an existing object.

## Validation

- `make QUANTOS_SKIP_ENV=1 r02-check`: deterministic Rust tests, structural negatives, coverage validator negatives and four compiled behavior mutations; no database connection.
- `make r02-live-check`: configured Supabase PostgreSQL and Storage, native success/rejection/recovery tests, named fixture actors, cleanup receipt and uncached SQL P95 baseline.
- `make r02-target-coverage`: the same target suite plus clean LLVM instrumentation, excluding test source; each of the five production files requires line ≥90% and region ≥85%.
- `make r02-release-performance`: explicitly enforces uncached query P95 <300ms for the release environment; this is separate from development correctness.

Provide an empty `QUANTOS_R02_EVIDENCE_DIR` for each run. Tests retain immutable metadata/audits, deactivate this run's actors and remove only this run's owned temporary objects. Failed evidence remains failed. Use existing `.env.local` configuration without printing credentials. Do not create a local PostgreSQL/Supabase, container or temporary database.

See [operations](../../docs/runbooks/r02_snapshot_operations.md), [design decision](../../docs/adr/20261007-r02-snapshot-trust-boundaries.md) and [repair validation](../../docs/audit/R02-remediation-2026-10-07.md). Local/target component passes do not establish deployment, same-SHA hosted CI, upstream provider permission or formal acceptance.
