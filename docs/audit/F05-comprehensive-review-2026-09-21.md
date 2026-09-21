# F05：事件、存储与审计账本全面复审报告

- 复审日期：2026-09-21
- 复审基线：`721d58d08fcdab207f14e80c042d90f3fcd28cfb`
- 需求来源：[`SumAlpha-QuantOS-Development-Plan.md`](../SumAlpha-QuantOS-Development-Plan.md#task-f05)
- 复审范围：`quantos-event`、`quantos-storage`、Supabase migrations / RLS policy、`replay-cli`、消费者恢复 Runbook、F05 本地与远端验收门禁
- 复审结论：**不通过，需整改后复验**

## 一、任务完成概况

F05 已完成事件账本、事务型 outbox/inbox、schema registry、投影 checkpoint、对象存储适配、replay CLI 与恢复 Runbook 的主体实现。内存层重复、乱序、重启、死信生成和 10,000 条事件回放测试通过；Rust 格式、Clippy 和两个核心库的单元测试也通过。现有 CI 的数据库门禁能够在一次性 PostgreSQL 中重建 migration，并检查 schema、RLS 目录和匿名/认证角色的负向访问。

但是，严格按开发计划及全局最低验收要求核对，F05 尚不能认定完成：租约没有贯穿成功/失败确认，过期 worker 可覆盖新 worker 的处理结果；事件与审计表没有数据库级 UPDATE/DELETE 防护；事件缺少 actor 与 causation；按 correlation ID 回放没有 tenant 边界；死信只有生成和查询，没有可执行的重放链路；F05 live test 会因变量缺失直接返回成功，且未进入 CI。配置的远端数据库连接在本轮复验中因凭据/项目映射无效而失败，Supabase Storage 线上往返也没有成功回执。

### 1.1 完成率

本报告将一个检查点记为 `PASS`、`PARTIAL` 或 `FAIL`。严格完成率只计 `PASS`；加权进度仅用于反映已存在但尚未验收闭环的实现，计算时 `PARTIAL = 0.5`。

| 指标 | 结果 |
|---|---:|
| 检查点总数 | 30 |
| PASS | 15 |
| PARTIAL | 8 |
| FAIL | 7 |
| **严格完成率** | **50.0%（15/30）** |
| 加权实现进度 | 63.3%（19/30） |
| 未关闭问题 | 11 |
| 阻塞级 / 高危 / 中危 / 低危 | 0 / 6 / 4 / 1 |

`development_status: COMPLETED` 表示代码开发状态，不能替代验收结论。按本次复审证据，计划中的 F05 `review_status` 应保持未验收状态，待所有高危问题和量化验收缺口关闭后再改为 `ACCEPTED`。

### 1.2 已执行验证

| 验证项 | 结果 | 证据与边界 |
|---|---|---|
| `cargo fmt --all -- --check` | PASS | Rust 格式检查通过 |
| `cargo clippy -p quantos-event -p quantos-storage --all-targets --all-features --locked -- -D warnings` | PASS | 两个 F05 crate 全 target/all features 无告警 |
| `cargo test -p quantos-event --lib --locked -- --nocapture` | PASS | 7/7；覆盖内存账本重复、乱序、重启、死信生成、10,000 条回放 |
| `cargo test -p quantos-storage --lib --locked -- --nocapture` | PASS | 10/10；覆盖内容寻址、schema registry、snapshot quality 等本地逻辑 |
| `cargo llvm-cov --package quantos-event --package quantos-storage --lib --summary-only --json ...` | FAIL | 合计 line 45.26%、region 50.67%；PostgreSQL 适配层为 0% |
| `make test-f05-live` | FAIL | 能连接服务端，但配置的远端数据库凭据/项目映射无效；4 个事件 PostgreSQL 测试均未执行到业务断言，storage 测试未启动 |
| `make test-supabase-storage-live` | NOT RUN | 缺少可用的目标 Supabase Storage 验收上下文与成功回执 |
| 远端数据库基础门禁 | PASS（旁证） | `c769897de9b1f94fbd6dd9ac3e35b6aca2e8945a` 的 CI 在一次性 PostgreSQL 中通过 migration/schema/RLS 检查；该结果不等同于 F05 live test 或目标 Supabase 验收 |

## 二、完成情况明细统计

| 编号 | 核对项 | 状态 | 核对结论 |
|---|---|---|---|
| C01 | F03、F04 前置依赖 | PASS | 两项已有正式验收记录 |
| C02 | `quantos-event`、`quantos-storage`、migration、CLI、Runbook 交付物 | PASS | 计划列出的交付物均存在 |
| C03 | 核心表与索引 | PASS | migration 建立 event stream/log、outbox、inbox、dead letter、schema registry、checkpoint、audit、artifact 等对象，并完成 F05 表名对齐 |
| C04 | event + audit + outbox 原子写入 | PASS | `append_event` 在同一 PostgreSQL 事务内写入三类记录 |
| C05 | schema registry | PASS | 本地与 PostgreSQL registry API/约束均已实现 |
| C06 | 本地内容寻址与存储目录 | PASS | manifest、hash、schema 与 snapshot 逻辑有单元测试 |
| C07 | Supabase Storage 真实往返 | PARTIAL | 适配器和 opt-in 集成测试存在，但本轮无成功线上回执 |
| C08 | `FOR UPDATE SKIP LOCKED` 与租约领取 | PASS | outbox claim 已实现跳锁、owner、expiry 与过期重领 |
| C09 | 租约所有权隔离到完成确认 | FAIL | success/failure 更新只按记录 ID；没有 owner/token/status/expiry 条件，过期 worker 可覆盖新租约 |
| C10 | inbox 幂等唯一约束 | PASS | tenant + consumer + event 唯一性和领取状态已实现 |
| C11 | 重复事件/重复投递测试 | PASS | 内存层有重复拒绝与幂等测试 |
| C12 | 乱序事件测试 | PASS | sequence gap 和 out-of-order 行为有测试 |
| C13 | 重启/checkpoint 恢复测试 | PASS | 内存投影引擎能够从 checkpoint 继续 |
| C14 | 死信生成与查询 | PASS | 内存和 PostgreSQL 路径均实现死信写入；DB 测试源代码有断言 |
| C15 | 死信重放 | FAIL | 没有 requeue/replay API、CLI 命令或端到端验证 |
| C16 | 10,000 条事件无丢失与最终一致 | PARTIAL | 内存测试通过；未在 PostgreSQL/outbox/inbox 实际链路验证 |
| C17 | Realtime 漏通知、断连、重连补偿 | PARTIAL | 测试源代码覆盖通知失败后 DB 扫描，但没有完整 disconnect/reconnect 生命周期与扫描 deadline 断言 |
| C18 | 同事件 1,000 次并发只产生一次副作用 | PARTIAL | PostgreSQL 测试源代码存在，但无成功运行回执，且未覆盖租约过期后的陈旧确认竞争 |
| C19 | correlation ID 全链路查询 ≤5 秒 | PARTIAL | 内存 10,000 条查询通过；PostgreSQL 测试仅使用少量事件且本轮未成功运行 |
| C20 | 隔离 PostgreSQL 由 migration 重建 | PASS | 远端 CI 的一次性 PostgreSQL migration/schema gate 通过 |
| C21 | 隔离 Supabase 项目/数据库分支重建 | PARTIAL | 无目标 Supabase 项目或数据库分支的成功重建回执 |
| C22 | 本地 PostgreSQL RLS 目录与负向访问 | PASS | CI 已验证 RLS enable/force 与匿名/认证角色负向访问 |
| C23 | 目标 Supabase RLS 默认拒绝 | PARTIAL | 没有目标 Supabase 环境的负向权限回执 |
| C24 | append-only 账本数据库强制约束 | FAIL | event/audit 表允许 service role `FOR ALL`，无 UPDATE/DELETE 防护；stream cascade delete 可删除账本 |
| C25 | actor、tenant、correlation、causation 完整写入 | FAIL | tenant/correlation 已有，actor 与 causation 未进入事件模型和持久化协议 |
| C26 | 租户隔离的 correlation replay | FAIL | PostgreSQL 查询与 replay CLI 只接收 correlation ID，没有 tenant 条件 |
| C27 | Rust 覆盖率最低线与分支覆盖 | FAIL | 两 crate 合计 line 45.26%、region 50.67%，无 F05 分支覆盖门禁 |
| C28 | 格式、Clippy、单元测试质量门禁 | PASS | 本轮全部通过 |
| C29 | 可观测性、部署/回滚、恢复说明 | PARTIAL | CLI 有统一观测包装、Runbook 有基础恢复步骤；缺少 F05 指标/健康检查、告警、回滚和可执行死信恢复 |
| C30 | F05 独立、失败关闭、进入 CI 的验收 Gate | FAIL | live tests 可因环境变量缺失静默成功，Make target 未进入 CI，也没有绑定 commit 的结构化验收回执 |

## 三、问题清单及风险分析

### 3.1 阻塞级问题（0）

未发现导致仓库无法构建、migration 无法解析或 F05 主体代码完全不可用的阻塞级问题。以下高危问题会阻止生产验收，但均有明确的局部整改路径。

### 3.2 高危问题（6）

| 编号 | 所属模块 | 具体表现 | 影响范围 | 风险分析 |
|---|---|---|---|---|
| A01 | `quantos-event` PostgreSQL consumer | outbox/inbox 的 success/failure 更新仅按记录 ID；没有校验 lease owner、处理 token、状态或租约有效期。`record_outbox_failure` 虽接收 `worker_name`，但不用于更新条件 | 所有多 worker outbox/inbox 消费者、checkpoint、业务副作用 | worker A 租约超时后，worker B 可重领并开始处理；A 随后仍能清除 B 的租约、标记成功/失败或推进 checkpoint，破坏幂等和 exactly-once 目标 |
| A02 | migration / 审计账本 | `event_log`、`audit_entries` 没有阻止 UPDATE/DELETE 的 trigger/privilege；service role policy 允许 `FOR ALL`；event stream 删除可级联清除 event log | 事件真相、审计追责、回放、合规证据 | 运行时高权限连接或误操作可改写/删除历史，所谓 append-only 只停留在约定，无法作为可信账本 |
| A03 | 领域事件协议 / audit | `RecordedEvent` 与 `NewRecordedEvent` 没有 actor/causation；`append_event` 未写入 actor，audit 的 actor 字段保持空值，也没有 causation 字段 | 所有事件生产者、审计查询、跨服务因果追踪 | 无法回答“谁触发、由哪个事件导致”，不满足全局写入审计要求，事故调查和授权追踪会断链 |
| A04 | PostgreSQL query / `replay-cli` | `events_by_correlation_id`、`audit_entries_by_correlation_id` 和 CLI 都只按 correlation ID 查询，没有 tenant 参数/条件；correlation ID 也没有全局唯一约束 | 运维回放、审计导出、多租户数据隔离 | 使用 service role 时可能把不同 tenant 的同 correlation ID 记录合并或泄露；回放结果不具备租户边界保证 |
| A05 | dead letter recovery | 代码只支持生成/查询 dead letter；没有租户安全的 claim/requeue/replay API、CLI 子命令、状态迁移或端到端测试；Runbook 也没有可复制命令 | poison event、故障恢复、消费者运维 | 死信产生后无法按标准流程恢复；人工改库会绕过幂等、审计与 schema 校验，恢复时间和误操作风险不可控 |
| A06 | F05 Gate / CI / 目标环境证据 | PostgreSQL 集成测试在 `DATABASE_URL` 缺失时直接成功退出，Storage 测试也需额外开关；`test-f05-live` 未接入 CI。本轮远端 DB 配置无效，未获得目标 Supabase DB/Storage 成功回执 | 全部数据库、RLS、并发、恢复及 Storage 验收 | CI 绿色仍可能完全未执行 F05 关键路径；无法证明计划列出的定量标准在目标环境成立，状态存在误报风险 |

### 3.3 中危问题（4）

| 编号 | 所属模块 | 具体表现 | 影响范围 | 风险分析 |
|---|---|---|---|---|
| A07 | 测试覆盖率 | 两 crate 合计 line 45.26%、region 50.67%；`quantos-event/src/pg.rs` 与 `quantos-storage/src/pg.rs` 为 0%，Supabase Storage adapter line 47.79%；无 F05 branch Gate | PostgreSQL/Supabase 的错误、重试、事务与恢复分支 | 最关键的持久化路径缺少自动回归保护，低层 SQL 或状态机变更容易在 CI 中漏检 |
| A08 | Realtime 补偿测试 | 已有 notifier 失败后继续 DB scan 的测试设计，但没有模拟断连、重连生命周期，也未对轮询完成设置明确 deadline | Realtime 唤醒与数据库兜底协作 | 只能证明通知回调失败不会阻止当前扫描，不能证明长连接中断后的积压会在时限内全部补齐 |
| A09 | 量化容量/一致性验收 | 10,000 条仅在内存账本运行；1,000 并发和 PostgreSQL correlation 查询没有成功执行回执；查询测试数据量过小 | PostgreSQL、outbox/inbox、checkpoint、最终一致性和性能 | 算法单元测试无法替代数据库锁、连接池、索引、RLS 和网络开销，计划中的容量指标仍未被证实 |
| A10 | 可运维性 | 事件/存储服务没有 F05 专属 backlog、lease、retry、dead-letter、checkpoint lag 指标和健康检查；Runbook 缺少部署/回滚、告警阈值、成功验证和已知限制 | 上线、故障发现、回滚与值班恢复 | 即使功能正确，也难以及时发现卡住的消费者或积压，并缺少一致、可审计的恢复与回滚程序 |

### 3.4 低危问题（1）

| 编号 | 所属模块 | 具体表现 | 影响范围 | 风险分析 |
|---|---|---|---|---|
| A11 | README / 开发文档 | crate 与 CLI 文档过于简略，未集中说明表级不变量、租约语义、配置、失败模式、测试矩阵和验收边界 | 新开发者、评审者、运维交接 | 容易把已有实现误判为已完成线上验收，也增加错误调用和重复排查成本 |

### 3.5 综合风险

当前主要风险不是缺少基础代码，而是持久化状态机和验收门禁没有形成闭环。A01 会直接破坏并发消费者的所有权边界；A02、A03、A04 共同削弱账本的不可篡改、可归因和租户隔离；A05 使死信恢复停留在人工操作；A06 允许关键验证被静默跳过。若在这些问题未关闭前由 F06/F07 继续依赖 F05，后续身份、授权和可恢复工作流会建立在不完整的审计与幂等语义之上，返工面将扩大到所有事件生产者和消费者。

## 四、整改建议

建议按以下顺序实施，前一项的协议变更应先固定，再扩展后续测试和文档。

### R01：为租约完成操作增加 fencing（对应 A01）

1. claim 时生成不可复用的 `lease_token`，或以 owner + claim generation 组成 fencing token，并返回给 worker。
2. outbox/inbox 的 success、failure、release 必须在 `WHERE` 中同时匹配 ID、processing 状态、owner/token；对过期 lease 明确定义是否允许完成，建议拒绝陈旧 token。
3. 检查受影响行数，零行必须返回稳定机器错误，不能继续推进 checkpoint。
4. 增加确定性并发测试：A 领取后超时、B 重领，A 的 success/failure 均被拒绝，最终只产生一次副作用。

### R02：把 append-only 变为数据库不变量（对应 A02）

1. 对 `event_log`、`audit_entries` 增加拒绝 UPDATE/DELETE 的 trigger 或收紧 privilege；仅允许受控 append 函数 INSERT。
2. 禁止通过删除 stream 级联删除历史；需要清理时使用独立、审批和审计完备的保留策略。
3. 增加 service role 下的负向测试，证明 UPDATE、DELETE、TRUNCATE 及父表级联路径均失败。

### R03：补齐事件来源与因果协议（对应 A03）

1. 在领域协议和 migration 中加入非空 `actor_id` 与 `causation_id`；系统事件使用显式 system actor，根事件使用可验证的 root causation 规则。
2. event log、audit、outbox 和 dead letter 保留同一来源链，replay 输出 actor/causation。
3. 更新 Proto/SDK、fixture、schema registry、兼容性检查和 migration 回放测试；若属于破坏性协议变更，按 F03 兼容策略升级版本。

### R04：强制 tenant-scoped replay（对应 A04）

1. PostgreSQL 查询 API 和 CLI 都要求 `tenant_id + correlation_id`，SQL 同时使用两列过滤。
2. JSONL 回放也执行 tenant 过滤；审计导出中明确记录租户上下文。
3. 添加两个 tenant 复用同一 correlation ID 的负向测试，证明数据不会混合。

### R05：实现可审计死信重放（对应 A05）

1. 为 dead letter 增加 pending/claimed/replayed/failed 状态、租约、replay attempt、reason、operator actor 与时间戳。
2. 提供 tenant-scoped CLI 子命令和库 API，重放前重新执行 schema 校验与 inbox 幂等检查。
3. 增加生成死信、重放成功、重复重放无副作用、重放再次失败、权限拒绝五类测试，并把可复制命令写入 Runbook。

### R06：建立失败关闭的 F05 验收 Gate（对应 A06、A08、A09）

1. 将普通单元测试与 live acceptance 分开；live Gate 在缺少任何必需变量时必须失败并输出缺失项，不得 `return Ok(())`。
2. 在一次性 PostgreSQL 中默认执行 migration、RLS、四类消费者、lease fencing、10,000 条、1,000 并发和 correlation deadline；目标 Supabase DB/Storage 另生成绑定完整 SHA 的结构化回执。
3. Realtime 测试显式模拟漏通知、断连、积压、重连，并对“数据库扫描处理全部已提交事件”设置 deadline。
4. 回执至少记录完整 commit SHA、migration hash、目标类别、测试数量、数据量、耗时、RLS 角色、Storage round-trip 和失败关闭状态；不得合并不同 SHA 的结果。

### R07：补齐覆盖率、可观测性和运维文档（对应 A07、A10、A11）

1. 为 PostgreSQL、Supabase Storage、失败/重试/回滚分支补测试，使新增 Rust 核心 line ≥90%、稳定 region ≥85%，并建立 nightly branch ≥85% 门禁。
2. 输出 outbox backlog/age、lease contention/expiry、retry、dead-letter、checkpoint lag、replay latency、Storage failure 指标和健康状态，定义告警阈值。
3. 扩展 Runbook 与 README，覆盖部署前检查、migration 顺序、回滚策略、死信重放、成功验证、权限模型、已知限制和验收命令。

### 4.1 建议复验顺序

1. 先执行 R01–R04 的协议、migration 和负向测试，确认账本/租户/租约不变量。
2. 再完成 R05 和 R06，获得一次性 PostgreSQL 全量成功结果以及目标 Supabase DB/Storage 的同 SHA 回执。
3. 最后执行覆盖率、格式、Clippy、全仓 CI 和可观测性/Runbook 检查，形成 F05 独立验收回执。
4. 只有在 30 个检查点全部 `PASS`、11 个问题全部关闭后，才将开发计划中的 F05 `review_status` 改为 `ACCEPTED`。

## 附录：关键代码证据索引

- 事件模型缺少 actor/causation：[`crates/quantos-event/src/lib.rs`](../../crates/quantos-event/src/lib.rs)
- PostgreSQL append、claim、ack、correlation query：[`crates/quantos-event/src/pg.rs`](../../crates/quantos-event/src/pg.rs)
- F05 schema/RLS：[`20260728010000_event_storage_audit_ledger.sql`](../../supabase/migrations/20260728010000_event_storage_audit_ledger.sql)、[`20260730090000_f05_polling_consumer_alignment.sql`](../../supabase/migrations/20260730090000_f05_polling_consumer_alignment.sql)
- PostgreSQL 集成测试：[`crates/quantos-event/tests/postgres_persistence.rs`](../../crates/quantos-event/tests/postgres_persistence.rs)、[`crates/quantos-storage/tests/postgres_persistence.rs`](../../crates/quantos-storage/tests/postgres_persistence.rs)
- Supabase Storage 集成测试：[`crates/quantos-storage/tests/supabase_storage_integration.rs`](../../crates/quantos-storage/tests/supabase_storage_integration.rs)
- replay CLI：[`services/replay-cli/src/main.rs`](../../services/replay-cli/src/main.rs)
- 恢复 Runbook：[`docs/runbooks/f05_db_polling_consumer_recovery.md`](../runbooks/f05_db_polling_consumer_recovery.md)
- F05 Make targets：[`Makefile`](../../Makefile)
