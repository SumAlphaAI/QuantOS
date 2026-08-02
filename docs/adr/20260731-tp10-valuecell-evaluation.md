# ADR: TP10 ValueCell Evaluation — IA/Interaction Reference Only

## Status

Accepted as evaluation conclusion.

## Context

TP10 requires an evaluation of ValueCell's research UI/workflow information architecture before U01, explicitly without copying its data model or account system. The evaluation is pinned to `ValueCell-ai/valuecell@9793e9c0563fbf56fc096757d8bb80e209ac7aab` (2026-02-11, Apache-2.0).

The UX gap report (`third_party/valuecell/ux-gap-report.md`) maps 12 UI patterns to the Terminal design spec and identifies 5 gaps. All differences between ValueCell's approach and QuantOS constraints are recorded here.

## Decision

1. ValueCell is classified as **reference only** (`reference_only`): information architecture and interaction patterns only. No source copying, no runtime dependency, no lockfile entry.
2. **Adoption decision**: 12 interaction patterns are adopted at the pattern level (reimplemented in the Terminal design spec); the mapping table in the UX gap report is authoritative for U01/X06 design work.
3. **Differences (all recorded)**:
   - **Navigation**: ValueCell's four workspace names (observation/research/exploration/backtest) are not copied; QuantOS navigates by object domain (Research/Signal/Proposal/Portfolio/Risk/Audit/Ops) because the QuantOS object model is contract-first, not agent-first.
   - **Account system**: ValueCell's local single-user account model is rejected; QuantOS uses the F02 tenant/workspace/role model with capability checks.
   - **Data model**: ValueCell's conversation/task/result schema is rejected; QuantOS uses versioned contracts (ResearchArtifact/Signal/TradeProposal) with content hashes.
   - **Trading surfaces**: ValueCell's auto-trading agent UI is rejected wholesale; QuantOS exposes only Proposal review (`executable=false`), approval, and risk surfaces.
   - **Data sources**: ValueCell's yfinance/akshare adapters are rejected; QuantOS data flows through TP05 licensed providers with lineage.
   - **Visual assets**: no component, style, or icon is copied; the Terminal uses its own design tokens.
4. The five identified gaps (evidence drill-down path, committee-view visualization, expired-state visual language, dangerous-action confirmation, small-screen degradation) are assigned to U01 design spec supplements, X06, and S02.

## Consequences

Positive:

- U01/X06 get a concrete, acceptance-checked interaction backlog (12 patterns) before design starts.
- Boundary is executable: tests verify ≥10 mapped patterns, the 7-item no-coupling list, and zero upstream references in QuantOS protocol/core/lockfiles.

Trade-offs:

- The mapped patterns are design commitments that U01 must honor or explicitly deviate from with a new ADR.

## Follow-up

- U01 design spec must incorporate (or explicitly reject with reasons) each of the 12 mapped patterns and close the 5 gaps.
- Re-evaluate only if ValueCell ships a materially different IA in a stable release.
