# market-ingestor

R01 v2 provides durable approved-source ingestion into the configured Supabase PostgreSQL event ledger. `ingest-source` and `poll-source` use atomic source receipts, events, audit and outbox; `dispatch`/`requeue` reuse F05 recovery. Provider configuration requires license/approval references and explicit instrument aliases. Live mode rejects fixture approvals.

`generate-replay` and `ingest-replay` are bounded deterministic **in-memory validation** commands:

```bash
export QUANTOS_TRACE_EXPORT_PATH=/private/tmp/market-trace.jsonl
cargo run -p market-ingestor --locked -- generate-replay --output /private/tmp/market-replay.jsonl --count 100000
cargo run -p market-ingestor --locked -- ingest-replay --input /private/tmp/market-replay.jsonl
```

All write commands require an absolute writable trace exporter. Optional `QUANTOS_OBSERVABILITY_ADDR` exposes the shared loopback health/ready/metrics/trace surface. Configuration, persistent commands, rejection, reconnect, dead-letter replay and rollback are in [R01 Runbook](../../docs/runbooks/r01_market_ingestion.md). Schema compatibility is in [Market v2 ADR](../../docs/adr/20261002-r01-market-v2-durable-ingestion.md).
