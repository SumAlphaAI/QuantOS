# TP12 Threat Model Supplement — Agent 与交易内核协作边界

补充自 TP01 inventory/threats 与 F07 agent runtime 边界。每条威胁给出当前缓解与可执行证据；引用规则见 `third_party/nautilus-agents/no-coupling-rules.json`。

## T1 提示注入诱导 Agent 调用订单/venue 工具

- 场景：恶意或越权提示让 Agent 直接下单或访问交易所。
- 缓解：Agent 引擎边界拒绝 `order/order_tool/trade_command/venue/secret/network` 字段；输出只有 `executable=false` 的 `TradeProposal`（规则 NC-01、NC-02）。
- 证据：`signal_proposal_workflow_rejects_forbidden_order_tools`；TP04 adapter 边界测试。
- 残余风险：低；F07 引入新工具时需同步扩充禁止字段清单。

## T2 Agent 会话/身份信息泄漏进执行内核

- 场景：tenant/actor/session/decision/approval 材料越过内核边界，内核获得越权上下文。
- 缓解：TP07 gateway 只向内核传递 sanitized `BoundaryCommand`（规则 NC-04）。
- 证据：`boundary_command_carries_no_session_or_identity_material`（key 白名单 + 禁止词扫描）。
- 残余风险：低；新增边界字段时必须更新隔离测试白名单。

## T3 Agent 本地检查被当作生产决策

- 场景：Agent 侧的 advisory 结论绕过权威风控直接驱动下单（上游 nautilus_agents 明确把本地检查定位为 advisory，这印证了该威胁的真实性）。
- 缓解：`TradeCommand` 签发必须持有权威 `RiskDecision`，审批状态机强制单用、禁自批（规则 NC-03）。
- 证据：`seven_rejection_classes_are_all_enforced`；`ApprovalVerifier`。
- 残余风险：中；命名层面应显式区分 advisory/authoritative（候选采纳项，见 interface-diff §4）。

## T4 重放导致重复下游提交

- 场景：网络重试或故障重放同一 `TradeCommand`，venue 侧出现重复订单。
- 缓解：签发层与 gateway 层双重幂等；同一 idempotency key 只产生一次内核提交（规则 NC-04 关联）。
- 证据：`thousand_concurrent_issuances_with_same_key_emit_exactly_one_command`；`thousand_replays_with_same_key_produce_exactly_one_downstream_submission`；`nautilus_adapter_replay_also_produces_one_outbox_entry`。
- 残余风险：低；持久化层落地后需补崩溃窗口测试。

## T5 过期/失效提案被评估或提交

- 场景：超过 `expires_at` 的提案仍进入评估、签发或内核。
- 缓解：R04 评估门、X02 签发检查、TP07 gateway `CommandExpired` 三层拦截（规则 NC-06）。
- 证据：R04 编排测试过期拒绝用例；`CommandExpired` 边界测试。
- 残余风险：低。

## T6 Agent SDK 供应链进入运行时

- 场景：`nautilus-agents`（LGPL-3.0-or-later）或其他上游 Agent 代码进入 QuantOS lockfile/依赖图。
- 缓解：TP12 baseline `reference_only` + TP07 LGPL ADR 进程边界决策（规则 NC-07）。
- 证据：`third_party/nautilus-agents/baseline.lock.json` policy；git diff 验证 lockfile 零改动。
- 残余风险：低；CI 可加 lockfile 禁止项检查。

## T7 证据/记录被篡改或不可定位

- 场景：Agent 侧记录被当作生产证据，或证据无法回溯到确定内容。
- 缓解：生产证据只走 runtime artifact 路径，content-hash 覆盖 + 去重（规则 NC-05）；上游 retention class 设计（ReferenceOnly/Redacted/Full，拒绝 Restricted）为候选采纳项。
- 证据：R03/R04 artifact manifest 记录与回放去重测试。
- 残余风险：中；Agent 侧 trace 的留存级别元数据尚未建模，列为候选采纳。

## T8 上游协议演进导致映射漂移

- 场景：nautilus_agents protocol 1.0 演进（早期 alpha，明确可能变更）使评估结论过时。
- 缓解：baseline 固定 commit `8d79877`；接口差异清单按 surface 组织，重评估时逐条复核。
- 证据：`baseline.lock.json` pinned upstream block。
- 残余风险：中；protocol 2.0 或 crate 1.0 发布时应重评估。
