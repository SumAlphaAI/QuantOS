# F05 远端与隔离 Supabase 验收记录（dcc2e1e）

- 核验日期：2026-09-21
- 完整提交：`dcc2e1ec540f15be6291a057ad74dd6815e615f7`
- 分支：`main`
- 远端 main：只读核验确认指向上述完整 SHA
- 结论：**FAIL / REMEDIATION_REQUIRED**。QuantOS CI 成功；F05 Event Nightly 与隔离 Supabase 目标 Gate 失败，A07、A09 不能最终关闭。

## 一、运行总览

| 验收面 | 回执 | 结果 | 结论 |
|---|---|---|---|
| QuantOS CI #114 | [Run 35602327844](https://github.com/SumAlphaAI/QuantOS/actions/runs/35602327844) | SUCCESS | 全仓验证、F05 一次性 PostgreSQL Gate、打包、签名与独立下载验签通过 |
| F05 Event Nightly #3 | [Run 35602692783](https://github.com/SumAlphaAI/QuantOS/actions/runs/35602692783) | FAILURE | Linux 上 `quantos-event/src/pg.rs` region 84.78%，低于单文件 85% 阈值 |
| 隔离 Supabase `f05-target-coverage` | [本地结构化失败回执](./evidence/F05-target-dcc2e1e-failure.json) | FAILURE | 远端延迟时序与持久目标残留队列导致 2 个 PostgreSQL 测试失败 |

三个结果均绑定 `dcc2e1ec540f15be6291a057ad74dd6815e615f7`；没有使用其他 SHA 的成功结果替代本轮失败。

## 二、QuantOS CI

QuantOS CI #114 最终为 SUCCESS。主要作业状态：

| 作业 | 结果 | 时长 / 证据范围 |
|---|---|---|
| `verify` | SUCCESS | 18m48s；F05 source Gate、一次性 PostgreSQL Gate、全仓测试、覆盖率、数据库/RLS、SCA、浏览器与打包均通过 |
| `signing-policy` | SUCCESS | 12s |
| `sign-main` | SUCCESS | 7s |
| `verify-download-main` | SUCCESS | 13s；下载制品和正式签名验证通过 |
| `verify-download` | SUCCESS | 3s；主分支下载验签汇总门禁通过 |
| `verify-download-pr` | SKIPPED | main push 的预期分支 |

本次 CI 页面显示 27 个 Playwright 用例通过。与本轮验收直接相关的制品包括：

