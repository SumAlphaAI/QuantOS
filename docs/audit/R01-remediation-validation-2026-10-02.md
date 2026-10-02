# R01 全面复审整改验证报告

日期：2026-10-02。依据：[修复前全面复审](./R01-comprehensive-review-2026-10-02.md)及开发计划 CORE:R01。验证对象是本次 Git 工作区的修复源码；最终源文件 SHA-256 绑定在[证据索引](./evidence/r01-remediation-20261002/index.json)，不是将历史提交或 fixture 当作正式 provider 验收。

## 一、任务完成概况

按 B01/H01 → H02/H03 → H04/M01 → M02/M04 → M03 → L01 顺序完成可实施的代码、迁移、行为测试、覆盖 Gate 和运维整改。10 项问题中 **9 项 CLOSED，1 项 B01 PARTIAL/OPEN**，问题关闭率 **90%**。B01 的持久化与恢复实现已经完成并连接实际 Supabase 验证；未关闭部分是获准真实行情源、原生协议 adapter、部署和真实异常回执。

用户确认 `.env.local` 尚无 provider URL/审批配置。本次已补充[官方获取与内部审批指南](../runbooks/r01_provider_onboarding.md)，未虚构批准记录、购买账号或写入凭据。R01 为 `FIX_VALIDATION`，**正式验收 0/1；不能标记 ACCEPTED，也不能推断 R1 Gate 已通过**。

实际数据库验证直接连接现有 Supabase PostgreSQL，已向前应用三个 R01 migration；没有本地数据库/容器，也没有 reset schema。测试仅创建具名 fixture 租户/actor，保留不可变事实，本次完成后停用自己的 actor。历史 F03/F05/F0 ACCEPTED 回执继续按历史 SHA 使用。

## 二、完成情况明细统计

原报告的 24 项等权检查点按相同完整要求复核：**PASS 18/24（75%），PARTIAL 6/24（25%），FAIL 0**；PARTIAL 不折半。此比例是验证检查点通过率，不是工时比例或正式任务验收率。源许可、部署与真实数据证据只要缺失，就保留相应 PARTIAL。

| 检查点 | 状态 | 修复后实现与本次证据 |
|---|---|---|
| C01 F03/F05/F0 依赖 | PASS | 历史回执匹配 Gate；F05 新增市场接线运行相关回归与全 workspace 测试，不改写历史验收 |
| C02 market crate | PASS | v2 契约、13 项单测及目标集成测试 |
| C03 ingestor 服务 | PARTIAL | 持久文件/HTTPS JSONL 入口、dispatch/requeue 已实现；native provider adapter/部署仍待提供 |
| C04 replay dataset | PASS | 固定 100,000 tick 生成、解析及身份核对 |
| C05 symbol | PASS | 显式 alias→BASE/QUOTE；歧义、未知标的拒绝，碰撞回归 |
| C06 时间 | PASS | UTC event/received/processing 时间、固定 clock、积压与持久断流 watchdog |
| C07 数值精度 | PASS | Decimal/Quantity 与超精度、负/零/非法数值分层 |
| C08 来源、dataset、许可 | PARTIAL | 元数据和批准引用可追踪；真实供应商条款/批准记录未取得 |
| C09 仅批准 provider | PARTIAL | registry 结构、重复、过期/撤销/live fixture 拒绝已测；真实批准待完成 |
| C10 质量异常 | PASS | 非法数值生成质量事件；坏帧/身份冲突 hash 隔离，后续继续 |
| C11 领域记录 | PASS | v2 envelope、hash、tenant/actor/correlation/causation |
| C12 可靠持久写入 | PASS | 单次 SQL 原子 receipt/序号/event/audit/outbox；实际目标读回 |
| C13 10 万解析 100% | PASS | 正确解析全部输入，重复数与身份集合断言；输入数不等于事件数 |
| C14 重复正确去重 | PASS | tenant 隔离、hash 冲突、重启、并发同 ID、空 ID/保留前缀拒绝 |
| C15 乱序处理 | PASS | event_time 保留，乱序不丢失；不声称下游投影自动按发生时间重排 |
| C16 异常 ≤5s | PARTIAL | 实际 Supabase fixture 异常持久提交 <5s；真实源发生点到发出终点未取回执 |
| C17 写失败安全重试 | PASS | 内存 staged batch + DB 完整事务；FK 失败无残留 receipt，重试成功 |
| C18 重启/死信闭环 | PASS | 实际 DB 重启唯一身份、F05 双死信恢复/checkpoint、CLI 授权 requeue |
| C19 自动化成功/拒绝/恢复 | PASS | market 13、CLI 2、Supabase 集成 1；CLI 一个测试含多个真实进程与目标场景 |
| C20 fmt/Clippy | PASS | fmt 与全 workspace/all-targets Clippy -D warnings |
| C21 覆盖/可破坏 Gate | PASS | 每生产文件 line≥90/region≥85/nightly branch≥85；16 个 JS 负向、2 个真实编译 mutant |
| C22 性能/deadline | PASS | 2,000 次纯领域调用测 P95<50ms；HTTP 2s、DB statement 4s/lock 2s timeout；真实源端到端仍归 C16 |
| C23 安全/锁/协议检查 | PARTIAL | secret/lock/计划结构与全 Rust workspace PASS；本次未重跑完整 SCA、Buf/SDK/TS/浏览器套件 |
| C24 运维/部署 | PARTIAL | trace sink、共享健康、质量事实、恢复/回滚、审批指南齐备；部署端采集/告警回执未验证 |

