# R02 全面复审整改与修复验证

日期：2026-10-07（Asia/Shanghai）。修复起点：`6aa5b9ee5c42e1527fbad47cfec4e71282340db9`。本报告承接[全面复审基线](./R02-comprehensive-review-2026-10-07.md)的 13 项问题；原报告、原始失败证据与已提交数据库事实保持历史状态。本轮为代码、向前迁移、必要联调和本地 Git 提交，不推送、不自行批准。

## 1. 完成概况

**13 项工程缺陷均已修复并完成分层验证：阻塞 1/1、高危 5/5、中危 6/6、低危 1/1。** 关闭率 13/13（100%）指原问题所述可复现缺陷，不代表完整 R1 或正式 R02 验收完成。来源实际批准、R01 到消费者全链、部署权限路径和 RELEASE 查询目标仍需后续验收。

按原报告的 28 个检查点重新评估：**PASS 23、PARTIAL 5、FAIL 0，严格完成率 23/28=82.14%**（原 11/28=39.29%）；开发/联调剔除 C25 后 **23/27=85.19%**。不按部分通过折算，不声称工时完成率。当前 `development_status=COMPLETED` 与 `DEVELOPMENT/NOT_ASSESSED` 分开维护，未登记 READY/ACCEPTED，也未取得当前候选同 SHA hosted CI/部署/正式确认。

本次只连接配置的 Supabase PostgreSQL/Storage，使用每轮唯一 scope 与具名测试 actor。七项迁移全部向前执行、原文件及 ledger checksum 保留。临时故障仅针对本次 fixture tenant；结束停用 actor、清理本次拥有的对象并保留 snapshot/audit/intent/tenant 事实。不删除或重建已有 Supabase，不运行或延长行情 ingestion。

## 2. 完成明细与统计

| 原检查点 | 当前结果 | 修复或独立证据 |
|---|---|---|
| C01 依赖/阶段准入 | PARTIAL | 移除静态 COMPLETED 充当依赖准入的推断；R01/F06/F0 当前准入仍未闭合，未自行登记 READY |
| C02 模型/API；C03 确定性 hash；C04 内容可信 | PASS | 只读 Record、微秒 canonical hash、自定义 serde、constructor/catalog/PG/Gate 多边界一致性；不可变编译失败 doctest |
| C05 去重/UPDATE；C06 类型错误 | PASS | 原不可变触发器保留；真实 PG 幂等写/冷读/枚举与拒绝验证 |
| C07 时间；C08 预算/expiry | PASS | start≤end≤capture≤created，capture≤observed/DB clock；age≤86400、checked expiry、每向量≤1024、输入≤1MiB |
| C09 来源/许可/血缘完整性 | PARTIAL | 空身份/未知 schema/无效 lineage 和 DB引用已拒绝；非空 label 不能替代真实批准及适用用途，沿 R01 追踪 |
| C10 租户关联；C11 持久化；C12 RLS；C13 成员查询 | PASS | schema/artifact/market 范围实体验证；受限成员函数正向读及非成员/跨租户拒绝；无直接表 grant；历史无 canonical 或无效引用拒绝读取 |
| C14 300非法fixture；C15 缺规则；C16 强制底线；C17 冲突 | PASS | 300 fixture、600 Strategy/Trading拒绝断言；五种危险规则禁止关闭底线；重复usage/混tenant错误 |
| C18 消费者全链 | PARTIAL | Strategy/Runtime单元及真实Python Engine的2 Research+3 Signal联调通过；R01真实源→可信快照→持久规则→实际业务消费者全链尚未闭合 |
| C19 目标Storage；C20 hash；C21 登记失败恢复 | PASS | 实际HTTP上传/读回/注册；错tenant/path/bucket在HTTP前拒绝；既有对象登记失败仍存在、durable intent记录、显式恢复成功 |
| C22 常规检查；C23 行为Gate；C24 覆盖率 | PASS | fmt/Clippy；14结构负向+8覆盖判定+4真实编译变异；目标覆盖排除测试源码，五个生产文件独立达标 |
| C25 RELEASE查询P95<300ms | PARTIAL | ID/hash/列表各25次无缓存真实SQL API基线，含网络/协议/校验，不是纯服务端执行时间；当前跨区域开发路径超300ms，不记PASS |
| C26 协议与完整服务兼容 | PARTIAL | CommandMetadata写context、DataSnapshot wire桥接及所有quality映射；11,000跨语言fixture/六方向二进制和ProtoJSON/15负向通过；部署服务/API完整链另验 |
| C27 原子写审计 | PASS | 实际actor/capability/correlation/causation/reason、规则revision；成功事实与F05 audit同事务，重复快照不重复成功审计、拒绝事务无成功审计 |
| C28 运维/回滚文档 | PASS | 当前summary/README、[操作规程](../runbooks/r02_snapshot_operations.md)、[ADR](../adr/20261007-r02-snapshot-trust-boundaries.md)，历史证据不改写 |

