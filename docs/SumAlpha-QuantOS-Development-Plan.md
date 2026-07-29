# SumAlpha QuantOS 可执行开发计划

> 版本：2.0  
> 日期：2026-07-26  
> 状态：技术执行基线  
> 依据：[架构](./SumAlpha-QuantOS-Architecture.md)、[技术方案](./SumAlpha-QuantOS-Technical-Solution.md)、[Terminal 前端设计规格](./SumAlpha-QuantOS-Terminal-Frontend-Design-Spec.md)  
> 目标：从空仓库交付可复现、可审计、可对账的单主租户 Paper + Shadow Beta；M5 仅完成 Assisted Live 上线评审准备，不默认开启实盘。

## 1. 执行范围与不可变约束

### 1.1 当前交付范围

| 范围 | 本计划交付 | 不在本计划交付 |
|---|---|---|
| 产品 | 单主租户、单主工作区、单优先 venue、有限现货/永续订单意图 | 多租户产品体验、多工作区切换、多 venue 智能路由 |
| 模式 | Research、Paper、Shadow；M5 完成 Assisted Live 的 testnet/上线评审准备 | 无审批自动实盘、Guarded Live 生产上线 |
| 客户端 | `app.sumalpha.ai` 与 Tauri 桌面端共享 Terminal；官网、BFF | 移动交易 App、浏览器内量化回测 |
| 交易边界 | `TradeProposal → RiskDecision → Approval（如需）→ TradeCommand → Execution Gateway` | Agent、Engine、前端或插件绕过该链路直连 venue |

### 1.2 开发不变量

1. Rust 负责核心领域、事件、权限、策略、风控、命令与执行边界；Python 仅作为受控 Engine，通过版本化 Engine Protocol 接入。
2. `TradeProposal` 永远不可执行；`TradeCommand` 必须已批准、短时有效、可审计且幂等。
3. 每个研究、策略、风险、命令和订单事实必须带 `tenant_id`、`actor`、`correlation_id`；一期只创建一个主租户和主工作区。
4. 研究 Engine、浏览器和桌面端不持有 venue 密钥；秘密只在执行边界以引用或短期租约使用。
5. M3/M4 的 `StrategyRelease` 仅可部署至 Paper/Shadow；只有 M5 Gate 与单独批准后才可出现 Assisted Live 目标。
6. Web 与桌面端共享业务页面、领域组件、BFF client、路由和权限测试；桌面壳不得复制或旁路领域逻辑。

## 2. 任务编写与自动验收规范

### 2.1 任务状态与依赖

任务按 `F`（Foundation）、`R`（Research）、`S`（Strategy）、`X`（Execution）、`U`（User interface）、`L`（Live-readiness）、`TP`（Third-party）编号。任务只有在前置任务的验收记录全部通过后才能开始；任何破坏性协议或风险边界变更必须新增 ADR、迁移和回放用例。

### 2.2 全任务最低完成条件

除任务表中特别说明外，每个任务都必须满足下列可由 Codex/CI 校验的标准：

| 维度 | 最低标准 |
|---|---|
| 功能完整性 | 所有列出的输入、成功、拒绝和恢复路径都有自动化测试；不得以手工验证替代。 |
| 代码质量 | `cargo fmt --check`、Clippy（禁止 warning）、Rust `cargo nextest`；Python Ruff、Pyright、pytest；TypeScript lint、typecheck、Vitest 全绿。 |
| 覆盖率 | 新增 Rust 核心领域/风险/执行代码行覆盖率 ≥90%，分支覆盖率 ≥85%；Python Engine 适配新增代码行覆盖率 ≥85%；TypeScript 领域组件/状态代码行覆盖率 ≥80%。不能覆盖的代码须在报告中逐项豁免。 |
| 性能 | 测试环境中纯领域计算 P95 <50ms；BFF 授权读查询 P95 <300ms；命令校验（不含外部 venue 往返）P95 <200ms。异步任务必须在 deadline 内返回受理或确定性错误。 |
| 兼容性 | 协议变更通过 Buf breaking check；Rust/Python/TypeScript 生成 SDK 可编译；Web Chromium/Firefox/Safari 当前稳定版与桌面 macOS/Windows 回归通过。 |
| 安全与审计 | 无高危依赖/secret scan 未豁免项；所有写操作写入 actor、tenant、correlation、causation；错误、日志和导出不含秘密。 |
| 可运维性 | 关键路径提供结构化日志、trace、指标、健康检查和失败说明；部署/回滚/已知限制写入 Runbook 或任务文档。 |

### 2.3 测试资产规则

