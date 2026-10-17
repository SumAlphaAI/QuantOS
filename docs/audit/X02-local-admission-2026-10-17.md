# X02：Pre/Post-trade Risk与kill switch本地验收报告

2026-10-17；分支codex/x02-risk。任务基线`9ce98f60f9fffbeee09afe60e9fb16136120c966`；实现提交`c6b41301ebb4efa3df2e41718db1230260b76f0a`；最终完整复验冻结候选`5717f7a2b002ec65f9ebc0429364d565e86d1ec1`。**X02_LOCAL / DEVELOPMENT READY，engineeringStatus=PASS，formalAccepted=false**。41节点135组本轮全部PASS，40依赖节点/131组先于自身4组。两份计划同步；开发IMPLEMENTED_PENDING_ACCEPTANCE，正式用户确认PENDING。后续证据提交不被宣称为已重新执行的源码候选。

## 需求与本地实现

| 任务要求 | 当前实现/实际证据 | 结论 |
| --- | --- | --- |
| Pre/Post规则 | 15规则全评估，deny优先；身份/数字/精度/kill/发布/数据/财务/venue/重复/名义/杠杆/集中度/日损/审批；主fixture Allow50、Deny60、ApprovalRequired50，另含50份有效审批重试 | 本地PASS |
| X01/S03/F06消费 | 实际X01合成投影快照和S03发布/审批/时限/universe；F06 AuthContext角色/capability/租户/工作区/账户/mode检查；日损/权益/UTC日/报价单位/来源时点显式输入 | 本地PASS；部署来源授权NOT_RUN |
| 拒绝规则/限额/签名 | GuardDecision含全规则结果、limit IDs、完整policy、请求/快照/facts hash、身份/phase/kill revision/时限，HMAC-SHA256覆盖完整payload；approval/kill域隔离 | 本地PASS；部署密钥托管/轮换NOT_RUN |
| global/account kill API | RiskGuard typed API，clone共享mutex；Owner/Operator engage、Owner disengage、修订CAS/原因/单调时钟；旧Allow在任何revision变更后拒绝 | 本地PASS；持久/分布式NOT_RUN |
| 并发与拒绝边界 | 同key50并发仅一次Allow，20同revision CAS仅一次成功，engage完成后50clone请求拒绝；跨账户/authority、篡改/自批/错配/过期/陈旧/异常小数/极端时间拒绝 | 本地PASS |
| 规则分支≥95% | installed nightly cargo-llvm-cov --branch真实instrumentation，rules.rs 16/16，100.00%；另验15规则双outcome30/30 | 本地规则分支PASS |
| kill拒绝P95<1s | 原指标和代表性目标/并发规模保留Beta；当前线程正确性不视为代表性P95 | NOT_RUN |

完整API和信任边界见[操作说明](../operations/x02-local-admission.md)、[ADR](../adr/20261017-x02-risk-guard.md)。Legacy RiskEngine/RiskDecision保留给兼容fixture，原公开checksum不是权威签名；新Gate只接受RiskGuard。旧portfolio适配器改为必须显式提供当日日损值，不再把生命周期P&L当今日P&L。S03新增精确authorization_expires_at读方法，使风险决策不越过真实审批/证据时限。

名义由严格小数quantity×price计算，拒绝客户端标量替代；投影采用gross+abs(order)保守上界，降低敞口的卖单也不乐观净额化。Post使用实际当前持仓和显式日账本，审查结果不撤销fill。策略必须有效、批准、目标/mode与universe匹配。ApprovalToken绑定完整intent（含key/release/target）、请求人与不同审批人，不能覆盖硬拒绝；只有成功Allow占用pre key，approval-required可绑定审批重试，post key另列。validate_allow是当前风险验证，X03仍须将其和issuer/审批消费原子组合；分离的先验再submit不获本Gate准入。

## 新候选完整依赖与历史恢复

[执行135组结果](./evidence/provider-a1-remediation-20261004/x02-local-20261017/attempt-02/execution-results.json)、[依赖顺序](./evidence/provider-a1-remediation-20261004/x02-local-20261017/attempt-02/dependency-revalidation.json)、[41节点回执](./evidence/provider-a1-remediation-20261004/x02-local-20261017/attempt-02/local-prerequisites.json)、[发布manifest](./evidence/x02-local-20261017/manifest.json)。F05/R01、X01、S03、F06和S2的完整闭包从本轮实际执行派生，未拼接任何历史READY；相同检查只在本轮按相同ID去重。精确命令、先后/退出/时间/信号/超时、raw Artifact/supporting字节hash、完整功能输入和source SHA均核验。X01的旧独立READY因共享输入变化撤回，历史manifest/report保留；只授予X02 consumer-local准入，上游运行时仍DENIED。

