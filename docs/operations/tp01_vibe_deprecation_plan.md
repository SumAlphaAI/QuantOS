# TP01-G Vibe Adapter Deprecation Plan

## Goal

Gradually remove the remaining Vibe-derived compatibility surfaces from `vibe-adapter` while preserving the QuantOS business protocol.

## Current replacement boundary

As of TP01-G, workflow planning, streaming projection, and audit wrapping depend on the QuantOS-native `ResearchExecutionContract` and `ResearchContractProvider` protocol instead of directly depending on catalog-specific fixture types.

The current compatibility fields remain in the adapter output only to support transition:

- `upstream_surface`
- `absorbed_designs`

These fields are now aliases generated from `provenance` and `design_capabilities`, not primary business-contract fields.

## Canonical business protocol

The canonical TP01 business protocol is:

- `workflow_contract`
- `protocol_version`
- `workflow_family`
- `design_capabilities`
- `provenance`
- `artifact_api`
- QuantOS-native `audit` envelope

Any future provider replacement must preserve these fields and the three stream phases:

1. `context_translated`
2. `workflow_planned`
3. `artifact_recorded`

## Planned removals

### Phase 1

- stop asserting `upstream_surface` and `absorbed_designs` outside adapter compatibility tests;
- migrate all downstream consumers to `provenance.source_surface` and `design_capabilities`.

### Phase 2

- remove `upstream_surface` and `absorbed_designs` compatibility aliases from adapter outputs;
- keep provenance for audit traceability only.

### Phase 3

- move the default catalog provider behind a generic research-provider namespace so the adapter package no longer carries Vibe-specific naming in its core contracts.

## Required evidence before removal

1. provider-replacement tests pass with a non-catalog in-memory provider;
2. replay contract tests pass for all 20 representative fixtures;
3. no runtime or UI consumer depends on deprecated alias fields.

## 2026-10-15 executable local transition

TP01-G adds host-injected native interfaces for provider, translator, workflow,
audit, stream and Artifact store. The mandatory host policy and protocol validators
remain authoritative. All six seams and their complete composition are exercised
over real local UDS for all 20 fixtures. Replacements are trusted host code; this
interface does not sandbox arbitrary Python or approve any external backend.

Phase 1 consumer migration is implemented: canonical replay assertions use
`provenance.source_surface` and `design_capabilities`; source checks cover Runtime
Rust and Web TypeScript consumers. Dedicated compatibility tests retain alias
coverage. Phase 2 is available for local host rehearsal using
`VibeAdapterService(compatibility_aliases=False)`, with all 20 fixtures checked.
The default retains aliases until deployed consumers are independently verified.
Removing fields changes serialized bytes, content hashes and Artifact identities;
start a fresh host instance and do not reuse an old in-memory idempotency cache.

Phase 3 package rename remains deferred: Python imports and Engine capability names
are public integration surfaces. No fork runtime/type dependency remains in these
native seams, so renaming is not required to prove local replaceability. Any future
rename needs coordinated Runtime/wheel/manifest/consumer migration and new evidence.

The general upstream replay-handoff fix is a reviewable, pinned patch under
`forks/vibe-trading/upstream-prs/20261015-atomic-replay-handoff/`; no remote PR exists.
Target deployment, real storage/consumption, performance and sustained operation
remain NOT_RUN. See `tp01-g-local-admission.md` for execution and Gate boundaries.