- `quantos-testkit` 提供固定 clock、ID、market replay、策略/订单 fixture 和 mock Engine；测试不得依赖真实账户、实时公共数据或未固定的模型输出。
- 每个 Engine/插件必须使用同一套 `Metadata / Health / Execute / StreamExecute / Cancel` contract harness。
- 每个事件消费者必须通过“重复投递、乱序投递、进程重启、死信重放”四类测试。
- 每个高风险命令必须有 allow、deny、approval-required、过期、重复、数据陈旧、kill switch 七类端到端用例。

### 2.4 Supabase 数据库实施基线

1. 一期主数据库采用 Supabase 平台的 PostgreSQL；事务数据、策略元数据、审批、任务状态、审计索引、outbox/inbox 与读模型均以版本化 SQL migration 管理。
2. 用户身份以 Supabase `auth.users` 为唯一主锚点；QuantOS 的 actor、成员关系、workspace/account 授权等业务表必须显式映射 `auth.users.id`，不得额外建立平行密码账户体系。
3. 凡是用户可见且承载 tenant/workspace/account 数据的业务表，默认启用 RLS 且默认拒绝；服务端只可通过受控 backend role/service role 执行跨租户维护、重放和运维任务。
4. 所有业务表主键与跨表引用统一使用 UUID，数据库默认值采用 `gen_random_uuid()`；`created_at`、`updated_at`、`occurred_at`、`expires_at` 等时间字段统一使用 `timestamptz`。
5. 每个数据库任务都必须提供 migration、RLS policy、索引、回滚说明和自动化验证；CI 必须覆盖本地重建、schema drift、RLS policy 测试与权限负向用例。

## 3. 阶段与依赖图

```mermaid
flowchart LR
  F["F0 工程与协议基线"] --> R["R1 研究与数据闭环"]
  R --> S["S2 策略治理闭环"]
  S --> X["X3 Paper + Shadow 执行闭环"]
  X --> L["L4 Assisted Live 评审准备"]
  F --> U["U 共享 Terminal"]
  R --> U
  S --> U
  X --> U
  F --> TP["TP 第三方评估/适配"]
  TP --> R
  TP --> S
  TP --> X
```

| 阶段 | 准入条件 | 阶段交付 | 放行条件 |
|---|---|---|---|
| F0 Foundation | 空仓库 | 单体工作区、协议、事件、权限、Runtime、Engine Manager、供应链基线 | Mock Engine 与核心事件端到端通过 |
| R1 Research | F0 | 数据快照、研究/信号/决策 Engine、Artifact、Research UI | 固定输入可重放且无交易副作用 |
| S2 Strategy | R1 | 策略草稿、回测、验证、不可变 Release、审批 | 未通过验证/审批的策略无法进入 Paper |
| X3 Paper + Shadow | S2 | 风控、命令、执行边界、OMS、对账、Shadow、审计 | 订单状态可重建，连续 Shadow 验证通过 |
| L4 Assisted Live 准备 | X3 | testnet venue、密钥、MFA、双人审批、加固与演练 | 仅形成上线评审证据；不自动开启实盘 |

## 4. F0：工程、协议与运行时基线

