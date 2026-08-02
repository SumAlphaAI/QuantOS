# TP10 Progress Ledger — ValueCell Evaluation

## Status

`implemented` — 评估完成，结论 `reference_only`；12 个 UI 模式映射至 Terminal design spec；5 个 gap 已分配归属；无源码复制、无运行时依赖。

## Deliverables

| Deliverable | Location | Status |
| --- | --- | --- |
| Baseline lock（固定 commit、Apache-2.0） | `third_party/valuecell/baseline.lock.json` | done |
| UX gap report + 12 模式映射 + 禁止耦合清单 | `third_party/valuecell/ux-gap-report.md` | done |
| 差异 ADR | `docs/adr/20260731-tp10-valuecell-evaluation.md` | done |
| 可执行校验（≥10 模式、禁止耦合、protocol/core/frontend/lockfile 零泄漏） | `engines/tests/test_tp10_valuecell_evaluation.py` | done |

## Pinned baseline

- Upstream: `ValueCell-ai/valuecell`
- Commit: `9793e9c0563fbf56fc096757d8bb80e209ac7aab`（2026-02-11，main HEAD）
- License: Apache-2.0

## Acceptance mapping

| Plan requirement | Evidence |
| --- | --- |
| 至少 10 个 UI 模式映射至 Terminal design spec | 12 个模式（ux-gap-report §二）+ `test_at_least_ten_ui_patterns_mapped` |
| UX gap report | §三，5 个 gap 全部分配归属（U01/X06/S02） |
| 可复用交互清单 | §二 12 项，全部 pattern 级采纳、实现级自绘 |
| 禁止耦合清单 | §四 7 条 + `test_no_coupling_list_is_complete` |
| 无源码复制/运行时依赖 | ADR 决策 + `test_no_upstream_reference_in_protocol_core_or_frontend` + `test_no_upstream_dependency_in_lockfiles` |
| 所有差异写 ADR | ADR §Decision 3：导航、账户体系、数据模型、交易面、数据源、视觉资产六项差异全部记录 |

## Open follow-ups

1. U01 design spec 必须逐条落实（或显式偏离并补 ADR）12 个映射模式，并闭合 5 个 gap。
2. ValueCell 发布稳定版本且 IA 有重大变化时可重评估。
