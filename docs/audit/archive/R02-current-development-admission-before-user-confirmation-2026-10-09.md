# R02 当前开发准入补齐与复验报告

日期：2026-10-09（Asia/Shanghai）。冻结执行源码 `7f18b8bc0d90e832b66f3e59652c5b40934c19ac`；承接[历史准入报告](./R02-development-admission-2026-10-08.md)与后续CI/TP01修复。原报告、失败、批准、Supabase不可变事实全部保留。本报告以本轮实际执行及当前严格内容校验为准。

## 1. 任务完成概况

**R02 当前 C01 开发准入已闭合：14节点/57组完整执行PASS，R01/F06/F0依赖和R02自身严格回执校验PASS，R02 DEVELOPMENT READY。** 调整后开发控制27/27；原完整28项PASS26、PARTIAL1（C26部署部分）、DEFERRED_RELEASE1（C25）。原13项R02工程缺陷保持CLOSED；没有正式用户确认，未登记ACCEPTED。

原5547211的57/57与8408122的远程CI属于各自历史源码。CI与TP01改变受控脚本后，本轮重新执行必要闭包，不手工迁移旧READY。联合计划当前14 READY、145 NOT_ASSESSED；不据此放行R1总Gate、后续研究工作流、页面、G0/A1/FEP-0或Beta。

源码整改分别由 `79ea170`（F06 Execution诊断与首次建连）、`80b70e5`（F02当前失败回执与R02短连接）、`c0c1fe9`（F06随机fixture登记及独立停用）、`7f18b8b`（F09/Engine进程监督、三fixture收尾及只读Git超时处理）完成。原业务断言全部保留；只有SQL之前已知传输故障与只读Git超时允许有界尝试，SQL执行后不重连、不重放。具体问题与闭合证据见第三、四部分，全部开发预检及失败启动器原件见证据索引；预检没有重标为同SHA准入。

## 2. 完成情况明细统计

| 口径 | 结果 | 完成率/边界 |
|---|---|---|
| 当前完整必要闭包 | 57 PASS / 57；14节点 | 100%，仅开发功能 |
| 调整后开发控制 | 27 PASS / 27 | 100% |
| 原完整检查点 | PASS26、PARTIAL1、DEFERRED_RELEASE1 | 26/28=92.86%，移交不计PASS |
| 原13项工程问题 | CLOSED13/13 | 不包含发布/正式验收 |
| C01依赖与R02自身 | 严格回执/实际源码与输入/嵌套目标和清理全部校验PASS | 当前内容绑定有效 |
| 联合计划159节点 | READY14、NOT_ASSESSED145 | 只恢复实际必需闭包 |
| 正式人工确认 | 未取得本轮确认，formalAccepted=false | ACCEPTED0/1 |
| 新源码hosted CI / 部署 | NOT_RUN | 不迁移8408122远程结果 |

逐项机器台账：[28项control-matrix](./evidence/provider-a1-remediation-20261004/r02-current-admission-20261008/control-matrix.json)；[57组实际执行](./evidence/provider-a1-remediation-20261004/r02-current-admission-20261008/attempt-05/execution-results.json)。下列PASS指当前开发范围；C26完整范围仍PARTIAL。