| ID | 任务与开发范围 | 技术要求 | 交付物 | 量化验收标准 | 依赖 |
|---|---|---|---|---|---|
| F01 | 初始化 Polyglot Monorepo | 建立 Cargo workspace、`proto/`、`crates/`、`services/`、`engines/`、`apps/website`、共享 `apps/terminal`、`apps/terminal-desktop`、`packages/*`、`supabase/`；固定 Rust、uv、Node 工具链 | 目录树、锁文件、Make 任务、本地开发环境基线、`DATABASE_URL` 约定 | 新环境在 ≤30 分钟内运行 `bootstrap`、`lint`、`test`；所有目录有 README 与明确模块边界；跨语言构建连续 3 次可重复 | 无 |
| F02 | CI、制品与供应链门禁 | PR 管道执行 fmt/lint/typecheck/unit/contract、SBOM、license、SCA、secret scan、制品签名、Supabase migration drift 与 RLS policy check；生成可追溯 build manifest | CI workflow、SBOM、NOTICE 模板、签名脚本、DB check 脚本 | 任一故意注入 secret、破坏 proto、未锁定依赖、RLS 缺失或 schema drift 均使 CI 失败；主干制品含 commit、依赖 digest、SBOM；高危漏洞=0 或有带到期日的豁免 | F01 |
| F03 | 领域协议 v1 与 SDK 生成 | 定义 `DataSnapshot`、`ResearchArtifact`、`StrategyRelease`、`Signal`、`TradeProposal`、`RiskDecision`、`TradeCommand`、Order/Fill/Position、Engine/Event API；Buf + OpenAPI 生成 | `proto/*/v1`、JSON schema、Rust/Python/TS SDK、兼容性测试 | SDK 三语言编译；100% 必填元数据（tenant/actor/correlation 等）测试；Buf breaking check 阻止破坏性变更；序列化往返 1,000 组 fixture 无差异 | F01 |
| F04 | Core、错误、时钟与 ID | 实现强类型 ID、UTC clock、领域错误码、金额/数量精度、版本与 hash primitives | `quantos-core`、fixture builder | 金额/精度边界与时区测试分支覆盖 ≥90%；任意错误可映射为稳定机器码；相同 fixture hash 100% 一致 | F03 |
| F05 | 事件、存储与审计账本 | Supabase PostgreSQL migration、业务 schema、RLS 基线、Supabase Storage、transactional outbox/inbox、schema registry、append-only audit；早期默认由 PostgreSQL outbox/inbox + Supabase Realtime 唤醒通知承担事件传递，不引入 Supabase 生态外的独立消息、缓存或时序基础设施；核心表主键默认 `gen_random_uuid()`，业务时间统一 `timestamptz`；数据库操作通过 `DATABASE_URL` 指向线上 Supabase PostgreSQL | `quantos-event`、`quantos-storage`、`supabase/migrations/*`、policy/sql、replay CLI | 重复/乱序/重启/死信四类测试全过；隔离 Supabase 线上项目或数据库分支可由 migration 重建 `quantos` schema；所有 tenant 表 RLS 默认拒绝且负向权限测试全过；1万条测试事件无丢失、消费者最终一致；按 correlation ID 在 ≤5 秒取回完整事件链；数据库轮询消费者、Realtime 唤醒通知、checkpoint 与重放链路在单服务部署下可闭环验证 | F03、F04 |
| F06 | 身份、授权、秘密引用与主上下文 | Supabase Auth/OIDC 会话、`auth.users` ↔ actor/member/workspace/account 映射、tenant/actor/account/mode 上下文、RBAC + capability、secret reference、默认拒绝 | `quantos-auth`、`quantos-policy`、鉴权中间件、身份映射 migration | 缺失 tenant/actor、越权 capability、绕过 RLS、Engine 请求 secret 四类请求 100% 拒绝；一期固定 Primary workspace 无切换 API；鉴权读 P95 <100ms | F03、F05 |
| F07 | Runtime 最小可恢复工作流 | session、持久任务、tool registry、deadline、cancel、retry、checkpoint、Artifact API、成本/速率限额 | `quantos-runtime`、workflow fixtures | worker 强杀后 100 个任务均从 checkpoint 恢复且不重复创建 Artifact；cancel/timeout 事件均带 audit；任务调度 P95 <200ms | F04–F06 |
| F08 | Engine SDK、Manager 与 Mock Engine | Engine manifest 审核、UDS gRPC、health/readiness、routing、限流、熔断、退避、资源配额、contract harness | `quantos-engine-manager`、Python common SDK、mock engine | `GetMetadata/Health/Execute/StreamExecute/Cancel` 100% contract 通过；连续 3 次崩溃触发退避且不丢请求；deadline 超时 ≤2 秒返回确定性错误 | F03、F06、F07 |
| F09 | 本地可观测性与故障注入 | trace、metrics、结构化日志、健康检查、test fault proxy | dashboards、alert rules、fault tests | 每个 F0 写操作可从 trace 查到 correlation ID；注入 DB/事件消费者/Engine 故障时无秘密泄露，恢复后事件链完整 | F05–F08 |

## 5. TP：第三方工程评估、适配与依赖治理

### 5.1 通用第三方接入流程（每个 TP 任务均强制执行）

1. 固定上游 repository URL、tag/commit、LICENSE、NOTICE、依赖锁和许可证结论；生成 SBOM/CVE 报告。
2. 在隔离环境做 capability inventory：输入、输出、副作用、网络、秘密、存储、资源和测试覆盖。
3. 只定义 QuantOS 自有契约；禁止公开上游 class、数据库 ID、配置格式或交易密钥。
4. 实现 adapter/Engine manifest 或仅形成 ADR；执行 contract、负向权限、重放和升级/回滚测试。
5. 将上游差异、补丁、升级策略、许可证义务写入 `UPSTREAM.md` 和 `THIRD_PARTY_NOTICES.md`。

### 5.1.1 Vibe-Trading 同步借鉴与演进执行规则

TP01 除遵循通用流程外，还必须执行以下专属规则：

1. 统一采用“受控 Fork + `vibe_adapter` 适配层吸收”策略，`third_party/vibe-trading` 仅作只读参考，生产制品只能来自 `engines/vibe-adapter`。
2. 上游更新按 S0–S3 分级处理：S0 安全响应、S1 兼容性响应、S2 计划同步、S3 研究借鉴；不同级别必须有独立 decision record、时限与阻断策略。
3. 每次同步必须固定 upstream commit/tag，并记录 LICENSE/NOTICE hash、依赖锁 hash、diff 摘要、patch queue、制品 digest 与回滚指针；禁止直接跟踪 `main`。
4. 只允许三种吸收方式：最小 cherry-pick 到 fork、在 adapter 重写等价逻辑、仅提取设计/测试思路；不得把上游 session/memory 主数据、订单工具或内部类型带入 QuantOS 核心协议。
5. 每次同步都必须经过 canary 和回滚演练；未通过质量 Gate 的变更只能保留在隔离分支或标记为“仅借鉴”，不得进入默认 capability registry。

