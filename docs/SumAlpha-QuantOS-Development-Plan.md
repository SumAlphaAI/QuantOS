# SumAlpha QuantOS 可执行开发计划

> 版本：2.1  
> 日期：2026-07-30  
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
| 覆盖率 | 新增 Rust 核心领域/风险/执行代码行覆盖率 ≥90%；稳定 Rust/LLVM CI 以 region 覆盖率 ≥85% 作为分支代理，nightly 发布验证仍要求分支覆盖率 ≥85%；Python Engine 适配新增代码行覆盖率 ≥85%；TypeScript 领域组件/状态代码行覆盖率 ≥80%。不能覆盖的代码须在报告中逐项豁免。 |
| 性能 | 测试环境中纯领域计算 P95 <50ms；BFF 授权读查询同区域 P95 <100ms，跨区域开发机连接托管数据库时 P95 <500ms；命令校验（不含外部 venue 往返）P95 <200ms。异步任务必须在 deadline 内返回受理或确定性错误。 |
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
6. `outbox_event`、`inbox_receipt`、`dead_letter_event` 与 `projection_checkpoint` 是可靠事件闭环的受控表；生产消费者必须以 PostgreSQL 轮询、租约和 `FOR UPDATE SKIP LOCKED` 领取事件，`inbox_receipt` 的幂等唯一约束、指数退避、死信和 checkpoint 均须持久化。
7. Supabase Realtime 仅用于消费者唤醒与已授权 UI 实时投影，不得充当可靠队列、事件事实来源或唯一 worker 调度器；断连、漏通知或订阅恢复后，消费者必须以数据库扫描补偿并最终处理全部已提交 outbox 事件。
8. PostgreSQL advisory lock 只用于短时互斥协调；不得把其或 Realtime 作为通用缓存。可重建读模型、任务状态和命令事实均以 PostgreSQL 为真相源，缓存失效不得改变交易或风控结论。
9. Supabase Vault 与平台托管 secrets 仅保存静态加密秘密/引用；解密访问仅授予 Execution Gateway 的受控数据库角色并经 allowlist 数据库函数，UI、Engine、普通 BFF 与用户角色必须无法读取解密视图。短时授权由执行边界的服务会话、命令过期时间与轮换状态表达，而非将 Vault 误作动态租约系统。
10. 在未完成 ADR 和容量评审前，不得预置 Supabase 生态外的独立事件、缓存、时序或秘密基础设施；仅当达到第 F09/L04 定义的阈值，方可比较 Supabase 原生索引/分区/聚合/批处理/Realtime Broadcast/可选 Queues 与外部方案。

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
| F05 | 事件、存储与审计账本 | Supabase PostgreSQL migration、业务 schema、RLS 基线、Supabase Storage、transactional outbox/inbox、schema registry、append-only audit；建立 `outbox_event`、`inbox_receipt`、`dead_letter_event`、`projection_checkpoint` 与基于租约/`FOR UPDATE SKIP LOCKED` 的轮询消费者。Realtime 只发送唤醒/投影通知，绝不作为事件真相或唯一调度；早期不引入 Supabase 生态外的独立消息、缓存或时序基础设施 | `quantos-event`、`quantos-storage`、`supabase/migrations/*`、policy/sql、replay CLI、消费者恢复 Runbook | 重复/乱序/重启/死信四类测试全过；隔离 Supabase 线上项目或数据库分支可由 migration 重建 `quantos` schema；所有 tenant 表 RLS 默认拒绝且负向权限测试全过；1 万条测试事件无丢失、消费者最终一致；模拟 Realtime 漏通知、断连和重连后，数据库扫描在测试 deadline 内处理全部已提交事件；1,000 次同事件并发投递只产生一次业务副作用；按 correlation ID 在 ≤5 秒取回完整事件链 | F03、F04 |
| F06 | 身份、授权、秘密引用与主上下文 | Supabase Auth/OIDC 会话、`auth.users` ↔ actor/member/workspace/account 映射、tenant/actor/account/mode 上下文、RBAC + capability、secret reference、默认拒绝；Vault 仅存静态加密秘密，Execution Gateway 通过受控角色与 allowlist 函数取得所需引用，短时授权由服务会话/命令过期/轮换状态控制 | `quantos-auth`、`quantos-policy`、鉴权中间件、身份映射 migration、Vault 访问 policy/函数 | 缺失 tenant/actor、越权 capability、绕过 RLS、Engine 请求 secret 四类请求 100% 拒绝；UI、Engine、普通 BFF 与用户角色读取 Vault 解密视图/函数 100% 被拒；一期固定 Primary workspace 无切换 API；鉴权读 P95 同区域 <100ms，开发机跨区域远程复验 <500ms | F03、F05 |
| F07 | Runtime 最小可恢复工作流 | session、持久任务、tool registry、deadline、cancel、retry、checkpoint、Artifact API、成本/速率限额 | `quantos-runtime`、workflow fixtures | worker 强杀后 100 个任务均从 checkpoint 恢复且不重复创建 Artifact；cancel/timeout 事件均带 audit；任务调度 P95 <200ms | F04–F06 |
| F08 | Engine SDK、Manager 与 Mock Engine | Engine manifest 审核、UDS gRPC、health/readiness、routing、限流、熔断、退避、资源配额、contract harness | `quantos-engine-manager`、Python common SDK、mock engine | `GetMetadata/Health/Execute/StreamExecute/Cancel` 100% contract 通过；连续 3 次崩溃触发退避且不丢请求；deadline 超时 ≤2 秒返回确定性错误 | F03、F06、F07 |
| F09 | 本地可观测性、容量阈值与故障注入 | trace、metrics、结构化日志、健康检查、test fault proxy；为 outbox 年龄/DLQ、Realtime 投影延迟与配额、读模型查询/MV 新鲜度、Storage 错误与秘密轮换配置可执行告警和 ADR 证据采集 | dashboards、alert rules、fault tests、容量 ADR 模板 | 每个 F0 写操作可从 trace 查到 correlation ID；注入 DB/事件消费者/Engine 故障时无秘密泄露，恢复后事件链完整；以下阈值均自动告警并生成 ADR 输入：outbox 最老事件 >60 秒持续 15 分钟或 DLQ >0.1%，Realtime 投影延迟 >5 秒持续 15 分钟或配额 >70%，风险/组合查询 P95 >300ms 持续 15 分钟，风险 MV >1 分钟或运营聚合 >5 分钟连续 3 次，Storage 错误 >1% 或秘密轮换/读取失败 | F05–F08 |

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
| L02 | Supabase Vault、mTLS 与受限执行区 | Vault 静态秘密/引用、Execution Gateway 专用受控数据库角色与 allowlist 函数、服务会话/命令 TTL、网络 allowlist、mTLS、最少 egress、轮换/撤销；不实现 Vault 动态租约 | secret integration、database grants/function、network policy、rotation runbook | secret scan 0 泄露；研究 Engine/UI/普通 BFF 无法解析或调用 Vault 解密路径；证书/secret 轮换后 ≤5 分钟恢复；过期服务会话或命令 100% 拒绝；未允许域名 egress 100% 阻断 | F06、L01 |
| L03 | 双人审批、MFA 与 Assisted Live UI Gate | 仅在服务端 feature/capability 返回时显示 Assisted Live；双人职责分离、额度与白名单 | approval policy、P10/P11 M5 UI、E2E | M5 flag 关闭时 UI/API 100% 不可达；开启 testnet flag 后 50 次双人审批均写签名审计；自批/额度超限/过期 100% 拒绝 | X02、X03、L02 |
| L04 | 容量、恢复、安全与上线证据包 | 压测、混沌、DB/事件恢复、订单对账、告警、回滚；生成不可篡改测试证据 | SLO report、drill report、release checklist | 目标负载下无重复 Command/订单、审计持久化 100%；四类演练（重放、恢复、Engine 故障、kill switch）全部通过；高危安全缺陷=0 | X05、X06、L01–L03 |

