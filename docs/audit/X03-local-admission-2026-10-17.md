# X03：TradeCommand签发与审批状态机

2026-10-17。基线`10b2e77ce1e64e006efdb7c1397427fdee91c280`，功能实现`e0b5a60460dba804ce1a68e8dd297c2fd03c2f75`，诊断修复`051f6af1f8adcda1065a97ed947a80632bb38a9f`，本轮功能证据源码`c720e7195b4b8da6dbcca152d84bc09658e3573f`及108个精确输入。**X03_LOCAL v2 / DEVELOPMENT READY（仅功能），engineeringStatus=PASS，formalAccepted=false**。两份计划同步IMPLEMENTED_PENDING_ACCEPTANCE。完整业务联调、发布及25组目标NOT_RUN；项目用户确认PENDING。

## 功能与验证

| 要求 | 本地实现与结果 |
| --- | --- |
| Proposal/风险权威 | 真正R04 schema/canonical artifact与tenant/workspace/account/originator/数量/币对/release/时效绑定；验证X02 stored Pre Allow并重算当前X01/S03/财务/venue/审批风险 |
| 原子风险校验、消费与签发 | 固定issuer→risk锁顺序，与kill CAS共用risk mutex；校验、HMAC签名、审批消费、幂等缓存和审计在临界区提交，失败回滚不占consumer |
| 审批状态机 | Pending→Approved/Rejected/Cancelled，Approved→Cancelled，签发→Consumed；revision CAS、有效期、scope/mode/capability、请求人和原发起人自批拒绝 |
| 幂等和拒绝 | 完整requester/proposal/decision/approval/venue绑定，冲突拒绝；过期、重复审批、自批、陈旧、kill、策略失效和缺审批拒绝；缓存仍复核当前安全状态，不延长命令TTL |
| 并发唯一签发 | 1000逻辑任务同时释放，16个原生Tokio worker；一个command ID、一次审批消费、999次原样重放与审计；不是1000独占OS线程或P95验收 |
| 签名/审计 | 完整command ID/payload域隔离HMAC-SHA256，带前hash/序号/HMAC的完整审计链；篡改、跨issuer消费、kill竞争和失败回滚测试通过 |

`authority::AtomicCommandIssuer`/`SignedCommand`是独立权威路径；legacy root checksum接口仅作兼容fixture，无转换授权或新增HTTP/venue提交路由。`verify_command`只验证当前本地成员/身份/签名/时效/kill，不执行下游提交，TP07负责下游单次消费和当前来源/策略撤销。见[ADR](../adr/20261017-x03-atomic-command-issuer.md)、[操作规程](../operations/x03-local-admission.md)。

## 最新测试原则与实际执行

依据用户更新的[AGENTS.md](../../AGENTS.md)与[分阶段规程](../operations/phased-testing.md)，停止无关上游全闭包，不再要求每次功能/文档/测试工具变更都重验42节点138组、全仓或三轮构建。机器策略、实际记录器、计划解析器及两份计划已同步；旧聚合执行器缺少显式INTEGRATION/RELEASE业务范围和理由时，在调度前拒绝。后续开发同样使用当前功能和影响范围。

本轮[12组执行结果](./evidence/x03-local-20261017/function-attempt-01/execution-results.json)、[精确输入](./evidence/x03-local-20261017/function-attempt-01/inputs.json)、[manifest](./evidence/x03-local-20261017/manifest.json)逐项记录命令、影响理由、时间、预算、正常退出/信号/错误/超时与日志摘要。8项X03行为、47项兼容（2性能ignored）、9项X02 API回归；56项门禁反例、98项共享计划/回执检查通过；必要编译、Clippy无warning、fmt、计划与移交检查通过。ignored不是目标通过。门禁覆盖缺项/跳过、命令/日志/输入替换、零exit掩盖信号或执行错误、覆盖率不足、阶段越权和事务发布回滚。

实际LLVM覆盖：authority.rs行585/605=96.69%、region793/865=91.68%；guard.rs行541/550=98.36%、region720/754=95.49%，达到开发≥90%行/≥85%region阈值。见[覆盖率原始数据与回执](./evidence/x03-local-20261017/function-attempt-01/coverage/receipt.json)。这是这两个文件的指标，不宣称全仓覆盖或目标性能通过。

本轮Gate只授予功能开发，依赖仍按原任务图列为NOT_REVALIDATED/referenceOnly，不把历史READY改绑当前源码，不授予上游独立READY。完整业务联调和发布另记NOT_RUN；未完成项不阻塞无关功能。后续文档/证据提交与该源码的功能输入核验分开，不能宣称新HEAD被重新执行。[变更索引](./evidence/x03-local-20261017/changed-files.json)列全任务文件，[摘要](./evidence/x03-local-20261017/summary.json)提供机器结果。

## 失败、中断和历史保全

首轮`e0b5a604`完整138组为136PASS/2FAIL，未授予准入；TP01-C manager的v1回执exit=null，缺error/signal字段，因此历史终止原因UNKNOWN，仅按180008ms时钟差推断子预算超时，不补造观察到的ETIMEDOUT。原失败、日志和[诊断](./evidence/x03-local-20261017/inner-termination-review/diagnosis.json)保留。v2补全退出诊断并给予完整manager测试600秒有界预算，其余180秒、外层900秒不变；62项相关反例及实际manager完整预检通过是原范围参考，不改绑成本轮依赖READY。产品P95目标未放宽。

第二轮`051f6af1`按用户最新指令停止：[中断记录](./evidence/provider-a1-remediation-20261004/x03-local-20261017/attempt-02/user-interruption.json)保留4个完成PASS组，当前make test记INTERRUPTED，134组未完整执行，不能视为PASS。终止时spawnSync内存中的当前输出未回收，记录该限制，不制造日志或退出原因。停止所有拥有的子进程后，[恢复记录](./evidence/provider-a1-remediation-20261004/x03-local-20261017/attempt-02/canonical-restoration-on-user-stop.json)校验15目录/637文件字节及存在性一致。旧全闭包失败和中断没有被新功能Gate覆盖为成功。

未提交预检中缺本地规程链接及unit覆盖率路径适配失败日志保留，修复后56项全部通过；早期沙箱port/UDS/cache失败与历史预检继续保留。没有因此再启动全闭包。

## 未决风险、Gate和下一任务

仅进程内线性化；独立guard、重启或副本不共享状态。真实R04/F06/source/时钟信任及会话撤权、密钥托管/轮换、Supabase/RLS持久分布式审批/幂等/审计/kill/崩溃恢复、容量/留存和启动拒绝边界待验。继承f64/单报价单位/保守gross限制。TP07下游单次提交、当前策略撤销及完整业务链联调未验。原签发P95<200ms、安全/负载/长稳、同SHA hosted CI及来源许可/最新漏洞审查均NOT_RUN。

[六维项目用户确认文稿](./evidence/x03-local-20261017/confirmation-draft.md)为PENDING；按[一人确认规程](../gate-records/user-acceptance-confirmation-workflow.md)保存真实原始答复后独立验门禁，不自行正式批准。完整联调/RELEASE/生产未放行。

仅修改QuantOS；未使用生产凭据、未连接目标数据库、未建立本地PostgreSQL/Supabase、未推送或外部发布。下一可执行任务是**CORE:TP07 NautilusTrader研究/仿真/OMS/执行内核**：按最新原则完成adapter/Paper内核、X03下游幂等消费和直接风险/撤销回归；完整业务链/全仓放联调，冻结发布矩阵和真实目标另验。TP12仍在TP07和S2之后，不将S2参考评估当完整内核运行时准入。
