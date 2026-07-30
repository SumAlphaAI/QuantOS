# services

Rust service binaries live here.

- `runtime-gateway`: bootstrap binary for auth/runtime store wiring against `quantos-core`, `quantos-auth`, and `quantos-runtime`.
- `replay-cli`: replays PostgreSQL-backed event chains via `DATABASE_URL`, with JSONL fixtures kept as a fallback for local audit drills.

Future tasks will add gateway, runtime, scheduler, market, risk, and execution services.
