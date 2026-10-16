# portfolio-rebuild

Generate a deterministic local event tape and rebuild a Portfolio projection:

```sh
cargo run -p portfolio-rebuild -- generate-replay --output replay.jsonl
cargo run -p portfolio-rebuild -- rebuild --input replay.jsonl --golden crates/quantos-portfolio/tests/golden/portfolio_snapshot.json
```

`--emit-golden <file>` emits the rebuilt display snapshot. `--risk-output <file> --risk-at <RFC3339> --max-age-seconds <1..3600>` also emits a bound, fresh RiskInputSnapshot if the owned input tape contains explicit active account state and source marks for every open position. The default replay intentionally has no account-state authority; it cannot silently become a risk-ready account. Both golden comparison and requested risk validation precede output writes. Invalid/missing/stale data return a nonzero status and preserve existing requested output files.

Each replay uses the tape's explicit global sequence and timestamps. Cold rebuild reads the whole tape; it does not claim persistent incremental-consumer or cross-process database recovery acceptance. The local CLI tests launch real processes against temporary owned fixtures.

Persistence is a separate explicit operation using `--use-database-env`, a supplied tenant/account, the already configured authorized Supabase DATABASE_URL and the applied forward migration. An ordinary offline command does not read the database environment or connect. Never put credentials in committed commands or documents, and do not create a local PostgreSQL/Supabase service.

Normal commands export JSONL traces through `QUANTOS_TRACE_EXPORT_PATH`. Setting `QUANTOS_OBSERVABILITY_ADDR` runs the shared health, metrics, correlation-trace and structured-error HTTP surface instead of a batch command. Local tests use their own trace files and clear inherited credentials/service overrides.

See [X01 local admission](../../docs/operations/x01-local-admission.md) for the full dependency, target and formal-acceptance boundaries.
