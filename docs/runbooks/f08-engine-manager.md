# F08 Engine Manager 启动、恢复与回滚

## 准入

Manager 默认拒绝 `register_engine`。部署控制面须在独立审核后固定 Engine manifest、不可变制品文件及路由策略，由 `f08-approval` 对三者生成绑定签名。审核密钥以 `QUANTOS_ENGINE_APPROVAL_KEY_HEX` 从受控启动环境提供给签发命令；不要写入仓库、日志或 Engine 环境。运行宿主用相同密钥及私有状态目录构造 `EngineManager::with_durable_state`，并通过 `register_supervised_engine` 注册本地 sidecar。签名策略 `requires_supervision: true` 若未配置持久状态目录会被拒绝。注册时和每次重启时核验制品 SHA-256；每次连接核对 `GetMetadata` 的名称、版本、capabilities 和 schema，再查 readiness。未审核、签名变化、制品变化或身份不一致均拒绝。

`EngineApproval::sign_for_local_fixture` 仅用于合成测试；它签入宽松本地策略，不得用作部署批准。部署策略使用 `sign_with_policy` 或如下签发命令，并明确列出租户、区域、数据分类上限、成本上限、GPU 能力、每秒请求上限、CPU 上限、是否要求进程监督以及 Engine 是否已证明可安全重试。生产本地 sidecar 设置 `requires_supervision: true`；没有可证明幂等实现时设置 `retry_safe: false`。Engine 无法从请求推断数据敏感度、成本或 GPU 需求，Runtime 必须调用带可信 `EngineDispatchContext` 的接口；默认上下文按最高敏感度和成本处理，偏向拒绝。

签发示例（路径为审核完成后的实际文件，输出不得覆盖）：

```bash
QUANTOS_SKIP_ENV=1 cargo run -p quantos-engine-manager --bin f08-approval --locked -- \
  manifest.json routing-policy.json engine-artifact.whl F08-reviewer approval.json
```

签发命令要求环境变量 `QUANTOS_ENGINE_APPROVAL_KEY_HEX`；命令行中不放密钥。`approval.json` 与 manifest、制品、策略的 SHA-256 及审核记录一起归档。要防止 UDS 本机冒名，socket 放在仅运行账户可进入的私有目录；不要把测试使用的 `/tmp` socket 路径作为部署配置。

## 启动与请求处理

1. 宿主加载审核记录、manifest、路由策略及密钥。先验证签名和制品，再注册 sidecar 的绝对可执行路径、固定参数和制品路径。Mock Engine 作为受监督服务运行时传入私有 `--state-db` 路径，使相同请求键的结果在 Engine 进程重启后保留；正式 Engine 取得 `retry_safe=true` 审批前须另行证明其副作用幂等。Manager 在首次调用时启动进程；应在开放入口前调用 `health` 并启动 `start_health_monitor(interval)`，确认 ready。
2. Runtime 将 tenant、actor、correlation、causation、capability、schema、snapshot/policy 引用、idempotency key、绝对 deadline 和可信路由上下文交给 Manager。Manager 对单 Engine 并发、租户每秒速率、采样 CPU/RSS、身份和路由策略执行拒绝；GPU 只用于能力路由。本系统不以 CPU/GPU 硬隔离作为 F08 Gate。所有拒绝均有稳定 `machine_code()`；不记录请求输入、秘密或签名密钥。
3. Manager 同一实例及其克隆共享熔断、速率和幂等结果状态。持久模式在调用前 fsync 未完成请求，跨进程对同一 tenant/capability/key 使用文件锁；成功后原子提交结果。相同请求跨 Manager 进程返回已完成结果；同键改输入返回 `ENGINE_IDEMPOTENCY_CONFLICT`。进程崩溃留下未完成记录时，只有审核策略 `retry_safe=true` 才能重放；否则返回 `ENGINE_RESULT_UNCERTAIN`，由 Runtime checkpoint/Artifact 对账后处置。`ENGINE_DURABLE_BUSY` 表示另一个 Manager 正在执行同一键。当前 Mock 可重放测试使用确定性 Artifact ID；有外部副作用的 Engine 必须先证明自身幂等再获 `retry_safe` 审批。
4. Engine 进程退出后，Manager 在下次调用重新校验制品、启动子进程并等待身份/就绪检查；达到崩溃阈值进入退避，仅一个半开探针可尝试恢复。超 deadline 返回 `ENGINE_DEADLINE_EXCEEDED`；调用方按 Runtime checkpoint 处理后续恢复。

