# R02 剩余 PARTIAL 续修与阶段调整报告

日期：2026-10-08（Asia/Shanghai）。修复起点：`f3d110b9c9999beb06db7852bcd8ba3bc6c7e9f0`。承接[原13项整改报告](./R02-remediation-2026-10-07.md)，不改写[原全面复审](./R02-comprehensive-review-2026-10-07.md)、历史失败、旧 hash 或已提交 Supabase 事实。执行用户本会话的[阶段调整指令](../gate-records/20261008-r02-development-release-scope.md)：发布环境相关 Gate 交由发布阶段，不要求开发阶段先部署。

## 1. 任务完成概况

本轮补齐 **C09 来源批准/用途/实际血缘、C18 持久化消费者链、C26 开发协议与模块消费功能**。**C25 代表性性能和 C26 部署 HTTP/JWT 链移交 `RELEASE-GATE:BETA`，不是验收通过。C01 的当前前置依赖准入仍未闭合**，新增独立 fail-closed 检查，不改 READY 字段、不自行批准。

组件功能检查与严格阶段准入分开：当前组件功能范围可继续开发；正式放行 R1 服务准入仍要求 R01/F06/F0 的当前独立回执。R01 原 B01/FA-H01 与新鲜度/持续运行结论不因此关闭。没有拟发布环境、目标规模/并发或部署身份，不将其虚构为已执行。

本轮只连接现有配置 Supabase，复用原 1800 秒/BTCUSDT、ETHUSDT 内部评估保留事实；**未启动或延长 ingestion，未开交易/客户展示/再分发/商业用途**。旧窗口距当前约3.8天，快照明确 Degraded，Research 仅按既有批准允许历史研究，Strategy/Trading 拒绝。新 captured_at 不改变 source age。每次空证据目录、独立具名 actor；结束停止测试 Engine、停用 actor，保留研究证据对象、快照/规则 revision/audit/intent 与失败历史。

## 2. 完成情况明细统计

| 原 PARTIAL | 模块与本轮处理 | 当前开发结论 | 完整验收剩余项 |
|---|---|---|---|
| C01 依赖/阶段准入 | `r02-stage-check.mjs` 输出真实 R01/F06/F0 NOT_ASSESSED；独立 `r02-admission-check` 拒绝，COMPLETED/手改READY不替代严格回执 | **PENDING_ADMISSION**，不计开发 PASS | 三项当前来源绑定的功能准入复评；R01 验证器尚须接入受控 receipt policy，不能仅改 plan 状态 |
| C09 来源/许可/血缘 | 服务器受控 `SnapshotSourcePolicy` 与原批准/固定scope/供应商配置/非fixture bounded-integrity回执绑定；逐条核对实际tenant/provider/dataset/license/reference/version/symbol/time/quality、来源ID与完整范围 | **PASS（当前内部研究用途）** | 扩大用途/窗口/部署或商业许可重新批准；当前批准到期拒绝，不等同供应商商用许可证 |
| C18 实际消费者 | `load_authorized_snapshot` 冷读快照/当前规则/实际market；Research/Signal coordinator持久化构造器和Strategy validation持久化入口；实际两个Research能力→Python RD-Agent、Signal pre-dispatch拒绝 | **PASS（开发持久化快照消费链）** | R03/R04工作流/输出repository仍为原内存实现；不声称完整研究系统、页面或策略运行发布通过 |
| C25 发布查询P95 | 开发目标停止重复75次发布计时，记录 NOT_RUN；原<300ms断言/旧超标基线保留，显式诊断与发布移交状态检查分开 | **DEFERRED_RELEASE** | 代表性环境/数据规模/并发及三个无缓存SQL路径的P95<300ms，由CORE:R02在Beta发布前验收 |
| C26 协议/完整服务 | 独立认证context与完整wire投影校对，实际活跃actor/read grant，冷读许可/质量与hash/schema/source等一致性；实际PG与Python模块消费 | **PASS（开发部分）；部署部分 DEFERRED_RELEASE** | 已部署BFF/Runtime、真实JWT/成员HTTP正向/跨租户与篡改拒绝、候选完整SHA与远程同SHA CI |

统计口径（不按 PARTIAL 折算，也不将移交计作通过）：

| 口径 | 结果 | 比率 |
|---|---|---|
| 原28检查点的完整范围 | PASS25、PARTIAL2（C01/C26完整范围）、DEFERRED_RELEASE1（C25），FAIL0 | 严格完成25/28=89.29%（原23/28=82.14%） |
| 调整后的开发/联调27项（剔除C25，C26只计开发范围） | PASS26、PENDING_ADMISSION1（C01） | 26/27=96.30% |
| 组件功能26项（再单列C01准入） | PASS26 | 26/26=100%；不是整体阶段READY |
| 5项PARTIAL处置 | 3项开发功能闭环、1项整体移交发布、1项准入保留；C26另有发布子项 | 不声称5/5完整验收通过 |
| 原13个工程缺陷 | 原CLOSED13/13保持；没有重新开放原缺陷 | 不等同R02正式验收 |
| 正式R02/Beta确认 | 未取得当前完整确认，阶段NOT_ASSESSED | ACCEPTED0/1 |

C02–C08、C10–C17、C19–C24、C27–C28 原23项通过范围保持；C24 新增 provenance 后按六个生产文件逐项重新评估，不以旧五文件结果冒充新覆盖。既有11,000跨语言fixture/六方向与15负向属于原协议证据，本轮未修改 `.proto` 或重跑全协议矩阵；新增typed引用解析已通过实际PG链与全目标编译。

## 3. 问题清单及风险分析

