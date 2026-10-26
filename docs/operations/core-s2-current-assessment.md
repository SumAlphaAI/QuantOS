# CORE-GATE:S2 当前策略业务闭环评估

2026-10-26，依据主计划第9节S2与AGENTS.md，评估自有本机策略链、修复当前边界缺陷并记录缺口。不调度历史S2-SERVICE的39节点/127组闭包、三轮构建、全仓或F05/F07 campaign，不重授依赖READY。当前入口：

```sh
node scripts/core-s2-review.mjs --run docs/audit/evidence/core-s2-local-20261026/attempt-N
node scripts/core-s2-review.mjs --verify
node --test scripts/core-s2-review.test.mjs
```

## 当前修复

HTTP层原已拒绝自批，但底层InMemoryStrategyReleaseStore/ReleaseService和共享approve_bound未检查创建者身份。现在在共同领域入口拒绝SelfApprovalForbidden，is_approved同时拒绝创建者等于批准者的值；内存与PG适配共用此检查，HTTP映射403。仅持有approve capability不能自批。原依赖自批的单元/手工PG fixture改用独立actor，不放宽业务约束。旧自批记录维持fail-closed，不自动修复、删除或重新授权；实际目标数据清查与迁移NOT_RUN。

配置消费原先仅复核Release有效期，时钟回退到票据签发前仍可能消费已保留票据。现在ReleaseService、StrategyService HTTP消费拒绝未来票据；去重也不能返回未来票据。PG去重仅在existing.requested_at≤当前请求时返回既有事实，否则拒绝。新测试覆盖签发前1纳秒、精确签发边界、稳定去重/单份事实、受控HTTP时钟回退及审计。PG仅编译，包括手工opt-in测试代码；没有连接数据库或执行SQL，实际PG行为保持NOT_RUN。

## 真实本机组合

cfg(test)宿主沿用实际R03/RD-Agent→StrategyLab Python UDS→owner验证原子安装→C04/C05/C08/C10→Web链，并只在显式QUANTOS_S2_CHAIN=1时增加独立Node loopback控制端口。普通BFF/浏览器API没有配置消费新端点。端口从受信身份调用同一Web Release所属的StrategyService，批准前拒绝，批准后分别为Paper/Shadow生成本地配置票据并实例化原生GeneratedStrategyAdapter；校验原Release hash、报告hash和完整固定参数，重复返回同一票据。

20条独立策略/Release（同一受信momentum模板与合成行情）各消费两种目标；补充未批准、assisted_live、拒绝、过期、request_info、并发审批、只读/离线和响应未知恢复。票据仅本地配置事实，不启动部署进程、外部kernel、venue或订单。core服务Audit原件随消费记录保存；它和Web C10因果索引分别验证，尚未贯通成生产持久审计，不宣称跨索引签署或全局完整性。

## 必要验证与来源治理

- Strategy域完整单元验证静态look-ahead/数据泄漏、不可变证据、源/快照/参数伪造、自批、目标和原生消费者；SERVICE:S04 TCP/UDS覆盖100未验证/未审批拒绝、100来源伪造、20路CAS、102生成产物和新增时钟回退。
- Release审批谓词被Risk/Execution消费，故定向回归quantos-risk及x02_guard、x03_authority、tp07_dispatch和tp12_boundary；只运行自有Paper/protocol，未经采用的上游不会安装/执行。这是直接影响回归，不递归验收其依赖或重授运行权限。
- C05/C08、实际R03注册拒绝/恢复、相关Web消费者、26条S2与5条直接Release浏览器回归、Node门禁/评估负向、计划和格式/lint。PG手工测试只no-run编译。
- TP06–TP12七项ADR/决策摘要绑定当前字节。TP06为QuantOS原生StrategyLab，不导入外部vibetrading；TP07、TP12只复核锁定评价/无耦合规则，runtime入口明确拒绝；TP08–TP11执行既有离线workspace排除检查。保留固定来源与历史漏洞/许可证材料，不访问远程、不重做最新CVE或法律许可判断，不将reference_only提升为adoption或READY。

Web产品与依赖输入未变，复用S04源码1f3c8725bbd3f512938add4dab52363c380825d8的导出，核对原buildId及182文件hash，不记新Web构建。新Rust和测试宿主按当前冻结候选编译，源输入含执行器、相关ADR、锁定评价资料、完整领域及消费源码。环境白名单、离线工具、loopback/UDS；不传入生产/数据库配置。每个attempt保存原始命令、时间/退出/信号、日志/hash、二进制、记录/截图，失败不覆盖或拼接。

## Gate与后续

当前工程评估完成结论为PASS_OWNED_LOCAL_S2_STRATEGY_LOOP。完整S2仍PARTIAL_WITH_EXPLICIT_PORT_SUBSTITUTIONS / NOT_READY_GAPS_OPEN，阶段INTEGRATION/NOT_ASSESSED；三个完整清单不勾选，正式checkpoint review_status=NOT_STARTED、source_commit=null不变。formalAccepted=false、runtimeAdmission=DENIED，历史R1/S04/G3与S2-SERVICE不改绑。

未决：真实身份/Cookie/CORS/MFA、生产HTTP→持久队列与增量策略注册、持久Artifact/Storage/Audit及跨进程恢复、Web C10与native配置消费审计贯通、全部业务链/浏览器和人工可访问性。实际Supabase/RLS/SQL与目标事务、旧自批记录治理、外部来源/用途许可、目标部署/安全/性能/长稳、同SHA远程CI及发布仍NOT_RUN。后续按原任务范围补足，不以工具/文档通过替代联调或发布许可。

下一可执行原任务：CORE:X06 执行/审计/运维Terminal页面（DEVELOPMENT）。
