# TP06 Progress Ledger — VibeTradingLabs/vibetrading Strategy Lab

## Status

`implemented` — `engines/strategy-lab` 已落地，生成只写 Artifact、恶意提示全拒、静态检查失败阻断 Release、可完全替换。

## Deliverables

| Deliverable | Location | Status |
| --- | --- | --- |
| 受控策略生成 engine（`strategy.generate.v1`） | `engines/strategy-lab/` | done |
| 边界 adapter（forbidden fields/tools、恶意提示拒绝） | `strategy_lab/adapter.py` | done |
| 确定性生成 + draft/check artifact | `strategy_lab/generator.py` | done |
| 静态分析 fixtures 与检查器 | `strategy_lab/static_checks.py`, `fixtures/catalog.json` | done |
| Python 契约测试 | `engines/tests/test_strategy_lab_contract.py` | done |
| Rust UDS 集成测试 | `crates/quantos-engine-manager/tests/python_strategy_lab.rs` | done |

## Acceptance mapping

| Plan requirement | Evidence |
| --- | --- |
| 生成结果只写 Artifact | 输出仅 `StrategyDraftArtifact` + `StaticCheckArtifact`（`artifact_refs` 指向 supabase artifact URI）；契约测试断言输出无 order/venue/trade_command/secret_ref/deploy/release 键 |
| 100 个恶意/越权提示无订单/secret/network 越权 | `test_strategy_lab_rejects_hundred_malicious_prompts`（100/100 PERMISSION_DENIED）+ `test_strategy_lab_malicious_keyword_coverage_is_exhaustive`（20 个关键词逐一可执行）+ `test_strategy_lab_forbidden_field_coverage_matches_boundary`（11 个禁止字段逐一拒绝） |
| 静态检查失败时 100% 阻断 Release | `test_strategy_lab_static_check_failure_blocks_release`：`release_eligible=false`、`blocked_release=true`；检查器对不支持规则/越界参数/18 类禁止构造全部产出 finding |
| 可完全替换上游实现 | 零上游依赖：纯 QuantOS-native fixture 引擎（`uv.lock` 无 vibetrading 依赖）；manifest `strategy.generate.v1` 可由任何同 capability 实现替换 |
| 绝不部署或进入 OMS | adapter `FORBIDDEN_FIELDS` 含 `venue/oms_command/trade_command/order/deploy/release/approval_signature`，边界层 PERMISSION_DENIED |

## Notes

- 引擎为 QuantOS-native 受控实现（决策：`engines/strategy-lab` 而非上游适配），上游 vibetrading 仅作策略生成 UX 参考；无上游代码、无运行时依赖、无 lockfile 条目。
- 生成的 draft 通过 `quantos-strategy` 的 `GeneratedStrategyAdapter` 进入 S02 回测编排，仍不触达 OMS。

## Open follow-ups

1. 若 S2 需要真实 LLM 策略生成，先完成提示注入防护评审，再以同 capability 替换 fixture 生成器。
2. 恶意提示关键词当前为 20 词静态集；接入真实生成器时需扩充为分层注入检测。
