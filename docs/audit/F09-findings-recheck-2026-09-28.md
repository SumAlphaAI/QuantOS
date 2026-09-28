# F09 原始 14 项问题复核与修复归档

## 1. 范围与口径

本次逐项核对[初审原文](F09-initial-review-2026-09-27.md)的全部 14 个唯一 ID，依据当前源码、针对性回归及既有回执，不从 `review_status=ACCEPTED` 反推问题已解决。初始工作区干净，基线为 `994ec5357f4d84f42fe3a151337e43aea7a651e7`；本轮主要源码修复提交为 `1ce64b6f0a33fff4b9ffb35f22c05ea642b3df69`。本报告随附的整理提交另补充 ready 响应中的明确监听失败原因，独立 loopback 回归通过；后续提交 `81cb5ae43f87e7d4b4be059b9eed036b755b4986` 的完整远程回执已核验通过，见[最终验收报告](F09-final-acceptance-2026-09-28.md)。

“代码修复并回归”表示可在当前开发期验证的原始缺陷已解决；“部分／移交”表示原问题的业务或运行期范围仍未解决；新源码完整回执统一由 B04 追踪。当前活动报告仅保留未解决和待验收事项，归档不删除原始失败证据。

## 2. 逐项检查

| ID | 优先级 | 当前判定 | 源码、测试证据与实际边界 |
| --- | --- | --- | --- |
| F09-B01 | 阻塞 | 部分／移交 | `services/{bff-gateway,runtime-gateway}/src/live.rs` 接入写请求 trace middleware，BFF `f09_live_tests`、Runtime `f09_runtime_real_write_trace` 核对真实业务与持久 trace；`scripts/f09-batch-trace-smoke.cjs` 验证市场/组合；Portfolio 另有真实 DB 写入回执。正式 Execution 入口由 X03 交付，部署后所有入口覆盖由 L04 验证。 |
| F09-B02 | 阻塞 | 部分／移交 | `services/capacity-monitor/src/main.rs` 提供每分钟 `--watch`，`scripts/f09-scheduler-smoke.cjs` 验证真实两次调度；五类已交付路径存在采样，D01–D04 四类业务来源缺失，未证明九类持续运行。 |
| F09-B03 | 阻塞 | 部分／移交 | `postgres_capacity_monitor.rs` 的真实会话终止与 outbox 消费重试，以及 `python_mock_engine` 的三次受监管崩溃均有组件回执；D07 跨服务同链、恢复 deadline 和全链秘密扫描仍待 L04。 |
| F09-B04 | 阻塞 | 完整回执闭环／关闭 | 最终源码 `81cb5ae43f87e7d4b4be059b9eed036b755b4986` 的 CI 36367996325、push 36367991959、手动调度 36369094723 全部 SUCCESS；内部 SHA、下载回执、两份目标各 7 个日志摘要与三类写入 trace 均核验通过。详见[最终验收](F09-final-acceptance-2026-09-28.md)，旧回执不转移到新源码。 |
| F09-H01 | 高危 | 代码修复并回归 | `capacity.rs::evaluate_and_persist_locked` 的故障字段为 `NOT RUN / NO RECEIPT`、脱敏为 false、trace 列表为空；`test-f09-adr-input.mjs` 验证生成文档不会把这些值渲染为通过。实际组件探针以独立目标回执记录。 |
| F09-H02 | 高危 | 代码修复并回归 | `service.rs` 在记录及 JSONL 导出两处递归脱敏；Rust 与 Python 观测监听只允许 loopback，远端绑定负例通过。本地 loopback 边界解决原公开监听风险；未来跨机代理认证仍须随部署验收。 |
| F09-H03 | 高危 | 本轮代码修复并回归 | 发现旧修复只拒绝 >90s 间隔，仍会把同一分钟内多次调用累计为连续次数；缺覆盖返回错误时也未清除持久状态。本轮按 UTC 分钟去重、忽略回退调用、保留最后有效 tick，缺覆盖时在事务中清空窗口并写告警；恢复后重新累计。并将规格中配额 >70% 修为首次有效评估即告警，删除错误的额外 15m 条件。新增阈值边界、重复/回退及真实 DB 快速恢复回归。 |
| F09-H04 | 高危 | 本轮代码修复并回归 | 已交付 batch 通过 `run_observed_write_command` 并行启动观测，BFF/Runtime 同步绑定失败直接报错。再发现 HTTP 单个读写错误可终止监听、监听故障不影响 ready；本轮隔离客户端错误、设置读写超时、监听失败令 ready=false。真实 loopback 空闲客户端→后续成功请求及致命监听故障负例通过。Execution 普通入口仍是观测骨架，F06 probe 先分支执行，不能当成 X03 正式入口已交付。 |
| F09-H05 | 高危 | 部分／移交 | `20260927090000_f09_metric_quality.sql` 限制比例/失败值域、时间与固定 source 标识，`require_metric_coverage` 要求九类最近 90s 样本，缺采样不作为健康。但来源标识不等于真实生产者认证，实际身份、权限与持续密度仍待业务任务/L04。 |
| F09-M01 | 中危 | 代码修复并回归 | `capacity.rs::collect_snapshot` 以 outbox `created_at` 算原始入队年龄；DLQ 分子按 event_id 去重、分母与分子均采用相同 event.ingested_at 窗口。实际目标容量用例核对告警族；生产阈值校准属于 L04。 |
| F09-M02 | 中危 | 代码修复并回归 | 按 scope 的 PostgreSQL advisory lock 覆盖评估读写；窗口/告警同事务，冲突键防同时间重复写入。目标测试独立持有同 scope 锁时验证 `ConcurrentRun`；本轮缺覆盖的清空和缺采样告警同样以事务提交。 |
| F09-M03 | 中危 | 部分／移交 | 原一致性脚本只核对 ID。本轮 `f09-rule-contract.mjs` 补查两套规则的阈值、运算符、时长、次数和严重度，负向测试证明 ID 不变的语义漂移也会失败。静态清单仍不等于看板查询/通知可用，运行证据留在 L04。 |
| F09-M04 | 中危 | 代码修复并回归 | SQL `source = metric_name`、敏感属性拒绝，Rust `record_metric` 原样交给 SQL 执行拒绝而不是先脱敏后入库；trace 单独递归脱敏。目标负例覆盖敏感属性与非法比例。真实生产者身份的剩余事项归 H05。 |
| F09-L01 | 低危 | 代码修复并回归 | Makefile 的 `observability-check` 不执行数据库测试；`test-f09-live` 明确要求 DATABASE_URL 并设置 QUANTOS_RUN_F09_POSTGRES_TESTS=1，目标脚本另验完整 SHA/干净工作区。无 DB 时的跳过结果不算目标验收。 |

