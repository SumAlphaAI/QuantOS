# ADR: TP12 nautilus_agents Evaluation — Boundary Confirmed, Reference-Only

## Status

Accepted as evaluation conclusion.

## Context

TP12 requires an evaluation of `nautechsystems/nautilus_agents` for the agent–trading-kernel collaboration boundary, extracting anti-patterns and tool-design lessons. The evaluation is pinned to commit `8d79877380f8617b45dff2b8c8b3790c2f9d963a` (crate 0.2.0, protocol 1.0, LGPL-3.0-or-later).

Key findings:

1. **The upstream authority boundary matches QuantOS.** nautilus_agents explicitly gives agent processes scoped observations and one narrow semantic proposal (`ReducePosition`), while NautilusTrader owns observation construction and every production decision and execution step. Agent processes hold no engine or venue authority. This independently confirms the QuantOS "Agent 不直连 venue" boundary; the evaluation verifies it does not change that boundary.
2. **Agent-side assurance is advisory by design.** Local checks produce findings, not decisions; the engine may reject even when all local checks clear. This matches the QuantOS X02 authoritative risk engine model.
3. **Three patterns are stronger than current QuantOS practice**: retention classes on recorded evidence (`ReferenceOnly`/`Redacted`/`Full`, rejecting `Restricted`), per-field ownership/stability/retention/digest metadata (`fields.toml`), and explicit advisory-vs-authoritative naming.
4. **The crate is early alpha with a shifting protocol**; any adoption must be re-evaluated per pinned commit.

## Decision

1. nautilus_agents is classified as **reference only** (`reference_only`). No runtime dependency, no lockfile entry, no code absorption.
2. The seven no-coupling rules in `no-coupling-rules.json` are adopted as standing QuantOS rules, each bound to executable evidence in the repository (validated by `test_tp12_nautilus_agents_rules.py`).
3. The threat model supplement (`tp12_nautilus_agents_threat_model.md`) extends the TP01/F07 threat model with eight agent–kernel collaboration threats and their current mitigations.
4. Three upstream patterns are recorded as **candidate adoptions** for future F07/R-series work, not as commitments: retention classes on agent evidence, per-field contract metadata, advisory-vs-authoritative naming.

## Consequences

Positive:

- The "Agent 不直连 venue" boundary is now externally validated by an independent upstream design, not just internally asserted.
- The no-coupling rules are executable: every rule's enforcement evidence is a real file+symbol checked in CI.
- Candidate adoption list gives F07 concrete design inputs without dependency risk.

Trade-offs:

- Retention classes and per-field metadata remain unimplemented until scheduled; the threat model marks the related residual risks as medium.

## Follow-up

- Re-evaluate if upstream releases protocol 2.0 or crate 1.0.
- When F07 agent runtime work starts, decide on the three candidate adoptions explicitly.
- Consider a CI check that fails if `nautilus` appears in any QuantOS lockfile (rule NC-07 automation).
