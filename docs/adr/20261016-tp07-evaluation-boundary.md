# ADR: TP07 S2 fixed candidate evaluation and execution boundary

Status: EVALUATION_ONLY. ProjectUser formal confirmation PENDING. CORE:TP07/X3, runtime, target and release are not admitted.

Pin the existing ADR reference fa86c6e39e8f064d5922c0ee4da5e2a9a2716408 (Python1.231.0 / Rust0.61.0), from immutable local Git objects. Do not advance to local checkout HEAD or download/execute upstream packages. Source provenance is local Git-object byte evidence; remote object authenticity/signature has not been newly established. The pinned descriptors require Python>=3.12,<3.15 and Rust1.97.1, while QuantOS uses its own pinned toolchain; this evaluation does not establish build or ABI compatibility.

Both Cargo.toml and pyproject.toml declare LGPL-3.0-or-later. This corrects the historical ADR's LGPL-3.0-only assertion. [Official licensing policy](https://nautilustrader.io/legal/open-source-licensing/) defers to the repository license; it does not grant an automatic process-boundary exception. Legal/distribution approval remains NOT_RUN. Do not infer an entire dependency graph's license from the root license.

The evaluation SBOM is SPDX2.3 over all pinned Cargo.lock/uv.lock packages; dev/optional and multiple-platform entries remain included. Transitive licenseConcluded=NOASSERTION. Public OSV package/version query bytes and a dated result or network failure record bind these exact lock hashes. An offline replay validates only the recorded snapshot. Unknowns and matched advisories do not become a clean scan or runtime authorization.

Engineering boundary:

1. Agent emits research Artifact or TradeProposal only; it never calls a venue or the candidate kernel.
2. QuantOS Auth/F06 resolves actor/tenant/workspace; policy, approval, limits, expiry and kill switch remain authoritative before any kernel call.
3. Only execution-gateway may transform an approved immutable TradeCommand into an owned BoundaryCommand. Do not forward user/Agent sessions, tokens or secret material.
4. Any future upstream runtime must occupy a separate process with an explicit transport, schema validation, credential isolation, idempotency and replay protection; the current in-process outbox model does not prove that transport.
5. Core imports only QuantOS-owned types. Importing/linking upstream packages in Rust/Python/JS locks or source is denied by the evaluation verifier.
6. QuantOS ledger, Order/Fill mapping, reconciliation and audit remain authoritative; upstream portfolio/persistence/risk modules cannot create a second core or shared database authority.
7. No live network/model/venue/database process is enabled by this evaluation. Actual adapter/Paper integration, partial-fill/cancel recovery, persistent dedupe, real process isolation, target security/performance and same-SHA hosted CI belong to CORE:TP07/X3 and Beta.

Replacement: keep ExecutionKernel and PaperKernel as QuantOS-owned abstractions. License/CVE/API drift closes candidate admission; remove the external bridge, retain PaperKernel and the protocol. Before adopting a different candidate, re-pin source, locks, license, SBOM/advisories and redo boundary tests; never relax core types, identity or venue authority to accommodate a vendor.

The existing gateway implementation and its historical local tests are inventory evidence only in this checkpoint, not a new CORE:TP07/Paper/external process acceptance. Supabase and target outcomes remain NOT_RUN; no local PostgreSQL/Supabase service is created.