Vibe-Trading 同步必须满足以下质量 Gate：

| 维度 | 最低标准 |
|---|---|
| 可复现性 | 连续 3 次独立构建得到相同 `uv.lock`、制品 digest 与 SBOM；`UPSTREAM.md` 能反向追溯 `upstream SHA → fork patch set → adapter image digest → release manifest`。 |
| 契约与功能 | `GetMetadata/Health/Execute/StreamExecute/Cancel` 100% contract 通过；20 个代表性 workflow fixture 可回放；取消 ≤2 秒确认；重启无重复 Artifact。 |
| 安全负向 | 至少 100 个 fixture 覆盖 secret、venue、shell、文件、未授权网络、跨 tenant 数据；全部必须被拒绝并写审计。 |
| 兼容与 UX | Web/Desktop 共享 Research E2E 全绿；上游故障只允许暴露受控错误，不泄露内部堆栈、路径或凭证。 |
| 发布与回滚 | canary 观察期内无未解释 P1；能力禁用或回滚在 ≤5 分钟完成，且 in-flight 请求有确定性取消或重试语义。 |

### 5.2 采用/封装工程任务

| ID | 上游工程与定位 | 接入范围与改造 | 交付物 | 集成验收标准 | 阶段/依赖 |
|---|---|---|---|---|---|
| TP01 | Vibe-Trading：研究工作流/工具/MCP/记忆 UX 参考与受控 Fork | 仅评估后吸收可独立测试的 workflow/skill/streaming 设计；建立 `vibe_adapter`，会话、权限、事件、审计全部替换为 QuantOS 接口；按 S0–S3 分级执行官方仓库同步、选择性吸收、canary 与回滚；禁止其成为状态源或执行器 | capability inventory、许可证报告、只读副本、fork、`UPSTREAM.md`、sync decision records、adapter ADR、自动化回归测试 | adapter 只能读写 QuantOS Artifact API；无 venue 网络/secret capability；上游 20 个代表性 workflow fixture 在固定输入下可重放；模拟 API 破坏、许可证变化、CVE 与 patch 冲突均能被分级并阻断；移除 adapter 后 Runtime 仍可启动 | F07、F08；R1 前完成最小适配 |
| TP02 | RD-Agent：自动研究/实验 Engine | 独立 Python Engine，映射 hypothesis/experiment capability 到自有 `ResearchArtifact`；限制网络、数据权限和 Artifact 写入 | `engines/rd-agent`、manifest、运行时打包、adapter、fixtures | contract harness 100% 通过；固定 DataSnapshot 运行两次 output/input hash 一致；拒绝交易/secret/任意外网工具调用；P95 接收响应 <1s | F08；R1 |
| TP03 | LLMQuant：特征、因子、模型、Signal Engine | 封装为 `quant.signal.v1`；输入必须是 release/feature snapshot，输出自有 Signal/diagnostics，不暴露上游类型 | `engines/llmquant`、manifest、Signal mapper、model provenance | 100 组固定输入结果 schema 100% 有效；每条 Signal 含策略/模型/数据版本、置信度和时效；无 OMS/venue/secret import；流式取消 ≤2s 生效 | F08、F05；R1 |
| TP04 | TradingAgents：多 Agent 决策 Engine | 封装为 `decision.proposal.v1`；保留多观点与证据，输出仅 `TradeProposal`；移除/屏蔽任何订单工具 | `engines/trading-agents`、proposal mapper、policy fixtures | 100% Proposal 带证据、反方观点、失效时间；所有输出 `executable=false`；尝试调用 order/secret tool 必失败并审计；固定 fixture 可重放 | F08、TP03；R1 |
| TP05 | OpenBB：数据/研究适配服务 | 隔离为 `data.query.v1` provider；实现自有 Data Contract、缓存/血缘/许可证标签；AGPL/商业许可未结论前只在隔离评估环境启用 | `engines/openbb-adapter`、provider interface、法律决策 ADR、替代 provider mock | 结果 100% 含来源/许可/schema/hash；未经批准的数据不可进入交易流程；服务端无核心领域依赖；许可证 Gate 未通过时生产构建拒绝包含该制品 | F05、F08；R1 |
| TP06 | VibeTradingLabs/vibetrading：自然语言策略开发参考/适配候选 | 单独评估策略生成、静态检查与回测编排；输出策略草稿和检查 Artifact，绝不部署或进入 OMS | `engines/strategy-lab` 或 ADR、generator adapter、静态分析 fixtures | 生成结果只写 Artifact；100 个恶意/越权提示无订单/secret/network 越权；静态检查失败时 100% 阻断 Release；可完全替换上游实现 | F08、TP01；S2 |
| TP07 | NautilusTrader：研究、仿真、OMS、执行内核 | 独立服务/进程边界；将 QuantOS Trading Protocol 映射为其 API；不引入其类型到 core；LGPL 合规与替换预案 | `services/execution-gateway`、Nautilus boundary adapter、Paper kernel、LICENSE ADR | `TradeCommand` 以同一 idempotency key 重放只产生一个下游提交；Order/Fill 事件可映射回自有 schema；精度/限额/过期/kill switch 100% 在边界前拦截；内核不可访问 Agent/用户 session | F03、F06、F08；X3 |

