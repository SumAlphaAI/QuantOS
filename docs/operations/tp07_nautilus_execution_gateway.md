# TP07 Progress Ledger — NautilusTrader Execution Gateway

## Status

2026-10-17：在历史模型基础上实现X03当前风险/签名/审批下游消费、单次提交与不确定结果隔离，并接入自有Paper本机子进程。当前功能与影响范围验证见[操作规程](./tp07-local-admission.md)；真实Nautilus运行时、完整业务联调、目标及正式确认独立NOT_RUN。历史网关模型不等于这些验收。本次 S2 只评估固定版本/许可/SBOM/CVE/能力与边界，参见 [S2 ADR](../adr/20261016-tp07-evaluation-boundary.md)。

## Deliverables

| Deliverable | Location | Status |
| --- | --- | --- |
| Execution gateway（边界拦截 + 幂等提交 + 事件映射） | `crates/quantos-execution/src/gateway.rs` | done |
| Paper kernel（默认内核 / 替换预案） | `gateway.rs` `PaperKernel` | done |
| Nautilus boundary adapter（进程边界 wire 映射） | `gateway.rs` `NautilusBoundaryAdapter` | done |
| 可部署服务 bootstrap | `services/execution-gateway` | done |
| LICENSE ADR（LGPL 合规 + 替换预案） | `docs/adr/20260731-tp07-nautilus-license-compliance.md` | done |

## Acceptance mapping

| Plan requirement | Evidence |
| --- | --- |
| 同一 idempotency key 重放只产生一个下游提交 | `thousand_replays_with_same_key_produce_exactly_one_downstream_submission`（1000 次重放，paper 内核仅 1 次提交）；`nautilus_adapter_replay_also_produces_one_outbox_entry`（nautilus outbox 仅 1 条） |
| Order/Fill 事件可映射回自有 schema | `order_and_fill_events_map_back_to_owned_schema`（paper）；`nautilus_events_map_back_to_owned_schema_through_the_gateway`（nautilus 事件 payload → client_order_id 解析 → GatewayOrder/GatewayFill） |
| 精度/限额/过期/kill switch 100% 在边界前拦截 | `all_six_boundary_rejection_classes_are_enforced_before_the_kernel` + `hundred_precision_and_limit_variants_are_fully_intercepted` + `limit_intent_without_price_is_rejected_before_the_kernel`，全部断言内核调用计数为 0 |
| 内核不可访问 Agent/用户 session | `boundary_command_carries_no_session_or_identity_material`（key 白名单 + 禁止词扫描）；`ExecutionKernel` trait 仅接收 `BoundaryCommand` |
| 独立服务/进程边界；不引入其类型到 core | `NautilusOrderWire` 为 QuantOS 自有 wire 结构；ADR 决策 1/2；`services/execution-gateway` 独立服务 |
| LGPL 合规与替换预案 | ADR 合规分析 + 替换矩阵（paper 内核为默认路径） |

## Current X3 implementation

新增`dispatch::SignedExecutionGateway`/服务`X03CommandService`，保留legacy checksum路径仅作合成兼容；`process_kernel::PaperProcessKernel`与服务`--tp07-paper-kernel`完成自有Paper的真实stdio进程。帧/绑定/期限、当前风险/kill、claim、累计Fill/去重与整批回滚详见[ADR](../adr/20261017-tp07-paper-dispatch-boundary.md)。

## Open follow-ups

1. 真实Nautilus bridge/API兼容与运行仍未验；当前已有自有Paper的真实有界stdio进程，Nautilus-style outbox只作wire参考，不能冒充上游运行时。实际目标仍需制品/法律/供应链和OS隔离。
2. 若启用 Nautilus 内核超出本地评估，先复验 `third_party/nautilus-trader/` 评估基线（固定 commit/SBOM/CVE），再补部署清单。
3. 事件映射覆盖 `OrderAccepted/OrderRejected/OrderFilled`，新增分批成交累计/均价/重复去重与异常批次隔离。完整OMS、取消、append-only持久化和10万事件验收仍归X04。