| 制品 | Artifact | 页面 SHA-256 |
|---|---:|---|
| `ci-browser-comparison-dcc2e1ec540f15be6291a057ad74dd6815e615f7` | [10639199843](https://github.com/SumAlphaAI/QuantOS/actions/runs/35602327844/artifacts/10639199843) | `3678679ffb415b99a7fe9ad286de0c7fa7567d16012fb9442425a5b069b9d831` |
| `f02-download-receipt` | [10641845824](https://github.com/SumAlphaAI/QuantOS/actions/runs/35602327844/artifacts/10641845824) | `dcd14171f2c3ad2e6f5141bf4769a968a508ccc500df4800f7a07b8ff10e4229` |
| `f02-validation-evidence` | [10641295962](https://github.com/SumAlphaAI/QuantOS/actions/runs/35602327844/artifacts/10641295962) | `aba7ae9f255e6d41ad18b04ad1a8be6331b9361786502825a7412bef8c9fc268` |
| `quantos-build-artifacts` | [10641405996](https://github.com/SumAlphaAI/QuantOS/actions/runs/35602327844/artifacts/10641405996) | `87f432e0ef4bb5b5dc9c5007e4a6fc037c9cd516402284bb0a47d41eb0761298` |
| `quantos-build-inputs` | [10641555824](https://github.com/SumAlphaAI/QuantOS/actions/runs/35602327844/artifacts/10641555824) | `5f35bfb07ab29d1aa6800544fc59bc6ddb72fca8e3761d4f6e1d1f8581866fd9` |

GitHub 的 Node.js 20 action 兼容性提示为 warning，不改变本次 CI 成功结论。

## 三、F05 Event Nightly

Nightly 在全新 PostgreSQL 服务中已经完成以下检查：migration 重建、RLS、事件/存储数据库测试、1,000 次并发投递、10,000 条正式消费者一致性和 HTTP 故障测试。结构化测量为：

- `eventCount=10000`、`uniqueSideEffects=10000`；
- `dispatched=10000`、`appliedReceipts=10000`；
- `checkpointNextSequence=10001`；
- 消费耗时 40.737s；
- 完整客户端 correlation 链取回 156.435ms，满足 ≤5s；
- `consumerPath=PgEventStore::poll_outbox_once`。

最终失败来自跨平台覆盖率差异。Linux 结果：

| 源文件 | line | region | branch |
|---|---:|---:|---:|
| `quantos-event/src/pg.rs` | 97.22% | **84.78%** | 84.21% |
| `quantos-storage/src/pg.rs` | 98.67% | 86.69% | 85.00% |
| `quantos-storage/src/supabase_storage.rs` | 98.55% | 95.31% | 100.00% |

`quantos-event/src/pg.rs` 为 507/598 regions，达到 85% 至少需要 509/598；缺少 2 个 covered regions。Gate 正确失败，不能降低或四舍五入阈值关闭 A07。

Nightly 制品：[`f05-nightly-dcc2e1ec540f15be6291a057ad74dd6815e615f7`](https://github.com/SumAlphaAI/QuantOS/actions/runs/35602692783/artifacts/10640875082)，页面 SHA-256 `4a367a1fed1c0637c03d7b9b463631b9c486e0b3d0654cad9c9f15640a756969`。

## 四、隔离 Supabase 目标 Gate

使用 `.env.local` 指向的已批准隔离项目执行 `QUANTOS_F05_TARGET_ISOLATED=1 make f05-target-coverage`。工作树在启动时为干净状态，回执绑定完整 SHA，未输出或归档秘密。

两个失败均属于验收夹具的目标环境适应性问题：

1. `postgres_rejects_invalid_appends_and_recovers_busy_and_duplicate_receipts` 在第一次远端操作完成后，仍以测试开始时的固定 `now + 2s` 再领取。生产代码以实际完成时间加 1 秒设置 retry；远端往返超过 1 秒后，固定时刻可能仍早于 retry 时刻，因此 `duplicate_skipped` 为 0。
2. `postgres_ten_thousand_event_chain_is_lossless_and_eventually_consistent` 的 worker 会全局领取可用 outbox，而测试假定每个领取项都属于本用例租户。持久隔离目标已有其他测试租户的未完成队列，handler 因租户不匹配失败。

失败后的只读统计为：`dispatched=10024`（15 个租户）、`leased=10`（2 个租户）、`pending=9991`（2 个租户）。该状态来自验收夹具，重跑前必须重置隔离 schema 或实现可重复的目标级清理；不得直接重跑并将污染状态视为产品数据。

## 五、验收结论与整改顺序

本轮证明 QuantOS CI、正式打包与验签成功，也证明修订后的 10,000 条本地/CI PostgreSQL量化场景满足 A09 指标。但 A07 的 Linux 单文件 region 门槛失败，Supabase 目标回执也未完成，因此 F05 继续保持 `FIX_VALIDATION`：

1. 补齐 `quantos-event/src/pg.rs` 至少 2 个 Linux region，保留单文件 85% 策略；
2. 将 retry 覆盖测试的第二次观察时间建立在实际完成时间之后；
3. 使目标 Gate 对持久目标可重复：重置已批准的隔离 schema，或在 Gate 中建立边界明确的测试数据清理；
4. 修复后生成新提交，人工推送，再对同一新 SHA 重跑 QuantOS CI、F05 Event Nightly 与 `f05-target-coverage`；
5. 三项均成功后再将 A07、A09 从 `FIXED_LOCAL` 更新为最终 `CLOSED`。

后续执行还确认：隔离 schema 重建完成后，Supabase pooler 可能在短暂传播窗口内关闭首次 TLS 连接。整改为测试辅助客户端最多重试三次、每次间隔一秒；这不会放宽业务重试、TLS 校验或验收断言。
