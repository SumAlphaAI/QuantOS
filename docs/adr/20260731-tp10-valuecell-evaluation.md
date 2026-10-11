# ADR: TP10 ValueCell — reference-only IA evaluation

## Status

Evaluation decision recorded; DEVELOPMENT admission is separate. No formal ACCEPTED, user approval, runtime or publication authority is granted by this ADR.

## Context

Fixed historical baseline: `ValueCell-ai/valuecell@9793e9c0563fbf56fc096757d8bb80e209ac7aab`. Public README, LICENSE and descriptors were read in memory on 2026-10-11; only hashes and QuantOS-owned observations persist. No source, screenshots, assets, components or configuration is copied. The [pattern inventory](../../third_party/valuecell/patterns.json) and [Terminal specification §9](../SumAlpha-QuantOS-Terminal-Frontend-Design-Spec.md#tp10-vc-01) are design inputs, not proof of implemented UI.

## Decision and complete differences

<a id="d01"></a>
### D01 Navigation

Use QuantOS object-domain routes and resource authorization. The old four-workspace description is unverified and withdrawn; it must not become an upstream-derived navigation requirement.

<a id="d02"></a>
### D02 Accounts and authority

No upstream identity/account schema is adopted. F02 tenant/workspace/role/capability checks remain authoritative. Local-storage advertising does not establish a verified single-user account model.

<a id="d03"></a>
### D03 Data and evidence

No conversation/task/result schema or database table is copied. Use versioned ResearchArtifact/Signal/DataSnapshot, hashes and authorized evidence references. Timelines, drill-down, structured details and status language are QuantOS specifications; exact upstream behavior is unverified.

<a id="d04"></a>
### D04 Trading and experimentation

Reject upstream strategy automation and exchange surfaces. Research/backtest/committee patterns expose candidates and non-executable Proposals; approval, policy, expiry and server checks remain mandatory. Multi-agent advertising does not prove a committee UI. Backtest comparison is a QuantOS extension.

<a id="d05"></a>
### D05 Data sources

No upstream market adapter is admitted. Use TP05 independently licensed, lineage-bearing provider contracts; document-level market coverage is not a rights grant or data quality result.

<a id="d06"></a>
### D06 Licensing, dependencies and widgets

Apache-2.0 applies to original upstream software; embedded widgets, exchange APIs, data and third-party assets have separate terms. No ValueCell dependency, resolved SBOM, CVE clearance, runtime, MCP/A2A integration, submodule or production file is admitted. Current resolved-graph advisory assessment is NOT_ASSESSED, not clean.

<a id="d07"></a>
### D07 Visual and interaction implementation

All components, assets, tokens, confirmation and empty states are implemented independently under QuantOS specifications. No source/style/icon/signing pipeline is copied. High-risk confirmation and small-screen restrictions already exist in §3.2/§6; their implementation requires separate U01/X06 and cross-platform evidence.

<a id="d08"></a>
### D08 Notifications

Advanced notification types are roadmap material, not verified shipped desktop behavior. QuantOS requires consent, redacted summaries, safe links and in-page fallback; notifications confer no action authority.

<a id="d09"></a>
### D09 Privacy and residency

Do not reuse the upstream local-only privacy claim. QuantOS has configured Supabase/BFF processing, explicit telemetry/residency rules and encrypted read-only offline behavior. Settings must describe actual processing and never solicit production credentials in this evaluation.

<a id="d10"></a>
### D10 Observation limits and historical correction

The previous 12 rows were mapped mostly by page names and contained unsupported upstream UI descriptions; the test also silently skipped the current frontend by scanning an obsolete absolute path. Original report/baseline/test are retained in docs/audit/evidence/tp10-20261011/initial. The current 12 unique mappings have source grades, stable specification anchors, constraints, acceptance behavior and owners; all UI implementation states stay NOT_ASSESSED. The five gaps are design follow-ups (DESIGNED_PENDING_IMPLEMENTATION), not unimplemented-spec claims or runtime closure. No browser session, upstream App, provider, account, live data, database, permission bypass or trading action was exercised for the TP10 evaluation itself.

## Consequences and follow-up

U01/X06/S02 must implement or explicitly deviate through a new ADR for all 12 mappings and five gaps. F0 prerequisites are independently refreshed with the configured development Supabase; they do not expand the TP10 evaluation scope. Re-evaluate upstream only under a new scoped decision; neither permissive licensing nor local tests authorize source copying or runtime adoption.
