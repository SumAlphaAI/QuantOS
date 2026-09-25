# F08 验收推进记录：M03 覆盖率与同 SHA 回执

> 日期：2026-09-25
> 起点提交：`9e7fd0e9795aaf1af9903deb9b4224f3b303009b`
> 状态：本文件记录 M03 补测和 Gate 准备工作；由于 Gate 未通过，尚未固定验收候选 SHA。

## 一、顺序与当前状态

按用户指定顺序执行。第一步 M03 **未关闭**：新增测试均已通过，但 Rust 覆盖率未达计划门槛。第二步的 F08 CI/Nightly 工作流已准备，**未运行、无远程回执**。第三步隔离目标服务 **未运行、无目标回执**。F08 仍为 `FIX_VALIDATION`，不得标为 `ACCEPTED`。

| 步骤 | 已完成的本地工作 | 剩余 Gate |
|---|---|---|
| M03 | 真实 UDS 故障注入覆盖错误身份、RPC 失败、流中断、重复/越序/终止后事件；原始 gRPC 恶意端点验证 Manager 独立校验；sidecar 制品篡改拒绝与恢复、socket 缺失恢复、Manager OS 强杀后安全/非安全重试与跨进程 Cancel。修复 Health `ready=false` 错误放行及错误身份/不完整流未计入熔断；Manager Debug 不再输出审批密钥。 | 稳定 Rust line 90%/region 85%、Nightly branch 85% 均未达。 |
| 同 SHA CI/Nightly | 新增 `.github/workflows/f08-engine-ci.yml` 和 `f08-engine-nightly.yml`，上传完整 SHA、Gate 日志和覆盖率 JSON。 | 本地 Gate 未通过，尚未固定候选 SHA；本机 `gh auth status` 显示凭据无效，沙箱内 `git ls-remote` 无法解析 github.com。 |
| 隔离目标服务 | Runbook 已列出五 RPC、三次真实崩溃、≤2 秒 deadline、幂等与租户隔离的验收记录要求。 | 缺目标服务环境名称、访问入口及隔离测试身份；没有执行或回执。 |

## 二、本地复测证据

`UV_CACHE_DIR=/tmp/quantos-f08-uv-cache QUANTOS_SKIP_ENV=1 UV_OFFLINE=1 CARGO_NET_OFFLINE=true make f08-check`：Rust fmt、Clippy、Manager 54 项测试、Python Ruff/Pyright、Python 134/134 及逐文件 Python 行覆盖率通过；最后 Rust line/region 为 **83.68%/82.25%**，低于 90%/85%，整体 **FAIL**。Mock 服务单文件 Python 行覆盖率 **92.70%**。

`UV_CACHE_DIR=/tmp/quantos-f08-uv-cache CARGO_NET_OFFLINE=true make f08-nightly-check`：最新测量 Rust line/region/branch 为 **83.70%/82.36%/78.44%**，低于 90%/85%/85%，整体 **FAIL**。这些是本地工作树的诊断结果，不是同 SHA CI/Nightly 回执。

依赖 F08 的 Runtime `research_orchestration` 2/2、`signal_proposal_orchestration` 3/3 通过；`git diff --check`、开发计划结构检查和两个新工作流的 YAML 语法检查通过。

## 三、继续执行的条件

1. 继续针对实际未覆盖的 Manager 监督、传输和超时分支补充可观察的故障测试；不得降低门槛或以测试文件行数充当生产代码覆盖。
2. 两道本地 Gate 均通过后提交并固定完整 SHA，在同一 ref 上取得两个 GitHub 工作流终态成功及制品；任何后续代码变更重新触发两道回执。
3. 使用用户指定的隔离目标服务完成 Runbook 验收矩阵，保存绑定同一 SHA 的结构化结果。缺少上述任一回执时保持 `FIX_VALIDATION`。
