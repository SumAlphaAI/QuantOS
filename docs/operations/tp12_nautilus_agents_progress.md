# TP12 Progress Ledger — nautilus_agents Evaluation

## Status

`implemented` — 评估完成，结论 `reference_only`；边界确认不变；7 条禁止耦合规则已机器可读并可执行校验。

## Deliverables

| Deliverable | Location | Status |
| --- | --- | --- |
| Baseline lock（固定 commit、LGPL、digest） | `third_party/nautilus-agents/baseline.lock.json` | done |
| 接口差异清单 | `third_party/nautilus-agents/interface-diff.md` | done |
| 禁止耦合规则（7 条，带执行证据） | `third_party/nautilus-agents/no-coupling-rules.json` | done |
| Threat model 补充（8 条威胁） | `docs/operations/tp12_nautilus_agents_threat_model.md` | done |
| 可执行校验（规则证据、边界声明、lockfile 零依赖） | `engines/tests/test_tp12_nautilus_agents_rules.py` | done |
| 评估 ADR | `docs/adr/20260731-tp12-nautilus-agents-evaluation.md` | done |

## Pinned baseline

- Upstream: `nautechsystems/nautilus_agents`
- Commit: `8d79877380f8617b45dff2b8c8b3790c2f9d963a`（2026-07-27；crate 0.2.0，protocol 1.0）
- License: LGPL-3.0-or-later

## Acceptance mapping

| Plan requirement | Evidence |
| --- | --- |
| 不少于 5 条禁止耦合规则 | 7 条规则（NC-01..NC-07），`test_at_least_five_no_coupling_rules` |
| 验证其方案不改变“Agent 不直连 venue”边界 | `boundaryStatement` + interface-diff §2（upstream authority boundary confirms ours）+ `test_boundary_statement_preserves_agent_venue_isolation` |
| 无运行时依赖 | `test_no_upstream_dependency_in_quantos_lockfiles`（Cargo.lock / uv.lock 扫描）；baseline policy `reference_only` |
| ADR | `docs/adr/20260731-tp12-nautilus-agents-evaluation.md` |
| threat model 补充 | `docs/operations/tp12_nautilus_agents_threat_model.md` |
| 接口差异清单 | `third_party/nautilus-agents/interface-diff.md`（6 组 surface + 5 条反模式） |

## Candidate adoptions（未承诺，待 F07 排期时决策）

1. Agent 证据留存的 retention classes（ReferenceOnly/Redacted/Full，拒绝 Restricted）。
2. 契约字段级 ownership/stability/retention/digest 元数据（`fields.toml` 模式）。
3. advisory 与 authoritative 检查的显式命名区分。

## Open follow-ups

1. 上游 protocol 2.0 或 crate 1.0 发布时重新评估（当前为 early alpha）。
2. NC-07 可加 CI lockfile 禁止项自动化检查。
