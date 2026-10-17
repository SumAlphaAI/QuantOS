# ADR: TP07 NautilusTrader License Compliance and Replacement Plan

## Status

Historical implementation note; no current CORE:TP07, runtime, legal or release acceptance. Licensing conclusions below are superseded by [the S2 evaluation ADR](20261016-tp07-evaluation-boundary.md).

2026-10-17补充：自有Paper进程及X03下游消费由[TP07边界ADR](20261017-tp07-paper-dispatch-boundary.md)定义；不授予真实Nautilus runtime/legal/release准入。替换内核仅用于新命令，结果不确定时禁止自动fallback和重投。

## Context

TP07 integrates NautilusTrader as a candidate execution kernel behind `services/execution-gateway`. Historical text incorrectly recorded LGPL-3.0-only; both pinned manifests actually declare LGPL-3.0-or-later (rechecked at the pinned local reference `nautilus_trader@fa86c6e39e8f064d5922c0ee4da5e2a9a2716408`, 2026-07-21). QuantOS core and services are UNLICENSED/proprietary, so the integration mode determines compliance obligations.

The plan also requires: QuantOS Trading Protocol mapped to the Nautilus API without importing its types into core, and a documented replacement plan.

## Decision

1. **Process boundary, not linking.** NautilusTrader runs only as an independent out-of-process service. QuantOS code never links, vendors, or imports Nautilus code or types. Communication uses QuantOS-owned wire payloads (`NautilusOrderWire` and the event payload mapping in `NautilusBoundaryAdapter`).
2. **No Nautilus types in core.** `crates/quantos-execution` defines its own sanitized `BoundaryCommand` and wire structs. The wire field vocabulary merely mirrors the public Nautilus order API (instrument id, order side/type, quantity, price, time in force, client order id) — data shapes, not code.
3. **Paper kernel is the default and the replacement path.** `PaperKernel` implements the same `ExecutionKernel` trait with zero external dependencies. All gateway guarantees (interception, idempotency, event mapping, isolation) are tested against both kernels.
4. **Deployment gating.** Any production enablement of the Nautilus kernel requires: (a) a pinned upstream commit with SBOM and CVE record (same governance as TP01/TP08 baselines), (b) legal sign-off on the LGPL service-boundary posture, (c) a deployment manifest proving the kernel runs in a separate process with no shared state.

## LGPL compliance analysis (corrected 2026-10-16)

The previous text treated an independent process as automatically avoiding derivative/combined-work obligations. That was an unsupported conclusion, withdrawn here. The engineering choice is a separate process and QuantOS-owned data contracts. Legal analysis, distribution/notices/source/replaceability duties and target evidence require their own approval; status NOT_RUN. Root declarations are LGPL-3.0-or-later; transitive dependency licenses are not thereby concluded.

## Replacement plan

| Scenario | Action |
| --- | --- |
| Nautilus legal review fails | remove `NautilusBoundaryAdapter` deployment; `PaperKernel` already covers all gateway behavior; no core change needed |
| Nautilus supply-chain failure (CVE/SBOM) | same as above; the adapter is one module behind one trait |
| Nautilus API drift on upgrade | re-pin upstream commit, update `wire_command`/`map_event` mappings in one module, replay gateway test suite |
| Need real venue connectivity | onboard a venue-specific kernel behind `ExecutionKernel` in a separate service; gateway contract unchanged |

Replacement cost is deliberately small: the kernel surface is one trait (`submit` + `drain_events`) plus one wire-mapping module.

## Consequences

Positive:

- Zero Nautilus code or types inside QuantOS; core remains license-clean.
- Local gateway invariants can be tested without upstream execution; external process, target and full TP07 acceptance still require separate evidence.
- The replacement path is exercised by default (paper kernel is the default kernel), not just documented.

Trade-offs:

- The Nautilus adapter currently models the wire bridge in-process (outbox + event intake); a real deployment still needs the external process transport (UDS/HTTP) and its own hardening.
- Out-of-process execution adds operational latency relative to in-process embedding; acceptable for the current research/paper phase (X3 testnet stage at the earliest).

## Follow-up

- If the Nautilus kernel is enabled beyond local evaluation, use and revalidate `third_party/nautilus-trader/` evaluation baseline (pinned commit, SBOM, CVE) before the first deployment manifest.
- X3 testnet work must reuse this gateway; no direct kernel access from any other service.
