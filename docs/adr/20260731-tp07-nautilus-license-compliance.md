# ADR: TP07 NautilusTrader License Compliance and Replacement Plan

## Status

Accepted for repository-side implementation.

## Context

TP07 integrates NautilusTrader as a candidate execution kernel behind `services/execution-gateway`. NautilusTrader is LGPL-3.0-only (verified at the pinned local reference `nautilus_trader@fa86c6e39e8f064d5922c0ee4da5e2a9a2716408`, 2026-07-21). QuantOS core and services are UNLICENSED/proprietary, so the integration mode determines compliance obligations.

The plan also requires: QuantOS Trading Protocol mapped to the Nautilus API without importing its types into core, and a documented replacement plan.

## Decision

1. **Process boundary, not linking.** NautilusTrader runs only as an independent out-of-process service. QuantOS code never links, vendors, or imports Nautilus code or types. Communication uses QuantOS-owned wire payloads (`NautilusOrderWire` and the event payload mapping in `NautilusBoundaryAdapter`).
2. **No Nautilus types in core.** `crates/quantos-execution` defines its own sanitized `BoundaryCommand` and wire structs. The wire field vocabulary merely mirrors the public Nautilus order API (instrument id, order side/type, quantity, price, time in force, client order id) — data shapes, not code.
3. **Paper kernel is the default and the replacement path.** `PaperKernel` implements the same `ExecutionKernel` trait with zero external dependencies. All gateway guarantees (interception, idempotency, event mapping, isolation) are tested against both kernels.
4. **Deployment gating.** Any production enablement of the Nautilus kernel requires: (a) a pinned upstream commit with SBOM and CVE record (same governance as TP01/TP08 baselines), (b) legal sign-off on the LGPL service-boundary posture, (c) a deployment manifest proving the kernel runs in a separate process with no shared state.

## LGPL compliance analysis

- LGPL-3.0 obligations trigger on distribution of the library or derivative works based on it. QuantOS does not copy, modify, link, or statically bundle Nautilus code; an independent process communicating over a data-format boundary does not create a derivative work of the library.
- The wire struct field names follow the public API documentation convention; this is interoperability, not incorporation.
- If a future requirement needs in-process embedding (e.g., the Rust core crates of Nautilus), this ADR must be revisited: linking an LGPL library requires either dynamic linking with replaceability notices or relicensing, and the paper-kernel replacement path must be preserved regardless.

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
- All TP07 acceptance criteria are testable without any external process.
- The replacement path is exercised by default (paper kernel is the default kernel), not just documented.

Trade-offs:

- The Nautilus adapter currently models the wire bridge in-process (outbox + event intake); a real deployment still needs the external process transport (UDS/HTTP) and its own hardening.
- Out-of-process execution adds operational latency relative to in-process embedding; acceptable for the current research/paper phase (X3 testnet stage at the earliest).

## Follow-up

- If the Nautilus kernel is enabled beyond local evaluation, create `third_party/nautilus_trader/` baseline (pinned commit, SBOM, CVE) before the first deployment manifest.
- X3 testnet work must reuse this gateway; no direct kernel access from any other service.
