# R02：DataSnapshot、血缘与质量 Gate 全面复审报告

日期：2026-10-07（Asia/Shanghai）。源码基线：`6aa5b9ee5c42e1527fbad47cfec4e71282340db9`；初始工作区 clean。依据[开发计划 R02](../SumAlpha-QuantOS-Development-Plan.md#task-r02)、§2.2–2.4、§2.9–2.10，以及[架构](../SumAlpha-QuantOS-Architecture.md)、[技术方案](../SumAlpha-QuantOS-Technical-Solution.md)。

## 一、任务完成概况

**R02 尚未满足完整功能交付与验收要求，建议进入 CHANGES_REQUESTED → FIX_VALIDATION，不能认定 READY 或 ACCEPTED。** 快照模型、确定性 hash、后台 PostgreSQL API、UPDATE 拒绝、默认 300 fixture 质量拒绝及 Storage 基础能力存在，但可信 hash/时间/血缘边界、策略交易规则硬约束、租户读取路径和失败补偿仍有已复现缺陷。

本次发现 **13 项问题：阻塞级 1、高危 5、中危 6、低危 1**。这些问题均为 OPEN；性能、覆盖采集范围及历史证据边界另行说明。没有把原 R01 的 B01/FA-H01 复制为 R02 缺陷，也没有因 R01 尚未正式 ACCEPTED 就要求停止所有研发。

| 统计对象 | 实际结果 | 口径 |
|---|---:|---|
| 计划开发标记 | 1/1，100% | `development_status=COMPLETED`，仅为原登记 |
| 本轮 28 个全量检查点 | **11/28，39.29%** | PASS 11、PARTIAL 11、FAIL 6；不将 PARTIAL 折算半分 |
| 开发/联调功能检查点 | **11/27，40.74%** | 剔除发布性能检查 C25；其余 PASS 11、PARTIAL 10、FAIL 6，不表示工时完成率 |
| 三项量化标准的限定样例 | 2/3，66.67% | 等价输入 hash 与默认规则下 300 fixture 通过；实际 SQL P95 未达目标。默认样例通过不证明规则可任意放宽后仍安全 |
| R02 阶段准入 | 0/1 | 现行 `DEVELOPMENT / NOT_ASSESSED`，本轮不自行登记 READY |
| R02 正式验收 | 0/1，0% | 计划历史复审为 NOT_STARTED；本报告建议整改，不自行签署 |

28 项为本次从需求及工程规范拆分的检查点，不是新增开发任务。报告评估 R02 源码、数据库/Storage 适配器、质量 Gate、策略/Runtime 调用边界、测试及文档；不宣称完成 R1、所有 BFF 页面、R03 Engine 或实盘交易验收。

R01、F06、CORE-GATE:F0 的当前阶段记录均为 NOT_ASSESSED。历史 COMPLETED/ACCEPTED 及 F05 Storage 回执保留，不能自动转移成当前功能准入。依赖应按当前 `stage_gate` 和实际用途评估；纯性能欠项移交 RELEASE，不放宽当前正确性、权限与完整性要求。

## 二、完成情况明细统计

### 2.1 逐项核对矩阵

PASS 表示本项限定范围有充分证据；PARTIAL 表示部分能力存在但完整边界/联调/证据未闭合；FAIL 表示已复现违反要求的行为。代码路径相对仓库根目录；下文 `base migration` 指 `supabase/migrations/20260731100000_data_snapshots_and_quality_gate.sql`，不可变迁移为 `supabase/migrations/20260916140000_r02_snapshot_immutability.sql`。

| ID | 需求、规范或交付检查点 | 结果 | 实现、证据及边界 |
|---|---|---|---|
| C01 | R01/F06/F0 依赖与阶段准入 | PARTIAL | 历史记录存在，当前前置 stage_gate 均未登记 READY；`check-r02` 只检查部分 COMPLETED 标记，不能代替准入评估 |
| C02 | snapshot Rust API 与模型字段 | PASS | `DataSnapshotInput/Record`、constructor、id/hash/symbol 查询及 quality API 存在；这是库 API，不等同于已交付 BFF HTTP 页面链 |
| C03 | 相同输入产生相同 hash | PASS | 排序、canonical JSON、SHA256；原有等价输入重排/JSON key 顺序测试本轮通过。不同 artifact ID 是不同输入，不将其误判为该标准失败 |
| C04 | hash 与实际快照内容保持可信一致 | FAIL | 公共字段/serde 可改质量及 expiry 而保留 hash；原生 PG 保存、冷读后 Gate 仍允许，H01 |
| C05 | PostgreSQL 去重与已有行 UPDATE 拒绝 | PASS | 同 tenant/hash 冲突不改写原行；目标触发器 SQLSTATE 55000；不推导为任何新输入都已校验 |
| C06 | 时间/schema/quality 基础类型与错误枚举 | PASS | UTC DateTime、SchemaVersion、quality/usage parse、反向窗口/负 age/空 schema 的既有拒绝测试通过 |
| C07 | capture/window/observed 时间关系 | PARTIAL | 基础 start≤end 检查存在，未来 capture、window end 超过 capture 仍可用于策略/交易，H03 |
| C08 | age/expiry 的确定性错误与资源边界 | PARTIAL | 非负值检查存在，极大正值触发 panic；expiry 可绕过派生关系，M02/H01 |
| C09 | 来源、许可证、血缘完整性与可追溯性 | PARTIAL | 检查 vec 非空/许可证字符串非空；空 provider/source/dataset、空 lineage 元素仍允许，H04。label 本身不证明获准用途 |
| C10 | schema 及关联引用的租户一致性 | FAIL | tenant A snapshot 可引用 tenant B 的不匹配 schema 注册项，目标事务实测，H05 |
| C11 | snapshot 元数据与质量规则持久化 | PASS | 目标 SQL 持久查询与规则写入执行；原生 PG 快照写入/冷读也执行。可信内容与策略安全分别由 C04/C16 判定 |
| C12 | 两张表 RLS 启用、force、迁移版本 | PASS | 目标 flags 和两项 migration SHA 与仓库一致；不是成员访问通过的替代证据 |
| C13 | 真实成员可读、跨租户拒绝的完整权限路径 | FAIL | authenticated 的成员正向 SELECT 返回 42501；authenticated/BFF/service_role 均无快照 SELECT grant。跨租户测试被正向失败中断，不能将全拒绝称作隔离完整通过，B01 |
| C14 | 默认规则下 300 个非法 fixture 拒绝 | PASS | 100 过期、100 Failed、100 缺总许可证，各对 Strategy/Trading 判定，共 600 个拒绝断言通过 |
| C15 | 缺规则、跨 tenant 规则的默认拒绝 | PASS | 缺失或 tenant 不匹配时 RuleMissing；既有行为测试通过 |
| C16 | 策略/交易不可关闭的质量/时效/许可约束 | FAIL | allow_failed=true、require_license=false、require_freshness=false 可使三类非法条件同时获准；数据库也接受该 trading rule，H02 |
| C17 | 重复规则与配置冲突确定性 | FAIL | 同 usage 后项静默覆盖前项；调换顺序即可改变过期判断，M01 |
| C18 | Strategy/Runtime 消费质量 Gate | PARTIAL | Strategy validation、Research、SignalProposal 的内存目录调用存在且单测通过；未闭合实际 R01→可信快照→持久规则→消费者链，不声称 Trading 生产链已完成 |
| C19 | 实际 Supabase Storage 上传/登记/读取 | PASS | 原生探针在配置项目完成基础往返，有准确对象 key/数据比对；整个探针套件另有失败，不将该分项 PASS 写为整体 PASS |
| C20 | 上传前、读取后的 payload hash 检查 | PASS | 源码两侧校验；当前 unit 与真实往返字节一致。不能据此证明任意 manifest 路径/关系都合法 |
| C21 | 登记失败补偿不伤害既有对象 | FAIL | 复用既有路径后登记失败，补偿 DELETE 删除之前已登记对象，manifest 留存；独立读回确认缺失，M03 |
| C22 | 受影响包 fmt/Clippy/原有功能单测 | PASS | fmt、三个 crate all-targets Clippy 零 warning；显式跳过环境加载的本地 R02 suite 通过，目标早返不充作数据库验收 |
| C23 | 成功/拒绝/恢复的行为 Gate 与故障覆盖 | PARTIAL | 原 12 个 JS 负向主要破坏字符串；正常 Gate 通过时本次 8 类坏行为仍可复现。缺新边界回归、目标成员权限与补偿所有权断言，M04 |
| C24 | 覆盖率与可审计范围 | PARTIAL | 本轮 file summary：snapshot line 93.28%/region 92.54%，含内嵌单测；PG 本地 0%，Storage 41.40%/37.04%。没有重采目标覆盖或独立生产行口径；不以汇总/历史覆盖替代，M04 |
| C25 | 查询 P95 <300ms（RELEASE） | PARTIAL | 实际 SQL 25 次 P95 669.563ms；小样本/跨区域开发链诊断，尚未正式性能验收。原 live test 25 次读已命中内存缓存，不能证明 PG 指标，M05 |
| C26 | 接口/协议与跨模块兼容证明 | PARTIAL | protobuf/serde/库契约存在，未找到 DataSnapshotRecord 到带 CommandMetadata 的 wire 对象的完整映射与当前服务集成回执；后续 API/消费者联调须明确承接 |
| C27 | snapshot/规则写入审计与可观测性 | PARTIAL | Storage 有 F09 outcome metric；snapshot/规则写入 API 不含执行 actor/correlation、未连 atomic audit/event/outbox，M06。测试 actor 的创建不等于业务写入已审计 |
| C28 | 运维、回滚与可复制文档 | PARTIAL | storage README 存在；“fresh disposable PostgreSQL”与当前 AGENTS 约束冲突，本地 Gate 自动加载环境，缺少区分历史 summary 与当前目标入口的交付指引，L01 |

### 2.2 本轮执行与目标结果

证据目录：[r02-review-20261007](./evidence/r02-review-20261007/README.md)，机器索引：[index.json](./evidence/r02-review-20261007/index.json)。所有探针是审计资产，临时 Rust test 接线已移除，没有修复业务源码。

| 执行 | 结果 | 不能外推的边界 |
|---|---|---|
| 原 `make r02-check` | 失败：自动加载 DATABASE_URL 后 Runtime admin-role 单测连接条件不满足；原日志保留 | 环境失败不归为 R02 算法缺陷，也不声称默认 Gate 完全本地隔离 |
| `QUANTOS_SKIP_ENV=1 make r02-check` | PASS：Node 12、storage 13、runtime 12、strategy 16 | Runtime 中依赖 DB 的早返不计目标通过；不等于 R03 orchestration 或实际 trading 联调 |
| 独立 Rust 边界探针 | 9/9 断言通过：8 个坏行为复现、1 个 expiry 相等边界观察 | 通过代表缺陷可复现；相等时仍有效符合当前实现，此处仅记录，未擅自作为额外缺陷计数 |
| Supabase 事务探针 | 6 项中 5 PASS、1 FAIL；跨租户 schema、宽松 trading rule、hash/expiry 缺约束复现；全部 fixture ROLLBACK | SET ROLE + transaction-local claims，不是外部 Auth JWT HTTP；当前成员正向失败，完整 RLS 正负链不 PASS |
| 原生适配器 target，按原配置 session pool | 2 个审计 test 中 1 PASS（坏 hash/expiry 持久化复现）、1 FAIL；基础 Storage 往返通过 | Storage test 的“缺失必须 HTTP404”断言失败；独立读回为 HTTP400、body statusCode=404/Object not found，证明对象已缺失，失败日志不改写为 PASS |
| 两次事务池原生探针 | 分别 240s、120s 超时，原始失败保留 | 涉及命名语句/连接模式等因素；未证明具体原因，不归因于数据库性能或忽略为绿。生产拓扑使用前应单独验证连接模式与超时 |
| fmt、Clippy | PASS | 仅受影响包，非全工作区回归 |
| 本地 LLVM 覆盖采集 | PASS（采集成功） | 门槛是否满足按文件及口径判定，采集成功不等于目标 coverage PASS；nightly 分支本轮未采集 |
| 历史 F05 Storage/覆盖 | 历史真实往返存在 | `48d8376` 后 pg/Storage 及测试已变，不能把旧整个回执改绑本次 HEAD |

查询采样使用真实 SELECT round trip，25 次、事务内 2 个 fixture snapshot，不经过 Rust cache；P95 采用 nearest-rank。该基线的 669.563ms 不作为本轮开发停工理由，正式 <300ms 由 RELEASE-GATE:BETA 在目标规模与部署环境验收。新发现的数据可信度/权限/恢复问题须先修复，不能作为性能优化后置。

### 2.3 范围与收尾

全部数据库操作直接使用已配置 Supabase，没有本地数据库、容器、reset 或既有数据删除。SQL/RLS fixture 及临时 auth/member 行全部事务回滚。原生探针保留 4 个专用审计租户、3 个 actor、1 个负向快照及相关 manifest/metric；3/3 actor 均独立确认 inactive。临时对象均已确认不存在，补偿删除与审计清理分开记录，未访问或删除其他租户对象。

首个原生失败在 actor 创建前停下，保留一个空测试租户；第二次失败留下 active actor，由本轮显式收尾停用，不伪装成自动成功清理。第三次的两个 actor 由 guard 停用并独立复核。无真实市场数据或扩大的 Binance 运行；未执行远程 CI、部署/长期窗口、整库重建、全 SCA/Buf/三语言生成或正式签署。

## 三、问题清单及风险分析

严重度按对 R02 功能、数据可信度和服务验收的影响分级，不是 CVSS。以下每项均 OPEN；源码行号对应本报告基线。

| ID / 优先级 | 所属模块、源码位置 | 具体表现与证据 | 影响范围 |
|---|---|---|---|
| **B01 / 阻塞级** | PostgreSQL 权限 / 可用 snapshot 查询路径；base migration:52–81、`pg.rs:245–297` | 两表 enable/force RLS、member policy 存在，但目标 authenticated 无 schema usage/SELECT，BFF 无 SELECT，service_role 也无快照权限；成员正向读取 42501，仅管理连接库查询可用 | R02 所需租户可见性/服务查询无法验收。应交付明确的受限查询角色/服务授权路径，不能用管理连接加 tenant 谓词代替成员 RLS。不是要求所有前端页面本轮完成 |
| **H01 / 高危** | 快照内容 hash / serde / PG 映射；`snapshot.rs:194–259,308–355`，`pg.rs:183–239,444–475` | Record 所有字段公开并直接 Deserialize；质量/expiry 改动后 hash 不变，constructor 校验可绕过。目标 native 将任意合法格式 hash、30 天 expiry 与 max_age=120 保存并冷读，Trading Gate 在一天后仍允许 | 快照引用与实际语义不再一致，去重/重放与交易质量判断失去可信输入。未宣称外部攻击者已利用或实际交易已受污染 |
| **H02 / 高危** | 质量规则硬约束；`snapshot.rs:117–156,324–350`，`pg.rs:339–370` | 可用配置关闭 Strategy/Trading 的 license/freshness 检查并 allow_failed；坏质量、过期、无许可同时获准；DB trading rule 也可写入此配置。现有 optional-license test 甚至明确允许策略/交易无许可 | 默认 300 fixture 通过无法保证交易安全；缺强制底线和受控例外范围，不得将可调研究规则直接复用为交易放行 |
| **H03 / 高危** | 时间窗/新鲜度；`snapshot.rs:222–239,263–265,347–349` | 只检查 end≥start、age≥0；未来一年 captured_at、未来数据窗或 window end>capture 都可用；freshness 只依赖可声明的 captured/expiry | 可把未来数据或陈旧来源重新标为新鲜；影响无 look-ahead 的研究/策略可信度。只证明构造/Gate 接受，不断言下游已发生 look-ahead 事故 |
| **H04 / 高危** | 来源、血缘、schema/对象元数据；`snapshot.rs:224–258,327–346` | sources/lineage 只检查容器非空；空 source_id/provider/dataset、空 lineage kind/reference/null details 仍允许；artifact_refs/symbols 为空和未知 schema_name 也可获准 | 无法保证可重放输入、有效来源/许可或可解析血缘。仅非空 license_label 不提供批准/适用用途证明；需要明确字段语义和真实引用验证 |
| **H05 / 高危** | 引用租户/schema 完整性；base migration:6，`pg.rs:193–216` | schema_entry_id 仅对全局 id 做 FK；目标 tenant A 快照引用 tenant B 的 UnrelatedContract/v9，快照仍称 DataSnapshot/v1。artifact refs/lineage JSON 也未在当前写入/Gate 中解析验证 | 租户隔离停留在顶层行，跨租户关联可成立、schema 声明与注册项不一致；用户读取策略不能替代写入引用约束 |
| **M01 / 中危** | ruleset 配置；`snapshot.rs:272–277` | 相同 usage collect 到 BTreeMap，后项静默覆盖；strict/relaxed 顺序不同即可改变过期结果；无重复或混 tenant 配置错误 | 同一配置集合结果依赖排列，误配可能放宽策略；应返回可诊断冲突，不让配置覆盖悄悄生效 |
| **M02 / 中危** | constructor 错误与资源边界；`snapshot.rs:225–239` | `i64::MAX` 触发 TimeDelta::seconds panic；9e12 秒触发 DateTime 加法溢出，Result API 未返回 SnapshotError；容器也没有明确输入预算 | 无效输入可使同步调用或 worker 崩溃，影响恢复。两个 panic 已复现；无界容器为源码风险，未做 OOM 压测 |
| **M03 / 中危** | Storage 登记/补偿；`supabase_storage.rs:20–33,129–147,176–181` | 默认 upsert=true；上传到既有 key 后登记失败即无条件 DELETE，未确认对象由本次新建。新 tenant 的失败 manifest 保留同 owned object key，真实补偿删掉原已登记对象；metadata 留存、独立读回 Object not found。cleanup 错误只记 metric，返回原 Persist error，无 durable 修复任务 | 重试/错误 manifest/共享路径可导致已有对象丢失和悬空引用；hash 检查能拒绝坏读取，却无法恢复已删对象。复现只操作审计临时对象，没有删除业务对象 |
| **M04 / 中危** | 测试 Gate / 覆盖；`scripts/check-r02.mjs:33–82`、`r02-gate-negative.mjs`、Makefile:132–140 | JS 多为 marker 存在检查；核心坏输入在 Gate PASS 时仍复现。默认库测试不含当前目标 RLS/补偿边界；本地 PG 0%、Storage region 37.04%，R02 没有完整当前目标/独立生产行覆盖证明 | 不能阻止上述回归；有 CI/F05 历史覆盖不等于 R02 新边界通过。nightly 是发布义务，本轮未采集不另算开发缺陷 |
| **M05 / 中危** | P95 验收测试；`postgres_persistence.rs:234–251`，`pg.rs:245–254` | persist/get 已填 cache，随后同 store/id 的 25 次 get 直接 cache return；P95 测的是内存 clone，非 PG query。独立真实 SQL P95 669.563ms | 既有绿色性能断言不能证明计划的真实查询指标；修复测量入口即可，当前不要求持续调优跨区域链路或删除原失败 |
| **M06 / 中危** | snapshot/规则写入审计；`pg.rs:183–240,339–377` 与两项 snapshot migration | 写入入口/表不保存执行 actor/correlation，规则更新仅 updated_at；未找到快照创建/规则放宽的 atomic audit/event/outbox 链。protobuf 所需 CommandMetadata 也未映射到这些写入 | 难以回答谁、为何、在哪次请求改变质量准入；规则可变时不能靠 fixture actor 或 Storage outcome metric补齐业务审计 |
| **L01 / 低危** | storage README / R02 交付指引 / 命令边界 | README 推荐 fresh disposable PostgreSQL；`make r02-check` 自动 include 环境，实际触发 Runtime 目标连接，未显式 skip 时并非完全 local-only。历史 summary 的旧计数与 NOT RUN 是当时事实，当前 README 缺少独立的目标/本地入口及新结果说明 | 易误执行禁止的本地数据库路径或把环境/早返当功能 PASS；保留历史 summary 不构成缺陷，需完善当前交付指引 |

风险主要由两条路径构成：不可信快照字段/规则仍获准 → 策略或研究使用不合格输入；对象先上传、登记失败 → 删除既有对象、留下不可用引用。顶层租户谓词、RLS flags、高本地覆盖或 300 个固定拒绝样例，均不能覆盖这些缺陷。实际业务用户/交易损害未验证，不能将潜在影响写为既成事故。

## 四、整改建议

1. **B01、H01、H02 优先处理。** 明确 snapshot 查询 API 的授权主体与最小权限（受限 backend/成员模式），在现有 Supabase 验证真实成员可读、非成员/跨租户拒绝、规则修改权限。保留 public schema 默认拒绝，不以广泛开放表权限替代服务授权。Record 改为受控构造/反序列化，在写入、冷读及使用边界验证 canonical hash、派生 expiry、schema/引用一致性。Strategy/Trading 设不可关闭的质量/时效/许可底线，研究例外明确用途，不静默放宽交易约束。
2. **H03–H05 收口时间和血缘。** 用可信 observed clock 校验未来偏移、窗口与 capture/source age；复用 R01 的 quality/批准版本及 source facts，不将快照新建时间当源数据新鲜度。校验来源/lineage 必填内容、序列范围和 artifact 关系；schema 关联采用 tenant 组合约束或明确共享授权，并验证名称/版本。可选空 artifact/symbols 的用途须形成明确契约；策略/交易的数据依赖必须可解析。
3. **M01–M03 修复配置、错误和恢复语义。** 重复规则返回 Result 错误；checked_add/受控 age 和输入预算代替 panic。对象登记先验证 tenant/path/hash/manifest，使用新建所有权或临时对象 promotion；补偿不得删除既有 key。失败 cleanup 应有持久、可重试、具名且可审计的 repair 状态，不吞掉未知结果。连接模式、SQL/Storage 超时及取消后副作用按实际部署拓扑补测，不把本次事务池失败直接改成 production PASS。
4. **M04/M06 补齐功能回归和审计。** 把本报告探针改成预期拒绝/安全恢复的自动化用例；引入能实际执行坏变更的行为 Gate，分别验证 source/hash/tenant/time/规则放宽/对象补偿。覆盖按生产代码与本地/目标分别报告，新增功能门槛不依靠历史聚合值。快照创建与规则变化连到 F05 审计/事件链，包含有效 actor、tenant、correlation、版本、原因和原子提交。
5. **M05 与发布性能分开。** 修正 warm-cache、fresh adapter、真实 SQL、列表/按 hash 查询的测量口径，先保存查询规模/索引/网络环境和基线。<300ms 由 RELEASE-GATE:BETA 完整验收；先完成正确性和必要联调，避免为了报告关闭反复长跑或过早调优。
6. **L01 同步交付文档。** 删除禁止的本地数据库建议，显式说明 `QUANTOS_SKIP_ENV=1` 的功能入口、目标入口的副作用/fixture 保留/失败目录，补 snapshot 运维与回滚（向前修复、保留不可变事实）。更新摘要的当前结果，但历史证据保持原 SHA、原结论；修复后再复审并按[单用户确认流程](../gate-records/user-acceptance-confirmation-workflow.md)准备阶段/正式确认，不自行批准。

本轮只完成检查报告和审计证据，未改业务源码或计划状态，未生成代码修复提交。建议先修复可证明的功能问题，再复核 R02 DEVELOPMENT 的输入、前置阶段与用途；不要等性能/部署全部闭合才推进后续功能，也不要用发布阶段安排推迟当前数据正确性修复。