| 检查点 | 内容 | 开发结论 | 原完整范围 |
|---|---|---|---|
| C01 | R01/F06/F0 依赖与阶段准入 | PASS | PASS |
| C02 | snapshot Rust API 与模型字段 | PASS | PASS |
| C03 | 相同输入产生相同 hash | PASS | PASS |
| C04 | hash 与实际快照内容保持可信一致 | PASS | PASS |
| C05 | PostgreSQL 去重与已有行 UPDATE 拒绝 | PASS | PASS |
| C06 | 时间/schema/quality 基础类型与错误枚举 | PASS | PASS |
| C07 | capture/window/observed 时间关系 | PASS | PASS |
| C08 | age/expiry 的确定性错误与资源边界 | PASS | PASS |
| C09 | 来源、许可证、血缘完整性与可追溯性 | PASS | PASS |
| C10 | schema 及关联引用的租户一致性 | PASS | PASS |
| C11 | snapshot 元数据与质量规则持久化 | PASS | PASS |
| C12 | 两张表 RLS 启用、force、迁移版本 | PASS | PASS |
| C13 | 真实成员可读、跨租户拒绝的完整权限路径 | PASS | PASS |
| C14 | 默认规则下 300 个非法 fixture 拒绝 | PASS | PASS |
| C15 | 缺规则、跨 tenant 规则的默认拒绝 | PASS | PASS |
| C16 | 策略/交易不可关闭的质量/时效/许可约束 | PASS | PASS |
| C17 | 重复规则与配置冲突确定性 | PASS | PASS |
| C18 | Strategy/Runtime 消费质量 Gate | PASS | PASS |
| C19 | 实际 Supabase Storage 上传/登记/读取 | PASS | PASS |
| C20 | 上传前、读取后的 payload hash 检查 | PASS | PASS |
| C21 | 登记失败补偿不伤害既有对象 | PASS | PASS |
| C22 | 受影响包 fmt/Clippy/原有功能单测 | PASS | PASS |
| C23 | 成功/拒绝/恢复的行为 Gate 与故障覆盖 | PASS | PASS |
| C24 | 覆盖率与可审计范围 | PASS | PASS |
| C25 | 查询 P95 <300ms（RELEASE） | EXCLUDED_RELEASE | DEFERRED_RELEASE |
| C26 | 接口/协议与跨模块兼容证明 | PASS | PARTIAL |
| C27 | snapshot/规则写入审计与可观测性 | PASS | PASS |
| C28 | 运维、回滚与可复制文档 | PASS | PASS |

| 当前必要节点 | 本节点命令组数（共享组去重后合计57） | 结果 |
|---|---:|---|
| CORE:F01 | 5 | PASS / DEVELOPMENT READY |
| CORE:F02 | 9 | PASS / DEVELOPMENT READY |
| CORE:F03 | 3 | PASS / DEVELOPMENT READY |
| CORE:F04 | 5 | PASS / DEVELOPMENT READY |
| CORE:F05 | 10 | PASS / DEVELOPMENT READY |
| CORE:F06 | 3 | PASS / DEVELOPMENT READY |
| CORE:F07 | 3 | PASS / DEVELOPMENT READY |
| CORE:F08 | 3 | PASS / DEVELOPMENT READY |
| CORE:F09 | 3 | PASS / DEVELOPMENT READY |
| CORE-GATE:F0 | 3 | PASS / DEVELOPMENT READY |
| CORE:R01 | 3 | PASS / DEVELOPMENT READY |
| CORE:R02 | 5 | PASS / DEVELOPMENT READY |
| CORE:TP01-A | 3 | PASS / DEVELOPMENT READY |
| CORE:TP01-B | 2 | PASS / DEVELOPMENT READY |

执行轮次独立统计：attempt-01/e3fbdec只完成6组（5PASS/1FAIL），F06 Execution报连接中断，原日志缺阶段，UNKNOWN；F09收尾后在静态unit阶段主动停止，控制器143，剩余51组未完成，无READY发布。attempt-02/79ea170完整57组，55PASS/2FAIL（F02未捕获ECONNRESET与旧PASS残留、R02首次建连超时）；attempt-03/80b70e5只完成6组5PASS/1FAIL，数据库组到截止前仅5测试完成，停止后14临时actor实际停用；attempt-04/c0c1fe9完整57组52PASS/5FAIL（F09截止、TP01只读Git超时、R01 SQL连接重置、静态Engine截止与收尾发现3进程），精确actor/进程收尾完成，FAIL原件保留；attempt-05/7f18b8b完整57/57通过。所有失败与提前退出未并入有效轮次。

## 3. 问题清单及风险分析

