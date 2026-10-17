# X05 Shadow 与对账的功能开发准入

遵守[最新AGENTS.md](../../AGENTS.md)与[分阶段测试规程](phased-testing.md)。仅运行`scripts/x05-test-scope.mjs`中的15组当前功能/直接影响检查：Shadow建议及虚拟账本/20类差异/异常队列、只读X03/X04/X01输入适配与财务黄金样例、真实本机只读worker、legacy兼容、无submit源码边界与编译拒绝、必要compile/Clippy/fmt/五个新文件覆盖率、专用Gate反例及计划/交接规则。没有上游运行时代码修改，不重跑X04的10万事件或X03/TP07全套，更不递归依赖、全仓或三轮构建。编译依赖源码哈希不等于复验其Gate。

`make x05-check`运行主要用例与禁止submit接口验证；`make x05-assess-local`以新`docs/audit/evidence/x05-local-20261017/function-attempt-NN`保存固定源码、精确输入、命令/原因/时刻/退出码/信号/错误/超时和原始日志。默认01，重试必须换新路径。所有必需检查正常退出、源码/输入未漂移、覆盖率行≥90%/region≥85%后，事务写入X05 manifest及两份计划。`make x05-local-check`核对本轮证据；`make x05-release-check`在真实目标和正式确认不足时拒绝。功能DEVELOPMENT、完整业务联调和发布独立记账；依赖行仅NOT_REVALIDATED/referenceOnly。

可信后端采用`shadow::ShadowRunner::new(scope, seed, dedicated_shadow_risk_guard)`，使用F06已核验的当前AuthContext，要求Shadow模式、execution.operate、Owner/Operator/Service与tenant/workspace/account范围；非Owner必须明确绑定账户。`recommend`接收当前X01/账户财务/venue/S03发布来源与有来源时间/序号的行情，调用X02当前风险；返回`executable=false`的对照建议，不生成TradeCommand。超过阈值需审批或风险拒绝只生成不可模拟成交的建议。`simulate_fill`仅允许当前有效Allow并再次在风险锁内校验；虚拟成交采用当时建议行情价格、limit条件与Decimal数量/费用，幂等重放、超量/新旧行情冲突/陈旧来源/kill拒绝都不产生重复账务。`mark`只更新虚拟估值。

`Seed::flat`声明平仓起始基线；已有持仓应使用`Seed::from_portfolio(scope, validated_X01_snapshot, opening_cash)`。现金必须来自可信账户账本，不能用权益充当现金。每个对账窗口使用同一明确seed，不隐式处理入出金、公司行动、FX或衍生品保证金。账本包括多空反转、已实现/未实现PnL、费用、现金及按mark估值的gross exposure，18位小数按银行家舍入；与X01浮点投影的比较使用显式≤1e-6容差，默认1e-8。

`reconciliation::from_x04_portfolio`只读取可信后端提供的完整X04事实/独立anchor和已验证X01快照，拒绝跨账户、缺失行情来源、错误币种、断链、非法转换与投影篡改；不调用任何submit/cancel。X04事实不编码tenant，因此scope、anchor来源、行情许可与现金来源须由可信服务核验。本轮没有新增BFF/HTTP、真实行情连接或上游Nautilus运行时。

`exceptions::ReconciliationService::run(auth, key, input, now)`比较订单、成交、仓位、虚拟账本并执行独立内部一致性检查，防止两路同样错误仍判绿。20类差异保留实体位置、expected/actual、两路来源、输入hash、可观测时间、检测时间与SLA是否超时；晚于15分钟会如实标为breach。计时从可信输入`available_at`开始，不冒充外部真实差异发生时间。来源revision必须单调，同revision不得绑定不同内容，同日不得切换来源对。

异常具有稳定的scope/day/kind/entity ID和CAS revision；新run重复观察会更新同一异常并使旧ack/closure失效；同key同输入重放不重复告警。同key不同输入拒绝。先ack，再引用同日同来源、最新、足够新鲜且来源版本已推进、覆盖原实体且该差异已消失的复验报告，非空resolution才可关闭。日结须最新报告零差异且所有该日异常已关闭；差异复发自动reopen并撤销日结。关闭异常只改审计状态，不改订单、仓位或账本。

`journal(auth)`导出追加动作和独立`JournalAnchor`；`restore(scope, bytes, trusted_anchor)`检查hash/序号/范围/大小，并重算所有报告、CAS和关闭约束以恢复去重及异常状态。必须在可信存储独立保存anchor；hash不证明操作者身份或持久原子性。内存服务最多10000动作/8MiB journal，达到容量在动作提交前拒绝；应归档再开新服务窗口，禁止静默丢弃。Shadow虚拟状态仍是进程内，跨进程持久幂等/自动运行调度是发布前义务。

本机worker构建为`cargo build --locked --offline -p quantos-reconcile --bin quantos-reconcile`，仅以`--x05-offline-reconcile`启动；读取≤1MiB严格JSON行并输出对账报告。协议`quantos-x05-offline/v1`接收`input`/`checked_at`，来源标记CALLER_PROVIDED；只处理传入数据，不加载环境凭据/文件或访问DB/网络/内核，拒绝未知字段、提交请求和坏帧。它不提供账户权限证明，不能用其输出绕过可信异常服务；本机进程不是OS沙箱或部署验收。

继承27组及X05新增1组目标（28组）保持NOT_RUN：获准真实行情/身份/时钟、10个实际交易日、日终0未解释差异、真实20类≤15分钟、无venue submit、持久Supabase/RLS/事务/CAS/审计/anchor及跨实例恢复、完整Paper/Shadow业务联调、法律/OS隔离/安全/性能/长稳和同SHA hosted CI。受控工作日不计真实持续窗口。正式验收仍按[一人确认规程](../gate-records/user-acceptance-confirmation-workflow.md)等待ProjectUser真实答复；任务执行请求不是批准稿件。
