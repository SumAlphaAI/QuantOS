# F08 原 11 项问题关闭复核与跨秒健康探测补修

本轮从干净的 `05fd24e18f677ef6b5df9484e1b0490a83d1e97c` 开始，逐项核对[初审归档](./F08-initial-review-2026-09-25.md)、实现、测试、覆盖率和远程回执。该基线相对历史验收 SHA `0a154e887d8f2bd283c8b7bdd9db927d1094341b` 仅有文档及证据变化。原报告归档 SHA-256 为 `7ae679f1dc3ff2d856caf72986694ed776e5f5caf202b7ac85593421b1b1b46c`，与重构前报告字节一致。

## 逐项关闭核验

下表 CLOSED 表示问题的代码与本地验证完成；本轮新增源码修复的远程验收仍待取得。Manager 实现在 [lib.rs](../../crates/quantos-engine-manager/src/lib.rs)，持久化实现在 [durable.rs](../../crates/quantos-engine-manager/src/durable.rs)；集成测试见 [python_mock_engine.rs](../../crates/quantos-engine-manager/tests/python_mock_engine.rs)，准入/策略负向测试见 [manager_negative.rs](../../crates/quantos-engine-manager/tests/manager_negative.rs)。

| 编号 | 级别 | 本轮实现与测试核验 | 结果 |
| --- | --- | --- | --- |
| F08-B01 | 阻塞级 | 默认注册拒绝；签名绑定 manifest/制品/策略；受监督制品摘要及握手身份核验。`malformed_approvals_never_register`、`supervised_release_requires_durable_state_and_exact_artifact`、握手维度拒绝和制品篡改恢复测试通过。 | CLOSED |
| F08-B02 | 阻塞级 | Manager 持有 Child、退出检测、重新校验及启动、退避和停止；`manager_supervises_three_real_crashes_without_test_owned_restarts` 通过。测试不替 Manager 重启。 | CLOSED |
| F08-H01 | 高危 | Execute/Stream 外层绝对 deadline 包住连接、退避和读取；控制 RPC 两秒限制。超时、长流及非可信控制 RPC 测试通过；本轮跨秒误判修复后保持确定性错误码。 | CLOSED |
| F08-H02 | 高危 | 签名策略检查 tenant/region/分类/成本/GPU；租户每秒窗口；冲突路由拒绝。`invalid_request_and_signed_route_dimensions_fail_before_network`、`signed_rate_limit_and_stream_deadline_are_enforced` 通过。 | CLOSED |
| F08-H03 | 高危 | `ps` 采集实际 RSS/CPU，超额调用停止与共享隔离；真实 RSS 超额测试通过。CPU/GPU 硬隔离按用户决定移除，不能表述为已实现硬隔离。 | CLOSED |
| F08-H04 | 高危 | 请求/响应身份、schema 和 capability 校验；私有持久目录、fsync pending/结果、跨进程同键锁和安全重放策略；Mock SQLite 缓存。强杀 Manager、重放、非安全重试拒绝、改输入冲突及不可信响应测试通过。 | CLOSED |
| F08-H05 | 高危 | 流式并发/RSS/速率和整段 deadline；执行归属及跨租户取消拒绝；Mock 运行中检查取消。`manager_cancel_interrupts_owned_running_execution`、流中断和顺序拒绝测试通过。 | CLOSED |
| F08-M01 | 中危 | heartbeat 共享 readiness、故障摘流和恢复；本轮修复跨秒健康回显误拒绝。`heartbeat_removes_failed_engine_and_restores_ready_route`、无 monitor 复探及新增跨秒测试通过。 | CLOSED |
| F08-M02 | 中危 | 共享退避及单半开探针；重注册清旧路由、拒绝抢占；熔断持久状态绑定 manifest digest。重建 Manager 的状态恢复及重注册负向测试通过。 | CLOSED |
| F08-M03 | 中危 | 七类 Engine 调用共用 [harness](../../engines/tests/engine_contract_harness.py)；错误、流中断、监督恢复测试及逐文件 Python Gate；稳定版/Nightly Rust Gate 与覆盖率负向探针通过。127 项豁免未扩容。 | CLOSED |
| F08-L01 | 低危 | [Runbook](../runbooks/f08-engine-manager.md)提供审批、启动、健康、恢复、回滚和证据边界；Makefile 两道 Gate、独立目标工作流及原始回执可重放。 | CLOSED |

