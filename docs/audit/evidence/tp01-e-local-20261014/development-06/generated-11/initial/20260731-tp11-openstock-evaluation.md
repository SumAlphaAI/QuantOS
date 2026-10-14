# ADR: TP11 OpenStock Evaluation — Reference-Only, No Day-1 Dependency

## Status

Accepted as evaluation conclusion.

## Context

TP11 requires an evaluation of OpenStock for public market data access, strategy/research display capability, and data-license risk. The evaluation is pinned to `Open-Dev-Society/OpenStock@4597c9a668118844b588f95eddb9342eed31c41d` (2026-07-04, package version `0.1.0`) and covers three deliverables: a provider comparison, Data Contract fixtures, and a license conclusion.

Findings:

1. **Upstream license blocks everything beyond reference.** OpenStock is AGPL-3.0-only (network copyleft), so no code absorption and no hosted-service reuse are possible.
2. **Data providers split cleanly by license posture.** Finnhub is the only credible provider candidate and only as research-only on free-tier terms; TradingView widgets are display-only and can never produce a DataSnapshot; the optional ADANOS backend has no verifiable license manifest. See `provider-comparison.md`.
3. **The Data Contract mapping works and the gate holds.** The two provider fixtures show Finnhub data maps into the TP05 Data Contract with complete lineage/quality mapping, while unauthorized variants (stripped license, widget data) are rejected by the recomputed F05 gate for 100% of usage classes.
4. **Supply chain is weak.** `npm audit` on the pinned lockfile reports 2 critical and 13 high findings, all transitive via the Inngest/OpenTelemetry/gRPC chain; admission would be blocked even if the license allowed it.

## Decision

1. OpenStock is classified as **reference only** (`reference_only`). No Day-1 dependency, no adapter, no lockfile entry anywhere in QuantOS.
2. The license conclusion is: **upstream AGPL-3.0-only; Finnhub free tier is research-only pending a commercial decision; TradingView widgets and ADANOS are rejected as data sources**.
3. Market data enters QuantOS only through owned paths: TP05 `data.query.v1` providers with license gates and the F05 snapshot catalog.
4. OpenStock's watchlist/research display UX may be used as design reference for the U-series terminal work only.
5. The standing gate rule is reaffirmed with executable evidence: **any data without a verifiable license label or per-source attribution cannot produce a usable DataSnapshot, for any usage class**.

## Consequences

Positive:

- AGPL and unlicensed data paths stay fully outside the QuantOS runtime and supply chain.
- The unauthorized-rejection rule is regression-tested against recomputed F05 gate semantics, not just documented.
- Provider comparison gives R1 a concrete shortlist: one research-only candidate (Finnhub) with a clear commercial-decision path.

Trade-offs:

- QuantOS does not reuse OpenStock's polished research-display implementation; equivalent views must be built in the owned terminal frontend.
- Finnhub real-time or redistribution use requires a future commercial decision before any strategy/trading usage.

## Replacement cost

If a future requirement demands Finnhub-class market data:

- **Provider onboarding**: add a TP05 `data.query.v1` provider using the fixture schema from this evaluation — small scope, the contract is already defined.
- **License decision**: commercial Finnhub terms must be recorded in the TP05 license gate before `approved_for_production` flips.
- **What is not required**: OpenStock itself. Its UI, Inngest pipeline, MongoDB layer, and auth stack are all rejected; only the provider analysis and fixture schema carry forward.

## Follow-up

- Revisit only if R1 requires a provider that TP05's current mock/OpenBB paths cannot cover; then onboard via `data.query.v1` using these fixtures as the contract baseline.
- Monitor the upstream npm audit chain; re-run if the baseline is ever re-pinned.
