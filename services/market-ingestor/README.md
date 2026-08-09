# market-ingestor

Generate and ingest deterministic QuantOS market replay datasets.

The binary covers the R01 validation path:

- `generate-replay` expands the compact replay catalog into JSONL ticks
- `ingest-replay` parses the dataset, enforces approved providers, normalizes symbols, and writes `MarketEvent` records into an append-only ledger

Examples:

```bash
cargo run -p market-ingestor -- generate-replay --output /tmp/market-replay.jsonl --count 100000
cargo run -p market-ingestor -- ingest-replay --input /tmp/market-replay.jsonl
```

Set `QUANTOS_TRACE_EXPORT_PATH` during normal batch execution to persist
started/succeeded/failed trace records. Set `QUANTOS_OBSERVABILITY_ADDR` to run
the shared health, metrics, correlation-trace, and structured-error HTTP surface.
