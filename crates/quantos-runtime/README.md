# quantos-runtime

Runtime workflow orchestration, checkpointing, cancellation, research execution wiring, and signal/proposal execution wiring for QuantOS.

## Scope

- runtime sessions and workflow run leasing
- checkpoint persistence and worker restart recovery
- artifact bindings with content-hash deduplication
- persistent attempt fencing, bounded retry, idempotent request fingerprints, and per-tool rate/cost limits
- R03 research orchestration over `quantos-engine-manager`
- R04 signal and proposal orchestration over `llmquant` and `trading-agents`
- stream-event capture, `DataSnapshot` quality-gated execution, and locatable `ResearchArtifact` records
- schema validation, counter-view capture, and proposal expiry gates for replayable `TradeProposal` records

## Validation

- `cargo test -p quantos-runtime`
- `cargo test -p quantos-runtime --test research_orchestration`
- `cargo test -p quantos-runtime --test signal_proposal_orchestration`
- `make f07-db-check` (requires matching isolated `DATABASE_URL` and `SUPABASE_URL` plus verified `QUANTOS_BFF_SSLROOTCERT`; no target means no F07 acceptance)
