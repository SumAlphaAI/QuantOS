# UI-601 当前功能复核

I8 UI-601 Operations/Incident/Runbook，依据前端执行计划、C11/C16和AGENTS功能优先策略；仅QuantOS/main，代码/测试/文档/证据与计划同步，不使用生产凭据、不推送或发布。

## 实现

交付Operations、health别名及Incident UUID详情；C01完整身份/权限/有效期和失效清理；健康/metrics同源核对、来源/期限与组件；有界冻结分页；C16告警读取绑定Incident创建；Incident确认/解决、时间线前后head核对；封闭Runbook批准目录、UUID参数、30秒precheck与MFA后重新核对；显式确认、CAS、审计回执、429冷却、原请求未知恢复、离线/移动端禁写；Alerts→Operations入口。

只接受inspect-health和inspect-evidence，无shell/脚本/任意JSON。ack不代表resolved；解决只允许已确认Incident，最终职责分离/审批、新来源修复和告警状态由服务端验证。实际未满足条件返回403/FORBIDDEN，客户端清除上下文，未冒充409或成功。Runbook operation摘要与outcome.reference分别验证结构，不虚构相等关系。

必要修复：reference C01原逻辑在Owner启用审批后只retain已声明能力，无法补回默认冷启动禁用的ops.approve。改为Governance有效权限与原角色能力交集同步，保留默认禁用、不同角色不扩权；新增native回归与真实HTTP Approver C01声明。只影响reference声明，不修改live授权。Owner bootstrap只在回环fixture中使用。

当前C11只有聚合服务和四组件，不伪造七个独立服务；P13后续适配。C02旧operations/alerts引用未加入本次路由范围。详见[功能规程](../operations/ui601-operations-incidents-runbooks.md)。

## 验证与证据

当前单元/策略、真实C01/F06/C11/C16/C10消费者、既有C16/P23消费者直接回归；原生BFF operations模块、单项X06批准订单InspectEvidence测试、类型/lint/rustfmt/构建/计划及静态路由/阶段政策。新Chromium8项及P23页面7项直接回归；dark/light 1440/390功能截图/axe，移动Runbook区域、Incident详情与确认弹窗额外截图。无递归全链、全仓数据库campaign或发布测试。

原命令/退出码/数量/SHA/日志及二进制/构建/浏览器摘要以[证据](./evidence/ui601-local-20261024/README.md)receipt/result为准。preflight为未冻结工作树，不认同SHA验收；首轮consumer预期409实际403已保留并纠正，后续通过；首轮browser6/8失败为确认尚未完成就切身份重载的测试竞态与链接缺下划线axe violation，均已修复，原截图/日志保留。后续修正必须用冻结attempt验证，不覆盖旧失败。

证据分别记录：HTTP健康/Runbook检查成功与恢复、创建/确认Incident与append-only时间线/恢复、HTTP解决拒绝；原生C11新来源修复后解决及复发重开；原生X06 InspectEvidence核心成功；前端明确内存模型两种动作/解决正向。当前reference HTTP没有订单证据注入和来源修复端点，所以HTTP InspectEvidence正向、HTTP修复后resolve正向仍NOT_RUN，不用内存/native结果替代HTTP正向，不添加产品可调用的注入/修复接口。

身份cookie桥接/TLS CORS代理为明确替代，故障注入另标probe，不能提升为真实IdP/CORS/目标环境。targetDB/RLS/事务、外部源、远程同SHA CI、Firefox/WebKit、人工读屏/原生200%缩放、性能容量/长稳、完整I8和RELEASE均NOT_RUN；P13高保真未交付。axe incomplete及失败原样保留。

## Gate与后续

工程Gate目标PASS_UI601_OPERATIONS_FUNCTION；开发IMPLEMENTED_PENDING_ACCEPTANCE，正式stage_gate保持NOT_ASSESSED，formalAccepted=false、runtimeAdmission=DENIED；不自行批准ACCEPTED。G4 IN_REVIEW、G4/FEP-4 NOT_READY_GAPS_OPEN、FEP-4 PARTIAL不变；原同源marker、蜡烛导出、估值join及目标/CI/性能/RELEASE缺口保留。UI603/P23/G4/FEP4历史包ORIGINAL_SCOPE_ONLY逐字节不变，不改绑新候选。

INTEGRATION预期拒绝；下一原开发任务FE:UI-P13（Operations和Incident高保真）。回退按源码提交审阅git revert并重建BFF/terminal；无DB迁移/生产写入，不清理业务事实，保留历史证据。

## 冻结结论

源码40290ef5e177720e6d8c052e9442c16544a7a100，attempt-01通过工程Gate PASS_UI601_OPERATIONS_FUNCTION：89项前端/消费者、22项BFF operations、1项X06 InspectEvidence核心、65项Node；Operations Chromium8项及P23直接回归7项全通过，无skip/重试/flaky；类型/lint/rustfmt/本机构建/计划通过。4次axe零violation，保留4项color-contrast incomplete。原链接violation和测试竞态失败保留未覆盖；人工查看本次dark1440、light390 Runbook下部及dark确认弹窗，功能可读，P13高保真仍NOT_RUN。

313个历史证据文件逐字节未变，159项正式stage_gate均NOT_ASSESSED；INTEGRATION预期拒绝，下一FE:UI-P13开发允许。HTTP两项未跑正向与目标/CI/性能/RELEASE不提升，formalAccepted=false、runtimeAdmission=DENIED。仅本地源码/封包提交，未使用生产凭据，未推送或发布。