### 5.2.1 TP01 可执行路线图（V0–V3）

| 阶段 | 子任务 | 开发范围 | 交付物 | 验收标准 | 依赖 |
|---|---|---|---|---|---|
| V0 建基线 | TP01-A 上游只读副本与 Fork 基线 | 建立 `third_party/vibe-trading`、`forks/vibe-trading`、remote、分支保护、`UPSTREAM.md` 模板与变更监测 | baseline SHA、监测 workflow、初始 SBOM/NOTICE、目录 README | 新 tag/commit 只生成 candidate 记录，不更新生产依赖；baseline 可重建 | F01、F02 |
| V0 建基线 | TP01-B capability inventory 与禁止耦合清单 | 枚举 workflow、skill、MCP、memory、tool、streaming、UX 与副作用，映射 QuantOS 边界 | capability matrix、threat model 补充、禁止耦合 ADR | 每项能力都有输入/输出/副作用/权限/替换策略；交易/秘密路径全部标记拒绝 | TP01-A、F07 |
| V1 最小适配 | TP01-C `vibe_adapter` skeleton | 实现 manifest、UDS gRPC、Artifact API、context translator、工具 allowlist、mock fixture | `engines/vibe-adapter`、contract tests、mock adapter | 五个 Engine RPC 100% 通过；无未授权 egress、secret 或 venue capability | TP01-B、F08 |
| V1 最小适配 | TP01-D 选择性吸收与最小 patch 队列 | 只迁移通过 inventory 的研究 workflow/streaming 设计，替换 session/审计/权限调用 | fork patch queue、adapter modules、sync ADR | 20 个代表性 fixture 可回放；移除 adapter 后 Runtime 仍可运行其他 workflow | TP01-C、R02 |
| V2 受控同步 | TP01-E 同步自动化与分级阻断 | 实现 S0–S3 分级、diff/range-diff、许可证/依赖 diff、candidate issue、质量流水线 | `sync-vibe` 工具、CI workflow、decision records | 模拟 API 破坏、许可证变更、CVE 和 patch 冲突均生成正确分级与阻断结果 | TP01-D、F02 |
| V2 受控同步 | TP01-F canary、观测与回滚 | capability flag、影子任务、阈值告警、签名制品、一键禁用/回滚 | dashboards、alert rules、rollback runbook、drill report | canary 连续运行 7 天无未解释 P1；回滚演练 ≤5 分钟，审计完整 | TP01-E、F09 |
| V3 演进 | TP01-G 上游贡献与脱钩替换 | 将通用 bugfix 回馈上游，逐步以 QuantOS-native trait/protocol 替换 fork 内耦合模块 | upstream PR 记录、deprecation plan、替换测试 | 不依赖 fork 内部类型；任一模块可替换且业务协议不变 | TP01-F、R03 |

### 5.3 仅参考工程的独立评估任务

这些项目不作为 Day-1 生产依赖。每个任务的完成标准是形成可验证的“采用/不采用”结论和可移植设计输入；未通过 Gate 时不得被引入运行时、客户端或核心领域编译图。