计划三项量化指标：replay PASS；乱序/重复 PASS（包含实际 DB fixture）；真实异常 ≤5s PARTIAL，因此严格完整通过率 **2/3（66.67%）**。正式 provider 及远程同 SHA CI：**NOT RUN / NO RECEIPT**。

| 生产文件 | stable line / region | nightly branch |
|---|---:|---:|
| market lib | 96.15% / 95.77% | 85.83% |
| durable | 98.39% / 92.74% | 100% |
| CLI main | 97.85% / 90.91% | 85.71% |

Stable 纯领域样本 n=2000，P95=82,167ns（0.082ms）；nightly P95=74,875ns。异常单 tick 实际持久提交 stable=250,467,125ns（0.250s），nightly=303,516,750ns（0.304s）。两轮各读取 fixture receipts=16/events=18/outbox=18；这是有界测试窗口的计数与单次异常提交耗时，不是生产吞吐或真实源端到端 P95。

覆盖原始 JSON、摘要、目标回执与全部最终命令日志见[证据目录说明](./evidence/r01-remediation-20261002/README.md)。coverage 采集前清理旧 LLVM profile，stable/nightly 顺序执行；不能用旧二进制或依赖总覆盖掩盖本次产品文件。仅 `cli.rs` 的 clap 派生声明适用 COV-R01-01 排除，Gate 拒绝该文件包含手写 fn/impl；实际业务逻辑 main.rs 全部计入。

## 三、问题清单及风险分析

| ID/等级 | 所属模块 | 整改与验证结果 | 状态/剩余影响 |
|---|---|---|---|
| B01 阻塞 | ingestor/event/db | 持久 source/poll、原子 SQL、稳定 tenant/actor、F05 dispatch/checkpoint/requeue；Supabase+loopback HTTP fixture 成功/断连/重启/死信 | PARTIAL/OPEN；缺 native adapter、真实批准/部署回执，阻止 R01 ACCEPTED |
| H01 高危 | market/event/db | 内存事务 staging；单 SQL 原子 receipt/事件；FK 注入失败全部回滚并安全重试，8 并发重复只提交一次 | CLOSED；追加事实不可删改，运维须按完整未确认窗口重试 |
| H02 高危 | market/receipt | tenant+provider+ID 约束；稳定内容 hash 不含本次 received_at；同 ID 改内容隔离、空/保留 ID 拒绝 | CLOSED；供应商更正须使用新身份，不覆盖旧事实 |
| H03 高危 | market contract | v2 BASE/QUOTE 与显式 map，AB/C 和 A/BC 不共用流；非法/多分隔标的拒绝 | CLOSED；v1 消费者不可直接解释 v2，按 ADR 升级 |
| H04 高危 | quality/CLI | 负/非数值/超精度生成 nullable 规范值+有界原值+质量异常；坏帧只持久 hash/reason | CLOSED；回查原文由获准源保留策略负责 |
| M01 中危 | clock/watchdog | live processing clock；watchdog 从最近已提交 tick 恢复；fresh/stale/never、源 503 与积压已测 | CLOSED（实现）；真实源时限与部署告警仍随 B01/C16/C24 待验 |
| M02 中危 | approval registry | Result 构造、完整 metadata/map/SLA、重复拒绝、引用/版本/到期/撤销、live 禁 fixture | CLOSED（配置能力）；代码不能代替人工验证合同或批准记录真实性 |
| M03 中危 | tests/Gates/CI | 真实行为与目标测试；hash冲突和批次提交 mutant 实际编译/执行被断言击败；分文件 stable/nightly Gate 与 CI | CLOSED（仓库资产/本次本地执行）；新增远程 workflow 尚未运行，不记远程 PASS |
| M04 中危 | replay/stream | spec 校验无 panic；100k数量与16KiB帧限制（空白帧也计数）；durable 无无限内存 seen/ledger 缓存 | CLOSED；超限要求来源分页/补偿，不能关闭限制 |
| L01 低危 | docs/runbooks | 必需 trace sink、memory/live/fixture 边界、schema ADR、回滚/撤销/恢复、provider 申请指南 | CLOSED |

数据完整性风险链已经由原子写入、持久身份和行为 Gate 阻断。仍需控制批准文件修改权限、adapter 的至少一次交付游标、数据库 backend role 和 trace 卷轮转。迁移 SECURITY INVOKER、receipt FORCE RLS、authenticated 拒绝读取、UPDATE/DELETE/TRUNCATE 不可变保护已在目标验证；这些不代表完整安全评估或实际 provider 合规已通过。

## 四、整改建议与后续关闭条件

1. 按 [provider 申请指南](../runbooks/r01_provider_onboarding.md)选定数据产品，取得条款/用途审批、真实版本化批准文件与 adapter 负责人。不应申请交易或提现权限来获取公共行情。
2. 完成 native protocol adapter 的时间单位/精度/稳定来源 ID、分页/断连补偿与至少一次交付测试，部署受控 HTTPS JSONL endpoint；当前 ingestor 未实现 Bearer Header 配置，若 endpoint 要求该鉴权须先实现并测试。
3. 用有效 service actor/tenant 在目标部署运行 live（不加 fixture），测量异常实际发生→持久 MarketEvent 的时限，单列检测/提交/消费延迟；补重启、死信、撤销和端点采集回执。
4. 正式提交后运行远程 exact-SHA Gate，保存工作流/环境/批准版本与读回回执。独立复审 B01，只有无阻塞且真实回执齐备时才能将 R01 改为 ACCEPTED。

三份向前 migration 已应用到现有目标，回滚应停止摄取并保持 v2-compatible 消费者，不删除不可变事实或退回进程内去重。原全面复审及其失败探针保持历史记录，本报告才表示修复后结论。