## 10. 阶段 Gate、命令与回归清单

### 10.1 F0 Gate

- [ ] F01–F09 完成；三语言 SDK、Mock Engine、事件重放和默认拒绝鉴权全绿。
- [x] 基于 `DATABASE_URL` 的远程 migration 重放、migration drift、`auth.users` 映射与 RLS 默认拒绝测试全绿；UUID 默认值与 `timestamptz` 约束无豁免项。
- [x] outbox/inbox 的轮询租约、幂等去重、退避/死信/checkpoint 和 Realtime 漏通知补偿均通过自动化验证；Realtime 未被用作可靠事件源或唯一 worker 调度。
- [ ] Vault 解密路径只对 Execution Gateway 的受控角色/allowlist 函数开放；UI、Engine、普通 BFF 与用户角色的负向访问测试全绿；F09 容量阈值告警与 ADR 证据模板已启用。
- [x] 每个服务提供 health、metrics、trace 和结构化错误；供应链报告可追溯。
- [x] TP01–TP05 的固定版本、许可证和 capability inventory 至少完成评估，未获批准者不能进入生产拓扑。
- [ ] TP01-A、TP01-B 完成；Vibe-Trading baseline SHA、只读副本、fork、`UPSTREAM.md`、分级规则与禁止耦合清单已归档。

#### 10.1.1 F0 Gate 首轮完成度核查记录（2026-08-08）

**核查基线**

- 核查 commit：`a9fc5fa25daa09e3b46f72cac53bcdcfe56b6ebb`。
- 核查范围：第 2 节全任务最低完成条件、F01–F09 任务表的交付物与量化验收标准、本节 7 条 Gate 清单。
- 判定规则：“已实现”、文件存在、内存 fixture 通过或测试因环境缺失而跳过，均不等于完成；必须有对应专属验收和第 2.2 节最低标准的自动化通过证据。
- 总体结论：**F01–F09 暂无任务可判定为完全验收通过；F0 Gate 7 条清单均未通过，本次未勾选任何 Gate 项。**

**自动化核查摘要**

| 核查项 | 结果 | 记录 |
|---|---|---|
| 锁文件、Proto、migration 命名、静态 RLS | 通过 | `check-lockfiles.sh`、`check-proto.sh`、`check-migration-filenames.sh`、`check-rls-baseline.sh` 返回 0。 |
| Rust 格式/静态检查 | 通过 | `cargo fmt --check` 和 `cargo clippy --workspace --all-targets -- -D warnings` 返回 0。 |
| Python/TypeScript 静态检查 | 部分通过 | Ruff、ESLint、TypeScript typecheck 返回 0；CI/Makefile 没有执行第 2.2 节要求的 Pyright。 |
| 不使用远程数据库的测试 | 通过，但不构成 DB 验收 | 清除 `DATABASE_URL` 后 `cargo test --workspace` 返回 0，Python `87 passed`，pnpm 各 workspace 测试全绿；PostgreSQL/Supabase 测试在无 `DATABASE_URL` 时直接 return/跳过。 |
| 完整本地 CI | 失败 | `make ci-local` 在 `quantos-auth/tests/postgres_auth_context.rs` 连接数据库时失败：`ENOTFOUND tenant/user postgres.qevsaxihufhklrayckud not found`。 |
| 远程 schema drift | 失败 | `make db-schema-diff` 因同一 `DATABASE_URL` 连接错误返回非 0。 |
| 远程 RLS/权限负向测试 | 失败 | `make rls-policy-test` 的静态部分通过，`check-live-rls.sh` 因同一数据库连接错误失败。 |
| 许可证门禁 | 失败 | `make license-check` 拒绝 `webpki-root-certs 1.0.9` 的 `CDLA-Permissive-2.0`；`security/sca-waivers.json` 当前为 0 条豁免。 |
| 覆盖率与兼容性 | 未建立验收证据 | Makefile/CI 无 `cargo nextest`、Rust/Python/TypeScript 覆盖率门槛，也无 Chromium/Firefox/Safari 与 macOS/Windows 回归矩阵。 |

