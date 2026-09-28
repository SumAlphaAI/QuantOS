# F09 整改实施记录（2026-09-27）

后续指标接线、调度和直连 Supabase Gate 的变更见 [续修记录](F09-producer-and-target-followup-2026-09-27.md)；本文件保留当次提交的历史状态。

## 1. 范围与结论

本记录对应 [F09 初审归档](F09-initial-review-2026-09-27.md) 的 14 项问题。整改已覆盖本地 trace、指标入口约束、容量时间窗口、数据库一致性、故障探针和验收入口。**F09 仍不能判定为全部完成**：缺少九类指标在业务路径上的完整生产接线、每分钟部署调度、Execution Gateway 正式写入口和跨服务故障恢复回执。保持计划中的 F09 复审未通过和 F0 Gate 关闭。

原报告 22 个检查点沿用固定分母。当前可完整确认的仍为 01（Rust trace 基础件）及 21（静态规则/模板交付），即 **2/22 = 9.1% 完全满足**；02–06、09–20、22 共 18 项有部分实现，07–08 共 2 项尚缺完整业务链演练。局部改进不折算为任务完成百分比。目标数据库测试仅验证测试阶段 Supabase PostgreSQL，不代表持续运行或生产验收。

## 2. 问题逐项整改与残余风险

| 编号 | 当前状态 | 已实施的修复和验证边界 | 待完成事项 |
| --- | --- | --- | --- |
| B01 | 部分 | Runtime、BFF 写请求记录 correlation ID、状态及错误 trace；同一 ID 返回 HTTP 响应。batch 观测服务与命令并行。 | 梳理所有 F0 写入口与事件 ID 的双向映射；Execution Gateway 正式入口尚未交付。 |
| B02 | 未关闭 | 九类指标缺样本或超过 90 秒会失败并写 `metric_coverage_missing` 告警；SQL 限制数值、时间与来源字段。 | 在 Realtime、风险/组合查询、MV/运营刷新、Storage 和 Vault 实际业务路径产生样本，并部署每分钟调度。 |
| B03 | 部分 | 对真实 `PgEventStore` 和 outbox 消费执行受控故障恢复探针；Engine mock 恢复单测执行。 | 实施 DB 中断、消费者重试/checkpoint、Engine 强杀的同链事件顺序和重复副作用演练，保存目标 trace/log/事件查询。 |
| B04 | 部分 | 新增 F09 CI/Nightly 的可丢弃 PostgreSQL Gate、同完整 SHA 的目标 Gate 脚本和回执结构。 | 取得实际 CI、Nightly、测试 Supabase 同 SHA PASS 回执后再申请验收；源码存在不等于远程运行。 |
| H01 | 已修复 | ADR 原始输入默认故障结果均为 `NOT RUN / NO RECEIPT`，脱敏验证为 `false`，trace 证据为空；生成器负向测试校验。 | 实际故障演练回执应由验收程序填充。 |
| H02 | 部分 | JSONL trace 属性递归脱敏，观测监听仅允许 loopback，Python 观测同样限制绑定范围。 | 运维侧若跨机器访问，需受控代理、认证和目标配置回执。 |
| H03 | 已修复代码 | 大于 90 秒的 tick 间隔或非单调时钟重置持续/连续状态；缺采样失败并发出独立告警；新增断采测试。 | 依赖每分钟实际部署调度和指标生产者验证。 |
| H04 | 部分 | batch 不再因观测地址跳过任务；Runtime/BFF 观测绑定失败使启动失败。 | Execution Gateway 正式业务入口尚未交付，需在其入口实现并行观测和就绪状态。 |
| H05 | 部分 | SQL 对比例/布尔值及时间偏差做约束；缺少新鲜样本不再默认为健康。 | 实际生产者来源身份、每分钟密度与权限收紧仍待业务路径接线。 |
| M01 | 已修复 | outbox 使用原始 `created_at` 计算年龄；DLQ 分子按失败事件 ID 去重，并与同窗口入库事件队列匹配。 | 目标持续负载下再校准阈值。 |
| M02 | 已修复代码 | 按 scope 获取 PostgreSQL advisory lock；窗口状态和告警在同一事务提交，告警有幂等冲突键；并发负向探针。 | 目标持续运行需观察租约/超时。 |
| M03 | 部分 | 新增 dashboard 指标、两套规则、Rust evaluator 双向清单检查。 | 实际看板查询、规则部署和通知目标尚无运行回执。 |
| M04 | 已修复 | SQL 限制 `source` 为注册指标名，敏感属性键拒绝；Rust/Python trace 递归脱敏，非法指标值负向测试。 | 生产者身份仍需由实际角色/入口绑定。 |
| L01 | 已修复 | `observability-check` 仅执行不依赖数据库的测试；`test-f09-live` 必须显式连接目标并启用真实测试。 | 目标回执另行按完整 SHA 运行。 |

## 3. 验证与测试数据库影响

- 本地 `make observability-check`、Rust Runtime/BFF 路由测试、`cargo fmt --all -- --check`、`make db-migration-check` 及 `git diff --check` 已通过。
- `20260927090000_f09_metric_quality.sql` 已应用于用户指定的测试阶段 Supabase PostgreSQL。测试使用 F09 前缀租户与唯一 scope；清理脚本只移除可删除的临时指标、窗口状态及告警。事件日志有 append-only 约束，因此测试租户及事件保留，不强制删除或重写历史。
- 本机没有独立 PostgreSQL 参考库，`make db-schema-diff` 因缺少 `QUANTOS_REFERENCE_DATABASE_URL` 无法完成 catalog 漂移比对。目标 Gate 单独校验完整迁移账本与每个文件的 SHA-256；这不替代参考库漂移检查。CI 的可丢弃数据库 Gate 负责全量迁移重放。
- 真实容量窗口、DB/消费者故障探针以及同 SHA 目标 Gate 的最终结果，以 `artifacts/f09/target.json` 和实际命令退出码为准。回执包含源码 SHA、迁移头及目标环境的不可逆摘要，不包含连接凭据。目标回执位于忽略的本地构建目录，不进入 Git 提交。

## 4. 下一步验收出口

先完成 B02 的九类真实生产者与每分钟调度，以及 B01/H04 的全部 F0 写入口；再执行 B03 的三类同链故障注入和 H02/M03 的目标访问、告警通知检查。最后在同一个完整源码 SHA 下取得 CI、Nightly 和测试 Supabase 目标 PASS 回执，重新核对 22 个检查点后才更新 F09 `review_status` 与 F0 Gate。
