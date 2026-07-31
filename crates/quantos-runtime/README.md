# quantos-runtime

Runtime workflow orchestration, checkpointing, cancellation, and research execution wiring for QuantOS.

## Scope

- runtime sessions and workflow run leasing
- checkpoint persistence and worker restart recovery
- artifact bindings with content-hash deduplication
- R03 research orchestration over `quantos-engine-manager`
- stream-event capture, `DataSnapshot` quality-gated execution, and locatable `ResearchArtifact` records

## Validation

- `cargo test -p quantos-runtime`
- `cargo test -p quantos-runtime --test research_orchestration`
