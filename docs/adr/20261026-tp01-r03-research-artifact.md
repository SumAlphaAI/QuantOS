# TP01 workflow output enters R03 as a data-only ResearchArtifact

Status: implemented for bounded local composition, 2026-10-26. This is an engineering decision, not formal task or release acceptance.

The controlled adapter already implemented workflow/stream/audit projection and 20 fixtures, but its output was not an R03 ResearchArtifact. The total CORE:TP01 task needs the worker and Web consumer to inspect actual adapter output without importing upstream state or giving the adapter execution authority.

The service now adds a QuantOS-owned ResearchArtifact envelope after validating the contract, plan and audit. R03 accepts the precise `research.vibe_adapter.execute` capability through the existing session/tool authorization and worker path. The envelope binds native actor/run/snapshot/policy, retains deterministic reference content and explicitly declares no trading or tool execution. R03 independently verifies response identity, content hashes, evidence, stream sequencing and snapshot policy before archiving.

No upstream code family beyond the existing workflow decomposition and streaming projection is adopted. Tool/MCP/memory patterns remain reference-only. The adapter's in-memory Artifact facade remains a test port; durable authority belongs to QuantOS. Its TEST/RESEARCH routing still requires explicit fixture mode or host rollout control.

The Web composition uses a separate test-host mapping of an existing hypothesis intent to the Vibe capability/fixture. It does not add a production API selector or relax public contracts. Reference identity, TLS/CORS and memory persistence substitutions are retained in evidence. Complete U01/TP01/R1 integration and release remain independent and unapproved. See the [current procedure](../operations/core-tp01-local-composition.md).