| ID | 工程 | 评估问题与限定范围 | 交付物 | 验收标准 | 阶段/依赖 |
|---|---|---|---|---|---|
| TP08 | Qlib | 评估数据集、因子实验、工作流复现能力；不引入第二 Quant Core | ADR、capability matrix、与 `DataSnapshot/ResearchArtifact` 映射样例 | 固定 commit、许可证/SBOM/CVE 记录齐全；完成 3 个离线实验映射；结论明确“仅参考/隔离 adapter/拒绝”及替换成本 | R1，F05 |
| TP09 | TrendRadar | 评估趋势检测、新闻/主题信号的输入质量与血缘要求 | ADR、趋势 signal schema 样例、数据许可清单 | 3 组离线输入可映射至自有 Signal；缺少许可证/来源的输出 100% 被标为不可交易；无生产依赖进入 lockfile | R1，TP03 |
| TP10 | ValueCell | 评估投研 UI/工作流的信息架构，不复制其数据模型或账户体系 | UX gap report、可复用交互清单、禁止耦合清单 | 至少 10 个 UI 模式映射至 Terminal design spec；无源码复制/运行时依赖；所有差异写 ADR | U01 前 |
| TP11 | OpenStock | 评估公开市场数据、策略/投研展示能力与数据许可风险 | provider comparison、Data Contract fixture、许可证结论 | 2 个 provider fixture 完成血缘/质量映射；任何未授权数据无法生成可用 DataSnapshot；无 Day-1 依赖 | R1，TP05 |
| TP12 | nautilus_agents | 评估 Agent 与交易内核协作边界，提取反模式与工具设计经验 | ADR、threat model 补充、接口差异清单 | 明确列出不少于 5 条禁止耦合规则；验证其方案不改变“Agent 不直连 venue”边界；无运行时依赖 | F07、TP07 |
| TP13 | Loong | 评估 protocol/Runtime/UI 设计思路与可替换接口 | ADR、协议/UX 对照表、adoption decision | 对照至少覆盖 session、workflow、tool、memory、权限、审计六项；无上游类型进入 QuantOS protocol/core | F03、F07 |

## 6. R1：数据、研究、信号与 Terminal 研究闭环

| ID | 任务与开发范围 | 技术要求 | 交付物 | 量化验收标准 | 依赖 |
|---|---|---|---|---|---|
| R01 | Market ingestion 与标准化行情契约 | 归一化 symbol、时间、精度、来源、质量；只允许已批准 provider；写 `MarketEvent` | `quantos-market`、ingestor、replay dataset | 10万条 replay 事件解析成功率 100%；乱序/重复数据正确去重；新鲜度/质量异常在 ≤5s 内发出事件 | F03、F05 |
| R02 | DataSnapshot、血缘与质量 Gate | 不可变 hash、时间窗、schema、质量、许可证、来源；快照元数据与质量 Gate 存于 Supabase PostgreSQL，并通过 RLS 保护租户可见性；交易相关调用必须检查质量/时效 | snapshot API、对象存储、quality rules、snapshot migration | 相同输入生成相同 hash；过期/质量不合格/许可证缺失的 300 个 fixture 100% 被拒用于策略/交易；查询 P95 <300ms | R01、F06 |
| R03 | Research orchestration 与 Artifact lifecycle | Runtime 组合研究 Engine、预算、deadline、流式事件、Artifact 归档与重放 | research workflow、Artifact repository | 同一 fixture 连续运行 10 次 input hash 一致且输出证据可定位；取消 ≤2s 确认；worker 重启后无重复 Artifact | F07、F08、R02、TP02 |
| R04 | Signal 与 TradeProposal 工作流 | 仅接收版本化 Signal/研究输入；生成不可执行 Proposal、反方观点、失效时间、证据 | signal/proposal service、schema validator | 100 个 Proposal fixture 100% 含证据/失效时间/`executable=false`；过期 Proposal 100% 拒绝评估；无订单 API 被调用 | R03、TP03、TP04 |
| U01 | 共享 Terminal 壳、认证与 Research 页面 | 建立共享 React/Next 应用、BFF typed client、OIDC/MFA、App Shell、P01–P05 页面；桌面仅 Tauri adapter | `apps/terminal`、`packages/ui/domain-ui/api-client/platform`、P01–P05 | Web/桌面同一 Playwright 场景全部通过；Research 创建/流式/取消/证据跳转 100% 可用；业务页 `noindex`；小屏不显示高风险动作 | F06–F09、R02–R04 |

## 7. S2：策略实验、验证、发布与审批

| ID | 任务与开发范围 | 技术要求 | 交付物 | 量化验收标准 | 依赖 |
|---|---|---|---|---|---|
| S01 | 策略草稿与参数模型 | 草稿可版本化、自动保存、冲突检测；策略只引用已批准数据/Artifact；草稿/参数表默认启用 RLS 并保留 `auth.users` 审计链 | `quantos-strategy` draft API、strategy fixtures、draft migration | 50 组并发编辑测试无静默覆盖；未授权/无快照/无 Artifact 的草稿不能发起验证；草稿保存 P95 <300ms | R02、R03 |
| S02 | 回测与成本/滑点验证 | 固定 DataSnapshot、clock、成本/滑点模型、look-ahead/数据泄漏检测、环境 hash | backtest adapter、validation report | 同一 release candidate 重放 10 次产生一致指标；100 个 look-ahead/数据泄漏 fixture 100% 失败；回测结果必须含成本、环境和输入 hash | S01、TP06、TP08 |
| S03 | StrategyRelease 与部署目标控制 | 生成不可变发布物，含源码/构建产物 hash、参数、数据、回测、审批；M3/M4 只允许 Paper/Shadow | release service、deployment policy、migration | 未验证/未审批 Release 的部署请求 100% 被拒；目标枚举不含 Assisted Live（M5 前）；同一内容重复发布返回同一 hash 或确定性冲突 | S02、F06 |
| S04 | 策略审批与 Terminal Strategy 页面 | 实现策略目录、Lab、Backtest、Release、审批时间线；前端通过 capability 显示目标 | P06–P07、approval integration、E2E | 20 个策略 UI fixture 从研究到 Release 可完成；拒绝/过期/并发审批均有明确状态；Web/Desktop 视觉与功能回归通过 | S01–S03、U01 |

