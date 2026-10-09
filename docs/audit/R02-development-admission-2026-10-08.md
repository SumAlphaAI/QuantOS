# R02 开发准入续验与整改报告

> 历史报告提示：下文为原执行时点的结论，原失败/源码/批准及事实保留。当前7f18b8b必要闭包57/57和严格回执已通过，R02 DEVELOPMENT READY；原13工程缺陷CLOSED，C25/C26发布部分与正式确认仍未完成。当前结论以[本轮准入报告](./R02-current-development-admission-2026-10-09.md)为准。

> 历史CI失效状态补记：本报告记录冻结5547211的历史57/57执行。随后c7a4d65远程CI暴露两处测试执行问题；[CI整改](./CI-c7a4d65-remediation-2026-10-08.md)改变了受控脚本内容，原14份READY回执已失效，当前NOT_ASSESSED、C01待新内容复评。以下历史结果及全部原始证据保留，不能直接批准当前源码。

日期：2026-10-08（Asia/Shanghai）。承接[上一轮续修报告](./R02-partial-remediation-2026-10-08.md)，原全面复审、整改报告、失败记录及 Supabase 事实保留。本轮修复起点 `22915b801d3f41a551d2aa66357f6a86d57c4e0c`；最终完整执行的冻结源码 `5547211a740d2c61d3d2d66d3f44c55c40d68d43`。本报告为开发功能验收，不签署正式 ACCEPTED，不把发布移交计作通过。

## 1. 任务完成概况

**C01 当前开发依赖准入已闭合，R02 DEVELOPMENT READY；调整后的开发/联调27项全部通过。正式用户确认未执行，C25/C26发布范围继续留待Beta**。C01 的当前 R01/F06/F0 依赖以及 R02 自身接入受控 receipt policy；完整功能闭包包含 F01–F09、TP01-A/B、F0、R01、R02，14 个节点、57 个独立命令组。所有目标回执均保留真实执行源码、输入摘要、日志、嵌套对象/覆盖/清理原件；不能手改 READY、重标旧源码或用未启用数据库的单测替代实际 Supabase。

本轮还修复准入之外发现的来源批准绑定、启动探针、供应链补丁、测试 Engine 回收、只读 preflight 瞬时连接重试，以及F07登录传输重试/fixture收尾、无效bearer格式与失败诊断、初始化连接、同时间审计顺序及poison fixture租约问题。真实 provider 没有重新摄取；R01 为本地 mock 连接真实 Supabase 的功能目标，R02 为原批准的非 fixture 保留行情→持久快照/当前规则→真实 Python Research 消费。历史行情明确 Degraded，Strategy/Trading 与 Signal 不合格消费拒绝。

## 2. 完成情况明细统计

当前严格回执与[28项逐项台账](./evidence/provider-a1-remediation-20261004/r02-admission-20261008/control-matrix.json)支持以下统计：

| 口径 | 结果 | 完成率/边界 |
|---|---|---|
| 调整后的开发/联调 27 项 | PASS27，含 C01 当前严格准入 | 27/27=100% |
| 原完整 28 检查点 | PASS26、PARTIAL1（C26 部署部分）、DEFERRED_RELEASE1（C25），FAIL0 | 严格完成26/28=92.86%；发布移交不计 PASS |
| 上轮保留的 5 项 PARTIAL | C01 当前准入闭合；C09/C18/C26 开发范围复验；C25/C26 发布子项保留 | 不声称完整范围5/5通过 |
| 原 13 工程缺陷 | CLOSED13/13，未发现重开证据 | 缺陷关闭与正式验收分别统计 |
| 完整开发功能闭包 | 57/57；14 节点 | 工程 DEVELOPMENT READY，formalAccepted=false |
| R02 正式人工确认 | 尚无本轮用户确认记录 | ACCEPTED0/1 |
| 全部联合计划 | 14 READY、145 NOT_ASSESSED | 不放行 R1 总 Gate、页面、G0/A1/FEP-0 或 Beta |