PASS：C02–C08、C10–C17、C19–C24、C27–C28（23项）。PARTIAL：C01/C09/C18/C25/C26（5项）。正式验收仍 0/1；未把工程闭环替代 ProjectUser 的正式确认。

## 3. 问题关闭清单与风险

| ID / 优先级 | 模块 | 整改结果与验证 | 当前处置 |
|---|---|---|---|
| B01 / 阻塞 | PG权限/成员查询 | 独立 `quantos_snapshot_api`，仅schema usage/函数execute；真实auth.users/membership + authenticated role/claims正向读取、非成员/跨租户42501；writer可函数写、直接SELECT42501 | CLOSED（组件权限路径）；真实HTTP JWT/BFF部署留后续 |
| H01 / 高危 | Record/serde/hash/冷读 | 只读Deref、自定义反序列化、canonical重算与派生expiry；数据库payload/列/hash一致性；PG/member API读取拒绝无canonical、伪造质量/expiry和无效引用的历史记录；旧事实保留 | CLOSED |
| H02 / 高危 | 规则/交易Gate | Strategy/Trading Passed+license+freshness不可关闭，Rust校验与DB约束双侧拒绝；Research可显式例外且不扩张许可 | CLOSED |
| H03 / 高危 | 时间/新鲜度 | 时间关系、可信observed、DBclock及实际window.end/source-age独立检查；修正两处Strategy和两处Runtime旧fixture未来窗口，100look-ahead/leakage拒绝保留 | CLOSED |
| H04 / 高危 | 元数据/血缘语义 | source身份、lineage元素、标的/对象/已知schema及预算校验；DB解析本租户真实引用。上游批准记录不是label，实际获准用途仍由R01提供 | CLOSED（所述输入缺陷）；R01许可/实际链不冒充已验收 |
| H05 / 高危 | schema/对象关联 | tenant/name/version完整schema元组、artifact完整manifest、已提交market范围校验；跨租户/缺对象23503；读取再验引用、移除缓存 | CLOSED |
| M01 / 中危 | Ruleset | duplicate usage、混tenant直接Result错误，禁止顺序覆盖 | CLOSED |
| M02 / 中危 | age/资源 | 0–86400、checked_add、1MiB/1024界限与极值错误；拒绝panic路径 | CLOSED |
| M03 / 中危 | Storage失败补偿 | 强制不覆盖、重复对象GET/hash、HTTP前durable prepared intent；失败保留对象与reconcile状态，显式恢复登记；实际目标注入失败后既有对象仍可读 | CLOSED |
| M04 / 中危 | Gate/覆盖 | 四类mutation必须编译成功后测试失败；结构负向仅补充；覆盖clean+排除tests+五生产文件逐项阈值及8项判定负向；默认Gate显式禁DB | CLOSED |
| M05 / 中危 | SQL性能测量 | 移除snapshot缓存，真实ID/hash/列表分别25次；nearest-rank P95，记录规模/limit/连接模式；RELEASE opt-in独立强制<300ms | CLOSED（错误测量）；C25数值目标待验收 |
| M06 / 中危 | context/审计 | 活跃actor与capability检查、typedCommandMetadata桥接、atomic audit、rule revision、correlation/causation/reason；目标成功/幂等/拒绝边界验证 | CLOSED |
| L01 / 低危 | 运维/环境/历史 | 删除本地临时DB建议、默认Gate不受.env误连接影响；当前summary与历史证据分开；记录新证据目录、失败保留、actor停用和向前恢复 | CLOSED |