## 8. X3：确定性风险、Paper、Shadow、对账与审计闭环

| ID | 任务与开发范围 | 技术要求 | 交付物 | 量化验收标准 | 依赖 |
|---|---|---|---|---|---|
| X01 | Portfolio 读模型与风险输入快照 | Position、valuation、P&L、exposure、账户状态、数据时间；只读模型可从事件重建，并持久化到 Supabase PostgreSQL 受控 schema | `quantos-portfolio`、rebuild CLI、portfolio projection migration | 1万条订单/成交 replay 后 Position/P&L 与黄金快照一致；读模型重建 100% 成功；查询 P95 <300ms | F05、R01 |
| X02 | Pre/Post-trade Risk 与 kill switch | 规则：策略发布、数据时效、账户、精度、名义、杠杆、集中度、venue 健康、重复、审批；global/account kill switch | `quantos-risk`、rule fixtures、kill switch API | allow/deny/approval-required 各 ≥50 个 fixture；规则分支覆盖 ≥95%；kill switch 到新命令拒绝 P95 <1s；拒绝结果含命中规则/限额/签名 | X01、S03、F06 |
| X03 | TradeCommand 签发与审批状态机 | 将有效 Proposal + RiskDecision + Approval 转为短期、签名、幂等 Command；禁止自批 | `quantos-execution` command issuer、approval verifier | 过期、重复、自批、数据陈旧、kill switch、策略失效七类测试 100% 拒绝；同一 key 1,000 次并发只签发一个命令；签发 P95 <200ms | R04、X02 |
| X04 | Nautilus 边界、Paper OMS 与订单状态机 | 通过 TP07 adapter 提交/取消、映射 ack/fill/reject，维护 append-only 订单事实 | execution gateway、Paper kernel、state machine | 10万条订单事件 state transition 100% 合法；重复 submit 仅一次下游调用；cancel 延迟/拒绝可审计；所有 Fill 可追溯 Command | X03、TP07 |
| X05 | Shadow 运行、对账与异常队列 | 在真实行情产生对照建议而不下单；日终对账订单/成交/仓位/虚拟账本；异常关闭流程 | shadow runner、reconciler、exception queue | 连续 10 个交易日 Shadow；日终未解释差异=0；故意注入 20 类差异均在 ≤15 分钟发现并定位；无 venue submit 调用 | X01–X04 |
| X06 | 执行/审计/运维 Terminal 页面 | 实现 P08–P14；实时事件投影、危险操作确认、MFA、导出与 Runbook 入口 | Portfolio/Risk/Proposal/Approval/Order/Audit/Ops UI、desktop notifications | 从任意订单在 ≤5 分钟经 UI 还原完整证据链；订单/审批/kill switch E2E 通过率 100%；无页面含直接 venue 请求；Web/Desktop 双端回归通过 | X01–X05、U01 |

## 9. L4：Assisted Live 上线评审准备（仅 testnet）

| ID | 任务与开发范围 | 技术要求 | 交付物 | 量化验收标准 | 依赖 |
|---|---|---|---|---|---|
| L01 | 优先 venue testnet 适配 | 仅接入已批准的单一 venue；订单意图/精度/限流映射；永不在 CI 使用生产 key | venue plugin、testnet fixtures、compat report | 200 笔 testnet 正常/拒绝/撤单/部分成交场景 100% 映射至自有 schema；网络/认证失败明确分类；无生产 endpoint/secret 出现在测试制品 | X04、TP07 |
| L02 | Supabase Vault、mTLS 与受限执行区 | secret reference、短期租约元数据、网络 allowlist、mTLS、最少 egress、轮换/撤销 | secret integration、network policy、rotation runbook | secret scan 0 泄露；研究 Engine/UI 无法解析执行 secret；证书/secret 轮换后 ≤5 分钟恢复；未允许域名 egress 100% 阻断 | F06、L01 |
| L03 | 双人审批、MFA 与 Assisted Live UI Gate | 仅在服务端 feature/capability 返回时显示 Assisted Live；双人职责分离、额度与白名单 | approval policy、P10/P11 M5 UI、E2E | M5 flag 关闭时 UI/API 100% 不可达；开启 testnet flag 后 50 次双人审批均写签名审计；自批/额度超限/过期 100% 拒绝 | X02、X03、L02 |
| L04 | 容量、恢复、安全与上线证据包 | 压测、混沌、DB/事件恢复、订单对账、告警、回滚；生成不可篡改测试证据 | SLO report、drill report、release checklist | 目标负载下无重复 Command/订单、审计持久化 100%；四类演练（重放、恢复、Engine 故障、kill switch）全部通过；高危安全缺陷=0 | X05、X06、L01–L03 |

