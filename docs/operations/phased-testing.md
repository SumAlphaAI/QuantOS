# 功能开发、联调与发布的分阶段测试规程

2026-10-17 项目用户在 X03 执行期间明确调整，依据 [AGENTS.md](../../AGENTS.md)。适用于当前 X03 收尾及后续任务。本规程替代旧本地准入规程中“每个功能必须重新验收全部上游”的开发默认要求；历史回执、失败、中断、签署和发布目标保持原事实。

| 阶段 | 必须完成 | 执行边界 |
| --- | --- | --- |
| 功能开发 DEVELOPMENT | 完整当前业务功能；成功、拒绝、恢复、权限、数据完整性、原子性、幂等、有效期和风险拒绝；必要编译、静态检查、覆盖率及实际变更影响的直接回归 | 每组说明变更路径和选择原因。默认不递归全依赖、不全仓、不三轮构建；新提交、文档/证据更新或测试工具修复不自动扩大范围 |
| 功能联调 INTEGRATION | 完整业务链真实模块组合与全仓测试；成功、拒绝、恢复、消费和补偿闭环 | 集中处理跨模块问题，不能把开发阶段的 fixture 当部署业务联调；扩大回归记录业务路径和原因 |
| 发布验收 RELEASE | 冻结候选，完整适用发布矩阵；实际目标数据库、部署、安全、性能、长稳及同 SHA CI | 未执行 NOT_RUN；实际授权和正式用户确认独立满足，不把本地测试提升为目标或发布通过 |

三阶段分别记账。未完成联调和发布不阻塞无关功能继续开发；已确认的当前功能、权限、数据完整性和风险边界缺陷仍必须修复。对真实数据库有影响的迁移、事务、RLS、权限负向测试仍按 AGENTS.md 连接已配置 Supabase，静态检查不能替代目标实测。本规程不授权生产凭据、破坏性数据库操作或外部发布。

证据记录实际 HEAD、精确输入摘要、命令、范围、时间、退出码、信号、超时和日志摘要。未受影响的历史结果仅供原范围参考，不改绑成新候选 PASS/READY。停止的检查记 INTERRUPTED/NOT_RUN；已完成结果保留，不把中断包装成全部通过。元数据或文档更新只执行对应检查；功能输入变化使相关证据失效时，仅重跑有影响的范围，扩大到联调/发布须显式说明原因。

机器策略为 `scripts/development-testing-policy.json`。`provider-a1-receipts.mjs::assess` 是旧聚合执行器，现要求显式 `campaign={phase:'INTEGRATION'|'RELEASE', reason:'具体业务链及扩大范围理由'}`，默认调用在调度和创建证据目录前拒绝；旧 recorder 不再能自动发起开发全闭包。现有聚合回执仍可按原范围审计；执行器参数不会把结果自动升级为对应阶段验收。后续任务应像 X03 一样建立当前功能/影响范围清单，再进入记录器，不应复制旧全闭包入口作为默认开发 Gate。

X03 的实际入口为 `make x03-assess-local`，清单为 `scripts/x03-test-scope.mjs`：12 组当前功能与直接影响检查，逐组 reason。`record-x03-local.mjs` 不调用聚合 assess、不读取历史 READY、不修改上游 canonical 产物；在新目录记录真实结果，只有全部必要检查正常退出、输入未漂移及覆盖率满足后才事务写入 X03 manifest 和两份计划。SIGTERM/SIGINT 中断会停止当前子进程组、保存 INTERRUPTED 并拒绝发布。

X03 v2 Gate 仅 `functionImplementation=PASS`；`businessIntegration=NOT_RUN`、`releaseAcceptance=NOT_RUN`、`formalAccepted=false`。原任务图和直接依赖保留，依赖行是 `NOT_REVALIDATED/referenceOnly`，不宣称上游 READY。`make x03-local-check` 重核当前功能输入及证据，`make x03-release-check` 在真实发布矩阵和用户正式确认未完成时拒绝。

[项目用户确认规程](../gate-records/user-acceptance-confirmation-workflow.md)继续适用。修改流程的指令不等于确认某份验收文稿；Codex 完整拟稿并保存真实用户回复后才可登记正式确认。

X04 使用`make x04-assess-local`及`scripts/x04-test-scope.mjs`的当前功能/直接影响范围：订单提交/取消、append-only事实及anchor重放、10万混合事件、Fill溯源、真实本机Paper进程及受影响X03/TP07回归；不通过旧全闭包入口。`X04_LOCAL`依赖行仅NOT_REVALIDATED/referenceOnly。源码变化撤回TP07当前独立READY，保留其原SHA历史回执；本轮直接回归只归属X04证据。完整联调与发布独立NOT_RUN，详见[X04操作规程](x04-local-admission.md)。

X05采用`make x05-assess-local`与`scripts/x05-test-scope.mjs`的15组当前功能/直接影响检查；仅验证Shadow/虚拟账本、20类对账、异常闭环、只读X04/X01输入及无submit边界，不重新跑X03/X04/TP07全套或上游闭包。X01–X04运行时代码不变；共享锁文件/Makefile/门禁契约输入变化使X04独立READY撤回，旧回执保留原范围。完整联调、真实10交易日、目标时效和28组发布目标独立NOT_RUN，见[X05规程](x05-local-admission.md)。

TP12为边界/参考评估任务，使用`make tp12-assess-local`的20组当前功能及直接影响检查：固定参考字节、7规则/6接口/8威胁、本机Agent进程与当前签发/审批/风险/净化命令/证据关闭边界；全生产图仅静态排除扫描，不调度全仓回归。TP12_LOCAL只授予本地功能READY；TP07完整联调后的TP12完整复审仍NOT_RUN，依赖为NOT_REVALIDATED/referenceOnly。受影响X05独立READY撤回，原SHA和证据保留；X05本模块不变，上游dispatch键边界按下段修复。见[TP12规程](tp12-local-admission.md)。

TP12核对发现dispatch幂等键值包含tenant/workspace原文，当前修复为域分离规范元组摘要。因此直接影响范围增加为全部8项tp07_dispatch、2项X04取消/控制及1项实际自有Paper进程检查；仍不执行无关S2闭包或10万事件。

SERVICE:X06 使用 `scripts/service-x06-test-scope.mjs` 明列20组当前功能及直接影响检查；覆盖固定作用域授权、证据链、职责分离、幂等/恢复、网关anchor CAS及实际Paper进程。F05/F06/F09与X01–X05仅参考，不递归重新准入；LLVM仅量测新服务模块，不运行全仓或旧10万事件/20类差异campaign。阶段和目标边界见 [SERVICE:X06规程](./service-x06.md)。

CORE-GATE:X3-SERVICE采用`make x3-service-assess-local`明列17组当前服务组合及影响回归。X03/Paper/X04/X01与独立Shadow比较、20类异常证明/ack/修复/复发、kill和陈旧拒绝及幂等恢复属于本检查点必要功能；不通过历史READY或旧聚合执行器拼接上游。修复零异币费用契约时，只扩展实际适配器和费用拒绝边界；完整INTEGRATION、实际10交易日、目标数据库/部署/性能及发布仍独立NOT_RUN。见[X3服务规程](x3-service-local-admission.md)。