| 续验检查点 | 本轮实际证明 | 留存边界 |
|---|---|---|
| C01 当前依赖/自身准入 | R01、F06、F0 及递归闭包实际复评；R02 自身严格 receipt 校验，内容漂移/缺测拒绝 | 仅 DEVELOPMENT，历史正式字段与远程 CI 不迁移 |
| C09 来源/许可/血缘 | 完整绑定原 receipt.authorization、固定1800秒与当前 scope；实际32条保留事件逐条核对，撤销/过期/版本/用途/reader/wire 负向 | 内部研究用途；公共接口不等于商业许可证 |
| C18 持久化消费者 | 冷读实际 Supabase 快照/规则/market，两种 Research 能力调用真实 Python RPC，Signal 在 Engine 派发前拒绝 | R03/R04 工作流/输出 repository 仍属后续功能，非完整研究平台验收 |
| C25 代表性查询性能 | 明确 NOT_RUN_RELEASE_STAGE，Beta 移交政策一致 | 原947.300/936.857/1024.334ms诊断基线仍超300ms，不在开发重跑优化 |
| C26 开发协议/模块消费 | 完整 typed wire 投影、可信认证 context、实际 reader grant、跨租户与篡改拒绝、真实模块链 | 已部署 BFF/Runtime、真实JWT/成员HTTP与候选同SHA远程CI留 Beta |
| C24 覆盖 | R01四文件、R02六文件重新采集并逐文件验证 line≥90%、region≥85% | 不用旧覆盖代替当前新增 provenance 文件 |

执行历史独立统计：attempt-01（`2fd03d8`）完整56项，54 PASS/2 FAIL，未发布READY；attempt-02（`55b4999`）只完成3项，2 PASS/1 FAIL，F09收尾后主动停止，全57未执行；attempt-03（`73784c7`）完整57项，56 PASS/1 FAIL（F07登录超时），没有发布READY；attempt-04（`c8aa8f8`）只完成3项，2 PASS/1 FAIL（无效bearer返回503），F09完成后退出143，全57未执行；attempt-05（`40e11b8`）完整57项，54 PASS/3 FAIL（F07初始连接中断、同时间审计顺序、poison fixture租约过期），未发布READY；attempt-06（`5547211`）完整57项，57 PASS/0 FAIL，发布14节点工程READY，使用空的新目录。失败、提前退出及清理结果均保留，不并入最终有效轮次凑数。

## 3. 问题清单及风险分析

| ID / 优先级 | 所属模块 | 具体表现与影响 | 修复及当前状态 |
|---|---|---|---|
| DA-B01 / 阻塞级 | receipt policy / R01→R02依赖 | R01无受控当前目标回执，C01不能严格准入；COMPLETED/静态成功不足以准入 | 注册R01/R02目标和完整14节点闭包；嵌套日志/覆盖/清理、实际源码/摘要/依赖严格校验；**CLOSED（开发范围）** |
| DA-H01 / 高危 | 保留来源授权 | 同scope ID下可延长expiry或扩permissions，原批准范围未完整绑定；可错误允许越界消费 | 原receipt.authorization与当前scope深比较，原runtime_seconds必须1800；反例仅只读模拟，原批准及DB未改；**CLOSED（开发范围）** |
| DA-M01 / 中危 | F06/F07服务启动验证 | 旧100×200ms探针可能在真实依赖初始化中杀掉进程，完整Gate误失败 | 60秒单调时钟预算、精确状态、活跃PID、截止时间验证；超过预算仍FAIL。F06联调实测BFF 8028ms、Runtime 5279ms；不放宽行情或发布SLO；CLOSED（开发范围） |
| DA-M02 / 中危 | Next.js依赖/SCA | 15.5.24新发现两项moderate缓存污染公告，完整SCA拒绝 | Next/ESLint插件固定15.5.27及匹配lock；实际SCA/backport/构建回归；无新增豁免；**CLOSED（开发范围）** |
| DA-M03 / 中危 | Rust→Python测试生命周期 | 终止uv启动器后Python Engine残留；本任务初轮/预检发现163个确属自身的fixture进程，影响后续验证与资源 | 直接仓库venv Python PID、kill_on_drop+wait回收；scope nonce/基线/PID启动时间与命令绑定；最后独立实际进程检查，有残留即使清理仍FAIL；**CLOSED（开发范围）** |
| DA-M04 / 中危 | F06只读 preflight runner | 已配置Supabase瞬时“Connection terminated unexpectedly”未归入窄重试，第二轮提前失败 | 仅精确只读transport关闭重试整个目标，最多3次；权限/角色/语义失败不重试，失败日志保留；**CLOSED（开发范围）** |
| DA-M05 / 中危 | F07 Auth与fixture收尾 | 密码登录15秒传输超时阻断完整Gate；旧runner只关服务/任务而未停用新建actor，失败回执缺phase/确切fixture身份 | 密码-token请求仅对TimeoutError/已知连接关闭最多3次，保留每次FAIL，身份创建/HTTP权限拒绝/缺token/显式取消/业务断言不重试；记录phase和fixture ID，成功失败均核验actor inactive/session注销及两PID回收，清理失败拒绝；CLOSED（开发范围） |
| DA-M06 / 中危 | Auth输入验证/F06诊断 | 格式无效bearer仍调用Supabase，网络超时返回503而非预期401，诊断未打印实际状态；请求被拒绝，未发生授权绕过 | 格式不符合签名compact JWT的令牌本地401；合法格式始终要求远端验证，未信任本地解码claims；6项单元/Clippy与当前真实Auth/BFF复验，FAIL保留HTTP状态及请求时序；CLOSED（开发范围） |
| DA-M07 / 中危 | F07数据库初始化 | 第五轮首次连接在任何SQL前关闭，恢复检查未执行 | 仅初始建连已知transport失败最多3次；失败连接关闭确认、每次结果留存；权限/TLS/取消/SQL操作不重试；12项负向/成功测试通过；**CLOSED（开发范围）** |
| DA-M08 / 中危 | Runtime/Event审计顺序 | 相同业务时间的取消请求与完成审计仅按时间排序，可反转因果顺序 | 新写入由数据库trigger强制分配append_sequence；读取增加序号及稳定历史fallback；不回填旧行、不声称全局提交顺序；真实PG同时间顺序回归；**CLOSED（开发范围）** |
| DA-M09 / 中危 | R01目标测试fixture | 批量领取8条poison事件后逐个远程事务消耗30秒租约，后续触发正确的StaleLease而使fixture失败 | 每次领取一条并使用原30秒租约；总8个deadletter/16条记录断言保留，生产fence和异常≤5s不变；**CLOSED（开发范围）** |
| DA-M10 / 中危 | Event/Market TLS | 额外verify-full预检在macOS原生TLS拒绝Supabase证书有效期，尚未进入业务；四actor收尾PASS | Event完整验证采用Runtime相同OpenSSL connector，缺失/坏CA仍拒绝；受控R01目标显式verify-full，未改.env.local或关闭证书验证；原require/prefer语义保留；**CLOSED（开发范围）** |

