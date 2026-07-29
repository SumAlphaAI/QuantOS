# crates

Rust shared crates live here.

- `quantos-core`: foundational types, workspace metadata, and shared primitives.
- `quantos-event`: append-only event ledger, replay helpers, and PostgreSQL-backed outbox/inbox/checkpoint repositories.
- `quantos-storage`: artifact manifests, object key derivation, schema registry primitives, and PostgreSQL-backed storage repositories.

Future F0 tasks will add protocol, auth, event, runtime, and risk crates here.
