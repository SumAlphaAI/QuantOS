# F08 Engine SDK、Manager 与 Mock Engine 整改记录

> 日期：2026-09-25
> 对照：[F08 全面复审报告](./F08-comprehensive-review-2026-09-25.md)
> 原始源码基线：`1a28d9dc6b3c1811d15635d8b7acbffa76b3e8dc`。本记录按提交前工作树执行；最终提交 SHA 以 Git 提交为准。
> 口径：`本地修复`表示代码问题和所述本地测试通过；`部分`表示原问题仍有未实现要求。没有同一最终 SHA 的 CI、Nightly、隔离目标服务回执，不表示 F08 验收通过。

> 本记录是首轮整改的历史快照。后续持久状态修复、更新后的完成率和当前剩余 Gate，见 [F08 后续整改](./F08-continuation-2026-09-25.md)。

## 一、整改概况

原复审的 24 项检查点为 12 PASS、6 PARTIAL、6 FAIL（严格完成率 50.0%）。用户明确取消 CPU/GPU 硬隔离 Gate 后，资源检查点以受监督进程的 RSS/CPU 采样与超额处置、GPU 能力路由为准；按此范围重核为 **22 PASS、2 PARTIAL、0 FAIL，严格本地完成率 22/24＝91.7%**。仍为 PARTIAL 的是 #20 跨 Manager 进程的持久幂等/请求所有权、#24 完整质量 Gate 与发布证据。11 项问题中 8 项本地修复、3 项部分整改；F08 保持 `FIX_VALIDATION`，F0 Gate 不放行。

已交付签名审批、制品 digest 核验、Manager 持有 sidecar 与三次真实崩溃自动重启、完整 Execute/Stream deadline、签名路由和租户限速、真实 RSS/CPU 观测与超额停止、共享熔断/健康摘流、请求身份与 schema 校验、运行中取消归属、五 RPC 公共 harness、逐 Python 源文件覆盖率 Gate、CLI 与专属 Runbook。Runtime 对未启动的排队任务直接取消，避免把不存在的 Engine execution 交给 Manager。

## 二、逐项问题与验证

| 问题 | 本轮状态 | 代码/验证 | 剩余边界 |
|---|---|---|---|
| B01 准入 | 本地修复 | `EngineApproval` 将 manifest、制品 SHA-256、审核者和路由策略签入 HMAC；默认注册拒绝；受监督注册核验制品；连接时核对名称、版本、能力名称/版本、schema 与 readiness；CLI 正反测试。 | 生产审核密钥、审核记录及私有 UDS 目录仍须在目标宿主配置。 |
| B02 监督恢复 | 本地修复 | Manager 自持子进程并重启；Mock 持久崩溃计数模拟连续 3 次 OS 退出，同一请求最终返回；启动、停止、制品复核测试通过。 | Manager 进程自身退出后的请求恢复依赖上层 Runtime checkpoint；本轮无目标环境回执。 |
| H01 deadline | 本地修复 | Execute/Stream 外层绝对 deadline 包含退避、连接、RPC、流读取；Metadata/Health/Cancel 上限 2 秒；流超时确定性错误测试通过。 | 调用方仍需提供有效 deadline；目标负载下 ≤2 秒须复测。 |
| H02 路由与限速 | 本地修复 | 签名策略限制租户、region、分类、成本、GPU 能力和每秒速率；冲突 capability 注册拒绝；旧路由重注册清除。 | 可信分类/成本/GPU 需求须由 Runtime 提供；默认上下文按保守值拒绝。 |
| H03 资源配额 | 本地修复 | 受监督进程用 `ps` 采集 RSS/CPU；实际 1 MiB RSS 超额测试确认终止、跨 Manager 克隆隔离；GPU 可用性进入签名路由策略。 | CPU/GPU 硬隔离不属于本系统 F08 Gate；目标宿主的采样和处置仍需复验。 |
| H04 校验与幂等 | 部分 | Manager/SDK 检查身份、capability、schema、引用、输入、响应身份；同进程共享完成结果，重键改输入拒绝；仅审核为 `retry_safe` 才重试。 | 完成结果仍为内存状态，Manager 进程重启后没有持久幂等结果/请求队列；不能据此宣称跨进程不重复。 |
| H05 流与取消 | 本地修复 | 流式占用并发槽、RSS/速率预算且整段受 deadline 限制；执行前绑定租户归属，跨租户 Cancel 拒绝；运行中 Mock 取消在 2 秒内生效。 | 真实 Engine 的取消合作行为须在目标服务单独验证。 |
| M01 健康/就绪 | 本地修复 | 主动 heartbeat 探测失败共享标记不就绪并摘流；重新探活后恢复路由；跨语言测试覆盖。 | 运行宿主须启动并管理 monitor task。 |
| M02 熔断/路由状态 | 部分 | 三次失败退避、单半开探针、克隆共享熔断；冲突注册拒绝，重注册清旧路由。 | 熔断和健康状态未跨 Manager 进程持久化；进程重启会重建状态。 |
| M03 harness/覆盖率 | 部分 | 七类 Engine 共用五 RPC 正反向 Python harness；131 项 Python 测试通过，SDK/Mock 各源文件行覆盖率均 ≥85%；新增 Rust fail-closed 覆盖率脚本。 | Rust 目标文件 line/region 未达到 90%/85%；Nightly branch 无有效回执，逐 Engine 崩溃恢复矩阵也未全部覆盖。 |
| L01 文档/Gate | 本地修复 | `docs/runbooks/f08-engine-manager.md` 给出审批、启动、探活、回滚与失败处理；`make f08-check` 固定 Rust/Python 测试和覆盖率阈值，低于阈值真实失败。 | Gate 当前失败，不能当作 F08 验收回执。 |

