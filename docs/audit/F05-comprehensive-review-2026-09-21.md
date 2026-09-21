# F05：事件、存储与审计账本全面复审报告

- 初审日期：2026-09-21
- 最新复验日期：2026-09-21
- 初审基线：`721d58d08fcdab207f14e80c042d90f3fcd28cfb`
- 目标环境验收基线：`e0520da0dd6ff04bbac9269be54db776f6129c38`
- 需求来源：[`SumAlpha-QuantOS-Development-Plan.md`](../SumAlpha-QuantOS-Development-Plan.md#task-f05)
- 详细目标回执：[`F05-target-acceptance-e0520da-2026-09-21.md`](./F05-target-acceptance-e0520da-2026-09-21.md)
- 结论：**原 11 项问题全部关闭，代码与隔离 Supabase 目标验收通过；等待最新提交的 GitHub Actions 同 SHA 回执后转为 `ACCEPTED`**

## 一、任务完成概况

F05 已形成事件与审计不可变账本、带 fencing token 的 outbox/inbox 租约、tenant-scoped correlation replay、可审计死信重放、schema registry、checkpoint、Supabase Storage、恢复 Runbook、可观测性与失败关闭 Gate。隔离 Supabase 项目已从空 `quantos` schema 顺序应用 15 个 migration，并完成 PostgreSQL、RLS 和 Storage 正式验收。

本轮在目标项目中进一步修复了测试夹具的会话池并发、跨用例 outbox 污染、10,000 条容量准备/投影方式、数据库端查询计时和 Realtime 重连数量断言。最终结构化回执绑定干净提交 `e0520da0dd6ff04bbac9269be54db776f6129c38`，状态为 `PASS`。

### 1.1 完成率

| 指标 | 初审 | 最新复验 |
|---|---:|---:|
| 检查点总数 | 30 | 30 |
| PASS | 15 | 29 |
| PARTIAL | 8 | 1 |
| FAIL | 7 | 0 |
| **严格完成率** | **50.0%（15/30）** | **96.7%（29/30）** |
| 加权实现进度（PARTIAL=0.5） | 63.3% | 98.3% |
| 原问题关闭率 | 0/11 | **11/11（100%）** |
| 阻塞级 / 高危 / 中危 / 低危产品问题 | 0 / 6 / 4 / 1 | **0 / 0 / 0 / 0** |

唯一 `PARTIAL` 是最新代码尚未人工推送，因而没有 `e0520da` 或其文档子提交的 GitHub Actions / nightly 同 SHA 回执；它是外部验收证据缺口，不是已确认的产品缺陷。

### 1.2 最新验证

| 验证项 | 结果 | 证据 |
|---|---|---|
| 隔离目标 schema 重建 | PASS | 删除并重建 `quantos` schema，15/15 migration 顺序应用 |
| `make QUANTOS_F05_TARGET_ISOLATED=1 f05-target-check` | PASS | 事件 PostgreSQL 7/7、Storage PostgreSQL 1/1、Supabase Storage 1/1；精确 SHA 回执为 `PASS` |
| `make rls-policy-test` | PASS | 36 张 tenant 表静态检查通过；目标数据库匿名/认证角色负向检查通过 |
| `make f05-check` | PASS | source Gate、4/4 负向 Gate、事件库 10/10、存储库 12/12 |
| F05 核心覆盖率 | PASS | line 95.03%，region 94.29%；均超过 90% / 85% 门槛 |
| 目标容量与一致性 | PASS | 10,000 条链完整读回，outbox open=0，1,000 次投递仅 1 个 applied receipt |
| correlation 查询 | PASS | PostgreSQL 同一 10,000 行完整查询使用 Index Scan；复核执行时间 8.452ms，低于 5 秒 |
| GitHub Actions 最新同 SHA | PARTIAL | 修复提交尚未由 GitHub Desktop 人工推送，暂无远端回执 |

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
| C16 | 10,000 条无丢失与最终一致 | PASS | 完整链 10,000/10,000，最终 open outbox=0 |
| C17 | Realtime 漏通知/断连/重连 | PASS | 数据库补偿扫描处理全部提交事件，显式 deadline=10 秒 |
| C18 | 1,000 次并发投递一次副作用 | PASS | 8 个 worker 保持低于目标 session pool=15，applied receipt=1 |
| C19 | correlation 完整链查询 ≤5 秒 | PASS | 完整客户端读取验证无丢失；同一查询数据库执行 8.452ms |
| C20 | 一次性 PostgreSQL migration 重建 | PASS | CI Gate 已接入并失败关闭 |
| C21 | 隔离 Supabase schema 重建 | PASS | 本轮目标项目 15/15 migration 成功 |
| C22 | PostgreSQL RLS 目录与负向访问 | PASS | 静态与数据库执行均通过 |
| C23 | 目标 Supabase RLS 默认拒绝 | PASS | `make rls-policy-test` 远端检查通过 |
| C24 | append-only 数据库强制约束 | PASS | UPDATE/DELETE/TRUNCATE/父级级联均有负向测试 |
| C25 | actor/tenant/correlation/causation | PASS | 模型、migration、持久化与回放均完整 |
| C26 | tenant-scoped correlation replay | PASS | API、CLI 与双租户负向测试通过 |
| C27 | 覆盖率及 nightly branch Gate | PARTIAL | line/region 门槛本地通过，branch Gate 已配置；等待最新提交远端 nightly 回执 |
| C28 | 格式、Clippy、单元质量门禁 | PASS | 本轮编译、格式、Clippy、22 个库测试通过 |
| C29 | 可观测性与运维说明 | PASS | backlog/lease/retry/dead-letter/checkpoint 健康信息和恢复 Runbook 已交付 |
| C30 | 独立、失败关闭、绑定 SHA 的 Gate | PASS | 目标 Gate 缺变量/脏树时失败；本轮产生精确 SHA 结构化 PASS 回执 |

## 三、问题清单及风险分析

### 3.1 原 11 项问题

| 原编号 | 等级 | 状态 | 关闭依据 |
|---|---|---|---|
| A01–A06 | 高危 | CLOSED | fencing、append-only、provenance、tenant replay、死信恢复、目标 Gate 均通过源代码和数据库验证 |
| A07–A10 | 中危 | CLOSED | 覆盖率、Realtime deadline、容量一致性、健康信息和 Runbook 均通过本地或目标验收 |
| A11 | 低危 | CLOSED | README、恢复 Runbook、测试矩阵与验收边界已补齐 |

### 3.2 当前开放验收项

| 编号 | 等级 | 所属模块 | 具体表现 | 影响范围 |
|---|---|---|---|---|
| V01 | 中危 | GitHub Actions / F05 nightly | `00906b3` 至 `e0520da` 的修复尚未人工推送；缺少最新代码的主 CI、一次性 PostgreSQL Gate 和 branch coverage 同 SHA 回执 | 不能把本地及目标项目成功结果直接等同于 GitHub 主干回归完成；在回执收集前保持 `FIX_VALIDATION` |

### 3.3 风险边界

目标 Supabase 的数据库与 Storage 功能已通过，但 correlation 的五秒结果是 PostgreSQL 服务端执行时间；从本地开发机跨网络传输 10,000 个完整事件不代表同区域应用端到端延迟。正式部署时仍应由 F09 可观测性对应用端 P95 和 Realtime 投影延迟持续采样。

## 四、整改建议

1. 通过 GitHub Desktop 推送包含 `e0520da` 及本报告的最新提交。
2. 收集最新完整 SHA 的 QuantOS CI 和 F05 Event Nightly 回执，确认一次性 PostgreSQL Gate 与 branch coverage ≥85%。
3. 若两项均通过，关闭 V01，将 F05 `review_status` 从 `FIX_VALIDATION` 更新为 `ACCEPTED`；若失败，只按失败回执新增问题，不回退已取得的目标 Supabase 回执。
