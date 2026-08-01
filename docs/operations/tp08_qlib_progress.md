# TP08 Progress Ledger — Qlib Evaluation

## Status

`implemented` — evaluation complete with conclusion `reference_only` (no adapter).

## Deliverables

| Deliverable | Location | Status |
| --- | --- | --- |
| Baseline lock (fixed commit, license, digests) | `third_party/qlib/baseline.lock.json` | done |
| Capability matrix | `third_party/qlib/capability-matrix.md` | done |
| SBOM (SPDX) | `third_party/qlib/sbom.spdx.json` | done |
| CVE audit record | `third_party/qlib/cve-audit.md` | done (status `blocked`, follow-up required) |
| Mapping sample 01: Alpha158 -> DataSnapshot | `third_party/qlib/mappings/01-alpha158-to-datasnapshot.json` | done |
| Mapping sample 02: LightGBM experiment -> ResearchArtifact | `third_party/qlib/mappings/02-lightgbm-experiment-to-research-artifact.json` | done |
| Mapping sample 03: workflow replay -> runtime run semantics | `third_party/qlib/mappings/03-workflow-replay-to-runtime-run.json` | done |
| Executable validation of mapping samples | `engines/tests/test_tp08_qlib_mapping_samples.py` | done |
| Evaluation ADR (conclusion + replacement cost) | `docs/adr/20260731-tp08-qlib-evaluation.md` | done |

## Pinned baseline

- Upstream: `microsoft/qlib`
- Commit: `d5379c520f66a39953bad76234a7019a72796fd0` (`v0.9.7-31-gd5379c52`, 2026-04-22)
- License: MIT

## Acceptance mapping

| Plan requirement | Evidence |
| --- | --- |
| 固定 commit | `baseline.lock.json` upstream block |
| 许可证/SBOM/CVE 记录齐全 | LICENSE digest in `baseline.lock.json`; `sbom.spdx.json`; `cve-audit.md` |
| 完成 3 个离线实验映射 | `mappings/01-03` + replayable hash validation test |
| 结论明确“仅参考/隔离 adapter/拒绝” | ADR decision: `reference_only`, with rejected surfaces enumerated |
| 替换成本 | ADR "Replacement cost" section |
| 不引入第二 Quant Core | no new engine, no runtime dependency; policy block in `baseline.lock.json` |

## Open follow-ups

1. CVE audit is `blocked` (local host bootstrap failure + no upstream lockfile); rerun on a clean Python 3.11+ host with a frozen lock before any future re-evaluation.
2. Revisit the ADR only if R1/R03 produces a requirement that TP02/TP03 cannot satisfy.
