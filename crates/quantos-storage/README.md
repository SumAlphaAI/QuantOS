# quantos-storage

Storage primitives for QuantOS artifacts, immutable `DataSnapshot` metadata, PostgreSQL-backed quality gates, Supabase Storage adapters, content-addressed object keys, and schema registry entries.

## Scope

- content-addressed artifact manifests and Supabase Storage upload helpers
- schema registry persistence for versioned contracts
- immutable `DataSnapshot` records with deterministic content hashes
- tenant-scoped snapshot quality rules for research, strategy, and trading usage
- PostgreSQL snapshot queries by id, content hash, and symbol
