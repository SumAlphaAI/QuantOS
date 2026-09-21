# F05 远端验收回执核验（4e6f784）

- 核验日期：2026-09-21
- 完整提交：`4e6f7843b2dcb60d907c2dc957dba4e708282eea`
- 分支：`main`
- 提交：`fix(f05): harden event ledger and recovery gates`
- 结论：**未通过；F05 一次性 PostgreSQL Gate 发现集成测试状态隔离缺口**

## 一、同 SHA 工作流回执

| 工作流 | Run | 结果 | 时长 | 制品 |
|---|---:|---|---:|---:|
| QuantOS CI | [35555899224](https://github.com/SumAlphaAI/QuantOS/actions/runs/35555899224) | FAIL | 20m 53s | 2 |
| F01 Clean Room | [35555899260](https://github.com/SumAlphaAI/QuantOS/actions/runs/35555899260) | PASS | 19m 32s | 2 |
| F03 Protocol Acceptance | [35555899256](https://github.com/SumAlphaAI/QuantOS/actions/runs/35555899256) | PASS | 2m 1s | 1 |
| F04 Core Branch Coverage | [35555899270](https://github.com/SumAlphaAI/QuantOS/actions/runs/35555899270) | PASS | 1m 55s | 1 |
| Frontend Baseline (FEP-0) | [35555899249](https://github.com/SumAlphaAI/QuantOS/actions/runs/35555899249) | PASS | 3m 31s | 0 |
| QuantOS Compatibility | [35555899321](https://github.com/SumAlphaAI/QuantOS/actions/runs/35555899321) | PASS | 3m 35s | 3 |

`F05 Event Nightly` 仅支持 schedule / workflow_dispatch，本次 push 没有对应执行。

## 二、F05 PostgreSQL Gate 结果

主 CI 的源码 Gate、migration/RLS catalog 检查以及大部分数据库场景通过。一次性 PostgreSQL Gate 的结构化失败回执与本提交绑定：

- `source`: `4e6f7843b2dcb60d907c2dc957dba4e708282eea`
- `dirty`: `false`
- `migrationDigest`: `sha256:347db18d854bae424ba50537dfbbffc8289eaac83ce9ad7b5ac1c61190a7c011`
- 事件测试：4 PASS / 3 FAIL
- 已通过：tenant-scoped correlation、append-only mutation rejection、1,000 次幂等竞争、lease fencing、死信恢复
- 失败：claim/reclaim、Realtime 补偿、10,000 事件一致性

三个失败的共同原因是前一测试留下的可领取 outbox 状态进入后续全局 worker 扫描：

| 场景 | 实际 | 期望 |
|---|---:|---:|
| 第三个 worker 领取 | 非空 | 空 |
| Realtime 首轮处理 | 5 | 3 |
| 10,000 事件处理 | 10,003 | 10,000 |

这证明业务 fencing、append-only 和 tenant replay 断言本身已经执行，但测试没有把自己创建的 outbox 行全部推进到终态，导致同一隔离数据库内的串行用例相互污染。

## 三、整改与复验条件

本轮已在后续提交候选中完成以下修复：

1. claim/reclaim 测试在断言后以当前 lease token 将两个 outbox claim 标记为 dispatched。
2. tenant correlation/append-only 测试在结束前通过正常 polling consumer 路径处理两个测试事件。
3. 保留数据库级 append-only 约束，不通过删除 event/audit 历史清理测试数据。

本地补充验证：

- F05 Rust 单元测试：PASS
- PostgreSQL integration target 编译：PASS
- `quantos-event --all-targets` Clippy：PASS
- Supabase Storage 上传/读取/manifest/清理往返：PASS（1/1）

`.env.local` 指向的 Supabase PostgreSQL 当前尚未应用本提交新增的 F05 migration，写入在 `event_log.actor_id` 缺列处失败，未形成目标数据库成功回执。复验需满足以下任一条件：

1. 将修复提交推送后，由主 CI 的一次性 PostgreSQL 服务生成 clean、同 SHA 的 PASS 回执；
2. 在明确为隔离 Supabase 项目或数据库分支的目标上应用 migration，再执行 `make f05-target-check`，生成同 SHA 的 PostgreSQL 与 Storage 回执。

主 CI 后续 `sign-main` / `verify-download-main` 因 verify job 失败而跳过；独立 `verify-download` job 同时报告 GitHub 账户账单失败或 spending limit 不足。该账户级问题不属于 F05 代码缺陷，但在完成正式制品链路前仍需处理。
