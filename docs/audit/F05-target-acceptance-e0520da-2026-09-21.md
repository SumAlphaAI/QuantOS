# F05 隔离 Supabase 正式验收回执（e0520da）

> 2026-09-21 再复验修订：本报告保留历史运行的真实成功状态，但不再作为 F05 全部 ACCEPTED 的依据。A07 覆盖率排除了持久化适配器；A09 旧容量测试直接写完成状态，五秒指标仅计数据库执行。本轮已修订容量测试，待新回执。当前状态与开放项以 [F05 全面复审报告](./F05-comprehensive-review-2026-09-21.md) 为准。


- 验收日期：2026-09-21
- 目标类别：隔离 Supabase 项目
- 源码完整 SHA：`e0520da0dd6ff04bbac9269be54db776f6129c38`
- 工作树：`dirty=false`
- migration digest：`sha256:347db18d854bae424ba50537dfbbffc8289eaac83ce9ad7b5ac1c61190a7c011`
- 结构化回执：`artifacts/f05/target.json`
- 结论：**PASS**

## 一、目标重建

经用户确认 `.env.local` 指向隔离测试项目并批准重置后，执行 `make QUANTOS_DB_RESET_CONFIRM=reset_remote_schema db-reset`：

- 删除并重建远端 `quantos` schema；
- 按文件名顺序应用 15/15 migration；
- 最后一个 migration 为 `20260921090000_f05_ledger_integrity_and_replay.sql`；
- migration ledger 与本地文件 checksum 机制保持启用；
- 未在报告、日志或提交中记录连接串、服务角色密钥等秘密。

## 二、正式门禁结果

执行命令：

```text
make QUANTOS_F05_TARGET_ISOLATED=1 f05-target-check
```

结构化回执时间：`2026-09-21T05:03:50.132Z` 至 `2026-09-21T05:13:10.407Z`。

| 检查 | 结果 | 关键数据 |
|---|---|---|
| `quantos-event` PostgreSQL integration | PASS | 7/7，536.07 秒 |
| `quantos-storage` PostgreSQL integration | PASS | 1/1，10.69 秒 |
| Supabase Storage live integration | PASS | 1/1，11.09 秒 |
| 目标 RLS | PASS | 36 张 tenant 表静态基线与远端负向访问通过 |
| F05 本地 Gate | PASS | source Gate、4/4 负向 Gate、22/22 库测试 |
| 核心覆盖率 | PASS | line 95.03%，region 94.29% |

`target.json` 最终内容的关键字段为：

```json
{
  "schema": "quantos-f05-target-acceptance/v1",
  "status": "PASS",
  "passed": true,
  "targetClass": "supabase-isolated-project-or-database-branch",
  "source": "e0520da0dd6ff04bbac9269be54db776f6129c38",
  "dirty": false,
  "migrationDigest": "sha256:347db18d854bae424ba50537dfbbffc8289eaac83ce9ad7b5ac1c61190a7c011",
  "checks": ["test-f05-live", "test-supabase-storage-live"]
}
```

## 三、量化验收

| 验收项 | 结果 | 证据 |
|---|---|---|
| 重复、乱序、重启、死信 | PASS | 单元与 PostgreSQL 状态机场景通过 |
| lease fencing | PASS | 陈旧 outbox/inbox token 均不能提交 |
| Realtime 漏通知与重连补偿 | PASS | 数据库扫描处理全部已提交事件；显式 deadline 为 10 秒 |
| 1,000 次同事件投递 | PASS | 8 个受控 worker；最终仅 1 个 `projection-idempotent` applied receipt |
| 10,000 条事件无丢失 | PASS | 完整链读回 10,000/10,000；最终一致后 open outbox=0 |
| correlation 查询 ≤5 秒 | PASS | 同一完整查询 PostgreSQL Index Scan；复核 10,000 行执行 8.452ms |
| append-only | PASS | UPDATE、DELETE、TRUNCATE 与父表级联删除均拒绝 |
| tenant replay | PASS | tenant + correlation 双键过滤，双租户负向场景通过 |
| Storage | PASS | 对象上传、读取、hash/manifest 注册与清理成功 |

验收结束后的只读汇总为：15 个 migration、10,012 条事件（含全部场景夹具）、open outbox=0、幂等消费者 applied receipt=1。该汇总不包含任何业务生产数据。

## 四、验收中发现并修复的问题

| 提交 | 修复 |
|---|---|
| `00906b3` | 将目标并发 worker 限制为 8，低于 Supabase session pool 上限 15 |
| `4c2496a` | 以 Binary COPY 在一个事务中准备 10,000 条 event/audit/outbox 一致夹具 |
| `1da5a59` | 批量形成容量投影最终一致状态，避免远端逐事件往返掩盖容量结论 |
| `c231346` | 清理幂等用例的 outbox；完整链无损读取与数据库端查询 deadline 分开验证 |
| `0ee0c12` | 依据目标实测为 Realtime 重连补偿设置明确 10 秒 deadline |
| `e0520da` | 修正断连期间新增事件后的 dispatched 数量断言 |

## 五、验收边界与后续动作

本回执证明上述完整 SHA 在隔离 Supabase 目标上的数据库、RLS 与 Storage 行为。correlation 的五秒结果测量 PostgreSQL 服务端执行；本地开发机到 Supabase 的公网传输不作为同区域应用延迟证据，部署后的应用端 P95 由 F09 监控继续验证。

历史提交 `45d1413314462deec7bda86679ada446b6163e33` 的首次远端执行曾被 GitHub 账户付款/Actions spending limit 状态阻止。阻断解除后，完整提交 `6b06a90de275fb38f5efb7982fd2e09dd5963581` 的 QuantOS CI Run [35574043608](https://github.com/SumAlphaAI/QuantOS/actions/runs/35574043608) attempt 2 与 F05 Event Nightly Run [35590560951](https://github.com/SumAlphaAI/QuantOS/actions/runs/35590560951) 均成功；详情见 [同 SHA 远端验收回执](./F05-remote-acceptance-6b06a90-2026-09-21.md)。目标 Supabase 回执与远端主干/nightly 回执共同满足 F05 最终 `ACCEPTED` 条件。
