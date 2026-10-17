# X01：Portfolio读模型与风险输入快照本地验收报告

2026-10-17；分支codex/x01-portfolio。任务基线`1ff2ee1131f8af8b6a327fadf12260af70a40fe2`；实现提交`3c74238449f6a1b7b16a0250907bbebcdd1480a8`；最终冻结候选`e2b85a80654ba91992a8fb4e2fd9f127ba449740`。**仅X01_LOCAL / DEVELOPMENT READY，engineeringStatus=PASS，formalAccepted=false**。完整40节点131组本轮全部PASS，127依赖先于自身4组；不拼接历史READY。开发状态IMPLEMENTED_PENDING_ACCEPTANCE；用户正式确认PENDING。

## 需求、实现与证据

| 任务要求 | 当前实现及证据 | 结论 |
| --- | --- | --- |
| Position/valuation/P&L/exposure/账户状态与时间 | quantos-portfolio保存完整账户快照、逐symbol mark来源时间；long/short、部分平仓/反转与手续费；手算short反转PnL=38 | 本地PASS |
| 从事件重建 | 10000合成成交+3行情事件与已有golden一致，10次冷启动全量重建一致；拒绝事件不污染状态或去重ID，补齐sequence可重试 | 本地PASS |
| F05/R01组合和风险输入 | 实际ledger/market模块组合，显式合并tape序号；租户/账户/来源/质量校验；active账户及每个持仓symbol有效mark；可信时钟、年龄界限与内容摘要验证 | 本地PASS |
| rebuild CLI | 3个真实本机子进程用例，黄金不符/陈旧风险拒绝先于输出；显式risk-at和max-age，无订单提交 | 本地PASS |
| PostgreSQL持久投影 | 完整JSON一致读、父账户锁、租户账户复合FK、单调头/同序冲突拒绝、原子保存、普通保存清除旧risk；向前迁移及12项静态校验 | 静态/编译PASS；实际Supabase NOT_RUN |
| 目标量化验收 | 原1万订单/成交、100%重建、查询P95<300ms保留到Beta；合成成交/冷重建只证明本地范围 | 目标NOT_RUN |

F05/R01适配器要求调用者提供确定性的合并portfolio序号，源流序号仍独立；本轮没有实现持久摄取调度或checkpoint恢复。旧display hash保持golden兼容；新风险输入摘要才绑定完整租户/账户/来源数据，摘要不是授权签名。已有NULL JSON行须获准重建，不伪造回填。迁移`20261016140000_x01_coherent_portfolio_snapshots.sql`未在任何数据库执行。

实现、用法和边界见[操作说明](../operations/x01-local-admission.md)、[ADR](../adr/20261016-x01-risk-snapshot.md)。[完整变更索引](./evidence/x01-local-20261016/changed-files.json)列出源码、测试、迁移、计划、门禁及所有原始证据。

## 新候选依赖顺序与历史保护

先于X01代码变更，冻结149ce0a4完成F05/R01/S2全39节点127组和回执发布：[先行证明](./evidence/x01-local-20261016/preimplementation-proof.json)。其新回执单独归档，原canonical与两份计划恢复。随后实现X01；共享输入变化使旧S2独立READY撤回。最终e2b85a80重新执行整个40/131闭包，只发布X01 consumer-local READY，不把内部LOCAL_READY传播给上游。

[最终执行结果](./evidence/provider-a1-remediation-20261004/x01-local-20261016/attempt-02/execution-results.json)、[依赖顺序证明](./evidence/provider-a1-remediation-20261004/x01-local-20261016/attempt-02/dependency-revalidation.json)、[全部40节点回执](./evidence/provider-a1-remediation-20261004/x01-local-20261016/attempt-02/local-prerequisites.json)、[发布manifest](./evidence/x01-local-20261016/manifest.json)。精确命令、顺序、退出、时间/信号/超时、raw日志/Artifact/输入hash和source SHA绑定由门禁核验；拒绝历史/跨候选/篡改/缺项/重排/目标声明。[canonical恢复](./evidence/provider-a1-remediation-20261004/x01-local-20261016/attempt-02/canonical-preservation.json)保留637文件和15目录原有字节与存在性；生成delta另存。

