# F07 Nightly 调度延迟复验记录

> 日期：2026-09-24。范围：隔离 Supabase PostgreSQL 的 F07 调度 P95；正式回执按完整源码 SHA 单独判定。

## 首次同 SHA Nightly

- GitHub Actions [F07 Runtime Nightly #1](https://github.com/SumAlphaAI/QuantOS/actions/runs/36014816535) 运行于 `1e143102620e8a9ec1efeb70f73767924d58e2e6`，结论 `FAIL`。
- 三个 F07 Actions Secrets 已配置；CA、依赖安装、迁移与 RLS 均通过。数据库测试 3/4 通过，100 次调度 P95 **326.65 ms > 200 ms**。Gate 在强杀恢复前失败，因此该次 Nightly 没有恢复及覆盖率正式结果。
- 失败回执 Artifact `f07-nightly-1e143102620e8a9ec1efeb70f73767924d58e2e6` 已上传，不能作为 PASS 回执。

## 整改

原 `schedule_run` 每次通过事务开始、Workflow 写入、速率窗口写入和提交四次数据库往返。现将 Workflow 插入与速率计数放入同一条 PostgreSQL data-modifying CTE；新增 `effective_limit` 约束，使超限时整条语句回滚，保留事务原子性。幂等重放不重复计数；约束错误仍映射为速率拒绝。前向 migration 为 `20260924110000_f07_atomic_schedule.sql`。覆盖率诊断入口在请求 branch 指标时传入 `--branch`，避免空分支样本误报。

## 本地验证与限制

| 验证 | 结果 |
|---|---|
| 前向 migration + 目标 RLS | 隔离 Supabase PASS |
| 负向调度测试 | PASS；验证撤销、能力/幂等冲突、速率超限及拒绝时 Workflow 和配额均回滚 |
| `make f07-db-check` | 3/4 数据库测试通过；开发机到远端 100 次调度 P95 **1126.52 ms > 200 ms**，仍 FAIL；退役检查 `pendingRuns=0` |
| Rust fmt、定向 Clippy、migration 静态检查 | PASS |

开发机跨区域 P95 仅用于诊断，不替代 GitHub runner 或正式部署区域回执。新提交推送后须在同一完整 SHA 上重跑 F07 Nightly；即使调度通过，仍需独立核验 100/100 强杀恢复、唯一 Artifact、line ≥90%、region ≥85%、branch ≥85%、HTTP/Storage 目标烟测及 F06 前置验收。当前 F07 保持 `FIX_VALIDATION`。
