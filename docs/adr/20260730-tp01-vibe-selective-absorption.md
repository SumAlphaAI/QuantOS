# ADR: TP01-D Vibe-Trading Selective Absorption And Minimal Patch Queue

- Status: accepted
- Date: 2026-07-30
- Related plan items: TP01-C, TP01-D

## Context

TP01-C established a contract-complete `vibe-adapter` skeleton. TP01-D must turn that skeleton into a selective absorption layer that can replay representative upstream workflow and streaming ideas without importing upstream session, audit, permission, or storage semantics.

## Decision

QuantOS will absorb only two upstream design families in TP01-D:

1. research workflow decomposition, translated into `vibe_adapter.workflow`;
2. streaming phase projection, translated into `vibe_adapter.streaming`.

All absorption is mediated through:

- `vibe_adapter.context` for QuantOS request translation and permission checks;
- `vibe_adapter.allowlist` for tool policy;
- `vibe_adapter.audit` for QuantOS-native audit envelopes;
- `vibe_adapter.artifact_api` for deterministic Artifact API refs;
- `vibe_adapter.fixtures` for the 20-fixture replay catalog.

## Consequences

### Accepted

- replaying 20 representative research fixtures under fixed QuantOS metadata;
- documenting a minimal patch queue under `forks/vibe-trading/patch-queue/`;
- testing that removing the adapter does not block unrelated workflows.

### Rejected

- upstream session IDs, SSE cursors, frontend stores, or memory files;
- direct reuse of upstream auth, audit, or permission calls;
- any direct broker, venue, secret, shell, or arbitrary file surfaces.

## Required evidence

1. Python replay tests prove all 20 fixtures execute and stream deterministically.
2. Rust UDS tests prove `quantos-engine-manager` can run the adapter and continue routing other engines when the adapter is absent.
3. The minimal patch queue records only approved design absorption, not a direct code fork.
