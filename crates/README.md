# crates

Rust shared crates live here.

- `quantos-core`: foundational types, workspace metadata, and shared primitives.
- `quantos-auth`: tenant/user/service identity mapping, primary workspace context, and gateway authorization helpers.
- `quantos-event`: append-only event ledger, replay helpers, and PostgreSQL-backed outbox/inbox/checkpoint repositories.
- `quantos-policy`: deterministic RBAC, capability, mode, and secret-resolution policy decisions.
- `quantos-runtime`: persistent workflow runs, checkpoints, artifact bindings, deadlines, cancellation, and restart recovery.
- `quantos-storage`: artifact manifests, object key derivation, schema registry primitives, and PostgreSQL-backed storage repositories.

Future F0 tasks will add protocol, auth, event, runtime, and risk crates here.
