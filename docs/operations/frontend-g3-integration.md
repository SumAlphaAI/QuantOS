# FRONTEND-GATE:G3 与 CORE:S04 当前联调

本任务按前端计划G3、FEP-3和核心计划S04执行I3完整本地业务链；不递归重新授予上游READY，也不连接Supabase/真实身份/生产服务。阶段准入、工程执行和用户确认分别记账。

实际Strategy Lab Python UDS进程生成20份自有合成StrategyDraftArtifact。仅cfg(test)编译的Rust宿主从文件导入这20份真实进程输出，构造S01 Snapshot/Artifact catalog与20个StrategyInput/独立策略。浏览器逐一打开C04研究Artifact元数据，再经P06/Lab、C05静态检查/真实S02回测、报告Artifact/不可变Release、C08独立审批控制、P07后端目标选择，最后通过真实correlationId进入C10 Audit Explorer。输入/报告/Release/审批/审计在同一宿主进程组合，逐项保存ID/hash/source/evidenceRefs。真实R03 Research worker到策略目录的生产注册链未配置，仍NOT_RUN；可信宿主导入是明确替代，不能冒充用户在Research工作区提交任务的完整旅程。

20个fixture是20次实际IPC生成、20个独立注册策略及20条浏览器业务链；使用相同受信momentum模板及自有行情，不能外推不同市场/模型/算法覆盖。Artifact/Snapshot仅进程内catalog；身份cookie与TLS/CORS桥、业务审批actor/MFA为reference替代。没有真实IdP/数据库验收。

补充实际后端拒绝、审批驳回、受控时钟过期、20路竞争（一次成功，其余明确拒绝）、只读/离线恢复；保留原UI301/302/303/P07共20个直接浏览器回归及18张既有基线，不更新基线。UI不提供审批决策入口，决定由独立Node控制会话完成。

CORE:S04完整复审同时执行真实StrategyService TCP测试：Python UDS产生102 Artifact、S01/S02/S03/S04成功与拒绝、100次未验证/未审批拒绝、100来源伪造、20路CAS、hash/时效/跨租户/工作区/会话/只读限制、两种真实原生adapter重放消费与审计链。配置票据仅本地计算，不是外部部署或交易。当前还执行全Rust workspace、Python engines与Web workspace测试，原因是本次明确为业务链INTEGRATION及完整核心复审；不运行F05/F07手工DB/覆盖率campaign。所有进程环境白名单剥离数据库/生产凭据，跨进程恢复和目标事务依旧NOT_RUN。

`node scripts/frontend-g3-review.mjs --run docs/audit/evidence/frontend-g3-local-20261023/attempt-NN`只接受冻结源码。原始命令/退出/失败/信号/全部输出及摘要保存，`--verify`复核。工程成功不改写历史页receipt、incomplete或NOT_RUN。若全仓出现失败，记录真实失败与影响，不拼接旧PASS或以缩小命令范围冒充全仓通过。G3/CORE:S04正式INTEGRATION READY须另有完整阶段证据、依赖准入和项目用户对本轮新稿的确认。

实际IPC产物揭示并修复两项当前C05缺陷：serde JSON Number可输出科学计数法，而DecimalString只接受普通十进制；现对有限浮点用最短往返Display展开、整数保留精度。Python24.0经JS回传24会误报参数冲突；现在仅对相等安全整数的JSON表示等价，保存时还原可信输入原表示、Release响应取核验过的报告参数。字符串金额、键、数组顺序、非安全整数均不放宽。保持原参数/报告/Release hash算法，不把声明为字符串的金额转数值。

全仓首轮6ff11941：Rust harness730通过/14 ignored、Python1908通过；Web通用schema样例错误使用普通URI替代受限ExportDownloadMetadata URL，工具修复后重跑Web。`--continue`只对原Rust/Python命令保留原SHA/原日志，并逐个核对相关输入未变，显式REFERENCE_NOT_CURRENT_SHA_REEXECUTION；不复制旧日志冒充新执行、不授予新候选全仓READY。Web/浏览器与S04核心组合在新候选执行。

3d8f9775自动44浏览器/18基线通过后，人工查看真实C10长路由事件截图发现固定15px行导致文字重叠，保留原36条incomplete及原receipt在history。改时间线行高为内容自适应，并对真实长事件/对象引用断言上下边界不重叠。仅Web呈现/测试变化；Rust/Python仍只引用输入未变的6ff原结果，新Web/构建/浏览器完整复验。

原9a463495/05c427f2限定文稿已确认，原包保持不可变。G3-INTEGRATION-01后续本地worker与因果交接另见 [独立范围](g3-integration-01.md)；新事实不回填本页所述历史NOT_RUN，不授予完整G3 READY。