#### 10.1.2 F01–F09 逐项核查

| ID | 核查结果 | 已确认的实现/证据 | 未完成问题 |
|---|---|---|---|
| F01 | **未通过（自动化完成，待首次 clean-room CI）** | Cargo/uv/pnpm workspace、工具链和锁文件已固定；本机 `bootstrap → lint → test` 全绿、耗时 97.17 秒。三个独立临时构建环境分别生成 5 个 Rust release 二进制、8 组 TypeScript dist 和 8 个 Python wheel，三轮总 digest 均为 `045d8b357ad98f6d17fd0cccd74266736c4a265563281fe189126ea9aa26c431`。独立 `F01 Clean Room` workflow 已设置 30 分钟硬门槛并上传 JSON 证据。 | 代码推送后需取得一次全新 GitHub-hosted runner 的 `bootstrap → lint → test` 成功记录；本机已有依赖缓存，不冒充“全新环境”证据。 |
| F02 | **未通过** | CI、Proto/DB/lockfile、许可证、隔离 migration replay、三语言覆盖率，以及 Chromium/Firefox/WebKit + Ubuntu/macOS/Windows 兼容矩阵门禁已建立；六类故意破坏自测均确认被实际 Gate 拒绝；用户已在 GitHub 配置名为 `QUANTOS_SIGNING_KEY` 的 Secret，名称与 workflow 完全匹配；CI 现会在正式签名后立即执行 HMAC 回验。 | Firefox/WebKit 与 macOS/Windows 矩阵仍需首次 CI 结果；正式签名需下一次 `main` push CI 的 `Sign main build artifacts` 与 `Verify formal artifact signatures` 均成功后形成最终证据。 |
| F03 | **通过** | v1 Proto 已覆盖计划列出的 11 类领域消息与 Engine/Event API；每类消息均执行 1,000 组 fixture 精确序列化往返，共 11,000 次无差异。描述符门禁证明 11 类领域消息和 14 种 RPC 输入/输出均存在 `REQUIRED` metadata 路径，且 `CommandMetadata` 的 tenant/actor/correlation 等审计字段及 `ActorRef` 身份字段全部为必填。Buf、生成漂移、Rust/Python/TypeScript SDK 编译及全工作区回归通过；Python wheel 与 TypeScript dist 已纳入 F01 可重复制品构建。 | 无。 |
| F04 | **通过** | 强类型 ID、UTC clock、稳定错误码、精度和确定性 hash 实现及边界测试通过；core/risk/execution 的 cargo-llvm-cov 行覆盖率 92.75%、region 覆盖率 92.38%，均超过 90%/85% 门槛。 | 无。 |
| F05 | **通过** | `make test-f05-live` 5/5、内存 1 万事件无丢失、RLS、随机隔离 schema 全量 migration replay，以及 Supabase Storage 上传/下载/manifest/删除均通过；轮询租约、幂等、DLQ、checkpoint、Realtime 补偿和 correlation 回放证据齐全。 | 无。 |
| F06 | **通过** | Auth/Policy、`auth.users` 映射、默认拒绝/RLS/capability、Primary workspace 与 Execution Gateway 受控角色均已实现并通过正负向测试；20 次真实鉴权读 P95 为 293–297ms，通过跨区域 <500ms 门槛；Vault 逐角色 live 负向检查通过。 | 无；同区域 <100ms 继续作为生产 SLO。 |
| F07 | **通过（跨区开发 Gate）** | 真实子 worker 对 100 个 PostgreSQL 任务 claim、写 checkpoint/Artifact 后被父测试执行 OS kill；新 worker 全量回收并完成，checkpoint 均存在且每任务仅一个 Artifact。100 次直接调度 P95 实测 790.88ms，通过当前跨区 1500ms Gate。 | 无；同区域生产 `<200ms` SLO 保留为部署环境验证项。 |
| F08 | **通过** | Python common SDK、Mock Engine、UDS gRPC、5 RPC contract、readiness/routing、deadline 均通过；共享 semaphore 实际拒绝超并发，supervisor 上报 RSS 超限时分派前拒绝；同一幂等请求经历 3 个真实 Python Engine 进程退出码 70 崩溃、熔断退避和 UDS 重连后由第 4 个进程完成。Python 覆盖率 91.04%。 | 无；生产 cgroup/容器资源采样与告警属于部署验证。 |
| F09 | **未通过** | 五个 Rust service 与全部 Python Engine 已统一接入 `/healthz`、fail-closed `/readyz`、Prometheus `/metrics`、持久化 correlation trace 查询和稳定错误 envelope；正常/失败命令及五个 Engine RPC 写真实 JSONL exporter。Rust 库测试、Python gRPC→JSONL→HTTP E2E、本机 batch/HTTP 冒烟及全 workspace 回归通过。 | 阈值/ADR 仍主要由库级 fixture 驱动，尚未把真实服务容量指标连续送入告警评估；无注入真实 DB/消费者/Engine 故障后的端到端 trace、告警和事件链恢复证据；JSONL 向平台采集器的 ship/rotation/retention 需部署配置验证。 |

#### 10.1.3 Gate 清单逐项结论与待解决问题

