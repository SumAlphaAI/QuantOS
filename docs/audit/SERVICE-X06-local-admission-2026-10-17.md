# SERVICE:X06 本地功能交付与准入记录 — 2026-10-17

当前候选：`bcadfef9f0501975fcbcdbd14dd25f45bd3943de`，基线 `ba9392a895d25188dd85602e0fe5a5f1b905d683`。只修改 QuantOS，无生产凭据、实际目标数据库、venue或外部发布。20组检查实际全部PASS，SERVICE-X06_LOCAL=DEVELOPMENT READY；正式确认PENDING。最终执行状态以 [manifest](./evidence/service-x06-local-20261017/manifest.json) 和 [summary](./evidence/service-x06-local-20261017/summary.json) 为准。

## 交付内容

新增 `quantos-operations` 固定账户可信后端服务：精确 tenant/workspace/account/mode + capability 校验；当前身份绑定的最长5分钟 step-up 断言；授权订单/Fill/审批/风险/仓位证据链、安全分页审计、健康/告警/incident 与受控操作。没有公开HTTP路由、客户端AuthContext/MFA反序列化、账务编辑、任意Runbook、凭据读取或venue提交工具。新增细分能力不自动授予任何真实主体。

组合真实 X03 签发、X02 guard、X04 OMS事实和X01 projection。服务初始化核对 issuer/guard/gateway 实例与作用域；提交在网关锁内校验源事实anchor并连续执行当前风险/审批/kill校验及内核IO，避免仓位检查和提交之间被另一写者插入。Shadow无submit路径，Paper只用自有内核。每次调用重新校验当前权限/时效，幂等绑定完整载荷与actor/user；并发prepare和消费只提交一次。取消保留过期/kill后的减险语义及当前持有人校验。

Fill只能来自认证网关事实，关联 command→risk/approval→order→fill→append-only PortfolioEvent→position；安全DTO屏蔽签名、session和任意内核拒绝原因，历史仓位明确标识source是否当前。服务本地journal hash链、完整事实并集回放与仓位重建可校验，F05持久数据库ledger/outbox未接入。

未知结果不自动重试，不可换key或换gateway绕过。恢复只由当前原操作者认证收集迟到事件及查询真实事实；延迟成交补记唯一Fill，取消未知须有真实终态事实。X04仅放行关联正确且满足既有时限/状态约束的Uncertain→真实取消回执，取消/submit IO不重放。checkpoint需Owner、step-up及不可反序列化的可信锚；仅空实例、同seed/作用域/网关租约、合法hash链与Fill映射可恢复，Prepared转Uncertain。此为进程内实例重建，不是跨进程持久恢复。

F09观察输入限定固定Service actor、完整四组件、规则名allowlist和单调/新鲜源时间，自由文本只存摘要。incident经ack、实际故障清除、更新观察后，由不同actor及user的Approver关闭；ack操作者同user换actor也拒绝。外部绿色报告不能覆盖本地执行未知；故障复发自动重开incident。解除kill要求独立审批、Owner执行、更新健康、kill revision CAS与单次消费。Runbook封闭为只读InspectEvidence/InspectHealth，未知字段拒绝。

## 测试范围与证据

按最新 AGENTS.md 的 FUNCTION_AND_IMPACT 执行 [20组清单](../../scripts/service-x06-test-scope.mjs)。41项不同Rust行为/编译拒绝契约：服务23、原生Paper进程1（即时成交/挂单两变体）、dispatch8、TP12敏感字段边界1、X03风险原子性1、X04取消/未知/事实回放4、编译拒绝3。新服务LLVM额外重跑23项用于量测，各model/service/telemetry文件要求行≥90%、区域≥85%；不声称branch或性能通过。Node负向门禁43、计划排期44；必要Clippy/fmt/计划与handoff检查、生产依赖图静态排除检查。原始日志、命令、退出码、时间/信号/超时和覆盖率数据均在 [function-attempt-01](./evidence/service-x06-local-20261017/function-attempt-01/)。

扩展的3项X04取消/非法事实回归源于实际修改apply_cancel的未知回执收口路径；没有运行旧10万事件campaign、X05全20类差异、全仓、三轮构建或任何上游任务Gate。八个直接依赖仅NOT_REVALIDATED/referenceOnly，不拼接历史READY。共享Cargo图/dispatch/guard与门禁输入变化导致TP12当前独立READY撤回，历史原始记录不改写，见 [withdrawal](./evidence/service-x06-local-20261017/withdrawal.json)。

预检保留全部失败：初始编译/测试target和fixture设置错误，Runbook单位枚举忽略额外字段的真实缺陷，Clippy警告，迟到取消未被原X04状态接受，以及代理fixture未转发submit_at导致非法时间。均已修复；旧日志不会被最终PASS覆盖。早期20项覆盖率属于修复过程，不作为本候选23项准入证据。详见 [preflight索引](./evidence/service-x06-local-20261017/preflight-index.json)。

## Gate、未决边界和下一任务

只允许功能DEVELOPMENT READY；businessIntegration/releaseAcceptance=NOT_RUN，formalAccepted=false、runtimeAdmission=DENIED、venueAuthority=NOT_GRANTED。ProjectUser正式确认PENDING，确认文稿覆盖Product/Frontend/BFF/QA/Security/Risk/Domain；Codex不代用户批准，单人项目验收也不改变交易职责分离。

未决目标：真实F06会话/MFA及能力授予、Supabase/RLS；F05 durable事件/outbox/审计和跨组件事务；可信锚的持久保管/重建与跨进程、跨实例崩溃恢复；实际F09/X05观察管线；BFF与P08–P14/P20–P23业务全链路；敏感checkpoint留存/OS隔离/真实时钟与凭据接收方；安全/性能/持续指标/部署/长稳及同SHA CI。全部NOT_RUN，移交CORE:X06及RELEASE-GATE:BETA。X01虚拟账本沿用f64/固定quote，不含精确会计或FX；非零异币手续费拒绝。未知取消无真实终态时继续隔离，不提供人工改账或强制关闭。

下一可执行任务：`CORE-GATE:X3-SERVICE`，先按最新分阶段规程定义X3服务聚合业务范围及受影响回归，保留历史证据并记录尚待联调/发布义务；不得把本轮单节点READY转换为整链或正式验收。后续页面/BFF在CORE:X06/G4/G5/G6执行。

完整变更文件和摘要见 [changed-files](./evidence/service-x06-local-20261017/changed-files.json)；源码与证据分别本地提交，不推送。技术规程见 [service-x06](../operations/service-x06.md)，决策见 [ADR](../adr/20261017-service-x06-controlled-operations.md)。
