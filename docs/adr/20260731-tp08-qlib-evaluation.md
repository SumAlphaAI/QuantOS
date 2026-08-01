# ADR: TP08 Qlib Evaluation — Reference-Only, No Adapter

## Status

Accepted as evaluation conclusion.

## Context

TP08 requires an evaluation of Qlib for dataset handling, factor experimentation, and workflow reproducibility, with the explicit constraint that Qlib must not become a second Quant Core. The evaluation is pinned to `microsoft/qlib@d5379c520f66a39953bad76234a7019a72796fd0` (`v0.9.7-31-gd5379c52`, MIT) and covers three deliverables: a capability matrix, an SBOM/CVE record, and three offline experiment mappings into `DataSnapshot` / `ResearchArtifact` contracts.

Findings from the capability matrix:

1. Qlib's valuable assets are design-level: the expression/handler dataset model, the declarative `qrun` experiment config, and the experiment-recorder reproducibility model. All three are expressible inside QuantOS contracts, as proven by the three mapping samples.
2. Every runtime surface (binary data store + cache, redis/mongo client-server infra, mlflow tracking, in-process training, backtest/execution, RL) conflicts with existing QuantOS boundaries: F05 snapshot catalog and license gate, F08 engine isolation, TP03 engine ownership, and the artifact store.
3. Supply-chain posture is weak for admission: no upstream lockfile, several unpinned heavy dependencies (`mlflow`, `gym`, `jupyter`), and the CVE audit is currently `blocked` by local host bootstrap failures.

## Decision

1. Qlib is classified as **reference only** (`reference_only`). No `engines/qlib-adapter` will be built.
2. Qlib designs may be absorbed only as design/test reference or as offline mapping samples, per `baseline.lock.json` policy.
3. QuantOS dataset, factor, and reproducibility needs are served by the owned path: F05 `DataSnapshot` catalog, TP03 `llmquant`, TP02 `rd-agent`, and R03/R04 orchestration.
4. The pinned baseline (`third_party/qlib/`) is retained for monitoring; CVE audit must be rerun and classified before this decision can be revisited.

## Consequences

Positive:

- No second Quant Core, no duplicate data infra, no mlflow dependency in the QuantOS runtime.
- Mapping samples keep the door open for absorbing Qlib experiment-design ideas without taking code dependencies.
- MIT license removes legal blockers for design reference.

Trade-offs:

- QuantOS reimplements handler-style factor definitions inside `llmquant` fixtures rather than reusing Qlib's mature factor library.
- Qlib's benchmark model zoo remains external; QuantOS keeps its own deterministic fixtures.

## Replacement cost

If this decision were reversed in favor of an isolated adapter:

- **Adapter build**: a `data.query.v1`-style provider translating Qlib handler/dataset definitions into the QuantOS Data Contract — comparable to TP05's `openbb-adapter` scope.
- **Data migration**: Qlib binary dumps would need conversion into F05 snapshots with per-source license and lineage labels; the community dumps currently lack production-grade licenses, so production use would additionally require a licensed data source.
- **Tracking replacement**: mlflow recorder semantics would need reimplementation on the QuantOS artifact store to satisfy hash dedup and tenant isolation.
- **Supply chain**: a pinned lockfile plus a passing CVE audit would be a hard prerequisite; the heavy dependency set (`mlflow`, `gym`, `jupyter`) is the dominant cost.
- **Net assessment**: replacement cost is high relative to the value, because the three valuable capabilities are design patterns that QuantOS already expresses natively. Reversal is not recommended without a concrete requirement that TP03/TP02 cannot meet.

## Follow-up

- Rerun the CVE audit on a clean Python 3.11+ host with a resolver-frozen lock for the pinned commit; record findings per `cve-audit.md`.
- Revisit this ADR only if R1/R03 surfaces a requirement that the owned engines cannot satisfy.
