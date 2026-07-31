# services

Rust service binaries live here.

- `runtime-gateway`: bootstrap binary for auth/runtime store wiring against `quantos-core`, `quantos-auth`, and `quantos-runtime`.
- `market-ingestor`: generates deterministic market replay JSONL fixtures and ingests them through `quantos-market` into an append-only event ledger.
- `replay-cli`: replays PostgreSQL-backed event chains via `DATABASE_URL`, with JSONL fixtures kept as a fallback for local audit drills.

Future tasks will add gateway, runtime, scheduler, market, risk, and execution services.