## 10. 阶段 Gate、命令与回归清单

### 10.1 F0 Gate

- [ ] F01–F09 完成；三语言 SDK、Mock Engine、事件重放和默认拒绝鉴权全绿。
- [ ] 基于 `DATABASE_URL` 的远程 migration 重放、migration drift、`auth.users` 映射与 RLS 默认拒绝测试全绿；UUID 默认值与 `timestamptz` 约束无豁免项。
- [ ] 每个服务提供 health、metrics、trace 和结构化错误；供应链报告可追溯。
- [ ] TP01–TP05 的固定版本、许可证和 capability inventory 至少完成评估，未获批准者不能进入生产拓扑。
- [ ] TP01-A、TP01-B 完成；Vibe-Trading baseline SHA、只读副本、fork、`UPSTREAM.md`、分级规则与禁止耦合清单已归档。

### 10.2 R1 Gate

- [ ] R01–R04、U01 完成；研究、Signal、Proposal 全部可回放且无交易副作用。
- [ ] RD-Agent、LLMQuant、TradingAgents 的 contract/权限/重放测试通过；OpenBB 仅在许可证 Gate 允许时启用。
- [ ] Web 与桌面端 Research 用例完全一致；所有 Artifact/数据快照可进入 Audit。
- [ ] TP01-C、TP01-D 完成；`vibe_adapter` 的 contract、负向安全、回放与隔离运行测试通过，且移除 adapter 不影响其他 workflow 启动。

### 10.3 S2 Gate

- [ ] S01–S04 完成；look-ahead/数据泄漏/未审批策略 100% 阻断。
- [ ] Release 包含全部不可变证据，且可部署目标只有 Paper/Shadow。
- [ ] TP06–TP13 的评估结论和 ADR 已归档；未经明确 adoption 的项目无运行时依赖。

### 10.4 X3 Gate

- [ ] X01–X06 完成；连续 10 个交易日 Shadow，对账未解释差异=0。
- [ ] 命令、订单、成交、仓位和审计链可重建；命令重复执行=0。
- [ ] kill switch、数据陈旧、venue 故障、审批拒绝、事件重放演练全绿。

### 10.5 L4 Gate

- [ ] L01–L04 完成；仅 testnet 证明通过，不自动产生生产实盘权限。
- [ ] venue、秘密、MFA、审批、网络、容量、恢复、对账和安全证据全部归档。
- [ ] 是否开启小额 Assisted Live 必须在本计划之外，由单独批准决定。

### 10.6 建议的自动执行命令

| 类别 | 命令目标（实现时在 `Makefile`/CI 固化） |
|---|---|
| 格式与静态检查 | `fmt`、`lint-rust`、`lint-python`、`lint-web`、`typecheck` |
| 单元与覆盖率 | `test-rust`、`test-python`、`test-web`、`coverage-check` |
| 数据库 | `db-apply`、`db-reset`、`db-migration-check`、`db-schema-diff`、`rls-policy-test` |
| 协议与契约 | `proto-check`、`sdk-generate-check`、`engine-contract-test` |
| 集成与回放 | `integration-test`、`event-replay-test`、`market-replay-test`、`order-state-test` |
| 安全与供应链 | `sbom`、`license-check`、`sca`、`secret-scan`、`artifact-sign-verify`、`sync-vibe-check` |
| 双端界面 | `e2e-web`、`e2e-desktop`、`visual-regression`、`a11y-test` |
| 性能与演练 | `bench-domain`、`load-bff`、`chaos-drill`、`reconciliation-test` |

## 11. 任务完成定义与禁止项

任务完成不以“代码可运行”或“页面可打开”为准，必须符合第 2 节最低完成条件、任务表专属验收和所属 Gate。以下行为一律视为未完成：

- 以真实账户、真实生产密钥或不可重放公网数据作为测试唯一依据；
- 将第三方内部类型、数据库或 SDK API 泄漏到 QuantOS 的核心领域、协议或 UI；
- 让 Agent、Engine、插件、Web 或桌面客户端绕过 Risk/Approval/Execution Gateway；
- 以未固定 commit/tag 的上游依赖、未完成许可证结论的 OpenBB、或无 SBOM 的制品进入生产拓扑；
- 在 M5 Gate 前显示或启用 Assisted Live，在任何阶段启用 Guarded Live；
- 为桌面端复制业务页面/状态机，或让离线缓存产生可提交命令。
