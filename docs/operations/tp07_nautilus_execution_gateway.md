# TP07 Progress Ledger — NautilusTrader Execution Gateway

## Status

`implemented` — gateway、双内核、边界拦截、事件映射、LGPL ADR 全部落地，验收测试通过。

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

## Open follow-ups

1. Nautilus 外部进程传输（UDS/HTTP）尚未实现；当前 adapter 在进程内建模 outbox/event intake，真实部署前需补传输层与加固。
2. 若启用 Nautilus 内核超出本地评估，先建 `third_party/nautilus_trader/` baseline（固定 commit/SBOM/CVE），再补部署清单。
3. 事件映射当前覆盖 `OrderAccepted/OrderRejected/OrderFilled`；部分成交与撤单事件随 X3 testnet 需求扩展。