| Gate 清单 | 结论 | 待解决问题 |
|---|---|---|
| F01–F09，三语言 SDK、Mock Engine、回放、默认拒绝 | **未通过** | F03 三语言 SDK、全领域往返与 metadata 门禁已通过；当前仍需取得 F01/F02 首次 GitHub-hosted CI 证据并完成 F09 部署级容量告警/故障恢复验证，之后重跑全量 CI。 |
| `DATABASE_URL` migration/drift/auth/RLS、UUID/`timestamptz` | **通过** | `make db-replay-check` 将 11 个 migration 在随机隔离 schema 中完整执行并创建 34 张表后回滚；ledger drift、Auth 映射与跨区 P95、RLS/Vault、UUID 默认值和 timestamptz 检查均通过。 |
| outbox/inbox 可靠事件闭环 | **通过** | `make test-f05-live` 串行执行事件 PostgreSQL 4/4、Storage PostgreSQL 1/1；租约恢复、1,000 次并发幂等、Realtime 漏通知补偿、correlation ≤5 秒回放、DLQ 与持久化均通过；内存 1 万事件无丢失测试通过。 |
| Vault 受控角色、负向访问、F09 阈值/ADR | **未通过** | Vault 路径已只保留 `quantos_execution_gateway`，通用 `service_role`/`authenticated`/`anon` 的函数及表访问均被 live 测试拒绝；F09 库级阈值和 ADR 模板通过，但仍需在实际服务指标上验证告警输入。 |
| 每服务 health/metrics/trace/结构化错误，供应链 | **通过** | 五个 Rust service 与全部 Python Engine 共享同一运维契约；三个批处理 service 导出 started/terminal trace 并使用 correlation 一致的结构化错误，Python SDK 集中覆盖五 RPC；JSONL exporter 持久化后可由 `/trace/<uuid>` 查询，未配置/不可写时 readiness fail-closed。供应链 manifest/SPDX 可由锁文件重建且发布签名策略 fail-closed；正式 signing key 的配置仍是发布环境事项，不影响本条“报告可追溯”的事实。 |
| TP01–TP05 版本/许可证/capability inventory | **通过** | TP02 RD-Agent 固定 `v0.5.0`/`923a326...`/MIT，TP04 TradingAgents 固定 `v0.2.1`/`551fd7f...`/Apache-2.0，TP05 OpenBB 固定 `4.4.5`/`34de2f6...`/AGPL-3.0-only；TP03 明确为无外部上游的 QuantOS-native capability。四项均归档 dependency descriptor digest、SPDX、CVE 状态及 capability/副作用/权限/替换策略；`make tp-intake-check` 验证未批准 upstream 包未进入 `uv.lock`。TP02/TP04 upstream 与 TP05 OpenBB 仍为非生产准入，其中 OpenBB 保持法务未批准、仅隔离评估。 |
| TP01-A、TP01-B | **未通过** | baseline SHA、`UPSTREAM.md`、SBOM/NOTICE 记录、分级规则、capability/threat/forbidden-coupling ADR 已归档；但 `third_party/vibe-trading` 仅有 provenance 文件而非可重建的只读上游副本，`forks/vibe-trading/README.md` 仍将受控 fork 写为 `future`/`to be provisioned`，当前 git 也只有 QuantOS `origin`；需配置只读 upstream 与 SumAlpha 受控 fork/remote，并验证 baseline 可重建。 |

#### 10.1.4 数据库重启后复验记录（2026-08-08）

**当次复验结论（已由 10.1.5 后续修复复验取代）**：`DATABASE_URL` 已从“不可连接”恢复为“可连接并可执行 migration/SQL”，但当次 live 业务测试发现 prepared-statement 兼容性、断言一致性和性能问题；当时 F0 Gate 为 0/7。

| 复验项 | 结果 | 完整记录 |
|---|---|---|
| `make db-apply` | **通过（增量）** | 前 9 个 migration 已存在并跳过，成功应用 `20260801120000_execution_secret_zone.sql`；这证明连接和增量应用可用，不等于空库全量重放。 |
| `make db-schema-diff` | **通过** | 远程 migration ledger 与仓库 migration 列表一致。 |
| `make rls-policy-test` | **脚本通过，Gate 语义未通过** | 静态与 live RLS 脚本返回 0；但 `db-cli.cjs` 明确要求旧 `resolve_execution_secret_reference(text,text,text)` 对通用 `service_role` 保持 EXECUTE，与 Gate “仅 Execution Gateway 受控角色”相冲突。 |
| `make test` / live Auth | **超时，未通过** | 两个 `postgres_auth_context` 用例并行时均 >60s；改为 `RUST_TEST_THREADS=1` 后第一个用例仍 >60s，排除仅由测试并行争用引起的可能，不满足 F06 鉴权读 P95 <100ms。 |
| `make test-f05-live` | **4/4 失败** | 并行执行时：两个用例报 `prepared statement "s0/s2" does not exist`；租约恢复断言实际 `0`、期望 `1`；Realtime 漏通知补偿/回放计数实际 `4`、期望 `3`。串行复验的第一个 1,000 次幂等用例 >60s 未完成。 |
| `quantos-storage` PostgreSQL 持久化 | **失败** | `get_data_snapshot` P95 实测 `869ms`，超过 `300ms` 门槛。 |
| `quantos-runtime` PostgreSQL 持久化 | **失败/超时** | cancel/timeout audit 用例报 `prepared statement "s2" already exists`；100 任务恢复用例 >60s 未完成。 |
| Supabase Storage 集成 | **未执行** | `make test-supabase-storage-live` 返回 0，但用例明确因 `QUANTOS_RUN_SUPABASE_STORAGE_TESTS` 未设置而 skip，不计入验收。 |
| F09 库级观测性 | **通过（库级）** | `make observability-check` 的 6 个用例全绿；实际服务端点未接入的原缺口仍存在。 |
| 许可证门禁 | **失败** | `make license-check` 复验仍因 `webpki-root-certs 1.0.9` / `CDLA-Permissive-2.0` 未在 allowlist 或豁免中而失败。 |

**截至当次复验仍待解决问题（已由 10.1.8 取代）**

1. 当时仍需等待首次 CI 完成 Firefox/WebKit 与 macOS/Windows 兼容矩阵、补服务观测与端到端故障证据、配置 TP01 受控 fork remote 和发布 signing key；其中统一服务观测与持久化 exporter 已在 10.1.8 完成。

#### 10.1.5 待解决问题修复与再次复验记录（2026-08-08）

