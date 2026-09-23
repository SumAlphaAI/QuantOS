# F05 同 SHA 三项验收复核（b4f1c9a）

- 核验日期：2026-09-23
- 完整 SHA：`b4f1c9a2333e1b847070e0851f5afdecaab6b003`
- 结论：**未通过最终验收**。QuantOS CI 成功；F05 Event Nightly 的 Linux 单文件 region 门禁失败；隔离 Supabase 回放在完整载荷传输时出现连接流中断。A07、A09 继续保持待验收，不能用其他 SHA 的成功记录替代。

## 三项回执

| 验收面 | 同 SHA 证据 | 结果与边界 |
|---|---|---|
| QuantOS CI #115 | [Run 35627478381](https://github.com/SumAlphaAI/QuantOS/actions/runs/35627478381) | **SUCCESS**；`verify`、`signing-policy`、`sign-main`、`verify-download-main`、`verify-download` 成功，主分支的 `verify-download-pr` 按预期跳过；27 个 Playwright 用例通过，正式制品签名与下载验签成功 |
| F05 Event Nightly #4 | [Run 35661268108](https://github.com/SumAlphaAI/QuantOS/actions/runs/35661268108)、[结构化摘录](./evidence/F05-nightly-b4f1c9a-failure.json) | **FAIL**；全新 PostgreSQL 的 migration、RLS、集成测试和万条消费完成，`quantos-event/src/pg.rs` 为 602/714 regions = **84.31%**，低于 85% 单文件门槛；保留覆盖率门禁 |
| 隔离 Supabase `f05-target-coverage` | [结构化回执](./evidence/F05-target-b4f1c9a-failure.json) | **FAIL**；已批准的隔离项目重置并重建 15 个 migration；PostgreSQL 测试 7/8 通过，万条正式消费者完成后，完整 payload correlation 查询经跨区域 session pooler 出现 `bytes remaining on stream`，未取得有效目标通过回执 |

Nightly #4 的结构化测量确认 `eventCount=10000`、`uniqueSideEffects=10000`、`dispatched=10000`、`appliedReceipts=10000`、`checkpointNextSequence=10001`。正式 `PgEventStore::poll_outbox_once` 消费用时 **2812ms**；客户端完整载荷取回用时 **117.336603ms**，符合 ≤5 秒指标。性能项已有远端实测数据，但 Nightly 整体因覆盖率失败，不能据此关闭 F05。Nightly 制品 `10667698508` 的页面摘要为 `sha256:416a06c3eb9be09f9a0ecb9be1d528238852035e2befc514d03e19e9b77db90b`。

同 SHA 的 [Nightly #5](https://github.com/SumAlphaAI/QuantOS/actions/runs/35787838557) 在作业启动前失败；GitHub 标注账户付款失败或 spending limit，未生成可用于复验的执行回执。仓库管理员需先解决 GitHub Billing & plans 状态，才能在修复 SHA 上重跑 Nightly；此事不改变 #4 的测试失败结论。

## 整改与下一次验收

1. 增加批量成功确认时 inbox/outbox 租约 token 失效的回滚集成测试，以覆盖 Linux 适配器缺失区域；85% 单文件门槛保持不变。
2. 目标库继续验证真实 migration、RLS、Storage、正式消费者万条一致性、checkpoint 与事件 ID 全链取回。跨区域 pooler 的 ID 传输耗时单独记录，不用它替代完整 payload 性能；完整链 ≤5 秒由远端 Nightly 的 loopback PostgreSQL 实测并严格门禁。两类 `lookupScope` 在回执中明确区分。
3. 修复提交须由 GitHub Desktop 人工推送；在 GitHub 允许作业启动后，收集**新完整 SHA** 的 QuantOS CI、F05 Event Nightly 和隔离 Supabase `f05-target-coverage` 三项成功回执，再核定 C16、C19、C27 与 A07、A09。旧 SHA 的 Nightly 性能数据只能证明旧实现的性能，不能移记为新提交的最终验收。
