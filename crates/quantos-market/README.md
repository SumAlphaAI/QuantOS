# quantos-market

R01 v2 freezes explicit provider instruments, tenant-scoped source identity/hash, exact decimal/raw values, quality/freshness events and actual processing timestamps. Unknown/revoked/expired providers, ambiguous instruments, empty source IDs, conflicting source facts and oversized inputs fail closed. Invalid numeric ticks emit quality failures without stopping subsequent facts.

`MarketIngestor` is a bounded in-memory replay validator; batches stage ledger/identity atomically. Production callers use `durable::DurableMarketIngestor`, which delegates receipts/sequence/ledger/audit/outbox to one atomic Supabase statement and restores the watchdog from durable receipts. It does not cache committed identities or allocate sequences in process memory.

Validate with `make r01-check`; target, coverage and operational commands are in the [Runbook](../../docs/runbooks/r01_market_ingestion.md). The [v2 ADR](../../docs/adr/20261002-r01-market-v2-durable-ingestion.md) documents breaking changes and generated-parser coverage exemption. Real provider approval and deployment receipts remain separate from replay/target fixtures.
