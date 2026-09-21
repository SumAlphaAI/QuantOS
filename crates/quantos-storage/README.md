# quantos-storage

Storage primitives for QuantOS artifacts, immutable `DataSnapshot` metadata, PostgreSQL-backed quality gates, Supabase Storage adapters, content-addressed object keys, and schema registry entries.

## Scope

- content-addressed artifact manifests and Supabase Storage upload helpers
- schema registry persistence for versioned contracts
- immutable `DataSnapshot` records with deterministic content hashes
- tenant-scoped snapshot quality rules for research, strategy, and trading usage
- PostgreSQL snapshot queries by id, content hash, and symbol
- PostgreSQL update rejection for immutable snapshot rows
- fail-closed Gate checks for tenant-bound rules, sources, source licenses, and lineage

## Validation

- `cargo test -p quantos-storage --lib`: deterministic hash, storage adapter, and 300 invalid-fixture checks
- `make r02-check`: source-contract, destructive negative, storage, strategy, and runtime checks
- `make r02-live-check`: opt-in PostgreSQL persistence, RLS-backed access, and query P95 check; requires `DATABASE_URL`
- `make f05-check`: event/storage source Gate and core coverage threshold
- `make f05-db-check`: storage, schema-registry and snapshot persistence against a fresh disposable PostgreSQL database
- `make test-supabase-storage-live`: fail-closed upload/download/delete round-trip against an explicitly configured Supabase project

## Persistence coverage

`make f05-db-coverage` includes `pg.rs` and `supabase_storage.rs` in measured
coverage. `tests/storage_http.rs` injects HTTP success, authorization/server
errors, corrupt downloads and database registration failure with compensating
DELETE. These local protocol tests are separate from live Supabase acceptance.
For an authorized isolated project, `make f05-target-coverage` also instruments
`supabase_storage_integration` against the actual service. Both coverage Gates
require a clean checkout and export per-file coverage plus the source-bound
acceptance receipt under `artifacts/f05/`.