| 优先级/状态 | 所属模块 | 具体表现 | 影响与当前处理 |
|---|---|---|---|
| 阶段准入阻塞 / OPEN | R01/F06/F0→R02 | 当前stage_gate均NOT_ASSESSED，无当前严格依赖回执；R01尚未纳入统一receipt验证策略 | 不能宣布R1服务准入或R02 READY；不要求组件开发先部署。COMPLETED与准入的混用已禁止 |
| 高危 / 开发已修复 | 来源/用途 | 非空label曾不足以证明实际来源批准、血缘或适用用途 | 现在实际事件必须对应服务器批准，全来源/标的实际绑定；撤销/过期/用途不符/身份错配/质量提升拒绝。当前只准内部Research |
| 高危 / 开发已修复 | 消费者/规则 | 内存fixture不足以证明当前持久化快照和规则被实际业务消费 | 每次dispatch冷读真实PG、当前规则/血缘及活跃reader；真实Research正向、Signal/Strategy/Trading拒绝。规则变化验证只修改本轮首次创建规则并恢复，既有规则不覆盖 |
| 中危 / 移交发布 | SQL性能 | 旧跨区域开发fixture P95为947.300/936.857/1024.334ms，均超300ms | 已知基线保留。开发不反复跑时延优化；发布前必须在代表性环境/规模/并发实测，不能用持续写入、pending=0或本地PASS抵销 |
| 中危 / 开发修复，部署待验 | Wire/BFF/Runtime权限 | 仅有投影/库兼容无法证明部署HTTP/JWT权限链 | 开发解析完整投影并验证可信context及actual reader grant；部署链移交Beta，未实现/未部署的页面BFF契约不冒充完成 |
| 中危 / 已修复 | 验证runner/覆盖汇总 | 初次清理使用错误列名；合并覆盖第二段自动清空第一段采样 | 原失败保留；唯一actor单独停用回执；清理即使规则恢复失败也先停用actor；覆盖显式no-clean保留第一段采样，源码变更拒绝PASS，阈值不降 |
| 低危 / 运行约束留存 | 服务器配置/执行器 | policy对象不是文件热更新服务；同步PG需要合适executor | 新任务从受控当前policy配置加载，过期每次检查；部署服务负责撤销/重载策略。多线程Tokio使用block_in_place，current-thread明确拒绝；不声称Linux/systemd或主机死亡通知已验收 |

当前Research使用真实保留market事实与实际RPC，但RD-Agent仍为仓库确定性研究实现，非真实商用LLM性能/策略有效性证明。对象hash读回、来源授权、质量与新鲜度是不同维度；历史行情即使存储完整、RPC成功，仍是旧source-age的Degraded研究数据。任何真实交易或扩大范围均须新授权。

## 4. 验证证据与整改建议

本轮[证据目录](./evidence/r02-partial-remediation-20261008/README.md)保存全部失败、恢复、实际目标回执、覆盖与源码索引。最终结果以该目录的机器台账为准；初次成功的Engine调用不覆盖清理失败，也不删除旧覆盖失败。

- 无DB组件Gate：storage21/runtime12/strategy16；结构/覆盖/来源scope/阶段移交负向；原4个与新增2个来源行为变异均编译成功后测试失败。
- 编译/格式：整个workspace all-targets `cargo check --locked`通过，三crate all-targets Clippy `-D warnings`、fmt；新增测试时间归一到微秒，避免Linux纳秒时钟与canonical窗口精度不一致。
- 真实Supabase：保留32条实际market事件、上传/读回/注册新对象、可信持久快照与规则、两Research能力的Python Engine，跨租户/批准撤销或过期/版本与用途错配/reader无权限/wire篡改/Signal拒绝；具名actor停用及Engine停止。
- 目标边界：真实PG1、权限/原子审计与恢复2、HTTP3、Supabase Storage1；发布计时明确NOT_RUN，清理只限本轮owned对象/actor，元数据留存。
- 既有消费者回归：2个Research与3个Signal实际Python Engine测试；新target测试在无opt-in场景只输出NOT_RUN，不能作为数据库验收。
- 联合计划：正文与结构化Beta required_scope一致、拓扑/政策及38个负向用例通过。stage Gate检查输出admitted=false；缺准入与未配置发布的独立入口预期拒绝。

后续按实际开发顺序继续未完成功能；R1服务准入需要时再完成R01/F06/F0当前受控复评与R01严格验证器接入。发布负责人在Beta候选形成后一次固定环境/身份/数据规模/并发/采样方案和新范围授权，执行C25/C26部署部分、远程同SHA CI及完整发布确认。`r02-performance-diagnostic`仅小fixture诊断，不是代表性发布验收；`r02-release-performance`仅检查Beta移交状态，不自行放行whole-Beta。适用许可及[统一用户确认规程](../gate-records/user-acceptance-confirmation-workflow.md)继续有效。

本地提交不推送，不把当前检查登记为READY/ACCEPTED，不删除/重建Supabase，不扩大1800秒/两标的/原内部用途。

| 六个生产文件 | 行覆盖 | region覆盖 |
|---|---:|---:|
| lib.rs | 98.90% | 97.09% |
| pg.rs | 95.03% | 88.16% |
| snapshot.rs | 90.32% | 88.51% |
| supabase_storage.rs | 94.97% | 91.28% |
| wire.rs | 99.05% | 91.16% |
| provenance.rs | 100.00% | 99.06% |

最终有效目标为 `coverage-attempt03`：三步退出均0，chain/boundaries均PASS_SCOPED_TARGET且cleanup PASS；两份source inventory与当前字节匹配。候选同SHA远程CI和部署均NOT_RUN_RELEASE_STAGE。本轮没有新的数据库迁移。