本次 API ABI 增加 Result/context；所有仓库调用点已更新。时间微秒规范化会改变旧纳秒输入的canonical值；不修改历史hash，重新签发可信快照。历史无canonical或失效引用拒绝读取是预期安全边界，可能要求消费者更新引用。恢复台账 explicit deny policy 与 NOLOGIN writer 不产生生产连接身份或商业授权；真实部署仍需受控连接身份评审。

风险留存：R01 B01/FA-H01、有效供应商用途批准及新鲜度/实时健康、实际持久化业务链、部署权限路径/主机运行与同SHA远程CI、生产规模和发布性能。当前SQL延迟已知超目标，不能用成功持久化、pending=0或其他本地绿灯掩盖。以上由原阶段/发布Gate追踪，未纳入13项原可复现代码缺陷的关闭统计。

## 4. 验证、证据与后续建议

[证据目录](./evidence/r02-remediation-20261007/README.md)包含 source-bound target receipt、原始日志、逐项机器台账、覆盖summary与checksum索引。完整目标覆盖使用 attempt06；显式恢复RLS policy应用后的最终功能使用 attempt08。覆盖所测的五个生产文件与最终receipt逐字节相同，最终所有七项migration另由目标readback核对。

| 验证层 | 本轮结果 | 证据 |
|---|---|---|
| 默认/显式无DB功能Gate | PASS：storage19/runtime12/strategy16、14结构负向/8覆盖负向/4真实mutation | `logs/r02-default-final.log`、`logs/r02-check-final.log` |
| 编译/格式 | fmt、三crate all-targets Clippy无warning、1只读compile_fail doctest | `logs/fmt-final.log`、`logs/clippy-final-current.log`、`logs/readonly-doctest-final.log` |
| 消费者 | 2 Research + 3 Signal实际Python Engine测试通过 | `logs/consumer-integration-attempt03.log` |
| 协议 | Buf/生成/breaking、11,000 fixture、六语言方向、15负向 | `logs/proto-check-attempt02.log` |
| 配置Supabase | 原生PG1、R02边界2、HTTP3、真实Storage1；cleanup PASS | `target-attempt08/receipt.json`、`target-attempt08/target-boundaries.log` |
| 生产源码覆盖 | clean LLVM排除tests，5/5生产文件达到line≥90%/region≥85% | `target-attempt06/coverage-summary.json`及原始`coverage.json` |
| 迁移/计划 | 七forward migration及目标checksum；55表RLS静态；联合计划检查/负向 | `target-state.json`、`logs/migration-static-final.log`、`logs/plan-final-check.log`、`logs/plan-final-negative.log` |

本轮最终 target attempt08 的无缓存 SQL API P95 基线为 ID **947.300ms**、hash **936.857ms**、标的列表 **1024.334ms**，各25样本、nearest-rank、小型fixture/limit5、配置session pool模式。全部超过发布目标；不构成容量评估或性能PASS。

| 生产文件（排除tests） | 行覆盖 | region覆盖 |
|---|---:|---:|
| lib.rs | 98.90% | 97.09% |
| pg.rs | 95.43% | 87.48% |
| snapshot.rs | 90.32% | 88.51% |
| supabase_storage.rs | 94.97% | 91.28% |
| wire.rs | 98.63% | 93.81% |

先推进未完成功能所需的准入输入与真实消费者联调，明确实际来源/批准记录和质量拒绝；成员HTTP/BFF部署与拟发布连接身份独立验证。发布阶段在代表性环境/数据规模/负载上完成<300ms和远程同SHA CI，再按[单用户确认规程](../gate-records/user-acceptance-confirmation-workflow.md)准备完整正式确认文稿。本轮不要求为关闭代码缺陷反复扩展行情窗口，也不自行批准24小时、Linux/systemd、交易、展示/再分发或商业用途。

失败attempt01/02/03/05和途中环境/fixture失败保持原结论；attempt04/06的PASS不改写此前失败。通用角色授权曾被自动审批拒绝，之后通过只读实际角色/成员选项证据，将动作缩小为现有postgres→writer membership的SET选项；该受限动作已批准并执行，未进行通用current_user grant。最后完整回读发现 PostgreSQL 新grantor条目默认继承，第七项向前迁移显式关闭INHERIT，保留SET；最终受限角色路径重新通过。清理只涉及当轮拥有的对象与测试actor，数据库事实留存。