**截至该次复验的结论（已由 10.1.6 取代）**：当时 F0 Gate 清单第 3 条满足并勾选，F0 Gate 为 1/7。

| 修复/复验项 | 结果 | 核查记录 |
|---|---|---|
| PostgreSQL pooler 兼容性 | **通过** | Auth/Event/Runtime/Storage live fixture 与 cleanup 全部改用 typed/batch 路径；未再出现 `prepared statement does not exist/already exists`。`.env.example` 明确需要事务/租约会话语义的 worker 使用 session pooler。 |
| F05 fixture、租约与 replay | **通过** | 修正事件写入后再采集 `observed_at`，correlation 性能计时只覆盖回放查询；Make 目标强制串行执行。`make test-f05-live`：Event 4/4（195.82s）、Storage 1/1（10.41s）。 |
| DataSnapshot P95 | **通过** | 对写后不可变、tenant-scoped 的快照增加上限 1,024 项的进程内缓存；未放宽 300ms 断言。修复后 Storage live 测试通过。 |
| Runtime 恢复与多租户隔离 | **通过（功能）** | Artifact upsert/binding/touch 合并为单条原子 SQL；稳定使用 `workflow_run_id` 生成去重证据；claim 与 timeout sweep 增加 tenant 条件。100 任务恢复/去重通过（224.13s），cancel/timeout audit 通过（15.17s）。性能 P95 与真实进程强杀仍列为 F07 未完成项。 |
| Auth 正确性与性能 | **通过（跨区域开发 Gate）** | fixture 邮箱已按 user UUID 唯一化；`postgres_auth_context` 正确性通过；20 次真实鉴权读 P95 为 297ms，通过默认 <500ms 跨区域门槛。生产同区域 SLO 仍为 <100ms，可用 `QUANTOS_AUTH_READ_P95_LIMIT_MS` 收紧。 |
| Vault/RLS | **通过** | 应用 `20260808150000_f0_gate_hardening.sql`：撤销通用 `service_role` 的旧/新解析函数及表访问，只授权 `quantos_execution_gateway`；`make rls-policy-test` 通过。 |
| UUID/时间类型 | **通过** | 四个 strategy 业务主键补 `default gen_random_uuid()`；live Gate 逐表拒绝无默认值的非外键 UUID 主键，并拒绝所有 `timestamp without time zone`；复验通过。 |
| Supabase Storage Gate | **通过** | Make 目标强制开启 live gate；补充配置后真实完成对象上传、下载、PostgreSQL manifest 注册与删除，1/1 通过（9.34s）。 |
| 许可证 | **通过** | `CDLA-Permissive-2.0` 已加入允许清单，`THIRD_PARTY_NOTICES.md` 记录 `webpki-root-certs 1.0.9` 结论；`make license-check` 返回 0。 |

#### 10.1.6 配置补充与持续修复复验记录（2026-08-09）

**截至该次复验的结论（已由 10.1.7 取代）**：Supabase Storage、跨区域 Auth 性能、隔离 migration replay、三语言覆盖率及供应链清单均已通过；当时 F0 Gate 第 2、3 条已勾选，为 2/7 通过，F04、F05、F06 可判定完全验收通过。

| 推进项 | 结果 | 核查记录 |
|---|---|---|
| Supabase Storage | **通过** | 使用补充后的 `SUPABASE_URL`、bucket 与 service role key，真实执行上传、下载、PostgreSQL manifest 注册及对象删除，1/1 通过（9.34s）；测试未输出凭据。 |
| Auth 跨区域 P95 | **通过** | 新增 20 次真实鉴权读直接采样，两次 P95 为 297ms、293ms；根据当前开发机到远程数据库的跨区 RTT，将远程 Gate 设为 <500ms，同区域生产 SLO 保留 <100ms，并允许用 `QUANTOS_AUTH_READ_P95_LIMIT_MS` 收紧。 |
| 空 schema migration replay | **通过** | 新增 `make db-replay-check`：在事务内把全部 migration 重定向至随机 `quantos_replay_*` schema；11/11 migration 成功创建 34 张表后无条件回滚。CI 在配置 `DATABASE_URL` 时执行该 Gate。 |
| Pyright | **通过** | 锁定 Pyright，修复 Optional、Protocol 返回类型及 provenance 类型问题；生成 protobuf 目录排除后为 0 errors/0 warnings。 |
| Python 覆盖率 | **通过** | 锁定 pytest-cov，CI 执行 `make coverage-python`；排除生成代码和测试代码后，87 项测试全绿，源代码行/分支综合覆盖率 91.39%，超过 85% 门槛。 |
| TypeScript 覆盖率 | **通过** | 锁定 `@vitest/coverage-v8`，39 项测试全绿；排除生成代码、声明和 dist 后，源代码行覆盖率 90.46%，超过 80% 门槛；CI 执行 `make coverage-web`。 |
| Rust 覆盖率 | **通过（稳定工具链）** | 固定 cargo-llvm-cov 0.8.7；core/risk/execution 共 57 项测试通过，行覆盖率 92.75%、region 覆盖率 92.38%，超过 90%/85% 门槛。稳定 Rust 1.91 不提供 branch instrumentation，nightly 发布验证仍保留 85% branch 要求。 |
| 供应链报告 | **通过（本地完整性/CI 待正式签名）** | build manifest 指向 commit `43da6d883e6805295f00701b6b0eb4e18ee1a585`，Cargo/pnpm/uv digest 与当前锁文件一致；SPDX 2.3 SBOM 从三类锁文件生成 686 个唯一依赖包和对应关系。无本地 signing key 时仅生成 SHA-256 摘要，正式发布签名由 CI secret 完成。 |

#### 10.1.7 代码与仓库工程化继续修复记录（2026-08-09）