| ID / 优先级 | 模块 | 具体表现与影响 | 当前结论 |
|---|---|---|---|
| CA-B01 / 阻塞级 | R02 C01 / receipt依赖 | CI/TP01受控输入改变后，旧14份回执不能放行当前内容 | 本轮完整57组及递归严格校验闭合，CLOSED（开发范围） |
| CA-H01 / 高危 | F06数据库功能验收 fixture | 8测试共用300秒总截止、超时缺诊断，旧Drop删除被拒后忽略错误留下临时actor | 随机fixture清单注册在SQL前；独立严格停用8fixture的actor/账户/会话并保留事实，命令预算900秒仅为总执行预算；完整目标通过；CLOSED |
| CA-H02 / 高危 | F09目标验收进程与fixture | 30分钟外层截止后回执仍RUNNING、子进程残留且缺内部阶段记录 | 续修7f18b8b补齐内部有界命令、进程组回收、实时阶段回执及独立三fixture身份/actor停用/事实保留校验；完整真实目标通过，CLOSED；旧等待根因仍UNKNOWN |
| CA-M01 / 中危 | F06 Execution验收脚本 | 首轮“Connection terminated unexpectedly”缺阶段，无法区分建连或SQL中断；首次建连未接入已有有界机制 | 阶段/具名fixture记录及仅首次建连处理补齐，33项回归和真实F06七步骤通过；CLOSED。旧失败阶段仍UNKNOWN，不伪造根因 |
| CA-M02 / 中危 | F02数据库开发检查 | SQL期间连接错误未捕获、失败后旧PASS文件残留，妨碍定位及独立使用者识别当前失败 | 本轮v2失败回执/阶段诊断/无SQL重放/独立只读收尾与完整真实检查通过；CLOSED |
| CA-M03 / 中危 | R02目标链连接 | 首次连接超时即失败；准备连接跨Cargo长时间持有，与清理连接边界不清 | 首次连接有界、准备提前关闭、独立清理、关闭/失败负向与真实链通过；CLOSED |
| CA-M04 / 中危 | TP01只读远程查询 | 公共ls-remote 15秒传输超时阻断必要闭包 | 只对ETIMEDOUT最多三次只读尝试，逐次FAIL保留，分支/鉴权/TLS/内容不重试；实际远程查询通过，CLOSED |
| CA-M05 / 中危 | R02静态Engine验收进程 | 超时后3个OpenBB进程残留，末尾清理发现3因而FAIL | 保持原五场景，独立有界进程组监督；完整静态场景及最终独立进程检查通过，CLOSED |
| CA-M06 / 中危 | R01目标连接诊断 | SQL期间Postgres ConnectionReset，不能确认传输根因 | 新轮全部原业务断言复验通过；未增加SQL重试，历史原因仍UNKNOWN，失败与actor4停用原件保留；属于历史失败风险记录 |

本轮没有发现需重开原13个R02工程缺陷的证据。仍需保留的边界：

- **发布欠项**：C25代表性环境/数据规模/并发下ID/hash/标的三路径无缓存P95<300ms，C26已部署BFF/Runtime、真实JWT/成员HTTP与候选同SHA远程CI，继续由CORE:R02在RELEASE-GATE:BETA验收。历史超标采样及本轮组件耗时仅诊断，不作发布性能PASS。
- **R01剩余范围**：B01/FA-H01继续OPEN/PARTIAL；Linux/systemd、父启动器/主机死亡通知、长期/部署运行与拟用途商用许可待验。TP01自然schedule及候选采用也不在本轮关闭。
- **时效与授权**：本轮复用32条原批准真实保留行情，quality=degraded，sourceAge=413961秒。新captured_at/RPC成功/写入持续/pending=0不改变source age，不证明实时readiness或自然告警/采样缺口恢复。processing、source-age、受控异常提交≤5s含义分别保留。
- **用途不扩展**：原scope固定1800秒，BTCUSDT/ETHUSDT，内部工程/研究，2026-10-10T00:00:00Z到期；本轮没有新provider摄取或自动延长。24小时、部署、客户展示、再分发、交易、商业用途需要新范围授权。
- **后续功能**：两个Research能力实际Python RPC证明持久快照/规则被消费；不证明R03/R04完整工作流/输出repository或商业LLM/策略效果。Strategy/Trading拒绝，不合格Signal在Engine派发前拒绝。
- **人工与源码边界**：当前DEVELOPMENT内容回执不等于正式ACCEPTED。仅文档提交后重新校验受控内容，不声称新HEAD有远程CI或发布同SHA验收。