失败未删除：前置attempt02环境探针挂起、03 sandbox进程枚举拒绝；04为122PASS/5FAIL，修正E/F/G/SERVICE临时计划fixture漏拷stage回执及symlink写穿并增加不可变回归；05虽127命令通过但E新增第50例与旧49标记不符导致组装失败，修正精确50标记后06全部重跑。预检两轮Beta移交scope失配修正后第3轮8项通过。见[预检摘要](./evidence/x01-local-20261016/preflight/summary.json)。

最终首轮3c742384为124PASS/7FAIL，五个外层超时、TP01-C manager中断、S2聚合正确拒绝。主机Sleep/Deep Idle与超时窗口重叠是中断相关性的佐证，并非所有失败原因的确定证明。[原始中断记录](./evidence/x01-local-20261016/host-interruption/summary.json)及raw日志保留。e2b85a80冻结后借助临时caffeinate -is完整重跑，未调整持久电源设置；本轮131组及最终发布成功才形成READY。Git遗留锁均先核验无人持有/无Git进程/不变性，再备份非空锁及保存元数据后清理，不覆盖历史索引证据。

## 测试和收尾

三次独立可复现构建、make lint、make test全部PASS；本轮全工作区Rust 424 passed/13 ignored，Python 1856 passed，Web 233 passed/3 skipped。ignored/skip并非目标通过。X01专用Rust13 passed/1性能ignored（含7读模型集成+3 CLI），schema/policy99通过；嵌套S2证据suite48通过。预检all-targets编译、clippy -D warnings、rustfmt以及risk/reconcile/evidence兼容8 passed/1性能ignored通过。

[摘要](./evidence/x01-local-20261016/summary.json)和[收尾检查](./evidence/x01-local-20261016/post/checks.json)记录本地READY复验、RELEASE预期拒绝、计划/移交、源文档格式和脱敏秘密扫描。原始日志若含格式空白保留字节及诊断，不将其改成测试或全量格式通过。冻结后仅修改audit产物与计划生命周期/当前工程复核叙述，功能输入保持不变。

## Gate、未决风险及下一任务

X01_LOCAL本地工程范围PASS；实际持久化、集成/部署/性能及正式验收均CONDITIONAL/NOT_RUN。23组目标检查及3类X01目标移交全部NOT_RUN：Supabase迁移/RLS/事务/并发和跨进程恢复、真实账户与行情来源/时钟权限、继承S2供应链/CVE/法律用途、部署安全、代表性1万订单/成交及100%重建、查询P95<300ms、负载/长稳和同SHA hosted CI。离线快照不能刷新远程漏洞/许可结论。无生产凭据、本地PostgreSQL/Supabase、目标连接、Git push或外部发布。

f64及单报价单位保留；生命周期已实现P&L不能充当日损或账户现金/权益。X02必须使用可信账户/行情/时钟、调用validate_for并补足自己的权益/日界限、风险限额、业务授权和kill switch；X01不授予交易权限。当前未把未执行的目标缺口标记为代码缺陷已关闭或正式验收通过。

[六维用户确认文稿](./evidence/x01-local-20261016/confirmation-draft.md)已备齐，ProjectUser一人可直接确认/修改；未经真实答复不创建批准记录、不自行放行正式Gate。下一可执行任务：**CORE:X02：Pre/Post-trade Risk与kill switch**，先在新的冻结候选完整复验CORE:X01、CORE:S03、CORE:F06、CORE-GATE:S2-SERVICE，再实现规则/三类各≥50 fixture/覆盖及kill switch本地证据。上游独立READY未授予，不能跳过新依赖闭包。

收尾实测：X01 --ready exit0；--release exit2，原因release target evidence NOT_RUN，符合拒绝预期；两份计划及core/frontend移交检查、源文档diff-check、gitleaks8.28.0脱敏暂存扫描全部PASS。全量raw diff-check exit2，共380条诊断，全部限定audit证据目录，原始字节保留。临时caffeinate断言随记录器结束已释放。