## 观测与故障判断

使用 `EngineManager::snapshot()` 读取注册数、受监督数、开启熔断数、已完成幂等键数和速率窗口数；注册、启动、停止、熔断转换经结构化 `tracing` 事件输出。Python Engine 的 RPC、ready、trace 和指标遵循[服务观测手册](../operations/service-observability-runbook.md)。对 `ENGINE_MANIFEST_UNAPPROVED`、`ENGINE_IDENTITY_MISMATCH`、`ENGINE_ARTIFACT_MISMATCH` 停止调度并核查审核链；对 `ENGINE_RSS_QUOTA`、`ENGINE_CPU_QUOTA` 核查资源配置和进程；对 `ENGINE_DEADLINE_EXCEEDED`、`ENGINE_RATE_LIMITED`、`ENGINE_CIRCUIT_OPEN` 检查队列、deadline、健康和容量。不要通过关闭校验来恢复服务。

## 回滚

停止新请求，等待已受理请求完成或由 Runtime 记录确定性取消结果；保留 checkpoint、审计与 Artifact。调用 `stop_supervised_engine` 终止并摘除旧 sidecar 和路由。使用上一个已审核的完整 manifest/策略/制品/签名组合重新注册，执行身份、ready、五 RPC contract 和隔离租户拒绝检查后恢复调度。不得只回退 Python 文件而保留新签名。回滚演练记录候选完整 SHA、制品 digest、签名审核者、启动/停止时间、健康结果、失败请求和重放结果。

## 可重放本地 Gate 与验收边界

```bash
QUANTOS_SKIP_ENV=1 make f08-check
```

Gate 包含 Rust fmt/Clippy/Manager 测试与物理源码 line ≥90%、逐项豁免后 region ≥85% 覆盖率、Python Ruff/Pyright/全 Engine contract 与逐文件 ≥85% 行覆盖率。`QUANTOS_SKIP_ENV=1 make f08-nightly-check` 另用 Nightly 测量逐项豁免后 branch ≥85%。Rust 原始 LLVM 数值、按物理源码位置合并重复编译实例的数值和每项豁免的启用状态均写入 Gate 日志；清单见 [F08 覆盖率豁免](../audit/F08-coverage-waivers.json)，覆盖率口径及风险见 [M03 关闭记录](../audit/F08-coverage-closure-2026-09-26.md)。负向探针要求缺失/重复生产文件、清空执行行或分支结果时失败；报表未生成的豁免区域不获得额度，若调整后低于阈值仍失败。两道 Gate 均失败即阻断，不含 CPU/GPU 硬隔离检查。UDS 测试需要允许创建 Unix socket 的本机/CI 环境；受限沙箱中的绑定失败不是产品失败。本地 Gate 只证明其实际执行源码；发布候选仍需同一完整 SHA 的 CI、覆盖率和目标服务回执，不能把本地 PASS 改写成远程验收。

本地两道 Gate 通过后固定候选完整 SHA。对该 SHA 等待 `F08 Engine CI` 完成并保存 `f08-ci-<SHA>` 制品，再以同一 ref 运行 `F08 Engine Nightly` 并保存 `f08-nightly-<SHA>` 制品；两份制品均含 `source-sha.txt`、执行日志和对应覆盖率 JSON。只有工作流终态成功、制品 SHA 与候选一致且数值逐项达标时，才进入隔离目标服务验收。重新提交代码须重新取得两份回执。

隔离目标服务使用 `f08-target-<SHA 前缀>` 标签触发独立 GitHub Ubuntu runner；工作流先构建 Mock Engine wheel 并以非 editable 模式安装，脚本验证加载路径位于 `site-packages`，再为真实 UDS 和 SQLite 状态建立权限 `0700` 的独立目录。回执记录候选完整 SHA、runner ID、wheel digest、目录权限、逐项测试日志和结果。逐项运行五 RPC 与跨租户拒绝、连续三次真实进程崩溃及恢复、≤2 秒 deadline、运行中 Cancel、Manager 强杀后的安全重放及非安全拒绝、同键幂等、制品篡改拒绝和恶意 RPC 身份拒绝。该 runner 使用隔离合成租户与测试审批密钥，不连接生产凭据。回执仍须核对每个测试的断言细节及 SHA；任一条缺失或失败时保持 `FIX_VALIDATION`。
