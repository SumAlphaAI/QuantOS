# F08 后续整改：持久请求状态与资源 Gate 范围

> 日期：2026-09-25
> 前次提交：`1c97df2c14abec1f1ab774b6a3f27dc92b49abe4`
> 依据：[初审](./F08-initial-review-2026-09-25.md)、[首轮整改](./F08-remediation-2026-09-25.md)
> 本文记录提交前本地工作树；最终提交 SHA 以本轮 Git 提交为准。

## 一、范围和完成概况

用户明确本系统 **不需要 CPU/GPU 硬隔离**，该要求已从 F08 Gate 移除。受监督进程的 RSS/CPU 采样与超额处置、GPU 能力路由仍保留。初审报告是原范围的历史基线；本轮以用户更新后的范围判定。

按原 24 个检查点逐项重核，当前 **23 PASS、1 PARTIAL、0 FAIL，严格本地完成率 23/24＝95.8%**。剩余 PARTIAL 为 #24 的 Rust 覆盖率与同 SHA 发布证据。初审 11 项问题中 10 项完成本地代码修复，M03 仍因 Rust 覆盖率 Gate 未闭合。F08 保持 `FIX_VALIDATION`，不标记 `ACCEPTED`，不放行 F0 Gate。

## 二、剩余问题的修复明细

| 原问题 | 本轮处理 | 本地证据与边界 |
|---|---|---|
| H03 CPU/GPU 硬隔离缺口 | 按用户决定移出 Gate；保留 RSS/CPU 采样超额处置及 GPU 能力路由。 | 既有真实 RSS 超额进程终止和跨克隆隔离测试通过；不再要求内核 CPU/GPU 硬限额。 |
| H04 幂等与安全重试 | Manager 新增私有持久目录：调用前 fsync pending 记录，跨进程同键文件锁，完成结果原子替换并 fsync；同键改输入拒绝。进程崩溃后，仅 `retry_safe=true` 的已审 Engine 可重放；否则返回 `ENGINE_RESULT_UNCERTAIN` 供 checkpoint/Artifact 对账。正式受监督策略缺持久状态会拒绝注册。Mock 新增可选 SQLite 结果缓存，重启后同键取回原结果。 | 单元测试覆盖冲突、锁、损坏状态拒绝；真实 Manager OS 强杀测试覆盖并发同键拒绝、锁释放、pending 重放和最终一个持久结果；Python Mock 重启缓存与改输入拒绝测试通过。已审 Engine 的外部副作用仍须逐个证明自身幂等，不能仅凭 Manager 锁推定。 |
| M02 熔断状态跨进程丢失 | 与审批 manifest digest 绑定持久 circuit 状态；重建 Manager 时恢复摘流状态，健康复探后开放路由。 | Mock UDS 集成测试覆盖结果与熔断状态重建；无后台 monitor 的 Runtime 编排失败复测促成 deadline 内就绪复探，随后 Mock 17/17 与 Runtime 5/5 通过。 |
| M03 Rust 覆盖率与 Gate | 加入审批/manifest、请求身份与路由拒绝、持久状态、强杀、就绪恢复等负向测试；Nightly 增加独立失败即阻断目标 `make f08-nightly-check`。 | 功能测试和 Python Gate 均通过，但 Rust 数值仍低于计划门槛，故 M03 保持 OPEN。 |

持久目录必须是宿主独占的私有目录。审批密钥不写入目录。`state.json` 原子写入并对文件及目录执行 fsync；每个请求键使用 OS 文件锁，进程强杀时由内核释放。Mock 的 `--state-db` 应位于私有目录，正式受监督 Mock 运行应启用此参数。请求键与结果会随业务增长，需要在发布设计中确定保留期限和容量预算；在幂等保留窗口内不得删掉未对账的 pending 记录。

## 三、本轮测试与未通过 Gate

| 检查 | 结果 |
|---|---|
| `make f08-check`（`UV_CACHE_DIR=/tmp/quantos-f08-uv-cache QUANTOS_SKIP_ENV=1 UV_OFFLINE=1 CARGO_NET_OFFLINE=true`） | **FAIL**，仅 Rust 覆盖率门槛失败；Rust fmt/Clippy、Manager 45 项测试、Ruff、Pyright、Python 132 项及逐源文件 Python 行覆盖率 ≥85% 均通过。测试使用可绑定 Unix socket 的本机执行环境。 |
| `make f08-nightly-check`（`UV_CACHE_DIR=/tmp/quantos-f08-uv-cache QUANTOS_SKIP_ENV=1 CARGO_NET_OFFLINE=true`） | **FAIL**，Rust line/region/branch 合并为 **81.23%/79.72%/67.92%**，低于 90%/85%/85%。稳定工具合并 line/region 为 **81.22%/79.64%**。新增 `durable.rs` 单文件稳定 line/region 为 98.58%/93.29%，不能抵消 Manager 其他源文件缺口。 |
| Python SDK/Mock | 132/132；逐源文件行覆盖率均 ≥85%，Mock 服务 91.07%、CLI 92.31%；Pyright 0 错误、Ruff PASS。 |
| F08 依赖的 Runtime 编排 | `research_orchestration` 2/2，`signal_proposal_orchestration` 3/3；无后台 monitor 时自动就绪复探得到真实回归验证。 |
| 目标验收 | 本轮没有同一最终 SHA 的 CI、Nightly 上传制品或隔离目标环境回执；本地覆盖率诊断不作远程验收。 |

## 四、剩余整改与验收条件

1. 按未覆盖的 Manager 错误、流中断、监督与恢复分支补充有业务意义的测试；稳定 Rust line ≥90%、region ≥85%，Nightly branch ≥85%，不得降低门槛或以 Python 总覆盖率替代。
2. 将 `f08-check` 与 `f08-nightly-check` 绑定同一最终完整 SHA 的 CI/Nightly 回执，并在隔离目标服务验证三条 F08 量化标准、持久目录权限和 Engine 自身幂等性。
3. 通过上述检查后再将 #24、M03 关闭并启动 F08 复审；在此之前保持 `FIX_VALIDATION`。
