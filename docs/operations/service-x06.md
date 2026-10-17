# SERVICE:X06 功能运行与验收规程

`make service-x06-check` 执行23项当前业务测试及3项编译拒绝契约。`make service-x06-assess-local` 仅在源码/工具/规范输入提交后运行20组影响范围检查，在全新 function-attempt-NN 目录保存命令、原始日志、时间/退出码/信号/超时、LLVM原始数据和输入摘要。记录器只继承最小工具环境，离线运行，不读取生产凭据或 DATABASE_URL。失败/中断原样保存，禁止拼接旧READY。

`make service-x06-local-check` 校验不可变源码、当前相关输入、精确检查集合/行为名/日志摘要、覆盖率及分阶段状态，并校验计划登记的manifest摘要。当前功能仅 DEVELOPMENT READY；八个直接依赖记录 NOT_REVALIDATED/referenceOnly。不会执行上游任务门禁。业务联调和发布分别NOT_RUN。`make service-x06-release-check`、`node scripts/service-x06-target-check.mjs` 必须exit2，不能凭本地回执准入真实目标。

宿主接入顺序：从当前授权会话解析精确租户/工作区/账户/模式及能力，再由已验证MFA提供方构造短时step-up；不要接受请求体内的AuthContext、用户时间或“已MFA”布尔值。给固定scope装配同issuer/guard/gateway，只使用Paper/Shadow模式；运行时能力授予须实际授权，工具不会修改用户或数据库grant。服务新增audit.read/ops.read/ops.operate/ops.approve/ops.observe为细分capability，不自动授予任何现有角色。

提交只接受X03真实签名命令，并用当前权威风险源调用prepare→dispatch。返回Uncertain或恢复隔离时，冻结新尝试；使用当前原操作者通过recover_order认证收集迟到事件并读实际X04事实，证明后更新仓位；取消未知须有真实终态事实，不能仅凭仍在挂单的状态解除隔离。禁止通过换key、换gateway、手改checkpoint或人工余额修正消除未知状态；无充分事实则保留incident并交目标恢复流程。取消仍校验当前持有人，但允许命令到期或kill后减少风险。checkpoint是受限敏感对象，只能由Owner取得并在同租约空实例恢复；本轮没有文件存储/公共导出/跨进程恢复入口。

所有查询按scope/capability检查。订单/成交/审批安全证据中保留事实引用、Fill链接和输入摘要，不保留签名和自由kernel原因；历史视图必须检查portfolio_source_current。审计分页使用expected head避免混读。Runbook仅InspectEvidence和InspectHealth，禁止任意命令/文件/网络或数据库写操作。

观察输入必须由固定Service actor从F09受信管线生成，包含execution/portfolio/risk/reconciliation全部组件与规则名allowlist。修复不能由操作者填自由文本宣布成功；incident先ack，实际故障清除且有更新健康观察，再由不同actor/user的Approver关闭。kill恢复也需独立审批、更新健康与kill revision CAS，Owner执行一次。告警复发重开，未知执行告警不能被绿色外部报告清除。

源代码/能力或业务范围变化后，只重跑当前功能与影响回归；旧TP12等回执保留为历史，撤回其因共享输入变化而失效的当前独立READY。CORE-GATE:X3-SERVICE是下一检查点，其业务聚合范围单独评估，不在此自动执行。

正式人工确认仍按 [用户确认规程](../gate-records/user-acceptance-confirmation-workflow.md)，本轮先生成ProjectUser待确认文稿，未经真实答复不记ACCEPTED。单人项目验收不替代交易审批职责分离。

目标移交：真实Supabase会话/MFA/能力/RLS、F05持久ledger/outbox/审计与交易原子性、可信checkpoint保管与跨进程/跨实例恢复、真实F09/X05观察、P08–P14/P20–P23及BFF全链路、隔离/敏感留存、安全/性能/长稳/部署及同SHA CI均NOT_RUN。禁止生产凭据与外部发布；Shadow不允许submit，Paper仅自有内核，无venue接入。
