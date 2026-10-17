# quantos-operations — SERVICE:X06

固定 tenant/workspace/account/mode 的可信后端服务；仅 Paper/Shadow，不加载生产凭据、网络客户端、shell 或上游 Nautilus SDK。接入真实会话的宿主须提供当前 `AuthContext`、已验证 MFA 的 `VerifiedStepUp` 与可信时钟/当前风险来源；这些 Rust 类型不是公共 HTTP 请求 DTO。

授权查询包括安全订单/成交/审批/风险/仓位证据链、带 head 校验的分页审计、告警、健康、incident 与操作回执。每次受控变更重新检查精确作用域、能力、角色及最长5分钟的 step-up。Owner/Operator 操作，独立 actor **和** user 的 Approver 审核恢复/关闭；恢复 kill 还需要 Owner、更新的健康观察及当前 kill revision CAS。单人项目验收确认不改变交易职责分离。

提交拆成 prepare/dispatch；真实 X03 command 与当前风险由 X03/X04 原子边界验证。操作幂等绑定完整载荷和身份；网关事实 head 在同一网关锁中再次校验，拒绝陈旧仓位及多写者绕过。Shadow 无提交路径。取消保留风险降低语义，命令过期/kill 后仍要求当前持有人权限。签名、session、自由文本拒绝原因不进入安全查询 DTO；受限 checkpoint 包含签名对象，不能当作导出报告。

只接受实际 X04 订单事实的 Fill，映射到 X01 append-only 事件并重建仓位；查询返回原始事实引用、Fill→事件链接及完整输入摘要。没有改余额/改账 API，Runbook 封闭为 `InspectEvidence`/`InspectHealth {}`，未知字段拒绝。虚拟账本沿用 X01 f64 及固定报价币种契约；非零异币手续费拒绝，没有精确会计/FX 声明。

F09观察要求固定 Service actor、完整四组件、规则名 allowlist、单调源时间和30秒新鲜度；自由细节仅保留摘要。未确认执行结果派生的本地告警不能被绿色观察覆盖。incident 经确认、修复、更新观察和独立审核关闭；故障复发重新打开。

恢复为**进程内可信锚与同一 gateway 租约的实例重建**：空实例、同seed、hash链、大小/时钟/Fill来源验证；Prepared隔离为Uncertain，不自动重试。下游已完成而服务未记完成时，只能查询实际网关事实补齐一次；不重置 issuer/risk/网关权威。跨进程持久锚、完整状态重建、F05数据库事件/outbox与跨组件事务仍需目标实现/验收。

运行 `make service-x06-check`；冻结本地源码后 `make service-x06-assess-local` 记录功能与直接回归，`make service-x06-local-check` 验证证据。详见 [规程](../../docs/operations/service-x06.md)。