[canonical恢复记录](./evidence/provider-a1-remediation-20261004/x02-local-20261017/attempt-02/canonical-preservation.json)恢复637原文件、15目录字节和原有存在性；生成delta保留在本attempt，发布manifest及两份计划有回滚保护。本轮临时caffeinate -is保护随进程结束，不改持久电源设置；[断言原始记录](./evidence/x02-local-20261017/awake-assertions.log)保留。

## 测试、覆盖和失败保留

三次独立构建、make lint/test通过；本轮Rust 433 passed/13 ignored，Python 1856 passed，Web 233 passed/3 skipped。ignored/skip未作为目标通过。X02新集成/API9 passed；risk/execution/evidence兼容47 passed/2性能ignored；自身门禁/覆盖反例109 passed。

[LLVM回执](./evidence/provider-a1-remediation-20261004/x02-local-20261017/attempt-02/supporting/x02-coverage/receipt.json)来自本轮精确执行，raw coverage.raw.json和coverage.log同目录，均与SHA绑定并校验。百分比的分母为rules.rs实际可执行规则分支，不是enum覆盖、函数覆盖或整个crate覆盖；guard身份/解析/密码/时间/权限另有反例测试，未宣称整个运行时分支≥95%。

[预检摘要](./evidence/x02-local-20261017/preflight/summary.json)保留首轮私有report字段编译失败（改公开report()）及计划镜像stage contract漏注册失败；随后修正，attempt02十项通过；人工复核补入Release universe、极端时钟及跨authority验证边界后attempt03十项重新通过。compile/alltargets、own/shared、实际覆盖、两份计划及core/frontend移交、clippy -D warnings、rustfmt和source/docs diff均通过；预检明确是未提交工作区，不作为最终冻结准入回执。最终135组及回执发布在5717f7a2新候选全部执行成功。

[完整变更索引](./evidence/x02-local-20261017/changed-files.json)、[摘要](./evidence/x02-local-20261017/summary.json)、[收尾检查](./evidence/x02-local-20261017/post/checks.json)列明源码、测试、文档、策略、raw证据及Gate校验。冻结后仅补audit产物与计划生命周期/当前复核叙述，不改变功能输入。

首轮冻结c6b41301的完整135组为133PASS/2FAIL：F02全历史扫描误报Codex新增的公开工具状态enum，S2聚合正确拒绝该失败依赖。原始[失败记录](./evidence/provider-a1-remediation-20261004/x02-local-20261017/attempt-01/failure.json)、全执行和恢复证据保留，未把失败改写为通过。[误报复核](./evidence/x02-local-20261017/scan-status-review/review.json)核对原提交/文件/行及公开值hash；只登记一个历史指纹，不豁免目录或规则，结构化状态避免再触发。精确修正的全历史扫描通过，自有无功能本地检测反例仍被拒绝。新冻结5717f7a2全部41/135重新执行，本轮未复用首轮任何通过组。

## Gate、未决风险与下一任务

仅X02_LOCAL / DEVELOPMENT READY；正式ACCEPTED、RELEASE、生产或交易权限未放行。[六维ProjectUser确认文稿](./evidence/x02-local-20261017/confirmation-draft.md)PENDING；按项目一人确认规程保存真实用户答复后再独立执行门禁，无虚构签署。

全部24组目标检查及3类X02移交NOT_RUN：真实F06身份/撤权与财务UTC日/权益/quote/venue/时钟来源、密钥托管/轮换、durable kill/dedupe/审批消费及跨进程恢复、部署BFF/Runtime/X03原子issuer、代表性P95<1s/安全/负载/长稳、同SHA hosted CI；继承X01/S03/F06/S2的实际Supabase/RLS/事务、供应链最新CVE/可达性、用途许可及正式批准仍须实际验收。离线快照不刷新远程漏洞/法律结论。

当前状态仅process-local，独立构造的authority/重启不共享kill和去重；Global指配置authority的全部账户，不表示跨进程/跨租户部署全局开关。生产需fail-closed持久启动、authority拓扑与容量/留存、业务来源和原子签发证据。f64、单报价单位及保守gross投影仍是限制；生命周期P&L不代表当日损失/现金/权益。未使用生产凭据、未连接目标或建立本地PostgreSQL/Supabase、未Git push或外部发布。

下一可执行：**CORE:X03：TradeCommand签发与审批状态机**。在新冻结候选完整复验R04、X02、S2及其依赖，再整合当前风险/修订与真实审批的原子消费、命令幂等签发和恢复；既有partial X03缓存修复不能视为本次完整验收，也不能跳过新依赖闭包。

收尾实测：X02 --ready exit0；--release exit2，原因release target evidence NOT_RUN，符合拒绝预期；两份计划及core/frontend移交、source/docs diff-check和gitleaks8.28.0脱敏暂存扫描均PASS。全量raw diff-check exit2，共152条格式诊断，全部限定audit证据目录，保留原始字节，不声称全量格式PASS。进程结束后已只读确认本任务caffeinate断言释放，未更改持久电源设置。
