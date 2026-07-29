# services

Rust service binaries live here.

- `runtime-gateway`: placeholder binary that proves service wiring against `quantos-core`.
- `replay-cli`: replays PostgreSQL-backed event chains via `DATABASE_URL`, with JSONL fixtures kept as a fallback for local audit drills.

Future tasks will add gateway, runtime, scheduler, market, risk, and execution services.
