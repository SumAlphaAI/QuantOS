# F05：事件、存储与审计账本全面复审报告

- 复验日期：2026-09-21
- 本轮检查基线：`78a7ba0`；本报告及测试修正由后续独立提交归档
- 需求来源：[开发计划 F05](../SumAlpha-QuantOS-Development-Plan.md#task-f05)
- 结论：**FIX_VALIDATION；原 11 项问题中 9 项已解决，A07、A09 尚未满足完整关闭条件。**

## 一、任务完成概况

重新对照初审 A01–A11、当前实现、测试代码和既有回执核查后，确认租约 fencing、append-only 约束、actor/causation、租户隔离回放、死信恢复、失败关闭门禁、Realtime 补偿以及运行文档已完成。已解决问题不再列入活动问题清单，历史描述可通过 Git 中 `4e6f784` 版本追溯。

上一轮 30/30、100% 和 ACCEPTED 结论需要纠正：容量测试曾直接写入 inbox applied、outbox dispatched 和 checkpoint，未实际驱动万条事件消费者；五秒断言仅测 EXPLAIN 的 Execution Time。同时，95.03% line、94.29% region 和 85% branch 均排除了持久化适配器。工作流成功是真实的，但这些测试范围不足以证明相应需求。

容量验收已改为循环调用 `poll_outbox_once`，检查 10,000 个唯一事件的处理、副作用、checkpoint 与完整回放集合；恢复从查询调用开始到全部结果反序列化完成的五秒计时，并增加源码 Gate 防止重新引入 SQL 完成状态夹具或 EXPLAIN 替代计时。

| 指标 | 本轮结果 |
|---|---:|
| 检查点总数 | 30 |
| PASS / PARTIAL / FAIL | 27 / 3 / 0 |
| 严格完成率 | **90.0%（27/30）** |
| 加权进度（PARTIAL=0.5） | 95.0% |
| 原问题关闭率 | **81.8%（9/11）** |
| 开放问题：阻塞级 / 高危 / 中危 / 低危 | **0 / 0 / 2 / 0** |

## 二、完成情况明细统计

| 编号 | 核对项 | 状态 | 最新结论 |
|---|---|---|---|
| C01 | F03、F04 前置依赖 | PASS | 已有正式验收记录 |
| C02 | crate、migration、CLI、Runbook 交付物 | PASS | 计划交付物齐全 |
| C03 | 核心表与索引 | PASS | 目标 schema 由 15 个 migration 重建成功 |
| C04 | event + audit + outbox 原子写入 | PASS | 同一 PostgreSQL 事务写入并有集成测试 |
| C05 | schema registry | PASS | 本地与 PostgreSQL 路径均通过 |
| C06 | 内容寻址与存储目录 | PASS | manifest、hash、schema、snapshot 测试通过 |
| C07 | Supabase Storage 真实往返 | PASS | 上传、读取、manifest 注册与清理 1/1 通过 |
| C08 | `SKIP LOCKED` 与租约领取 | PASS | 并发领取与过期重领通过 |
| C09 | 完成确认的 lease fencing | PASS | owner/token/status/expiry 均进入条件，陈旧 token 被拒绝 |
| C10 | inbox 幂等唯一约束 | PASS | tenant + consumer + event 唯一性生效 |
| C11 | 重复事件/投递 | PASS | 重复拒绝与 1,000 次投递只产生一次副作用 |
| C12 | 乱序事件 | PASS | sequence gap 与乱序缓冲测试通过 |
| C13 | 重启/checkpoint 恢复 | PASS | checkpoint 续跑与目标库持久化通过 |
| C14 | 死信生成与查询 | PASS | outbox/inbox 死信路径通过 |
| C15 | 死信重放 | PASS | tenant-scoped requeue、审计和重复重放拒绝通过 |
| C16 | 10,000 条无丢失与最终一致 | PARTIAL | 本机 PostgreSQL 正式消费者实测通过；待修复 SHA 的 CI 与隔离 Supabase 新回执 |
| C17 | Realtime 漏通知/断连/重连 | PASS | 数据库补偿扫描处理全部提交事件，显式 deadline=10 秒 |
| C18 | 1,000 次并发投递一次副作用 | PASS | 8 个 worker 保持低于目标 session pool=15，applied receipt=1 |
| C19 | correlation 完整链查询 ≤5 秒 | PARTIAL | 本机完整查询 91.115ms；待修复 SHA 的隔离 Supabase 新回执 |
| C20 | 一次性 PostgreSQL migration 重建 | PASS | CI Gate 已接入并失败关闭 |
| C21 | 隔离 Supabase schema 重建 | PASS | 既有目标验收 15/15 migration 成功 |
| C22 | PostgreSQL RLS 目录与负向访问 | PASS | 静态与数据库执行均通过 |
| C23 | 目标 Supabase RLS 默认拒绝 | PASS | `make rls-policy-test` 远端检查通过 |
| C24 | append-only 数据库强制约束 | PASS | UPDATE/DELETE/TRUNCATE/父级级联均有负向测试 |
| C25 | actor/tenant/correlation/causation | PASS | 模型、migration、持久化与回放均完整 |
| C26 | tenant-scoped correlation replay | PASS | API、CLI 与双租户负向测试通过 |
| C27 | 覆盖率及 nightly branch Gate | PARTIAL | 全部 6 个源文件 line 95.10% / region 92.33% / branch 86.51%；nightly 已接入完整 Gate，待远端执行 |
| C28 | 格式、Clippy、单元质量门禁 | PASS | 本轮格式、Clippy、22 个库测试通过 |
| C29 | 可观测性与运维说明 | PASS | backlog/lease/retry/dead-letter/checkpoint 健康信息和恢复 Runbook 已交付 |
| C30 | 独立、失败关闭、绑定 SHA 的 Gate | PASS | 目标 Gate 缺变量/脏树时失败；既有精确 SHA 回执有效范围见下文 |

### 本轮验证与历史证据边界

| 证据 | 结果与范围 |
|---|---|
| 本轮 `QUANTOS_SKIP_ENV=1 make f05-check` | PASS；source Gate、7 项负向测试、23 个库测试；快速核心覆盖率仅作开发反馈，正式覆盖率见完整数据库 Gate |
| 本轮数据库测试编译、Rust 格式与 Clippy | PASS；编译通过不计为数据库集成执行通过 |
| [隔离 Supabase 回执](./F05-target-acceptance-e0520da-2026-09-21.md) | 绑定 `e0520da0dd6ff04bbac9269be54db776f6129c38`；数据库、RLS、Storage 等已执行证据保留，容量消费与完整查询时限结论受 A09 限制 |
| [远端 CI 与 nightly 回执](./F05-remote-acceptance-6b06a90-2026-09-21.md) | 绑定 `6b06a90de275fb38f5efb7982fd2e09dd5963581`；运行成功、236 文件正式验签、85% 核心 branch 证据保留；不是本轮修订测试的回执 |
| 本轮完整数据库与 HTTP 故障测试 | PostgreSQL 17.11：9 个数据库测试、3 个 HTTP/配置/注册补偿测试通过；10,000 条消费约 10.297s，完整查询 91.115ms；本轮未操作 Supabase |
| 本轮完整覆盖率 | nightly 实测 line 2622/2757、region 2938/3182、branch 109/126；无 F05 源文件排除；详见 [整改记录](./F05-A07-A09-remediation-2026-09-21.md) |

## 三、问题清单及风险分析

仅保留以下两项未满足关闭条件的问题。

| 编号 | 等级 | 所属模块 | 具体表现 | 影响范围 / 状态 |
|---|---|---|---|---|
| A07 | 中危 | F05 覆盖率 Gate、PostgreSQL / Supabase Storage 适配器 | 已增加完整源码清单校验、适配器独立阈值、真实 PostgreSQL 与 HTTP 故障覆盖率；nightly 改用完整 Gate | 本机全部阈值达标；远端 nightly 和目标新证据待收集；**FIX_VALIDATION** |
| A09 | 中危 | PostgreSQL 容量、一致性和 correlation 查询验收 | 正式消费者完成万条事件；回执校验实际 inbox/outbox 数量、checkpoint、完整查询计时，拒绝缺失或无效测量 | 本机实测通过；远端 CI/nightly 与隔离 Supabase 新回执待收集；**FIX_VALIDATION** |

核心分支覆盖率 85% 仅适用于现有统计范围。correlation 的原始要求是五秒内取回完整链，不能用服务端执行时间或未来 F09 监控替代。修订测试在跨区域开发机执行时可能暴露网络耗时；应保留真实结果，采用满足部署条件的运行位置验证，不能继续缩减测量范围。

## 四、整改建议与关闭条件

1. **A07**：人工推送修复提交后运行 F05 Event Nightly 的 `f05-db-coverage`；下载同 SHA 的完整 coverage 与 database 回执。在隔离 Supabase 上执行 `f05-target-coverage`，补齐实际 Storage 服务证据。
2. **A09**：人工推送本轮提交后，运行 QuantOS CI 与 F05 Event Nightly；在已批准的隔离 Supabase 目标上执行修订后的 `f05-target-check`。检查正式消费者处理 10,000 个唯一事件、checkpoint=10,001、无 pending outbox/inbox/dead letter，且完整链取回 ≤5 秒。
3. **最终接受**：A07、A09 的有效新证据齐备后，重新核定 C16、C19、C27。当前保持 `FIX_VALIDATION`，不把旧 SHA 的成功回执移记到修订后的代码。

关键实现与测试：[事件 PostgreSQL](../../crates/quantos-event/src/pg.rs)、[数据库测试](../../crates/quantos-event/tests/postgres_persistence.rs)、[账本 migration](../../supabase/migrations/20260921090000_f05_ledger_integrity_and_replay.sql)、[源码 Gate](../../scripts/check-f05.mjs)、[恢复 Runbook](../runbooks/f05_db_polling_consumer_recovery.md)。
