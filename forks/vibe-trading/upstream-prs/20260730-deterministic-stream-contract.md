# Upstream PR Record: deterministic stream contract projection

- Status: draft
- Genericity: reusable upstream
- QuantOS area: `engines/vibe-adapter` streaming projection
- Proposed upstream area: streaming event ordering / replay determinism

## Motivation

TP01 introduced deterministic three-phase replay streaming so fixtures can be re-run with stable ordering and auditable artifact attachment.

The underlying improvement is generic:

- keep stream phase order deterministic;
- reserve the final phase for artifact attachment;
- make replay fixtures assert phase order explicitly.

## Proposed upstream contribution

1. add replay-oriented stream phase assertions to upstream tests;
2. document the invariant that the terminal stream event owns artifact finalization;
3. isolate phase naming from session-store internals.

## Notes

- no upstream PR has been opened from this repository yet;
- once the private fork remote is provisioned, this record should be updated with an upstream issue or PR URL.