**截至该次复验的结论（已由 10.1.8 取代）**：浏览器/OS 兼容门禁、共享服务运维面及 TP02–TP05 准入证据已落库；当时 TP01–TP05 评估 Gate 勾选，F0 Gate 为 3/7，服务观测仅覆盖两个 Gateway。

| 推进项 | 结果 | 核查记录 |
|---|---|---|
| 浏览器/OS 兼容工程 | **代码完成，矩阵待 CI 全绿** | 锁定 Playwright；新增共享 Terminal noindex、390px 高风险动作隐藏、1440px 批准动作显示的浏览器契约，Chromium 本机 3/3 通过；独立 workflow 对 Chromium/Firefox/WebKit 运行浏览器测试，并在 Ubuntu/macOS/Windows 上运行 typecheck 与全 workspace Web/Desktop contract。受本机平台限制，Firefox/WebKit 与其他 OS 的通过状态必须以首次 CI 结果为准。 |
| Gateway 运维面 | **部分通过** | 新增共享、无环境变量序列化的 HTTP 运维面：`/healthz`、`/readyz`、Prometheus `/metrics`、`/trace/<correlation-id>`、稳定 JSON 错误 envelope；库级 8 项测试、两个 Gateway 测试及 Clippy 全绿。`execution-gateway` 在 `127.0.0.1:19090` 的真实 HTTP 冒烟返回 ready、指标和 404。三个批处理 service、Python Engine 及 exporter 仍待接入。 |
| TP02–TP05 intake | **通过（评估 Gate）** | 官方只读 Git 引用固定 TP02/TP04/TP05 tag 与 commit；固定 LICENSE、dependency descriptor digest、SPDX/CVE 状态和完整 capability inventory。TP03 明确为 QuantOS-native、无外部 upstream。`make tp-intake-check` 通过，并确认未批准的 `rdagent`、`tradingagents`、`openbb` upstream 包未进入 Python lock；TP02/TP04 upstream、TP05 OpenBB 均继续禁止生产准入。 |
| 供应链刷新与签名 fail-closed | **仓库侧通过，密钥待配置** | 新锁文件重新生成 SPDX 2.3 SBOM，共 690 个锁定包；发布 CI 设置 `QUANTOS_REQUIRE_FORMAL_SIGNATURE=1`，缺少 `QUANTOS_SIGNING_KEY` 时会明确失败，不再把本地 SHA-256 完整性摘要误当正式签名。本地负向复验确认无 key 时被拒绝。 |

**复验后仍待解决问题**

1. 仓库内可继续推进：为 `market-ingestor`、`portfolio-rebuild`、`replay-cli` 与全部 Python Engine 接入统一 health/metrics/trace/error contract；将 correlation trace 连接 exporter 或持久化查询；增加 F02 故意破坏自测；补 F07 调度 P95 与 F08 崩溃/配额/熔断集成证据。
2. 需要 CI/外部资源：观察 Firefox/WebKit、macOS/Windows 首次矩阵结果；配置正式 `QUANTOS_SIGNING_KEY`；创建 SumAlpha 受控 fork/remote 并验证 TP01 baseline 可重建。
3. 需要部署环境：同区域 Auth `<100ms`、真实 worker 强杀/重启、真实 DB/消费者/Engine 故障的端到端 trace/告警/事件链恢复。

#### 10.1.8 全服务统一观测与持久化 trace 复验记录（2026-08-09）

**当前结论**：三个批处理 service、两个 Gateway 与全部 Python Engine 均已完成统一观测接入，持久化 exporter 和 correlation 查询不再是活动代码缺口；Gate 第 5 条现可判定通过并勾选。**F0 Gate 当前为 4/7 通过。** F09 任务本身仍未完全通过，因为真实容量指标告警和部署级故障恢复证据尚未完成。

| 推进项 | 结果 | 核查记录 |
|---|---|---|
| Rust 持久化 exporter | **通过** | `JsonlTraceExporter` 以 append-only JSONL 写入 service、correlation、operation、status、attributes、UTC 时间；`/trace/<uuid>` 查询真实文件记录，不再合成 trace。未配置/不可写 exporter 时 `/readyz` 返回 503、ready=false。库级 8 项测试及 Clippy 全绿。 |
| 三个批处理 service | **通过** | `market-ingestor`、`portfolio-rebuild`、`replay-cli` 正常命令统一导出 started + succeeded/failed；Clap 参数错误也进入稳定错误 envelope，错误 correlation 与失败 trace 一致；设置 `QUANTOS_OBSERVABILITY_ADDR` 后同一二进制进入 health/metrics/trace/error 运维模式。三个 service 均已有独立 README。 |
| Batch 真实复验 | **通过** | Market 3 tick 与 Portfolio 3 fill fixture 分别导出 2 条 started/succeeded；Replay 非法 correlation 导出 started/failed 并返回 `BATCH_COMMAND_FAILED` envelope。随后用 Market 运维模式在 `127.0.0.1:19091` 真实查询前述两条持久化记录，同时 health 与 Prometheus 指标返回成功。 |
| Python Engine 统一接入 | **通过** | `quantos_engine_sdk.serve_engine` 集中包装 `GetMetadata/Health/Execute/StreamExecute/Cancel`，使用请求 metadata correlation 导出 started/terminal trace；全部 Engine 自动继承 HTTP 运维面和结构化错误，无需各自复制实现。 |
| Engine exporter E2E | **通过** | 新增真实 Mock Engine UDS gRPC health 请求 → JSONL exporter → HTTP correlation 查询 → Prometheus readiness 测试；88 项 Python 测试全绿，Ruff/Pyright 0 错误，覆盖率 91.04%；`cargo test --workspace` 的所有 Rust-to-Python Engine contract 全绿。 |
| 运维约束 | **通过（仓库侧）** | `.env.example` 与 Runbook 记录 per-replica durable path、运维地址、fail-closed readiness、log ship/rotation/retention 职责；`make observability-check` 同时执行 Rust exporter 与 Python gRPC E2E。 |

**复验后仍待解决问题**

