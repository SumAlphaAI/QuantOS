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
