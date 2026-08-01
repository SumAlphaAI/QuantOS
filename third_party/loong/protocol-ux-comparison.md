# TP13 Loong Protocol/UX 对照表

Baseline: `eastreams/loong@3ab7936638e4772c1db95ebee7f5f643852697c2`（2026-07-07，dev 分支 HEAD，MIT，Rust workspace）。

Verdict 口径：`aligned`（原则一致）、`diff`（语义差异）、`adopt`（候选采纳）、`reject`（不进入 QuantOS）。

## 六项必查对照

### 1. Session

| 维度 | Loong | QuantOS | Verdict |
| --- | --- | --- | --- |
| 会话模型 | conversation/session 工具（`session_status`、root/child session tool view 交集） | runtime session（`open_session`，AuthContext 租户/工作区/角色绑定，F02） | aligned：都会话内收敛工具面；diff：QuantOS 会话是租户安全边界，Loong 是对话容器 |
| 工具可见性 | 每会话 restricted tool view（root ∩ persisted policy ∩ build-time availability） | engine manifest capability + policy 检查（quantos-policy） | adopt：会话级 restricted tool view 概念可用于 F07 |

### 2. Workflow

| 维度 | Loong | QuantOS | Verdict |
| --- | --- | --- | --- |
| 执行模型 | turn engine（ProviderTurn → ToolIntent → TurnResult，plan/todo 任务） | runtime workflow：schedule → lease claim → execute → audit，幂等 + 确定性回放（R03/R04 已验证） | diff：Loong 是 LLM turn 驱动，QuantOS 是确定性 run 驱动；各自适配场景 |
| 重放 | approval replay（`ApprovalRequestRecord` 重放已批准请求） | input hash 稳定 + artifact 去重的全链路回放 | adopt：approval replay record 模式可用于 X02 审批审计 |

### 3. Tool

| 维度 | Loong | QuantOS | Verdict |
| --- | --- | --- | --- |
| 工具边界 | kernel tool adapter + policy extension（`ToolPolicyExtension`/`FilePolicyExtension`，统一安全执行点） | F08 engine UDS 隔离 + capability manifest + 边界禁止字段（TP01–TP05 adapter） | aligned：都有统一执行点；diff：Loong 在 kernel 内扩展，QuantOS 在进程边界外 |
| 构建期裁剪 | feature gating（`tool-shell` cfg 控制工具是否存在于构建产物） | 无（运行时 manifest 控制） | adopt：高风险工具的构建期剔除值得借鉴（比运行时禁用更强） |

### 4. Memory

| 维度 | Loong | QuantOS | Verdict |
| --- | --- | --- | --- |
| 记忆平面 | kernel 独立 memory plane（`memory-sqlite` feature，connector/runtime/tool/memory 四平面分离） | 无 agent memory 平面；研究证据走 artifact store（content-hash 去重） | diff：QuantOS 刻意没有 agent 长期记忆；adopt（谨慎）：若 F07 需要记忆，平面分离 + 留存元数据是前提 |

### 5. 权限（Authorization / Approval）

| 维度 | Loong | QuantOS | Verdict |
| --- | --- | --- | --- |
| 审批模型 | kernel-bound approval（`ApprovalRequestRecord`、`trusted_internal_context` 标记、审批后 replay） | X02 审批状态机（单用、禁自批、TTL、hash 绑定）+ capability 检查 | aligned：都是显式审批 + 防绕过；diff：QuantOS 审批绑定内容 hash 更严 |
| 内部调用信任 | `trusted_internal_context` 区分内部/外部触发 | 无内部信任旁路（所有调用同口径检查） | reject：内部信任标记是反模式，QuantOS 不采纳 |

### 6. 审计（Audit）

| 维度 | Loong | QuantOS | Verdict |
| --- | --- | --- | --- |
| 审计通道 | `bootstrap_kernel_context_with_audit_sink`（kernel 统一 audit sink 抽象） | runtime 审计事件（cancel/timeout audited）、F06 事件账本、correlation id 索引可观测写入 | aligned；adopt：audit sink 抽象可统一 QuantOS 各 crate 的审计出口 |

## 补充对照（protocol / runtime / UX）

### 7. Protocol

| 维度 | Loong | QuantOS | Verdict |
| --- | --- | --- | --- |
| 契约组织 | `contracts` + `protocol` + `spec` 三 crate 分离（DTO/协议/规范） | F03 proto + JSON docs + 语言特定 SDK | aligned；diff：Loong 纯 Rust 类型，QuantOS 是 proto-first 跨语言 |
| ACP/MCP | 支持 ACP 后端、MCP server 注入（可按策略禁用） | 无（vibe-adapter MCP 已拒绝） | reject：MCP 注入面与 QuantOS 边界冲突 |

### 8. Runtime

| 维度 | Loong | QuantOS | Verdict |
| --- | --- | --- | --- |
| 内核组织 | 单 kernel + 执行平面分离（connector/runtime/tool/memory）+ daemon | runtime kernel（in-memory/Postgres）+ engine manager（UDS sidecar 池） | diff：Loong 进程内多平面，QuantOS 进程边界隔离引擎 |

### 9. UX / UI

| 维度 | Loong | QuantOS | Verdict |
| --- | --- | --- | --- |
| 终端 | TUI shell（`crates/tui`，ratatui 类终端 UI） | desktop terminal frontend（U 系列，React/Vite + Tauri adapter） | diff：Loong 是 TUI，QuantOS 是图形终端；参考其会话/工具状态呈现 |
| 渠道 | Telegram 等 channel 集成 | 无（业务页无第三方渠道） | reject：渠道集成不在 QuantOS 边界内 |

## 结论摘要

Loong 的价值集中在四个设计模式：**会话级 restricted tool view、高风险工具构建期剔除、approval replay record、kernel audit sink 抽象**。`trusted_internal_context` 与 MCP 注入是明确反模式。无上游类型需要进入 QuantOS protocol/core；采纳均为设计层面。
