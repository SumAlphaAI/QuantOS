# services

Rust service binaries compose the shared domain crates. The Cargo workspace is
the executable inventory; `make f01-check` verifies this index covers each member.

- `bff-gateway`: authorized HTTP page contracts and BFF provider composition.
- `capacity-monitor`: outbox/DLQ capacity collection and ADR evidence.
- `execution-gateway`: controlled command execution boundary and runtime wiring.
- `market-ingestor`: approved market replay ingestion and MarketEvent publication.
- `portfolio-rebuild`: rebuildable portfolio projection from event facts.
- `replay-cli`: correlation-addressed PostgreSQL or fixture event replay.
- `runtime-gateway`: authentication and research runtime store composition.

Services depend on domain/protocol crates, never frontend components or concrete
Python packages. Engine calls cross the versioned protocol boundary. Individual
README files define each service's inputs, outputs and test entrypoints.

Observability support must be checked per service; this index does not assert
that every new binary has a production health/trace deployment. Run
`cargo test --workspace --locked` for the baseline. Live PostgreSQL and external
provider acceptance require separate isolated-environment evidence.
