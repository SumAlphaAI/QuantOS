# 功能开发、联调与发布的分阶段测试规程

2026-10-17 项目用户在 X03 执行期间明确调整，依据 [AGENTS.md](../../AGENTS.md)。适用于当前 X03 收尾及后续任务。本规程替代旧本地准入规程中“每个功能必须重新验收全部上游”的开发默认要求；历史回执、失败、中断、签署和发布目标保持原事实。

| 阶段 | 必须完成 | 执行边界 |
| --- | --- | --- |
| 功能开发 DEVELOPMENT | 完整当前业务功能；成功、拒绝、恢复、权限、数据完整性、原子性、幂等、有效期和风险拒绝；必要编译、静态检查、覆盖率及实际变更影响的直接回归 | 每组说明变更路径和选择原因。默认不递归全依赖、不全仓、不三轮构建；新提交、文档/证据更新或测试工具修复不自动扩大范围 |
| 功能联调 INTEGRATION | 完整业务链真实模块组合与全仓测试；成功、拒绝、恢复、消费和补偿闭环 | 集中处理跨模块问题，不能把开发阶段的 fixture 当部署业务联调；扩大回归记录业务路径和原因 |
| 发布验收 RELEASE | 冻结候选，完整适用发布矩阵；实际目标数据库、部署、安全、性能、长稳及同 SHA CI | 未执行 NOT_RUN；实际授权和正式用户确认独立满足，不把本地测试提升为目标或发布通过 |

三阶段分别记账。未完成联调和发布不阻塞无关功能继续开发；已确认的当前功能、权限、数据完整性和风险边界缺陷仍必须修复。对真实数据库有影响的迁移、事务、RLS、权限负向测试仍按 AGENTS.md 连接已配置 Supabase，静态检查不能替代目标实测。本规程不授权生产凭据、破坏性数据库操作或外部发布。

证据记录实际 HEAD、精确输入摘要、命令、范围、时间、退出码、信号、超时和日志摘要。未受影响的历史结果仅供原范围参考，不改绑成新候选 PASS/READY。停止的检查记 INTERRUPTED/NOT_RUN；已完成结果保留，不把中断包装成全部通过。元数据或文档更新只执行对应检查；功能输入变化使相关证据失效时，仅重跑有影响的范围，扩大到联调/发布须显式说明原因。

2026-10-22 用户进一步调整 F05/F07：日常数据库正确性、恢复、权限测试改为人工维护；取消日常全量数据库及覆盖率强制执行，包括 push/PR/schedule。离线功能/静态检查继续；新缺陷不能以人工维护为由放任。完整工具仅在 `QUANTOS_MANUAL_F05_F07=1` 下手工运行，GitHub 仅 `workflow_dispatch` 并确认输入。发布矩阵按候选另行人工组织，缺失结果仍为 `NOT_RUN`。该条优先于旧任务卡及旧验收文档中的 F05/F07 Nightly 要求，详见 [维护与数据保留规程](f05-f07-manual-maintenance.md)。

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

PROVIDER:A2使用16组当前功能汇总检查及5项激活入口，见[A2规程](provider-a2-functional-admission.md)。重新执行当前26操作HTTP、两类provider/consumer及身份注销对导出的拒绝边界；两原确认/回执以原SHA核对，不拼接历史READY。F05/A1只查直接消费边界，不执行旧全依赖闭包；旧变异仅参考原hash，未改Rust运行时不重复变异campaign。共享输入变化撤回007独立READY，汇总只归属PROVIDER:A2，完整联调与发布分别NOT_RUN。

FE:BFF-FE-003采用[BFF003_SCOPE_LOCAL规程](bff-fe-003-functional-admission.md)的19组当前功能/直接影响检查与4个激活入口。新增Research审计事实、reference时钟拒绝及Artifact hash一致性修复，直接回归共享A2 provider和实际生成consumer；F07/F08/R02/R03/R04/R1-SERVICE只覆盖具体消费边界与本机UDS路径，不调度旧40节点闭包。A2独立READY撤回，原确认保留原SHA，完整UI联调、目标持久worker/数据库/Storage与发布分别NOT_RUN。

FE:BFF-FE-005采用[BFF005_SCOPE_LOCAL规程](bff-fe-005-functional-admission.md)的18组检查与5个激活入口；直接检查R01时钟/盘口及R02审批/snapshot边界，watchlist共享审计变化直接回归A2两provider。七项市场API与真实生成consumer/基本Chromium不代表完整UI/API联调；不调度旧40节点闭包或Research Engine测试。BFF003原稿用户确认绑定原SHA，共享输入变化撤回其独立READY；完整联调/发布和实时来源健康另验。

PROVIDER:A3采用[A3_SCOPE_LOCAL规程](provider-a3-functional-admission.md)的18组当前汇总/直接影响检查及7项激活入口，重新执行当前16操作与跨域generated consumer；三原确认和回执只核对原范围。修复reference Market→Snapshot→Research引用时，直接回归Research/Market和共享A2，不调度旧42节点或Engine/R01容量闭包。仅A3检查点准入，完整联调/发布NOT_RUN。

2026-10-22 FEP-1执行纠偏：检查点发现项（如G1-DL/REC/DEP）是原业务范围内的缺陷或辅助记录，不因独立编号、确认待办、环境阻塞或证据登记而变成后续功能开发的新增前置。FEP-1可以直接执行功能收口，完整联调READY仍独立判定；必要缺陷只阻断实际受影响路径。实际功能执行入口与拒绝测试见[FEP-1规程](fep1-function-closure.md)及`scripts/development-execution.mjs`，调度账本为`docs/execution/development-followups.json`。原稿/原确认/NOT_RUN保持，下一原计划功能项UI-507不等待G1-DEP-01或未验证的联调/发布READY。
