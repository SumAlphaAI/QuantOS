# TP13 Progress Ledger — Loong Evaluation

## Status

`implemented` — 评估完成，结论 `reference_only`；4 个设计模式候选采纳、2 个反模式明确拒绝；无上游类型进入 protocol/core。

## Deliverables

| Deliverable | Location | Status |
| --- | --- | --- |
| Baseline lock（固定 commit、MIT、digest） | `third_party/loong/baseline.lock.json` | done |
| 协议/UX 对照表（6 必查轴 + protocol/runtime/UX） | `third_party/loong/protocol-ux-comparison.md` | done |
| Adoption decision ADR | `docs/adr/20260731-tp13-loong-evaluation.md` | done |
| 可执行校验（六轴覆盖、基线固定、protocol/core/lockfile 零泄漏） | `engines/tests/test_tp13_loong_evaluation.py` | done |

## Pinned baseline

- Upstream: `eastreams/loong`
- Commit: `3ab7936638e4772c1db95ebee7f5f643852697c2`（2026-07-07，dev HEAD）
- License: MIT

## Acceptance mapping

| Plan requirement | Evidence |
| --- | --- |
| 对照覆盖 session、workflow、tool、memory、权限、审计六项 | `protocol-ux-comparison.md` §1–§6 + `test_comparison_covers_all_six_required_axes` |
| ADR | `docs/adr/20260731-tp13-loong-evaluation.md`（adoption decision 明确） |
| 协议/UX 对照表 | `protocol-ux-comparison.md`（含 §7–§9 补充轴） |
| adoption decision | ADR：4 候选采纳 + 2 反模式拒绝 |
| 无上游类型进入 QuantOS protocol/core | `test_no_upstream_types_in_protocol_or_core` + `test_no_upstream_dependency_in_lockfiles` |

## Candidate adoptions（未承诺，F07/U 系列排期时决策）

1. 会话级 restricted tool view（root ∩ persisted ∩ build-time）。
2. 高风险工具构建期剔除（feature gating，强于运行时禁用）。
3. X02 审批审计的 approval replay record。
4. 跨 crate 统一 audit sink 抽象。

## Rejections

- `trusted_internal_context`（内部调用信任旁路——反模式）。
- MCP/ACP server 注入（TP01 已拒绝的边界）。
- Telegram 等渠道集成、Loong TUI 复用。

## Open follow-ups

1. F07 启动时逐项决策候选采纳。
2. Loong 发布稳定 1.0 protocol crate 时可重评估。
