# R01：Market ingestion 与标准化行情契约全面复审报告

## 一、任务完成概况

| 项目 | 本次复审基线 |
|---|---|
| 日期 | 2026-10-02（Asia/Shanghai） |
| 依据 | [开发计划 v3.19](../SumAlpha-QuantOS-Development-Plan.md#task-r01)，含 §2.2 最低完成条件、§2.3 测试资产、§2.4 Supabase 基线 |
| 配套规格 | [架构](../SumAlpha-QuantOS-Architecture.md)、[技术方案](../SumAlpha-QuantOS-Technical-Solution.md)，Market Service、事件可靠性、质量降级与可观测性要求 |
| 源码提交 | `296ffc2f1b98e6266a3a83e4716b8f6b99ecfa16` |
| 初始工作树 | clean；本次仅新增报告和复审证据，不整改业务代码、不修改计划状态、不提交或推送 |
| 范围 | `crates/quantos-market`、`services/market-ingestor`、replay catalog、R01 Gate/CI、关联事件账本与核心数值类型 |
| 原记录 | `development_status=COMPLETED`，`review_status=NOT_STARTED`；[历史摘要](../R01-summary.md)与[2026-09-16 证据](./R01-acceptance-evidence-2026-09-16.md)明确限定仓库来源层 |

**复审结论：R01 尚不满足服务验收，建议进入整改验证（FIX_VALIDATION），不能认定为 ACCEPTED。** 确定性 10 万条 JSONL replay、基础字段与本地领域转换已经存在且本次复验通过；服务入口仍只提供 replay CLI，事件和去重状态仅驻留内存。写入失败重试、身份冲突、symbol 歧义与部分质量异常路径存在可复现缺陷。既有本地 Gate PASS 不足以证明服务验收完成。

依赖方面：计划中的 F03/F05 均为 ACCEPTED；F0 历史 main `91e222f744fd350ab9db80ba7554bd1fee9194fa` 为 7/7 PASS，证据见 [F0 索引](./evidence/f0-91e222f/index.json)。本次 `git diff 91e222f… HEAD -- crates/quantos-market services/market-ingestor crates/quantos-event crates/quantos-core` 无差异，未发现相关源码依赖回退。此为仓库记录与源码差异检查，没有重新执行 F0 远程验收，亦不将历史回执改绑到本次 HEAD。

### 完成率口径

| 统计对象 | 结果 | 解释 |
|---|---:|---|
| 计划中 R01 开发标记 | 1/1，100% | 仅反映原文标记，不是本次验收结果 |
| 本次 24 个复审检查点完整通过率 | **8/24，33.33%** | PASS 8；PARTIAL 13（54.17%）；FAIL 3（12.50%）；部分通过不折算半分 |
| 计划三项量化标准严格完整通过率 | **1/3，33.33%** | replay PASS；去重 PARTIAL；异常 ≤5s PARTIAL，详见下表 |
| R01 任务正式验收完成率 | **0/1，0%** | 任务为不可拆分验收单位，仍有阻塞项；不是“代码完成度为零” |
| 新增边界探针 | 10/10 复现成功 | 探针断言现有问题行为；通过意味着缺陷被复现，不能计入验收 PASS |

24 项是本报告从技术要求、交付物、量化指标和通用规范拆出的等权检查点，便于复核，不是计划新增的 24 个开发任务，也不代表工时完成率。此报告不评估 R02–R04、U01 或 R1 完整阶段 Gate；R01 服务验收不能替代页面/E2E 闭环。

## 二、完成情况明细统计

### 2.1 逐项检查矩阵

PASS：本项限定范围已有实现且本次证据充分；PARTIAL：部分实现或证据通过，但完整路径/指标未满足；FAIL：缺少必须交付的路径或已复现违反要求。

| 编号 | 要求/检查点 | 状态 | 当前实现、测试与验收边界 |
|---|---|---|---|
| C01 | F03/F05/F0 前置依赖 | PASS | 历史 ACCEPTED 记录、F0 索引存在；相关依赖源码无差异；不声称远程重验 |
| C02 | `quantos-market` 交付 | PASS | workspace、crate、公开契约、5 项 Rust 单测均存在 |
| C03 | ingestor 服务交付 | PARTIAL | replay generate/ingest CLI 可运行；无真实 provider 摄取/恢复入口，B01 |
| C04 | replay dataset 交付 | PASS | 固定 catalog 可生成 100,000 行；本次 CLI 实际执行成功 |
| C05 | symbol 归一化 | PARTIAL | ASCII/分隔符校验及大写转换通过；不同币对分区可碰撞，无标的映射，H03 |
| C06 | 时间标准化 | PARTIAL | UTC typed timestamp；只比较输入 `received_at/event_time`，缺实际处理 clock 和无 tick 检测，M01 |
| C07 | 数值精度 | PASS | `Quantity/Decimal`；scale ≤12，禁止负值；`100.1250` 精度单测通过；超过约定精度拒绝。异常路径另计 C10 |
| C08 | 来源、dataset、许可证 | PARTIAL | 事件包含 provider/dataset/license；来源 ID 和 registry metadata 未完整校验，H02/M02 |
| C09 | 仅批准 provider | PARTIAL | 未知 provider 拒绝已测；默认批准为硬编码参考配置，缺审批凭据/撤销与配置校验，M02 |
| C10 | 质量归一化及异常路径 | PARTIAL | 正值正常、零值/未来偏移可降级；负值/非数值直接返回错误，无质量事件，H04 |
| C11 | `MarketEvent` 转领域记录 | PASS | typed event → RecordedEvent；tenant/actor/correlation/causation、schema、payload hash 可生成；仅领域内存范围 |
| C12 | 可靠写入 `MarketEvent` | FAIL | CLI 创建内存 AppendOnlyLedger，进程结束事件丢失；没有接入 F05 PostgreSQL/outbox，B01 |
| C13 | 10 万条解析成功率 100% | PASS | JSONL round-trip 单测、本次 CLI 均成功；100,000 input，94,737 unique，5,263 duplicate |
| C14 | 重复数据正确去重 | PARTIAL | 单进程同 provider/ID 基础重复通过；身份冲突静默丢弃、跨 tenant 共用键、空 ID 可用、重启重置，H02/B01 |
| C15 | 乱序数据基础处理 | PASS | fixture 交换相邻 tick；24 条样例 19 unique/5 duplicate；保留 event_time。限乱序输入不重复丢失；不宣称投影排序/重启闭环 |
| C16 | 新鲜度/质量异常 ≤5s 发出 | PARTIAL | 单函数即时生成零值/过时 tick 异常且耗时 ≤5s；未测从真实异常发生至持久提交/消费，H04/M01/B01 |
| C17 | 写失败后安全重试 | FAIL | 去重键先于 append 提交；append 失败后重试计为 duplicate，丢失事件，H01 |
| C18 | 重复/乱序/重启/死信闭环 | FAIL | 前两类仅内存样例；重启丢去重与序号；没有 R01 死信重放入口和对应验收，B01/H01 |
| C19 | 成功/拒绝/恢复自动化测试 | PARTIAL | Rust 5、JS Gate 9；CLI Rust 0；F09 batch smoke 有成功/trace sink 拒绝断言，但不能覆盖 provider/replay 错误和恢复，M03 |
| C20 | Rust fmt、Clippy 无 warning | PASS | 本次 fmt 与相关两个 package 的 `--all-targets --locked -- -D warnings` 成功 |
| C21 | 覆盖率与可破坏 Gate | PARTIAL | 本地 market line 96.37%/region 94.61%；CLI 为 0%；CI 不强制 market 覆盖门槛，nightly branch 未验，M03 |
| C22 | 纯领域 P95 <50ms/异步 deadline | PARTIAL | 本次 10 万 replay 测试约 5.9s，不能转换为 P95；未取得逐调用分布或异步摄取 deadline 证据 |
| C23 | 安全、锁与协议质量检查 | PARTIAL | secret-pattern 与锁检查 PASS；协议字段可序列化，无本轮协议修改；未重跑全量 SCA/Buf/SDK/工作区套件 |
| C24 | 日志/trace/指标/健康/运维 | PARTIAL | 统一 batch wrapper、强制 trace sink、共享健康端点及 Runbook 存在；真实摄取指标、恢复/回滚说明不足，M01/B01/L01 |

### 2.2 三项量化验收

| 计划原指标 | 本次观察 | 判定 |
|---|---|---|
| 10 万条 replay 事件解析成功率 100% | 单测解析 100,000 条；CLI input=100000，recorded_events=96303，anomalies=1566；生成器故意替换 tick 注入重复，输入数不同于输出事件数 | PASS，限固定 replay |
| 乱序/重复数据正确去重 | 基础 24 条与 100,000 条样例通过；重启、同 ID 内容变化、tenant 边界和写失败重试未正确处理 | PARTIAL |
| 新鲜度/质量异常在 ≤5s 内发出事件 | 原单测测量两次同步函数调用的总耗时；未连接真实源，未包含持久提交/消费者，负数/不可解析 tick 无质量事件、断流无检测 | PARTIAL |

真实 provider、Supabase 事件写入、跨进程交付及目标环境时限：**NOT RUN / NO RECEIPT**。既有 F05 的数据库验收证明通用事件设施，不证明 R01 已连接它。本次没有启动本机数据库、容器或 Supabase CLI，没有连接或修改任何数据库。

### 2.3 本次执行证据

证据目录：[r01-review-20261002](./evidence/r01-review-20261002/index.json)。全部对应上述源码 SHA；报告与证据本身为未提交新增文件。

| 命令/资产 | 结果与证据 |
|---|---|
| `make r01-check` | PASS：JS 9/9、market Rust 5/5、ingestor 0 test，见 [日志](./evidence/r01-review-20261002/r01-check.log) |
| 独立边界探针 | 10/10 复现，见 [源码](./evidence/r01-review-20261002/boundary_probes.rs)、[日志](./evidence/r01-review-20261002/boundary-probes.log)；临时 test 接线已删除 |
| `cargo llvm-cov -p quantos-market -p market-ingestor --locked --json --summary-only` | [JSON](./evidence/r01-review-20261002/coverage.json)、[日志](./evidence/r01-review-20261002/coverage.log)；仅原有测试，不含审计探针/单独 CLI 执行；stable branches count=0 表示未采集，不能当分支覆盖率 0% 或 PASS |
| 覆盖率细节 | market 505/524 lines、720/761 regions；CLI 0/48 lines、0/84 regions；按文件报告，不使用依赖汇总掩盖 CLI；未提供排除测试代码的独立生产行口径 |
| CLI generate/ingest 100,000 | [生成日志](./evidence/r01-review-20261002/cli-generate.log)、[摄取日志](./evidence/r01-review-20261002/cli-ingest.log)；使用 `/private/tmp` 文件及显式 trace exporter，未使用 provider/数据库凭据 |
| fmt、Clippy | [fmt](./evidence/r01-review-20261002/fmt.log)、[Clippy](./evidence/r01-review-20261002/clippy.log)，均退出 0；fmt 成功日志为空 |
| secret-pattern、计划结构 | [secret](./evidence/r01-review-20261002/secrets.log)、[计划](./evidence/r01-review-20261002/plans.log) PASS；计划工具的 model/platform NOT_RUN 不替代本次人工式源码复审 |
| 锁检查 | [首次](./evidence/r01-review-20261002/lockfiles.log)遇 uv cache 权限；[重试](./evidence/r01-review-20261002/lockfiles-retry.log)受系统 pnpm 版本影响；使用临时 UV_CACHE_DIR 与 Corepack pnpm 10.20.0 的[最终检查](./evidence/r01-review-20261002/lockfiles-final.log)退出 0、全部锁匹配。pnpm 更新查询 DNS 失败为非致命提示；不声称联网元数据检查通过，未修改锁文件 |

未执行：全工作区 Rust/Python/TS 测试、nightly 分支覆盖、完整依赖安全扫描、Buf/SDK/浏览器回归、真实 provider/目标数据库验收。R01 本轮不涉及新增 Web 页面，浏览器回归也不计为 R01 核心交付缺陷。上述未执行项不记录 PASS；本次采取相关 Rust 包的聚焦检查，避免把有限检查扩写为全工程验收。

## 三、问题清单及风险分析

共 **10 项未关闭问题：阻塞级 1、高危 4、中危 4、低危 1**。级别按对 R01 服务验收、数据完整性与研究数据可信度的影响确定；不是 CVSS 安全评分。具体表现与推导的下游影响分开记录。

| ID/优先级 | 所属模块及源码位置 | 具体表现与证据 | 影响范围/风险 |
|---|---|---|---|
| B01 阻塞 | ingestor `main.rs:80–95`；market `lib.rs:200–215`；event `lib.rs:197–204` | 只生成/读取 replay；每次创建随机 tenant、actor、内存 ledger/去重/序号；无真实 provider 接口、PostgreSQL/outbox 接线或断线补偿。探针 `restart_reaccepts_duplicate_and_resets_sequence` 重启后同 tick 再接受、sequence 再从 1 开始 | 无法交付可恢复的数据服务；退出丢全部市场事实。通用 F05 已完成不能代替 R01 接入。真实源与目标服务回执缺失阻止 ACCEPTED |
| H01 高危 | market `lib.rs:256–258,321–326,343–360` | 先提交 seen key/递增 sequence，再 append；不是原子事务。探针先由 A 写第一个 tick，B 向同 ledger 写第二个 tick 因序号冲突失败，B 重试却报 duplicate=1、recorded=0，ledger 仍只有第一条 | 发生 append 错误后无法安全恢复，静默丢数据；异常多事件批次也无事务原子性保证 |
| H02 高危 | market `lib.rs:227–233`；RawMarketTick `lib.rs:70–79` | key 只有 provider/source ID；无 tenant、内容 hash 或 ID 非空约束。同 ID 改价为 999 被直接 duplicate，tenant B tick 被 tenant A 的键压掉，空 ID 首次正常接受，三个独立探针复现 | 供应商重复 ID/更正/空 ID 会静默丢事实；API tenant 参数与去重隔离不一致。一期单主租户降低跨租户触发概率，但不消除 ID 冲突缺陷 |
| H03 高危 | market `lib.rs:438–458` | 只删除分隔符拼接；`AB/C` 与 `A/BC` 均为 `ABC`；`BTC/USDT/EXTRA` 也接受。无 provider instrument map 或唯一标的语义约束 | 归一化不能保证市场身份唯一；碰撞会共享 aggregate stream，并可能污染下游研究/快照。固定 BTCUSDT/ETHUSDT fixture 未覆盖此问题 |
| H04 高危 | market `lib.rs:236–247,297–318`；core `precision.rs:72–83` | 负数先被 Quantity 拒绝，因此 `price.value() <= 0` 的负值分支实际上不可达；负价格返回 MARKET_INVALID_PRICE，无 QualityFailed。不可解析数值也直接错误；batch 第一条错误即中止 | “非正值产生 quality failure”摘要与实际行为不一致；非法行情不能形成独立质量事件/隔离记录，后续批次 tick 无法继续处理，异常验收覆盖不足 |
| M01 中危 | market `lib.rs:241–244,324`；五秒测试 `lib.rs:625–682` | freshness 只比较输入两时间；2026-01-01 的 tick 两时间相等仍 Passed（探针复现）。未传入处理 clock，无断流 watchdog；异常 occurred_at 使用输入 received_at；≤5s 测试只计函数耗时 | replay 中使用历史时间合理，但实时部署仍无法区分旧 tick 重放/处理积压/断流；缺跨进程告警 deadline 证据，不能外推目标环境 ≤5s |
| M02 中危 | market `lib.rs:28–68` | registry 构造无校验，重复 provider 覆盖前项；允许空 dataset/license 和负 freshness/skew。非法 metadata 探针仍能输出事件；默认批准是 internal-approved 字符串，无审批记录 | allowlist 拒绝未知名的能力存在，但配置治理不完整；来源许可证与质量门槛不能独立验证。未证明真实供应商未获授权，仅证明批准证据/配置检查缺失 |
| M03 中危 | `scripts/check-r01.mjs:34–65`、Makefile `r01-check/coverage-rust`、CI R01 step | JS Gate 主要检查字符串/文件存在，9 项破坏探针修改文本而非执行运行时语义；本次严重边界问题存在时它仍 PASS。未检查新增 F0 ACCEPTED 依赖；CI 通用 coverage-rust 不含 market；CLI 原生测试为 0、原测试采集覆盖 0%；F09 smoke 仅补少量成功/trace 拒绝路径 | 测试资产不足以阻止已复现缺陷回归；计划开发状态检查不能替代独立验收。稳定覆盖数字较高也不说明拒绝/恢复正确或 nightly branch 合规 |
| M04 中危 | market `lib.rs:468–477`；read JSONL `lib.rs:533–544` | 公开 replay spec 可传空 symbols，count=1 时除零 panic，探针复现；JSONL 全量收集、去重 set/ledger 无边界。默认 catalog 合法，不触发此 panic | 可配置 fixture 调用者会崩溃；大 replay 或长期摄取缺资源上限/流式消费。资源风险属源码推导，未进行 OOM 压测，不声称已发生 OOM |
| L01 低危 | ingestor README 示例；R01-summary；历史 evidence 命令 | README 与历史命令未在可复制示例设置必需 QUANTOS_TRACE_EXPORT_PATH；README 末尾仅提示持久化 trace。领域注释将内存 seen set 称为 durable；摘要称非正值发质量异常，与 H04 不符 | 新接入者直接复制命令可能 bootstrap 拒绝；内存/目标边界虽在历史证据写明，措辞仍易造成误读 |

最主要的数据完整性风险链为：摄取状态在内存 → 写入未原子化 → 失败重试被去重 → 市场事实缺失而本地 Gate 仍 PASS。标的碰撞与源 ID 冲突还会降低后续 DataSnapshot/研究输入的可信度。此报告没有验证实际 R02/交易链已受污染，因此不把潜在下游影响写为已发生事故。

## 四、整改建议

### 4.1 按优先级实施

1. **B01/H01 先闭环可靠摄取。** 以现有 F05 Supabase PostgreSQL 为唯一事件持久事实来源，复用 outbox/inbox/checkpoint，不新增独立消息基础设施。将源 tick 身份、去重、序号、MarketEvent 和 outbox 放入受控原子事务；持久化成功后才确认源数据。使用稳定服务 actor 与配置 tenant；从 checkpoint 恢复，支持重复/乱序/重启/死信重放。数据库集成仅在已配置 Supabase 执行，破坏性重建另按授权范围处理。
2. **H02/H03 完成市场身份契约。** 冻结 source ID 的唯一性范围与纠错规则：同 ID 同 hash 才是重复，同 ID 不同内容返回确定性冲突/隔离事件；拒绝空 ID，明确 tenant 隔离或全局源事实扇出模式。通过已批准 provider 的 instrument map 解析 base/quote/venue/market type，拒绝歧义或未知标的，不能仅拼接文本。若属于破坏性协议变更，增加 ADR、schema version、迁移和回放兼容测试。
3. **H04/M01 完成异常契约。** 原始值解析/符号校验与非负领域 Quantity 分层；拒绝数据也生成安全质量异常或 dead-letter，绑定来源/tenant/correlation/causation。注入固定 processing clock，区分 replay 时间和实时检测；加入断流、积压、恢复状态。分别测量异常检测、持久提交、消费可见时限，证明要求所定义的 ≤5s；禁止用伪造 received_at 回填时限。
4. **M02/M04 校验配置与资源边界。** registry 构造返回 Result，禁止空元数据、无效 SLA、重复 provider，记录批准版本/许可引用/撤销策略。replay spec 校验 count/symbols/日期/注入参数；流式 JSONL 与批量持久写入，引入可配置上限和背压；非法 spec 返回机器码而非 panic。
5. **M03 建立行为 Gate。** 将本报告边界探针改为正确行为的回归断言；加入账本失败注入与原子重试、重启/死信、源 ID 冲突、symbol 唯一、非法数值/时间/metadata、CLI I/O/错误 envelope 用例。将 R01 line ≥90%、stable region ≥85%、nightly branch ≥85% 纳入 CI；单列 CLI 成功/拒绝/恢复测试，不因依赖或测试代码覆盖抬高产品覆盖率。读取完整 depends_on 和 ACCEPTED 回执，Gate 本身也需运行时破坏测试。
6. **L01 补齐可复制运维说明。** 示例必须显式配置 trace sink；将 memory ledger、来源层和目标验收边界写在命令附近；说明恢复、回滚、provider 撤销、source 冲突、质量事件和批次失败行为；修正“durable”与“非正值异常”描述。

### 4.2 整改后的关闭条件

| 验证层 | 必须交付的可复核证据 |
|---|---|
| 本地领域与 CLI | 固定 clock/ID 测试；上述边界问题不再复现；完整拒绝/恢复自动化；10 万 replay 逐条身份/hash 与事件完整性核对；fmt/Clippy/相关测试和行为 Gate 全绿 |
| 覆盖率/性能 | 按 R01 文件与排除项报告 line/region/nightly branch；纯领域逐调用 P95 <50ms；明确样本量/clock/环境与包含的阶段，不能由 batch 总耗时推算 |
| 真实摄取与目标 Supabase | 审批可追溯 provider fixture/授权连接；MarketEvent/outbox/inbox/checkpoint 实際读回；写失败/重启/死信无丢失、同 ID 冲突可追溯；异常发生至约定发出终点 ≤5s，并报告尾延迟 |
| 审计与正式验收 | 绑定修复源码 SHA、环境、命令、预期/实际计数与哈希的结构化回执；迁移/RLS/权限负向；无未关闭阻塞/高危；复审后再修改 review_status，不以开发标记自动通过 |

本次仅完成复审与问题登记。所有问题保持 OPEN；整改建议尚未实施，现有历史报告不被删除或改写。
