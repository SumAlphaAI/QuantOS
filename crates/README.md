# crates

Rust shared crates live here.

- `quantos-core`: foundational types, workspace metadata, and shared primitives.
- `quantos-auth`: tenant/user/service identity mapping, primary workspace context, and gateway authorization helpers.
- `quantos-engine-manager`: manifest review, UDS gRPC routing, crash backoff, deadline enforcement, and engine contract harnesses.
- `quantos-event`: append-only event ledger, replay helpers, and PostgreSQL-backed outbox/inbox/checkpoint repositories.
- `quantos-market`: approved-provider registry, symbol normalization, market tick ingestion, replay dataset generation, and `MarketEvent` emission with freshness/quality anomaly detection.
- `quantos-observability`: local trace, metrics threshold evaluation, structured logging, fault injection, health reporting, and ADR evidence generation.
- `quantos-policy`: deterministic RBAC, capability, mode, and secret-resolution policy decisions.
- `quantos-portfolio`: rebuildable portfolio read model with position/P&L/valuation/exposure projections, golden-snapshot replay verification, and PostgreSQL persistence.
- `quantos-risk`: deterministic pre/post-trade risk rules, leverage/concentration/notional limits, approval routing, and global/account kill switch APIs with signed decisions.
- `quantos-runtime`: persistent workflow runs, research orchestration, signal/proposal orchestration, stream capture, artifact bindings, deadlines, cancellation, expiry gates, and restart recovery.
- `quantos-storage`: artifact manifests, `DataSnapshot` metadata and quality gates, object key derivation, schema registry primitives, and PostgreSQL-backed storage repositories.
- `quantos-strategy`: versioned strategy drafts and parameter models, optimistic-concurrency conflict detection, approved snapshot/artifact reference gating, validation handoff rules, the deterministic backtest adapter with look-ahead/data-leakage detection, and immutable `StrategyRelease` publishing with Paper/Shadow-only deployment policy.

Future F0 tasks will add protocol, auth, event, runtime, and risk crates here.
