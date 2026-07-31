# quantos-market

R01 market ingestion and normalized market data contracts for QuantOS.

## Scope

- approved provider registry and allowlist enforcement
- normalized symbol parsing for provider-specific tick symbols
- deterministic replay dataset generation from a compact catalog fixture
- duplicate and out-of-order tick deduplication
- freshness and quality anomaly detection that emits `MarketEvent`
- conversion of market events into `quantos-event::RecordedEvent`

## Validation

- `cargo test -p quantos-market`
- `cargo run -p market-ingestor -- generate-replay --output /tmp/market-replay.jsonl --count 100000`
- `cargo run -p market-ingestor -- ingest-replay --input /tmp/market-replay.jsonl`
