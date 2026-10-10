# ADR: TP08 Qlib — reference only, no adapter

## Status

Engineering evaluation decision refreshed 2026-10-10. Formal acceptance: false. This decision grants no runtime, data-purpose or production permission.

## Evidence and decision

The baseline is `microsoft/qlib@d5379c520f66a39953bad76234a7019a72796fd0`, MIT. Six pinned source files were retrieved read-only and hashed; their notices are retained. Review scope covers the handler, benchmark YAML, recorder and dependency descriptors. The source inventory is not a resolved transitive SBOM, and current CVE advisory scanning has not run.

Classify Qlib as **reference_only**. Do not create `engines/qlib-adapter`, import Qlib or admit its dependencies to production. The useful concepts are declarative handlers, experiment configuration, and recorder evidence. Three QuantOS-owned offline experiments demonstrate a small mean5/return1 subset, a zero-return diagnostic baseline, and local deterministic replay into current typed DataSnapshot/ResearchArtifact contracts. They do not execute full Alpha158, LightGBM, MLflow or the actual Runtime. Synthetic data has a synthetic-test-only label; software MIT rights do not confer market data rights.

F05 owns snapshots and data-purpose gates; TP02/TP03 own controlled research/model paths; QuantOS orchestration and Artifact interfaces retain authority. A parallel Qlib data/training/tracking/execution system would duplicate those responsibilities. The scope-aware in-memory reference store proves local refusal/dedup behavior only, not deployed authorization or persistent F05 storage.

## Replacement cost and alternatives

| Option | Cost / required evidence | Decision |
| --- | --- | --- |
| Design reference | Maintain six pinned files, small executable fixtures, contract/schema and hash regression checks | Selected; lowest current maintenance cost |
| Isolated adapter | Freeze platform-specific dependency graph; audit complete SBOM/CVE; implement five Engine RPCs, cancellation, scope, Artifact and purpose controls; prove OS egress isolation | Deferred; substantial build/operations cost with no established unmet need |
| Data migration | Convert source dumps to F05 snapshots with full bytes, lineage and independently authorized source rights | Not undertaken; synthetic fixture grants no source rights |
| Tracking replacement | Translate experiment state/config/metrics to owned persistent Artifact and audit semantics, recovery and dedup | Not undertaken; local transcript does not establish delivery |
| Direct second Quant Core | Parallel storage, training, tracking or execution authority | Rejected |

Revisit only for a concrete requirement the owned path cannot satisfy, with explicit decision change and the above evidence. No effort estimate is claimed without that requirement. The historical ensurepip SIGABRT scan failure remains archived; it is not a current host result. Runtime admission remains DENIED until a frozen graph, current advisory triage, isolation and relevant rights are approved.