Next补丁依据见[ADR](../adr/20261008-next-security-patch.md)及[Vercel 15.5.27发布记录](https://github.com/vercel/next.js/releases/tag/v15.5.27)。既有 braces/glib backport仍执行真实验证；本轮没有通过增加豁免关闭SCA。

本轮共12项发现：阻塞级1、高危1、中危10；全部按当前开发范围关闭，低危运行约束单独留存。上述为本轮发现清单，不覆盖原13个已关闭缺陷。以下范围继续 OPEN/PARTIAL 或移交发布，不能随开发 READY 消除：

- **R01 B01 / FA-H01**：原十问题仍9/10关闭；历史窗口检测降级714/8530=8.37%、effective ready109/120。Linux/systemd、父启动器/主机死亡通知、长期运行、发布同SHA CI及拟用途许可仍待验。没有新实时健康结论。
- **指标不同含义**：processing只量响应头到检测；source-age量行情年龄；受控异常≤5s量提交时限；服务启动readiness不代表行情readiness。自然告警精确ACK与采样缺口只沿用已记录历史窗口，不冒充本轮新采集；pending=0/写入持续/RPC成功不抵销新鲜度降级。
- **范围/到期**：原scope固定1800秒、BTCUSDT/ETHUSDT、内部工程/研究用途，`2026-10-10T00:00:00Z`到期，当前有效原批准才允许保留数据复验。部署、24小时、扩大用途或商用必须新授权，不改原配置假延长。
- **正式/发布**：C25代表性P95<300ms、C26部署HTTP/JWT/远程同SHA CI归RELEASE-GATE:BETA；未执行不记PASS。当前文档提交改变HEAD后，开发内容绑定仍须严格复核；不能声称新HEAD已有远程CI或发布同SHA验收。
- **配置/执行器边界（低危约束留存）**：SnapshotSourcePolicy为服务器当前受控配置，每次检查到期；不是文件热重载服务。部署服务须验证撤销/重载。同步PG仅在合适executor运行，多线程Tokio使用block_in_place，current-thread明确拒绝；本次功能回执不替代这些部署运行条件。
- **Research实现边界**：RD-Agent仍为仓库确定性研究实现；真实Python RPC证明持久快照/当前规则被模块消费，不证明真实商用LLM能力、策略有效性或R03/R04完整持久工作流。

## 4. 整改建议与验证证据

当前代码整改、完整复评和严格回执已通过；优先继续R03/R04等未完成功能，不以开发阶段反复执行代表性发布性能替代功能建设。发布候选形成后固定环境、身份、数据规模/并发、采样方案及用途范围，集中执行Beta欠项。

[本轮证据索引](./evidence/provider-a1-remediation-20261004/r02-admission-20261008/README.md)包含独立轮次、原始失败、受控负向、逐节点manifest和SHA256索引。最终以attempt-06台账及严格回执为准；无DB检查中的NOT_RUN不统计为数据库通过。第三轮F07的唯一新建actor已按程序命名/Auth测试身份/创建窗口独立核验并停用，原FAIL保持；修复预检有63项Node及真实六组功能/actor/session/服务PID收尾，只计预检不作同SHA准入。实际目标只连接已有Supabase，不重建/删除旧事实；本轮具名R01/R02 actor停用、Engine/fixture进程停止，保留快照/规则/audit/intent/对象与失败证据。

- 实际 R01：local mock/真实Supabase的原子去重、回放、游标与异常提交通过；异常提交344.644ms（≤5s），四个owned actor均inactive。没有新的真实provider回执。
- 实际 R02：32条保留market事实，sourceAge=357374秒、quality=degraded；两Research实际Python RPC；来源批准4项、reader2项、wire篡改4项负向，跨租户/Strategy/Trading拒绝、Signal REJECTED_BEFORE_ENGINE，EngineStopped=true；chain及boundaries的owned actor清理PASS，元数据及不可变事实RETAINED。
- F07当前诊断scheduleP95=1070.077ms，高于原200ms指标，DIAGNOSTIC_ONLY，不作性能PASS。其回执的isolated标签指已有配置Supabase内的具名fixture与权限范围，未创建隔离数据库/本地环境。
- F05万条事件实际applied/dispatched/unique均10000、checkpoint=10001，消费600541ms、lookup=21725.123ms；lookup仅target-event-id-client-retrieval，不是完整载荷查询性能。另有1000重复交付与F07实际100任务恢复/唯一绑定、当前目标覆盖和本地服务→Supabase权限/Storage均通过；耗时仅诊断，不授予发布性能或管理员Storage身份部署许可。
- 严格入口：R02依赖准入与R02自身receipt分别校验，F0当前闭包校验；联合计划和38项负向复核。组件stage disposition的admitted=false依然正确，它本身不授予准入。
- 最终scope 1f1acb17实际进程检查discovered=0/remaining=0；不是清理后把原失败改判PASS。

| R02生产文件（独立排除测试源码） | 行覆盖 | region覆盖 |
|---|---:|---:|
| lib.rs | 98.90% | 97.09% |
| pg.rs | 95.03% | 88.16% |
| snapshot.rs | 90.32% | 88.51% |
| supabase_storage.rs | 94.97% | 91.28% |
| wire.rs | 99.05% | 91.16% |
| provenance.rs | 100.00% | 99.06% |

逐项命令、执行时刻、日志摘要、源码/契约输入和递归依赖见[最终执行台账](./evidence/provider-a1-remediation-20261004/r02-admission-20261008/attempt-06/execution-results.json)及[当前R02严格manifest](./evidence/provider-a1-remediation-20261004/r02-admission-20261008/attempt-06/core-r02.json)。

前向迁移的实际完整性核验：337,443条历史审计ID全部保留，全部原JSON字段逐行相同，新增序号全部NULL；实际迁移账本SHA与SQL一致。两次迁移前读取超时及后续查询取消请求留存；未回填、删除或重建原事实。TLS额外预检失败与四actorinactive也独立保留；完整目标固定verify-full并采用OpenSSL，无凭据或.env.local修改。

本轮本地修复提交：`2fd03d8`（受控准入/目标验证）、`8f53f0d`（授权/就绪/依赖/Engine回收）、`55b4999`（嵌套原件补齐）、`73784c7`（有界只读transport重试及提前失败原件）、`c8aa8f8`（F07登录/收尾/失败artifact及第三轮原件）、`40e11b8`（无效bearer本地拒绝/失败状态与第四轮原件）。`5547211`（数据库bootstrap/只追加审计序号/poison fixture及第五轮原件）。最终报告/完整证据提交另行生成，不推送。正式人工确认采用[统一规程](../gate-records/user-acceptance-confirmation-workflow.md)，Codex不代用户批准。