计数：阻塞级 2/2、高危 5/5、中危 3/3、低危 1/1，共 11/11；活动代码问题 0。原问题描述与修复追踪继续保存在[归档](./F08-closed-findings-2026-09-26.md)。

## 本轮补修及回归证据

`client_for_engine` 发送 `service_metadata("manager-readiness")` 后，原先再次生成 metadata 校验响应。`build_metadata` 的 `issued_at.seconds` 来自当前时间，跨秒后第二次生成的值与原请求不同，导致健康 Engine 被拒绝。这解释了此前 `rd-agent` 偶发未就绪的可能机制；当次远程日志没有记录请求时间，不能声称已唯一归因。

本轮普通回归也在 `control_rpcs_timeout_within_two_seconds_on_untrusted_engine` 观察到预期 `ENGINE_DEADLINE_EXCEEDED`、实际 `ENGINE_NOT_READY`。新增 `readiness_accepts_exact_metadata_echo_across_second_boundary`，让真实 UDS 服务延迟 1.1 秒后完整回显 metadata：旧实现稳定失败，修复后通过。实现现在只生成一次 readiness metadata，发送克隆并保留原值校验；不放宽身份一致性或两秒时限。

增加一行实现代码后，26 项既有豁免坐标平移一行；127 项条目的编号、理由、类别和源码行哈希保持不变。此操作没有新增豁免。历史报表继续按原提交的源码和豁免清单解释。

## 本轮执行记录

[本地机器可读回执](./evidence/f08-closure-20260926/receipt.json)保存提交前工作树源码文件摘要、日志和覆盖率产物摘要；不冒充远程回执。

| 验证 | 结果 |
| --- | --- |
| 新跨秒用例：修复前 / 修复后 | FAIL（预期复现）/ PASS |
| 完整 `make f08-check` | PASS；Rust 55 项，Python 134 项；fmt、Clippy、Ruff、Pyright、逐文件 Python Gate；覆盖率负向探针 3 PASS、1 个 Nightly 专属项 SKIP |
| 完整 `make f08-nightly-check` | PASS；Rust 55 项；覆盖率负向探针 4 PASS |
| 稳定版 Rust | 原始 LLVM line/region 83.86%/82.45%；物理源码行 92.82%、审计豁免后 region 85.49% |
| Nightly Rust | 原始 LLVM line/region/branch 83.88%/82.55%/79.38%；物理源码行 92.81%、审计豁免后 region/branch 85.62%/89.73% |
| Python SDK/Mock | 8/8 生产源文件行覆盖率达标，最低 87.23% |
| 历史回执完整性 | 18 个归档文件摘要全部一致；原目标 9/9 PASS，完整 SHA 一致 |

## 远程验收边界

本轮只读核对了已推送的 `05fd24e18f677ef6b5df9484e1b0490a83d1e97c`：其 [CI](https://github.com/SumAlphaAI/QuantOS/actions/runs/36231461972) 与 [Nightly](https://github.com/SumAlphaAI/QuantOS/actions/runs/36231461986) 均 SUCCESS。此前 `0a154e8` 的三道历史成功回执仍在[原验收记录](./F08-acceptance-0a154e8-2026-09-26.md)中。

本轮修改了源码，故当前 F08 为 `FIX_VALIDATION`。本轮修复提交生成后需以该完整 SHA 重新取得远程 CI、Nightly 和隔离目标回执；三者尚为 NO RECEIPT。原来的 ACCEPTED 结论不自动转移到新提交。