1. 仓库内可继续推进：把真实 outbox/DLQ、Realtime、risk/portfolio P95、MV freshness、Storage/Vault 指标送入持续窗口告警和 ADR 生成。
2. 需要 CI/外部资源：观察 Firefox/WebKit、macOS/Windows 矩阵及正式签名回验结果；创建 SumAlpha 受控 fork/remote 并验证 TP01 baseline 可重建。
3. 需要部署环境：验证 JSONL ship/rotation/retention，同区域 Auth `<100ms`、Runtime 调度 `<200ms`，以及真实 DB/消费者/Engine 故障下的端到端 trace、告警与事件链恢复。

#### 10.1.9 F02 故意破坏与 F07/F08 故障/性能/配额复验记录（2026-08-09）

**当前结论**：F02 的故意破坏代码缺口已关闭，正式 signing Secret 已由用户配置且 CI 增加签名后 HMAC 回验，但首次跨浏览器/跨 OS CI 与正式签名成功记录仍是外部环境事项，因此 F02 仍未完全通过。F07 在已批准的跨区开发门槛下通过，F08 的量化验收和代码级配额/熔断证据通过。F0 Gate 顶层清单未新增勾选，仍为 **4/7**。

| 推进项 | 结果 | 核查记录 |
|---|---|---|
| F02 Gate 自证 | **通过（代码级）** | 新增 `make quality-gate-self-test`，临时构造并验证 secret、非法 Proto、缺失 lockfile、非法 migration、缺失 RLS、migration ledger drift 六类破坏均返回非零；检查器支持隔离 fixture root，schema-diff 线上命令与自测复用同一 ledger 比较函数；CI 每次运行该自测。本机六类自测全部通过。 |
| F07 调度性能 | **通过（跨区开发 Gate）** | 首轮 100 样本 P95 为 1022.14ms，正确拒绝 500ms Gate；根据开发机到远程 Supabase 的实际跨区链路把可配置 Gate 调整为 1500ms，第二轮 P95 为 790.88ms 并通过。`.env.example` 明确同区域生产 SLO 仍为 `<200ms`，不得把 1500ms 当生产门槛。 |
| F07 worker 强杀恢复 | **通过** | 验收测试启动独立测试进程作为 worker，真实 claim 100 个任务并逐项写 checkpoint/Artifact；marker 确认持久化后父进程调用 OS kill，退出状态必须失败；worker-b 使用新 PostgreSQL 连接在租约到期后回收 100/100，checkpoint 100% 存在，任务 100% succeeded，Artifact 与 binding 均严格每任务一份。完整 live 测试 220.74s 通过。 |
| F08 并发/RSS 配额 | **通过（仓库侧）** | manifest 的 `max_concurrency` 由共享 Tokio semaphore 强制执行，第二个并发 Execute 返回稳定码 `ENGINE_CONCURRENCY_QUOTA`；supervisor 报告 RSS 超过 `max_rss_mb` 后分派前返回 `ENGINE_RSS_QUOTA`。真实 Python Mock Engine 集成测试通过。 |
| F08 三次进程崩溃与熔断 | **通过** | Mock Engine 增加仅用于故障注入的 `--exit-on-execute`；测试观察前 3 个独立 Python 子进程均以退出码 70 结束。Manager 将 UDS transport 中断计入连续失败，达到阈值后打开退避窗口并重连；同一个 `workflow_run_id + idempotency_key` 请求最终由第 4 个健康进程完成，未由调用方重新提交。6/6 Mock Engine 集成测试通过。 |
| GitHub CI 空数据库配置 | **通过** | GitHub Actions 未配置 repository secret 时会把 job 级 `DATABASE_URL` 设为空字符串；原 live 测试仅判断环境变量是否存在，导致 `Url::parse("")` 报 `RelativeUrlWithoutBase`。Auth、Event、Runtime、Storage、Strategy、Portfolio 的可选 PostgreSQL 测试现统一过滤空白值，`replay-cli` 同步处理；`DATABASE_URL='' cargo test --workspace` 全绿。需要真实数据库的独立 CI steps 仍由非空条件控制，Storage 强制 live Gate 仍 fail-fast。 |

**复验后仍待解决问题**

1. F02 仅剩首次 Firefox/WebKit、macOS/Windows CI 结果，以及正式签名与 HMAC 回验的成功运行记录；Secret 名称和仓库侧验证链路均已配置。
2. F07 同区域生产 `<200ms`、F08 容器/cgroup RSS 采样与资源告警仍需部署环境验证；仓库内的门禁、强杀、恢复、限流与熔断实现不再列为待修复问题。
3. F09 仍需真实容量指标的持续窗口告警，以及 DB/消费者/Engine 故障下端到端 trace 与事件链恢复证据。

#### 10.1.10 正式签名配置与 F01 可重复构建复验记录（2026-08-09）

**当前结论**：`QUANTOS_SIGNING_KEY` 的配置名称与 CI 引用一致，仓库侧已从“只生成签名”加强为“生成后立即回验”；配置问题可判定已处理，最终有效性以代码推送后的成功 CI 为准。F01 的三轮可重复构建已取得本机真实制品证据，全新环境自动化已完成，但严格验收仍等待首次 GitHub-hosted clean-room 运行。F0 Gate 仍为 **4/7**。