## 三、测试记录与风险

| 检查 | 本轮结果 |
|---|---|
| `QUANTOS_SKIP_ENV=1 UV_OFFLINE=1 CARGO_NET_OFFLINE=true make f08-check` | **FAIL**，仅最后 Rust 覆盖率阈值失败；前置 Rust fmt、Clippy、Manager 单元及七组跨语言集成、Ruff、Pyright、Python 131/131 均 PASS。 |
| Python 覆盖率 | 总行覆盖率 91.04%；SDK/Mock 八个源文件逐个 87.23%–100%，全部超过 85%。 |
| Rust LLVM 覆盖率 | Manager `lib.rs` line 1370/1807＝75.82%、region 1808/2412＝74.96%；审批 CLI line 35/37＝94.59%、region 68/83＝81.93%；合并 line 1405/1844＝76.19%、region 1876/2495＝75.19%。稳定工具的 branch 28 项未提供有效执行计数，不能当 Nightly 结果。 |
| Runtime 兼容 | 两组 F08 依赖的编排测试 5/5 PASS；`cargo clippy -p quantos-runtime --all-targets --offline --locked -- -D warnings` PASS。 |
| 计划与变更 | `node scripts/check-development-plans.mjs` 结构 PASS，平台加载/模型复审仍为 NOT_RUN；`git diff --check` PASS。 |

未经持久化的幂等记录在 Manager 进程重启后丢失；共享 heartbeat task 需要宿主持续运行。CPU/GPU 硬隔离已按用户决定移出 F08 Gate，RSS/CPU 采样和超额处置仍保留。Rust 覆盖率低于计划门槛，且没有同一最终 SHA 的 CI/Nightly/目标环境回执，是验收阻断项。本轮没有豁免这些可测试路径，也没有把本地 PASS 解释为发布许可。

## 四、后续整改与复审条件

1. 将幂等结果、请求归属和熔断恢复状态接入持久状态，与 Runtime checkpoint 用同一请求键核对；执行 Manager 进程强杀、重启、重放后唯一 Artifact/无丢失的测试。
2. 扩充 Manager 错误、重启、健康、路由、流与资源分支测试，使 Rust line ≥90%、region ≥85%，Nightly branch ≥85%；保持当前失败即阻断脚本，不降低阈值。逐 Engine 跑完恢复与取消负向矩阵。
3. 在同一最终完整 SHA 上取得 CI、Nightly 覆盖率及隔离目标服务回执，核验 24/24 检查点、三条量化标准与 F03/F06/F07 依赖后再复审。此前保持 `FIX_VALIDATION`。
