# F05：事件、存储与审计账本全面复审报告

- 初审日期：2026-09-21；最终复验：2026-09-23
- 最终验收代码 SHA：`48d837692b81e56bd88e13189f0cf15ee34976d3`
- 需求来源：[开发计划 F05](../SumAlpha-QuantOS-Development-Plan.md#task-f05)
- 结论：**ACCEPTED**。30/30 检查点通过；原 11 项问题全部关闭。三项同 SHA 回执见[正式验收记录](./F05-acceptance-48d8376-2026-09-23.md)。

## 一、任务完成概况

对照 F05 需求、技术要求、交付物及量化标准复核后，事件与审计原子写入、租约 fencing、inbox 幂等、死信重放、append-only、RLS、Supabase Storage、Realtime 数据库补偿以及恢复 Runbook 均交付并经相应检查。`48d8376` 的 QuantOS CI、F05 Event Nightly 和隔离 Supabase `f05-target-coverage` 三项回执全部通过，均明确绑定完整 SHA。

| 指标 | 最终结果 |
|---|---:|
| 检查点 | **30/30 PASS；严格完成率 100%** |
| 原问题修复与关闭 | **11/11；100%** |
| 未关闭问题：阻塞级 / 高危 / 中危 / 低危 | **0 / 0 / 0 / 0** |
| 远端 CI / Nightly / 隔离目标 | **SUCCESS / SUCCESS / PASS** |

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
| C16 | 10,000 条无丢失与最终一致 | PASS | 同 SHA Nightly 和隔离 Supabase 均验证 10,000 条正式消费、10,000 次唯一副作用与 checkpoint=10,001 |
| C17 | Realtime 漏通知/断连/重连 | PASS | 数据库补偿扫描处理全部提交事件，显式 deadline=10 秒 |
| C18 | 1,000 次并发投递一次副作用 | PASS | 8 个 worker 保持低于目标 session pool=15，applied receipt=1 |
| C19 | correlation 完整链查询 ≤5 秒 | PASS | Nightly 完整载荷客户端取回 160.233317ms，低于 5 秒；目标 Supabase ID 链仅用于完整性验证 |
| C20 | 一次性 PostgreSQL migration 重建 | PASS | CI Gate 已接入并失败关闭 |
| C21 | 隔离 Supabase schema 重建 | PASS | 本 SHA 目标回执显示 15/15 migration 成功 |
| C22 | PostgreSQL RLS 目录与负向访问 | PASS | 静态与数据库执行均通过 |
| C23 | 目标 Supabase RLS 默认拒绝 | PASS | `make rls-policy-test` 远端检查通过 |
| C24 | append-only 数据库强制约束 | PASS | UPDATE/DELETE/TRUNCATE/父级级联均有负向测试 |
| C25 | actor/tenant/correlation/causation | PASS | 模型、migration、持久化与回放均完整 |
| C26 | tenant-scoped correlation replay | PASS | API、CLI 与双租户负向测试通过 |
| C27 | 覆盖率及 nightly branch Gate | PASS | Nightly 六文件 line 96.44% / region 91.23% / branch 86.96%；pg.rs region 607/714=85.014%，门禁通过 |
| C28 | 格式、Clippy、单元质量门禁 | PASS | 本轮格式、Clippy、23 个库测试通过 |
| C29 | 可观测性与运维说明 | PASS | backlog/lease/retry/dead-letter/checkpoint 健康信息和恢复 Runbook 已交付 |
| C30 | 独立、失败关闭、绑定 SHA 的 Gate | PASS | 目标 Gate 缺变量/脏树时失败；三项正式回执均绑定本 SHA |
### 同 SHA 验收证据

| 证据 | 可核查结果 |
|---|---|
| [QuantOS CI #117](https://github.com/SumAlphaAI/QuantOS/actions/runs/35881789334)、[结构化摘录](./evidence/F05-ci-48d8376-pass.json) | 整条工作流 SUCCESS；`verify`、主干签名策略、正式签名、独立下载验签和总门禁成功。验签作业日志确认 236 个文件及 HMAC-SHA256 manifest 签名。 |
| [F05 Event Nightly #7](https://github.com/SumAlphaAI/QuantOS/actions/runs/35882055545)、[原始制品摘录](./evidence/F05-nightly-48d8376-pass.json) | SUCCESS；数据库回执 PASS，干净 SHA；10,000 条真实消费者、唯一副作用、dispatched、applied receipt 均为 10,000，checkpoint=10,001；正式消费 3314ms；完整事件链客户端取回 160.233317ms。六文件覆盖率及 `pg.rs` 85% 独立阈值均过。 |
| [隔离 Supabase 原始回执](./evidence/F05-target-48d8376-pass.json) | PASS；干净 SHA；隔离 schema 重置后 15 项 migration、RLS、Storage 真实往返、PostgreSQL/HTTP 故障与 10,000 条消费者一致性通过。目标侧 `pg.rs` region 841/966=87.06%。 |

Nightly 的 `lookupScope=complete-client-retrieval` 是 ≤5 秒完整链性能的正式测量。Supabase 回执 `lookupScope=target-event-id-client-retrieval` 仅验证目标链 ID 的完整性；跨区域客户端取回为 19749.879625ms，不是完整载荷性能回执。当前验收不证明目标 Supabase 在这一跨区域路径上 ≤5 秒。若产品将该特定目标路径列为性能目标，须设置同区域完整载荷测量并另行验收；不能把 Nightly 的低延迟外推至该路径。

## 三、问题清单及风险分析

当前活动问题清单为空。初审 0 个阻塞级、6 个高危、4 个中危、1 个低危问题均已关闭；原 A07（完整源码覆盖率和适配器阈值）及 A09（正式消费者容量、一致性和完整链查询）由上述新 SHA 三项回执最终关闭。历史失败与整改轨迹保留在 [b4f1c9a 回执](./F05-acceptance-b4f1c9a-2026-09-23.md)、[88cf19f 回执](./F05-acceptance-88cf19f-2026-09-23.md)及 Git 历史中，不再列为当前缺陷。

剩余观测风险是目标 Supabase 跨区域 ID 链取回耗时约 19.75 秒；当前验收标准中的完整链 ≤5 秒由 Nightly 测量达成，目标侧没有相同作用域的性能回执。Nightly `pg.rs` region 覆盖率 607/714=85.014%，仅高于 85% 门槛一个 region，未来新增分支需继续受失败关闭门禁约束。

## 四、整改建议与后续维护

原问题无待执行整改。保持完整六文件覆盖率、`pg.rs` 85% 独立阈值、Nightly 完整链 ≤5 秒与正式签名下载验签门禁；代码变动后重新收集新完整 SHA 的回执。若需目标 Supabase 的跨区域或同区域完整载荷性能承诺，先定义客户端部署区域与测量范围，再建立单独的目标环境预算和 Gate。

关键实现与测试：[事件 PostgreSQL](../../crates/quantos-event/src/pg.rs)、[数据库测试](../../crates/quantos-event/tests/postgres_persistence.rs)、[账本 migration](../../supabase/migrations/20260921090000_f05_ledger_integrity_and_replay.sql)、[源码 Gate](../../scripts/check-f05.mjs)、[恢复 Runbook](../runbooks/f05_db_polling_consumer_recovery.md)。
