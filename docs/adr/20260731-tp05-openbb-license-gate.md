# ADR: TP05 OpenBB License Gate and Provider Isolation

## Status

Accepted for repository-side implementation.

## Context

TP05 requires QuantOS to evaluate OpenBB as a data and research adapter without letting OpenBB become a core-domain dependency or an unreviewed production dependency. The architecture and technical solution documents already state that OpenBB's AGPL-3.0-only license requires legal review, and that service isolation alone does not automatically remove those obligations.

At the same time, QuantOS still needs:

- a stable `data.query.v1` provider boundary;
- a QuantOS-owned Data Contract carrying source, license, schema, lineage, and hash metadata;
- a replacement provider path so upstream legal or commercial decisions do not block local development and contract testing.

## Decision

We implement TP05 as an isolated Python sidecar engine named `openbb-adapter` with the following constraints:

1. The public capability is `data.query.v1`.
2. The adapter returns a QuantOS-owned JSON Data Contract instead of exposing upstream OpenBB types.
3. The adapter ships with two providers:
   - `openbb`: isolated evaluation provider guarded by a license gate;
   - `mock`: replacement provider used for deterministic contract tests and local development.
4. The default license decision is `evaluation_only`, with `allow_production=false`.
5. Any request that attempts to use OpenBB in `production` is blocked by the license gate.
6. Any request whose intended use is `trading` is rejected at the adapter boundary.

## Consequences

Positive:

- QuantOS keeps a stable provider abstraction even if OpenBB is later replaced.
- Production builds have a clear machine-readable gate before OpenBB can be enabled.
- Contract, replay, and UDS integration tests can run without introducing the OpenBB package into the default workspace dependency graph.

Trade-offs:

- The repository-side implementation models OpenBB through isolated fixtures until legal approval and a final provider onboarding decision exist.
- Additional legal and supply-chain work is still required before any production enablement.

## Follow-up

- Record final legal decision and NOTICE/SBOM obligations before enabling OpenBB outside isolated evaluation.
- If commercial terms are approved, update `license_gate.json`, CI release gating, and deployment manifests together.
- If OpenBB is rejected, keep the Data Contract and swap the provider implementation without changing downstream callers.
