# UI-603 当前功能复核

任务：I8 UI-603 Alerts 收件箱；依据前端执行计划、AGENTS功能优先与分阶段测试要求。代码/测试/文档/证据只写QuantOS，main本地提交；不使用生产凭据，不推送或发布。

交付：C01授权Alerts列表/详情与共享导航，C16分页筛选、版本化订阅、SSE有界手动读取/续接、ack/unack明确确认与二次验证、原请求幂等恢复、429冷却、身份/离线失效清理。ack=已读，active/resolved不可被回执修改。移动端只读高风险操作，订阅仍可用；UI-P23高保真留给下一任务。

必要修复：实际浏览器Approver冷启动显示C01在首个C16加载后减少ops.approve。定位为reference C01在OperationsHost惰性初始化前错误声明seed默认禁用的处置审批能力。冷启动声明已收窄至seed有效权限，并增加四种reference身份原生一致性回归；不启用审批能力、不修改live授权。浏览器使用真实Approver读取并验证ops.operate写拒绝。

验证范围：UI603策略/运行时单元与真实Rust reference消费者、现有C16消费者、P18订阅、共享导航、Rust operations模块、静态路由、功能门禁、terminal类型/lint/一次候选构建、Chromium基本成功/拒绝/恢复及四种dark/light×1440/390截图/axe。精确命令、退出码、测试数量、源码SHA和产物摘要以[证据](./evidence/ui603-local-20261024/README.md)内receipt/result与原日志为准。源候选提交后执行完整该有界矩阵，封包提交不重绑源码。没有递归全链、全仓数据库campaign或目标测试。

保留失败：初始unit 6个fixture字段错误（StreamEvent和MFA响应）、真实consumer的Viewer权限假设失败、浏览器5/6（reference冷启动授权漂移）、rustfmt增量格式检查；终端初始类型错误（HeaderProps/导航字段、联合返回类型/可空journal、负向fixture类型）与lint（control regex/未使用proxy helper）已修正。preflight为未冻结工作树，未捕获的原始类型/lint终端输出不伪称有版本绑定日志。preflight日志/失败截图保持原样；成功验收只认后续冻结attempt。

工程Gate目标PASS_UI603_ALERTS_INBOX_FUNCTION，开发状态IMPLEMENTED_PENDING_ACCEPTANCE。正式stage_gate保持NOT_ASSESSED；formalAccepted=false、runtimeAdmission=DENIED；不自行批准ACCEPTED。预期INTEGRATION命令拒绝，下一FE:UI-P23 DEVELOPMENT允许。

G4/FEP-4保持NOT_READY_GAPS_OPEN，G4 IN_REVIEW、FEP-4 PARTIAL；历史证据ORIGINAL_SCOPE_ONLY逐字节保留。UI402-MARKER-SOURCE-01真实C09→C12同源正向NOT_RUN、P19-C10-EXPORT-01蜡烛导出NOT_IMPLEMENTED、C12→C14估值join NOT_CLAIMED；本任务无权关闭这些缺口。

真实IdP/cookie/CORS与目标DB/RLS/事务、外部告警源、远程同SHA CI、Firefox/WebKit、完整I8、性能容量/长稳、读屏/原生200%缩放和RELEASE均NOT_RUN。C01 cookie桥接/TLS CORS代理替代、受控X06/F09输入与故障注入边界必须保留；有限EOF不冒充持续实时连接。C02旧告警objectRef契约未改写，UI-601处置页面及UI-P23后续深化未替代交付。