## 4. 整改结果、验证证据与后续建议

- 实际数据库只连接现有配置Supabase；没有本地数据库、Supabase CLI服务、容器、数据库reset、隔离项目创建或既有不可变事实删除/重建。F02在现有schema执行迁移账本/catalog七断言与事务RLS/drift负向，每次rollback，并独立只读连接验证catalog/ledger恢复；未修改角色、重放迁移或建立隔离schema。
- F01三次独立构建输出一致；F06七步骤含真实Auth/BFF/Runtime、Execution六类正负、Vault/数据库默认拒绝全部PASS。初始连接失败记录保留；没有SQL重试策略。
- F05实际万条applied/dispatched/unique及重放恢复断言；F07实际恢复/服务/覆盖；F08真实wheel/UDS；F09实际Supabase写trace/调度/Engine恢复及9命令组关闭、3fixture actor inactive/事件事实不变；SCA、gitleaks、Buf/三语言与漂移/负向均按policy完成。lookup/调度耗时仅诊断。
- R01为mock行情连接真实Supabase的归一化/持久去重/原子游标/回放与受控异常提交315.168ms（≤5s），不是新真实provider窗口；R02为实际保留来源→快照/当前规则→reader/typed wire→两Research Python RPC链。来源批准4、reader2、wire篡改4类负向及跨租户/Strategy/Trading/Signal拒绝PASS。
- R01/R02目标owned actor均inactive；F06临时权限/秘密fixture清理、空tenant保留；研究对象、快照/规则/audit/intent/metadata等不可变证据保留。最终scope `2c542cf6` 独立进程检查discovered=0、remaining=0，不是清理后改判失败。
- R01/F06/F0依赖准入入口与R02自身严格manifest分别通过；组件诊断本身不自行授予准入，`--admission` 的依赖子结果为 admitted=true。
- 生产代码覆盖独立排除测试源码，R01四文件与R02六文件逐文件门槛通过。当前R02如下：

| R02生产文件 | 行覆盖 | region覆盖 |
|---|---:|---:|
| lib.rs | 98.90% | 97.09% |
| pg.rs | 95.03% | 88.16% |
| snapshot.rs | 90.32% | 88.51% |
| supabase_storage.rs | 94.97% | 91.28% |
| wire.rs | 99.05% | 91.16% |
| provenance.rs | 100.00% | 99.06% |

当前功能源码整改和严格开发准入已完成，可按计划推进R03/R04等未完成功能。正式验收使用[当前待确认文稿](../gate-records/R02-current-development-user-confirmation-draft-2026-10-09.md)与[统一规程](../gate-records/user-acceptance-confirmation-workflow.md)，项目用户确认前不自批；发布欠项留至候选形成后按代表性环境和新范围授权集中执行。

证据：[本轮索引](./evidence/provider-a1-remediation-20261004/r02-current-admission-20261008/README.md)、[R02严格manifest](./evidence/provider-a1-remediation-20261004/r02-current-admission-20261008/attempt-05/core-r02.json)、[文档更新后严格内容校验](./evidence/provider-a1-remediation-20261004/r02-current-admission-20261008/strict-validation.json)、SHA256SUMS。历史[5547211报告](./R02-development-admission-2026-10-08.md)与全部失败原件保留。文档与证据提交状态见本次任务最终回执；不推送。