统计：8 项代码修复并回归（H01–H04、M01、M02、M04、L01），5 项部分／移交（B01–B03、H05、M03），1 项完整回执闭环关闭（B04）；合计 9 项关闭、5 项部分／移交、0 项开发期回执待齐。原 4/5/4/1 严重度总数保持不变。

## 3. 本轮验证与历史回执

- 本地 `make observability-check` PASS：Rust 17/17、BFF 1/1、Runtime 2/2、批处理 trace smoke、Python 9/9、ADR 渲染、规则配置、规则语义负向 2/2。
- Rust fmt、`cargo clippy -p quantos-observability --all-targets --locked -- -D warnings` PASS。
- 直连测试 Supabase 的本机数据库回归在建连时被 macOS TLS 校验拒绝：证书有效期超过系统允许范围。业务断言未执行，不能记为目标 PASS；保留校验，不安装本地数据库，不降低 TLS 要求。
- 远程目标回归：[F09 push 36367388810](https://github.com/SumAlphaAI/QuantOS/actions/runs/36367388810) SUCCESS。下载回执内部 `sourceCommit=1ce64b6f0a33fff4b9ffb35f22c05ea642b3df69`、`dirty=false`、`status=PASS`；7 个日志 SHA-256 全部核对一致。测试 Supabase 数据库组件 3/3 通过，新增缺覆盖清空窗口、快速恢复不沿用旧状态断言随容量用例执行；三类实际写入口的 writeTraces 均存在。这是实际目标执行，区别于本机 TLS 建连失败。
- 历史基线 `994ec5357f4d84f42fe3a151337e43aea7a651e7` 的 [CI](https://github.com/SumAlphaAI/QuantOS/actions/runs/36363563920)、[push 目标](https://github.com/SumAlphaAI/QuantOS/actions/runs/36363560908)、[手动调度](https://github.com/SumAlphaAI/QuantOS/actions/runs/36363592528) 为 PASS。本轮重新核对本地下载件内部完整 SHA、两份目标各 7 个日志 SHA-256、三条 writeTraces；CI `downloadVerified=true`、`formalSignatureVerified=false`。这证明旧基线的 PR 验收，不代表 main 正式签名或新源码验收。

## 4. 状态及后续

最终源码 `81cb5ae43f87e7d4b4be059b9eed036b755b4986` 在开发计划标记 `ACCEPTED`，F09-B04 由同 SHA 完整回执关闭（见[最终验收](F09-final-acceptance-2026-09-28.md)）；业务来源与运行期问题仍留在活动清单和 L04，不能因阶段移交写为已修复。F0 总 Gate 未打开。当前归档记录已验证的修复事实，后续文档整理提交不自动获得旧源码回执。
