# ADR: TP13 Loong Evaluation — Reference-Only, Design-Pattern Adoption Candidates

## Status

Accepted as evaluation conclusion.

## Context

TP13 requires an evaluation of `eastreams/loong` (formerly LoongClaw, a Rust base for vertical AI agents) for protocol/Runtime/UI design ideas and replaceable interfaces. The evaluation is pinned to commit `3ab7936638e4772c1db95ebee7f5f643852697c2` (2026-07-07, dev HEAD, MIT).

The protocol/UX comparison (`third_party/loong/protocol-ux-comparison.md`) covers the six required axes (session, workflow, tool, memory, permissions, audit) plus protocol, runtime, and UX.

Key findings:

1. **Four design patterns are stronger than current QuantOS practice** and are recorded as adoption candidates: session-level restricted tool views, build-time elimination of high-risk tools (feature gating), approval replay records, and a unified kernel audit sink abstraction.
2. **Two upstream patterns are explicit anti-patterns for QuantOS**: `trusted_internal_context` (internal-call trust bypass — QuantOS checks every caller with the same口径） and MCP server injection (rejected already at TP01).
3. **No upstream type is needed in QuantOS protocol or core.** Loong's value is design-level; its crate organization (contracts/protocol/spec) mirrors what QuantOS already achieves with proto-first contracts.

## Decision

1. Loong is classified as **reference only** (`reference_only`). No runtime dependency, no lockfile entry, no upstream type or schema inside `proto/` or `crates/quantos-core`.
2. **Adoption decision**: four candidate adoptions are recorded for F07/U-series scheduling, none committed now:
   - session-level restricted tool view (intersect root policy, persisted policy, build-time availability);
   - build-time elimination of high-risk tools (stronger than runtime disabling);
   - approval replay records for the X02 approval audit trail;
   - a unified audit sink abstraction across QuantOS crates.
3. **Rejections are explicit**: `trusted_internal_context`, MCP/ACP injection, channel integrations, and the Loong TUI.
4. The executable check (`test_tp13_loong_evaluation.py`) enforces the boundary: the six required comparison axes are present, the baseline is pinned, and no `loong` reference exists in QuantOS `proto/`, `crates/quantos-core`, or any lockfile.

## Consequences

Positive:

- F07/U-series get four concrete, evidence-backed design inputs without dependency risk.
- Anti-patterns are documented with the reason for rejection, preventing accidental copying.
- MIT license removes legal friction for design reference.

Trade-offs:

- Candidate adoptions remain unimplemented until scheduled; they are recorded as decisions-to-make, not commitments.

## Follow-up

- When F07 agent runtime starts, decide each candidate adoption explicitly and reference this ADR.
- Re-evaluate if Loong publishes a stable 1.0 protocol crate.