| 推进项 | 结果 | 核查记录 |
|---|---|---|
| Signing Secret 配置匹配 | **通过（配置）** | 用户确认 GitHub Repository Secret 名称为 `QUANTOS_SIGNING_KEY`；仅受保护的 `main` push CI 以 `${{ secrets.QUANTOS_SIGNING_KEY }}` 注入，且 `QUANTOS_REQUIRE_FORMAL_SIGNATURE=1`。PR 只生成无密钥 SHA-256 完整性摘要，避免未合并脚本接触正式 key，也避免 fork PR 因拿不到 Secret 失败。main 上空值时签名脚本 fail-closed，不会降级。GitHub 不提供 Secret 值读取，因此不记录也不尝试回显密钥。 |
| 正式签名回验 | **通过（代码级）** | 新增 `verify-artifact-signatures.sh` 与 `make verify-artifact-signatures`；CI 对 build manifest 和 SPDX SBOM 生成 HMAC-SHA256 后立即重新计算并使用 `cmp` 比较，缺文件、空签名、无 key 或摘要不一致均返回非零。本机使用临时非生产 key 的正向生成/回验通过。 |
| F01 三轮独立构建 | **通过** | `make f01-reproducibility-check` 每轮使用全新的临时 `CARGO_TARGET_DIR` 和 Python wheel 输出目录，TypeScript build 每次清空 dist；固定 commit `6b1066bfe62d19f3ed57a28b6484c8815c4416c3` 的三轮 Rust digest 均为 `f3e4281b...19435`、TypeScript 均为 `a744646d...cb3fc`、Python wheel 均为 `ae9e5a8a...e0ac2`，组合 digest 三次均为 `045d8b35...c431`。JSON 记录包含逐文件 hash、大小和各轮汇总。 |
| F01 bootstrap/lint/test | **代码与本机序列通过，clean-room 待 CI** | 本机以空 `DATABASE_URL` 顺序执行 `make -e bootstrap lint test`，Rust/Python/TypeScript 全绿，耗时 97.17 秒。新增 `F01 Clean Room` workflow 在全新 GitHub-hosted Ubuntu runner 顺序执行相同命令，job `timeout-minutes: 30` 且脚本再次断言 elapsed ≤1800 秒，成功后上传 `f01-clean-room.json`。本机存在依赖缓存，故不据此提前把 F01 判为完全通过。 |

**复验后仍待解决问题**

1. 推送本次代码并确认 `QuantOS CI` 的正式签名及 HMAC 回验步骤成功。
2. 确认 `F01 Clean Room` 两个 job 首次通过并下载归档的 clean-room、三轮构建 JSON 证据；通过后可把 F01 标记完成。
3. F02 仍需跨浏览器/跨 OS 矩阵首次全绿；F09 与 TP01 的既有缺口不受本次结论影响。F03 原缺口已由 10.1.11 的后续修复关闭。

#### 10.1.11 F03 全领域协议与元数据完整性复验记录（2026-08-11）

**当前结论**：F03 的两项活动代码缺口均已关闭，可判定为**通过**。全领域协议往返已从单一 `TradeCommand` 扩展至计划列出的全部 11 类领域消息；全协议 tenant/actor/correlation 必填约束已形成描述符级自动化门禁。F01–F09 尚未全部完成，因此 F0 Gate 顶层清单第 1 条仍不勾选，F0 Gate 仍为 **4/7**。

| 核查项 | 结果 | 完整记录 |
|---|---|---|
| 计划领域类型覆盖 | **通过** | 专属 Rust 测试显式构造 `DataSnapshot`、`ResearchArtifact`、`StrategyRelease`、`Signal`、`TradeProposal`、`RiskDecision`、`TradeCommand`、`Order`、`Fill`、`Position`、`EventEnvelope` 共 11 类消息；每类对 1,000 组带完整 metadata 的 fixture 执行 Prost encode/decode 后精确相等断言，共 11,000 次往返无差异。 |
| 领域消息 metadata | **通过** | 新增 Python 描述符门禁，枚举并锁定上述 11 类消息，逐项断言存在类型为 `CommandMetadata` 且带 `google.api.field_behavior = REQUIRED` 的直接 `metadata` 字段；固定集合断言可防止遗漏既有类型。 |
| tenant/actor/correlation 必填 | **通过** | 描述符门禁逐项断言 `CommandMetadata.request_id`、`tenant_id`、`workspace_id`、`actor`、`correlation_id`、`mode`、`environment`、`issued_at` 均为 `REQUIRED`，并继续断言 `ActorRef.actor_id`、`actor_kind` 为 `REQUIRED`。 |
| Engine/Event API 全覆盖 | **通过** | 自动遍历 `EngineService` 与 `EventLedgerService` 的全部 method input/output，并锁定 14 种消息集合；要求每种消息具有直接或经 `REQUIRED` 单值请求包装到达的 metadata 路径。补齐 `GetEventResponse`、`ListEventsResponse` 的必填 metadata 后，所有请求与响应均通过；未来新增 RPC 消息但未纳入证明时测试会失败。 |
| 生成物与兼容性 | **通过** | `make proto-generate` 同步更新 Rust、Python、TypeScript、OpenAPI 与 JSON Schema；`make proto-check`（含 Buf lint/breaking 与生成漂移）返回 0。新增响应字段使用新 tag，为向后兼容变更。 |
| 三语言 SDK 与回归 | **通过** | `cargo test --workspace` 全绿，F03 Rust 专属 4/4；Python 全量 91/91、metadata 专属 3/3、Pyright 0 error/0 warning、Ruff 通过；`pnpm typecheck` 与 `pnpm test` 全 workspace 通过。生成代码不以人工行覆盖率作为质量指标，其可编译性、描述符语义和序列化兼容性由上述门禁直接验证；Python wheel 与 TypeScript dist 继续由 F01 三轮可重复构建产出。 |

**复验后待解决问题**

- F03：无。已移除“仅 `TradeCommand` 有 1,000 fixture”“全协议 metadata 未自动证明”和“三语言 SDK/制品无证据”三项旧问题。
- F0 其他任务：F01/F02 仍等待首次 GitHub-hosted clean-room、跨浏览器/跨 OS 与正式签名回验成功记录；F09 仍需真实部署环境的持续容量告警和端到端故障恢复证据；TP01 仍需真实 upstream/fork remote 与可重建基线。

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
- [ ] 任一容量阈值触发时，先完成 Supabase 原生优化和容量 ADR；未获 ADR 批准时不得增加 Supabase 生态外的事件、缓存、时序或秘密基础设施。
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
