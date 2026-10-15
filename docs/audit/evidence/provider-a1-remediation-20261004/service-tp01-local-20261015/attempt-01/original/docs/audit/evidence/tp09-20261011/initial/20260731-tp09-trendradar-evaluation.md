# ADR: TP09 TrendRadar Evaluation — Reference-Only, No Adapter

## Status

Accepted as evaluation conclusion.

## Context

TP09 requires an evaluation of TrendRadar for trend detection and news/theme signal input quality, including lineage and license requirements. The evaluation is pinned to `sansan0/TrendRadar@8ee26026ba6c11dec41a95fb3895a7162876caa1` (`mcp-v3.2.0-38-g8ee26026`, pyproject version `6.10.0`) and covers three deliverables: an ADR, trend signal schema samples, and a data-license inventory.

Findings:

1. **License posture blocks everything beyond reference.** TrendRadar itself is GPL-3.0-only, so no code absorption and no production dependency are possible. More importantly, its input classes (newsnow-aggregated hot lists, publisher RSS feeds, AI analysis output, self-hosted custom APIs) all lack verifiable redistributable licenses; per the inventory, every class is `trading_approved=false`.
2. **Input quality is attention-grade, not market-grade.** Hot-list ranks are popularity metrics; RSS items carry per-publisher copyright; AI analysis has no provenance for embedded claims. None of these satisfy QuantOS lineage and license requirements for trading-adjacent use.
3. **The schema is expressible.** The three mapping samples show TrendRadar-style inputs map cleanly into the QuantOS `Signal` contract with provenance in `diagnostics`, including the degraded case where missing license/source forces `not_tradable` marking.

## Decision

1. TrendRadar is classified as **reference only** (`reference_only`). No `engines/trendradar-adapter` will be built and no TrendRadar package may enter any QuantOS lockfile.
2. The non-tradable marking rule is adopted as a standing requirement for any future trend/news input: **any input item missing a license label or source attribution makes the derived output `trading_approved=false` with `not_tradable` diagnostics tag**, enforced by the mapping sample regression test.
3. Trend and theme signals enter QuantOS only through owned paths: TP03 `llmquant` fixtures/signals and TP05 `data.query.v1` providers with license gates.
4. The pinned baseline (`third_party/trendradar/`) is retained for monitoring; the CVE audit must be rerun before this decision can be revisited.

## Consequences

Positive:

- GPL-3.0 and unlicensed data inputs stay fully outside the QuantOS runtime and supply chain.
- The `not_tradable` marking rule is executable and regression-tested, not just documented.
- QuantOS keeps a clean provenance story: every trend input carries source + license labels in `diagnostics`.

Trade-offs:

- QuantOS does not get TrendRadar's broad platform coverage; licensed news/data providers must be onboarded through TP05 instead.
- Trend-theme strategy ideas must be re-expressed as `llmquant` fixtures rather than reusing TrendRadar's keyword/frequency pipeline.

## Replacement cost

If a future requirement demands real trend/news inputs:

- **Licensed provider onboarding**: a TP05 `data.query.v1` provider backed by a licensed news API — comparable to existing adapter scope; this is the recommended path.
- **Lineage mapping**: per-item source attribution and license labels must be populated at ingestion; the TP09 mapping samples define the target schema.
- **What is not required**: TrendRadar itself. Its crawling, storage, notification, and AI-analysis surfaces are all rejected; only the input-quality rule and schema shape carry forward.

## Follow-up

- Rerun the CVE audit on a clean Python 3.12+ host for monitoring completeness.
- If a licensed news provider is onboarded, add a `data.query.v1` fixture proving the same `not_tradable` marking rule for degraded records.
