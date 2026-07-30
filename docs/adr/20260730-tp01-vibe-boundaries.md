# ADR: TP01 Vibe-Trading Controlled Fork And Adapter Boundary

- Status: accepted
- Date: 2026-07-30
- Related plan items: TP01-A, TP01-B

## Context

TP01 evaluates `HKUDS/Vibe-Trading` as a source of research workflow, MCP, streaming, and UX ideas. The upstream project also carries session persistence, local memory files, shell and file mutation tools, trading connectors, channel integrations, and its own API / frontend contracts. QuantOS cannot adopt those surfaces directly without breaking the runtime, auth, audit, and execution boundaries established by F06-F08.

## Decision

QuantOS adopts a controlled-fork and adapter-only boundary for TP01:

1. `third_party/vibe-trading/` remains a read-only provenance ledger and review entrypoint.
2. `forks/vibe-trading/` is the future patch-queue home for approved upstream deltas only.
3. Production artifacts may be built only from `engines/vibe-adapter`.
4. QuantOS public contracts must stay native to QuantOS Engine RPC, Artifact API, auth context, and event/audit semantics.

## Consequences

### Allowed

- borrowing research workflow decomposition ideas;
- replaying representative upstream research fixtures after QuantOS-side translation;
- adapter-side rewrites of research-safe capabilities behind QuantOS manifests.

### Forbidden

- exposing upstream classes, IDs, session layouts, memory formats, or browser contracts;
- allowing upstream connectors, broker auth, or venue network paths into QuantOS research engines;
- importing upstream shell, write-file, edit-file, or local filesystem mutation tools into default capability registries;
- using upstream state stores as a source of truth.

## Required controls

1. every sync candidate must record upstream SHA, digests, diff summary, and decision severity;
2. V1 adapter work must pass QuantOS Engine contract tests plus negative permission fixtures;
3. canary and rollback evidence remain mandatory before any adapter release is enabled by default;
4. removing the adapter must not block QuantOS Runtime startup for unrelated workflows.
