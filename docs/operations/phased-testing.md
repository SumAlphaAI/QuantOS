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
