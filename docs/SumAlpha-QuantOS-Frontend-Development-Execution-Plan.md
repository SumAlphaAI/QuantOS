# SumAlpha QuantOS 前端开发执行计划

> 版本：1.0  
> 日期：2026-08-09  
> 状态：待产品、前端、BFF、QA、安全与风控联合评审后执行  
> 依据：[网站与终端设计方案](./SumAlpha-QuantOS-Web-and-Terminal-Design.md)、[Terminal 全量前端页面设计规格](./SumAlpha-QuantOS-Terminal-Frontend-Design-Spec.md)、[QuantOS 可执行开发计划](./SumAlpha-QuantOS-Development-Plan.md)  
> 目标：交付官网、`app.sumalpha.ai` 与 Tauri 桌面端共享的 QuantOS Terminal 前端；在页面、字段、请求响应、权限、实时流、风险审批、订单与审计链路上与后端保持可验证的一致性。

## 1. 执行原则、范围与当前基线

### 1.1 不可变原则

1. Web 与 Desktop 复用 `apps/terminal`、领域组件、BFF client、路由、权限判断和核心 E2E；平台差异只进入 `packages/platform`。
2. 浏览器和桌面端只访问 Gateway/BFF，不直连 Supabase 数据库、Realtime 原始表、NATS、Engine、Execution Gateway 或 venue。
3. 服务端是领域状态、权限、capability、mode、数据时效与风险结论的唯一权威；前端只保留查询缓存、布局、偏好和未提交草稿。
4. `TradeProposal` 永远显示为“不可执行建议”；前端不得创建或修改 `RiskDecision`、拼装 `TradeCommand`、持有交易密钥或乐观展示订单成功。
5. 当前交付仅覆盖单主租户、单主工作区、单优先 venue、Research/Paper/Shadow。Assisted Live 只做 M5 testnet 评审准备，必须由服务端 flag/capability 放行；Guarded Live 不进入本计划。
6. 所有写操作必须幂等、可追踪、可审计；高风险动作必须执行“刷新对象版本与可操作性 → 必要的 MFA/审批 → 服务端最终校验 → 展示 correlation ID”。

### 1.2 交付范围

| 产品面 | 本计划交付 | 不交付 |
|---|---|---|
| 官网 | 首页、产品、架构与安全、使用场景、文档、访问申请、登录；后续补开发者与状态页 | 收益宣传、公众投资推荐、社区/跟单 |
| Terminal Web | P01–P15、P17–P23 全部页面与全局状态 | 移动端高风险操作、浏览器内回测/任意脚本 |
| Terminal Desktop | 与 Web 相同的业务页面；P16 平台能力、深链、通知、多窗口、布局恢复、签名更新验证 | 独立业务状态机、离线写队列、本地交易能力 |
| 模式 | Research、Paper、Shadow；M5 testnet 条件入口 | 默认生产实盘、Guarded Live |

### 1.3 仓库现状与目标差距

当前仓库已经具备 `apps/website`、`apps/terminal`、`apps/terminal-desktop`、`packages/ui`、`packages/domain-ui`、`packages/api-client`、`packages/platform` 骨架，已生成 QuantOS TypeScript Protobuf 类型，并有 U01/S04/X06/L03 场景测试。当前应用仍是 TypeScript 骨架：尚未落地 Next.js/React 页面运行时、Tailwind/Radix 设计系统、TanStack Query/Table/Virtual、图表、表单、i18n、MSW、Storybook 和真实 BFF HTTP transport；`InMemory*Backend` 只能作为场景 fixture，不能作为生产接口契约。

因此第一个里程碑不是直接铺页面，而是冻结 OpenAPI/BFF 页面契约、建立真实应用运行时，并把已有 fixture 转成由同一 schema 驱动的 mock。

## 2. 技术栈与工程决策

以下选型继承两份设计文档，并在阶段 FEP-0 通过 ADR 锁定版本；没有 ADR 不得替换核心框架。

| 层 | 选型 | 执行约束 |
|---|---|---|
| 官网 | Next.js App Router + React + TypeScript | SSG/SSR、SEO、内容安全、访问申请；与 Terminal 分应用构建 |
| Terminal | Next.js App Router + React + TypeScript | 同一共享应用供 Web 与 Tauri 加载；业务路由全部 `noindex, nofollow` |
| 桌面壳 | Tauri 2 + Rust | 只实现 `PlatformCapabilities`；最小 capability、签名制品、受控更新 |
| 样式与无障碍 | Tailwind CSS + Radix UI + QuantOS Design System | token 集中管理；状态必须有文字、图标、语义色和读屏标签 |
| 服务端状态 | TanStack Query | 统一 query key、缓存、失效、重试和实时投影合并；领域真相不进 Zustand |
| 本地 UI 状态 | Zustand | 仅布局、抽屉、筛选偏好和未提交草稿；交易命令和权限禁止持久化 |
| 表格 | TanStack Table + TanStack Virtual | 服务端分页/筛选/排序；URL 同步；大列表虚拟化 |
| 图表 | ECharts + Lightweight Charts | 风险/P&L/归因使用 ECharts；OHLCV/K 线使用 Lightweight Charts |
| 表单 | React Hook Form + Zod | Zod schema 优先从 OpenAPI/领域 schema 生成或薄封装；服务端校验仍为准 |
| 国际化 | next-intl | 首发中英文；时间、币种、数字格式统一；安全文案不可随意改写 |
| 契约 | OpenAPI + 生成式 TypeScript client；Proto/JSON Schema 为领域事实来源 | 禁止页面手写重复 DTO；Buf breaking 与 client generation diff 进入 CI |
| 实时 | SSE 为任务/事件流默认方案，WebSocket 仅用于确需双向或聚合频道的场景 | 必须支持游标续传、乱序/重复去重、断线回补和权限变更断开 |
| 测试 | Vitest + React Testing Library + MSW + Playwright + axe + 视觉回归 | fixture 固定 clock/ID；Web/Desktop 共享业务用例 |
| 组件文档 | Storybook | 覆盖默认、加载、空、错误、无权、陈旧、离线、危险确认状态 |
| 观测 | Sentry/OTel Web SDK（按隐私策略启用） | 错误含 correlation ID；token、密钥、完整敏感载荷不得上报 |
| 包管理/构建 | 现有 pnpm workspace；Next.js 构建；Tauri build | 锁文件、Node/pnpm 版本固定；正式制品生成 manifest、SBOM 与签名 |

## 3. 前期准备阶段（FEP-0，建议 2 周）

### 3.1 工作包与产出

| ID | 任务 | 主要动作 | 产出 | 完成标准 |
|---|---|---|---|---|
| PRE-01 | 需求拆解 | 将官网页面、P01–P23、全局壳、角色、状态和关键流程拆为 story；每项标注 P0/P1、角色、路由、平台和风险级别 | 页面台账、路由/权限矩阵、验收场景表 | 页面覆盖率 100%；每页至少有默认/加载/空/错误/无权/陈旧/离线状态 |
| PRE-02 | 设计系统预研 | 固化 token、密度、断点、主题、状态枚举、金融数值、图表、表格、危险动作模式 | Design token ADR、组件清单、Storybook 骨架 | WCAG 2.2 AA 基础检查通过；通用安全文案全部入 i18n |
| PRE-03 | 技术栈落地 | 在现有 workspace 引入并验证目标依赖；建立 Next.js Web/Terminal 与 Tauri 加载 PoC | 运行时 ADR、依赖锁、最小构建与双端 smoke | 新环境 ≤30 分钟完成 bootstrap/build/test；Web 与 Desktop 打开同一路由 |
| PRE-04 | 接口盘点 | 对照 F03、F05–F09、R02–R04、S01–S04、X01–X06、L01–L03 与现有 Proto/API client，建立本计划第 5 节契约台账 | OpenAPI gap list、字段字典、接口责任人、mock 状态 | 每个 P0 页面有 Query/Command/Realtime 依赖；无“待开发时再定”字段 |
| PRE-05 | 环境方案 | 建立 local/mock、local-integrated、staging、desktop 四套配置，定义 BFF origin、OIDC callback、feature flags、观测和测试账号 | `.env.example`、配置校验、开发说明 | 缺必需变量 fail-fast；客户端 bundle 不含 server secret；环境/mode 明确分离 |
| PRE-06 | 测试基线 | 建立 MSW contract fixtures、Playwright project、axe、视觉基线、性能预算 | 测试目录与 CI job | 故意破坏 schema、权限、敏感字段或视觉基线能使 CI 失败 |

### 3.2 前期 Gate G0

以下条件全部满足后才能进入页面功能开发：

- BFF 发布版本化 OpenAPI，至少冻结会话/上下文、Research、DataSnapshot、Strategy、Portfolio/Risk、Proposal/Approval/Order 与统一错误模型；未实现接口允许 mock，但 schema 不允许另起一套。
- 生成 client 与 Proto/JSON Schema 一致性检查进入 CI；现有手写 `InMemory*Backend` 已迁移为实现生成接口的测试 adapter，或明确标记为待删除。
- 页面台账能追踪到 `页面 → 前端任务 → BFF 契约 → 后端计划任务 → 测试用例 → Gate`。
- Web/Desktop 共享页面 PoC、OIDC callback PoC、SSE 断线续传 PoC、Tauri 深链 PoC 均通过。
- 产品、前端、BFF、QA、安全与风控签署 G0 记录；未冻结项有责任人、截止日和兼容策略。

## 4. 阶段化开发计划与里程碑

排期基准为 3–4 名前端、1 名 BFF 联调接口人、1 名 QA，2 周一个 Sprint。后端依赖未达到对应 Gate 时，该阶段先用同 schema mock 完成 UI，但不能标记“联调完成”。总建议周期为 18 周；官网工作可与 Terminal 阶段并行。

| 阶段 | 周期 | 页面/范围 | 主要后端依赖 | 交付节点与放行条件 |
|---|---:|---|---|---|
| FEP-0 准备与契约 | W1–W2 | 工程运行时、设计系统、接口台账、环境、测试底座 | F01–F06，尤其 F03/F06 | G0：栈、OpenAPI、会话、错误、mock、双端 PoC 冻结 |
| FEP-1 壳与官网 | W3–W4 | 官网首期；P01、P02、P15、P17；App Shell、路由、主题、i18n、全局状态 | F06、F09 | G1：认证/RBAC/模式/陈旧/离线/响应式可用，官网内容合规 |
| FEP-2 研究闭环 | W5–W7 | P03–P05；Research 创建、流式、取消、Artifact、DataSnapshot | R02–R04、F07/F08、TP01–TP05、U01 | G2：固定输入可追溯与重放；取消 ≤2s；Web/Desktop 同用例全绿 |
| FEP-3 策略治理 | W8–W9 | P06–P07；草稿、静态检查、回测、Release、审批时间线 | S01–S04、R02、F06 | G3：未验证/未审批不可部署；M3/M4 仅 Paper/Shadow |
| FEP-4 市场与分析 | W10–W11 | P18–P19、P21；市场目录、报价、K 线、订单标记、收益与报表 | R01/R02、X01、Performance/Valuation/Report API | G4：来源/venue/as_of/quality/口径完整；断流不拼接；provisional 正确 |
| FEP-5 风险与执行闭环 | W12–W14 | P08–P12、P20、P22；Portfolio/Risk、Proposal、Trade Ticket、Approval、Order、Reconciliation、Audit | X01–X06、TP07 | G5：七类高风险用例全绿；完整证据链 ≤5 分钟还原；无直连 venue |
| FEP-6 运维治理与跨端 | W15–W16 | P13、P14、P16、P23；Operations、Admin、Alerts、桌面能力 | F09、X05/X06、Auth/Policy/Incident/Alert API | G6：受控 Runbook、职责分离、通知/深链/窗口/离线安全通过 |
| FEP-7 硬化与 Beta | W17 | 全量回归、兼容、性能、可访问性、安全、视觉、故障恢复 | R1/S2/X3 Gate | G7：Paper + Shadow Beta 验收通过，阻断级缺陷为 0 |
| FEP-8 M5 评审准备 | W18 | P10/P11/P16 的 testnet 条件入口、MFA、双人审批、签名更新 | L01–L04，且仅 testnet | G8：flag 关闭时 UI/API 不可达；只形成评审证据，不开启生产实盘 |

### 4.1 分阶段任务拆解

#### FEP-1：壳、认证、官网与通用能力

| ID | 任务 | 接口绑定 | 验收重点 |
|---|---|---|---|
| UI-101 | App Shell、路由守卫、主工作区/账户/mode/数据新鲜度/风险/连接状态 | C01、C02、C16 | 守卫严格按 session → tenant/workspace → RBAC/capability → resource → mode → data 顺序；任一步失败停止后续请求 |
| UI-102 | OIDC、callback、MFA、401/403/404/maintenance/offline | C01、C08 | 401 清内存态；403/404 不泄露对象存在性；return path 不含敏感参数 |
| UI-103 | QuantOS UI/domain-ui、主题、i18n、表格/时间线/确认框 | 无业务接口 | 所有组件状态进 Storybook；键盘、焦点、200% 缩放和读屏通过 |
| UI-104 | Profile/安全/通知/浏览器能力 | C17 | 会话撤销、通知降级、下载说明可用；小屏无高风险按钮 |
| WEB-101 | 官网首页、产品、架构安全、场景、访问申请、登录 | Access Request/Auth | Lighthouse、SEO、隐私、防滥用和禁用词检查通过 |

#### FEP-2：Research、Artifact 与 DataSnapshot

| ID | 任务 | 接口绑定 | 验收重点 |
|---|---|---|---|
| UI-201 | Research 列表、新建与表单校验 | C03、C04 | 请求含 capability、snapshot、budget、deadline；后端拒绝字段原位显示 |
| UI-202 | Research 详情、SSE 流、取消与恢复 | C03 | 以 sequence/cursor 去重；断线从最后确认游标回补；取消返回受理态而非伪造已取消 |
| UI-203 | Artifact/Evidence 详情与交叉跳转 | C04、C10 | 显示 input/content/environment hash、Engine/prompt/code 版本、证据与 correlation ID |
| UI-204 | DataSnapshot 目录/详情、质量/许可/时效 | C04 | `failed/degraded/expired/license missing` 明确阻断后续策略/交易用途 |

#### FEP-3：Strategy、Backtest 与 Release

| ID | 任务 | 接口绑定 | 验收重点 |
|---|---|---|---|
| UI-301 | Strategy 目录与 Lab 草稿 | C05 | 自动保存带版本；409 保留草稿并提供 diff，不覆盖服务端 |
| UI-302 | 静态检查、回测队列与报告 | C05 | 固定 snapshot/clock/cost/slippage/environment hash；泄漏检查失败阻断 Release |
| UI-303 | 不可变 Release、审批申请与目标选择 | C05、C08 | hash/参数/回测/数据/证据齐全；目标完全取自后端 `allowedTargets` |

#### FEP-4：Markets、K 线、Performance

| ID | 任务 | 接口绑定 | 验收重点 |
|---|---|---|---|
| UI-401 | Market Catalog、Watchlist、VenueQuote | C12 | 每行含 source、venue、asOf、latency、quality、capability；不同产品不前端合并 |
| UI-402 | OHLCV/K 线、指标、订单/成交标记 | C12、C09 | series 元数据完整；切 venue/product 清空旧 series；断流停在最后确认时间 |
| UI-403 | Performance、归因、周期报表 | C14、C15 | 金额/币种/估值/账本版本/口径齐全；未对账数据标为 provisional |

#### FEP-5：Portfolio、Risk、Trade 与审计

| ID | 任务 | 接口绑定 | 验收重点 |
|---|---|---|---|
| UI-501 | Portfolio 与 Risk | C06、C16 | asOf/stale、仓位、P&L、敞口、规则命中、kill switch 常驻；陈旧即阻断写操作 |
| UI-502 | Proposal 与风险评估 | C07 | 永久显示 `executable=false` 语义；过期 Proposal 不允许评估 |
| UI-503 | Trade Ticket preflight | C12、C13、C07 | 每一步重新取报价、余额、限额、venue 健康、对象版本和 mode；只预填 intent，不生成 command |
| UI-504 | Approval、MFA、职责分离 | C08 | 自批/过期/冲突/额度变化明确拒绝；不采用乐观更新 |
| UI-505 | Command 提交、Order/Fill 时间线、撤单请求 | C09 | 提交只传服务端 command ref 与 Idempotency-Key；重复提交只产生一笔下游订单 |
| UI-506 | Reconciliation 与账本差异 | C15、C16 | 不能手工改账；差异贯通 Order/Fill/Performance/Alert/Audit |
| UI-507 | Audit Explorer 与受控导出 | C10 | correlation/causation 链完整；导出异步、短时 URL、授权和审计 |

#### FEP-6：Operations、Admin、Alerts 与 Desktop

| ID | 任务 | 接口绑定 | 验收重点 |
|---|---|---|---|
| UI-601 | Operations/Incident/Runbook | C11、C16 | 只能触发服务端批准 actionId；无任意命令/脚本入口 |
| UI-602 | Admin 治理 | C11、C01 | 成员、角色、policy、capability、flag 全量审计；最后管理员保护；职责分离 |
| UI-603 | Alerts 收件箱 | C16 | BFF 授权/去重/限速；ack 仅代表已读，不代表解决；离线禁写 |
| UI-604 | Tauri adapter 与 P16 | C17、平台接口 | 业务组件无 `isDesktop` 分叉；离线只读；深链重新鉴权；签名更新验证 |

## 5. 接口对接清单与契约基线

### 5.1 契约状态说明

《可执行开发计划》冻结的是领域对象、协议元数据、错误稳定性、幂等/审计要求和业务时序，并没有给出 P01–P23 完整 REST URL 与统一 JSON envelope。下表中的 C01–C17 是前端需要 BFF 冻结的**逻辑契约包**，不是对尚未发布 HTTP 路径的臆造。实际路径、method、分页格式和 envelope 必须以版本化 OpenAPI 为准；页面只能引用生成 client。

### 5.2 页面—接口—后端任务映射

| 契约 | 页面 | 必需 Query/Command/Realtime | 关键请求/响应字段 | 后端计划依赖 |
|---|---|---|---|---|
| C01 Session/Context | P01、全局、P15 | session、workspace/account context、capabilities、reauth/MFA、logout | actorId、tenantId、workspaceId、accountId、mode、environment、capabilities、mfaState、expiresAt | F06、L03 |
| C02 Command Center | P02 | summary query、authorized event projection | riskPosture、dataFreshness、pendingApprovals、failedRuns、orderSummary、alerts、sampledAt | F09、R03、X01–X06 |
| C03 Research Runtime | P03/P04 | list/create/get/cancel、SSE stream/replay | runId、capability、dataSnapshotId、budget、deadlineAt、status、inputHash、engineVersion、artifactRefs、evidenceRefs、sequence、correlationId | F07/F08、R03、U01 |
| C04 Snapshot/Artifact | P04/P05 | list/get snapshot、get artifact/attachment | snapshotId、schemaVersion、window、sources、quality、contentHash、licenseLabel、capturedAt、maxAge；artifactId、hypothesis、summary、engine/prompt/codeVersion、environmentHash | R02/R03、F05 |
| C05 Strategy | P06/P07 | draft list/get/save、static check、backtest create/get、release create/get/list | strategyId、draftVersion、expectedVersion、parameters、snapshotId、reportHash、leakViolations、source/image/parameterHash、allowedTargets、approvalState | S01–S04 |
| C06 Portfolio/Risk | P02/P08 | portfolio/risk query、kill switch command、authorized realtime | accountId、asOf、stale、positions、Money/Decimal values、P&L、exposure、hitRules、limitIds、verdict、killSwitch | X01/X02 |
| C07 Proposal/Risk Evaluation | P09/P20 | list/get proposal、request evaluation | proposalId、accountId、symbol、action、quantity/notional、signal、rationale、counterViews、evidenceRefs、expiresAt、`executable=false`；decisionId、verdict、hitRules、limitIds、signer、decidedAt | R04、X02 |
| C08 Approval/MFA | P07/P10/P20 | list/get/decide approval、MFA challenge、reauth | approvalId、originator、objectVersion、decision、reason/note、mfaChallengeRef、status、expiresAt、signature、commandRef | F06、X03、L03 |
| C09 Command/Order | P11/P19/P20 | submit command ref、list/get order、cancel request、order event stream | commandId、decisionId、accountId、venue、symbol、intent、side、quantity、prices、idempotencyKey、expiresAt；orderId、status、filledQuantity、averageFillPrice、Fill、sequence、correlationId | X03/X04、L01 |
| C10 Audit/Export | P04/P07/P09–P13 | search events、get evidence chain、create/poll/download export | correlationId、causationId、actor、occurredAt、objectRef、hash、redactedPayload、retention；exportId、scope、status、expiresAt、signedUrl | F05、X06 |
| C11 Ops/Admin | P13/P14 | health/incident/admin query、approved runbook/member/policy/capability/flag commands | service health、latency、DLQ、incidentId、actionId、configVersion、memberId、role/capability/flag、audit ref | F06/F09、X06 |
| C12 Market/Candle | P18/P19/P20 | catalog/quote/candle query、authorized realtime | canonicalSymbol、productType、venue、bid/ask、fee/slippageEstimate、lotSize、source、asOf、latency、quality；interval、timezone、OHLCV、gaps | R01/R02、L01 |
| C13 Trade Preflight | P20 | order capabilities、preflight/risk refresh | accountId、mode、venue options、supportedIntent、balance/position snapshot refs、quoteRef、limit impact、objectVersion、blockingReasons | X01–X03、L01 |
| C14 Performance/Report | P21 | performance query、create/poll/download report | accountId、currency、method、ledgerVersion、valuationSnapshotId、coverage、asOf、P&L/return/drawdown/fees、provisional；period/reportVersion | X01/X05，需 BFF 新增页面模型 |
| C15 Reconciliation | P22/P21/P11 | list/get/request rerun、status realtime | runId、accountId、venue、window、ledgerVersion、matched/investigating/resolved、breakId、internal/external values、reason、evidenceRefs | X05 |
| C16 Alert/Notification | P02/P13/P23、全局 | list/get/ack/unack/subscriptions、authorized realtime | alertId、severity、domain、account/venue、status、occurredAt、asOf、objectRef、correlationId、ackActor/At | F09、X05/X06 |
| C17 Settings/Platform | P15/P16/P17 | profile/session/device/notification/download query/commands | locale、timezone、theme、session/device、notification permission、download record；不得包含领域秘密 | F06、F09、L02/L03 |

### 5.3 字段与序列化规则

| 类型/字段 | 统一规则 | 前端处理 |
|---|---|---|
| `CommandMetadata` | `request_id`、`tenant_id`、`workspace_id`、`actor`、`correlation_id`、可选 `causation_id`、`mode`、`environment`、`issued_at` | tenant/actor 从受信会话由 BFF 注入，客户端不得伪造；页面至少能显示 correlation ID |
| ID | 领域主键和引用使用 UUID；显示层不解析 ID 业务含义 | 视为 opaque string，不排序、不重组、不放敏感上下文到 URL |
| 时间 | Proto Timestamp / PostgreSQL `timestamptz`；HTTP 使用带时区 RFC 3339 | 内部保持 UTC；展示按用户时区并同时提供原始时间；禁止本地无时区字符串 |
| 精确数值 | 数量/价格/比率采用 `DecimalValue.value` 字符串；金额采用 `MoneyValue {currencyCode, units, nanos}` | 禁止先转 IEEE-754 number 再做交易计算；用十进制定点库格式化 |
| 枚举 | 以 F03 Proto 为准：mode、quality、verdict、order status、intent、side 等 | 未知枚举必须显示“未知/需升级”并阻断高风险动作，不能落入默认 allow |
| hash/version | content/source/image/parameter/input/environment/report hash 与 objectVersion/ETag | 完整保留；危险动作前刷新并携带 expected version，409 不自动覆盖 |
| 可空性 | OpenAPI `required`/nullable 与 Proto field behavior 对齐 | 不用空字符串代替缺失；新增可选字段向后兼容，移除/改义属于 breaking |
| 分页/排序 | BFF 必须统一 cursor、pageSize、sort、filter 结构 | 大表只做服务端分页/排序/筛选；游标不持久化为领域数据 |
| 敏感字段 | BFF 先脱敏；Vault/venue/model secret 永不进入 schema | 日志、URL、analytics、Sentry、导出与桌面缓存均做负向检查 |

JSON 字段命名以 OpenAPI 生成结果为准。若采用 Proto JSON 映射，应统一输出 lowerCamelCase；任何 snake_case ↔ camelCase 转换只能集中在生成/transport 层，页面组件不得自行映射。

### 5.4 请求、响应与错误格式冻结项

G0 期间由 BFF 与前端共同冻结以下内容：

- 认证使用 HttpOnly/Secure/SameSite cookie 或等价服务端会话；浏览器不持久化长期 token。
- 所有 command 携带 `Idempotency-Key`；同一业务意图重试复用原 key，新意图生成新 key。高风险请求同时携带对象版本、短时 reauth/MFA 引用和客户端 request ID。
- BFF 返回或响应头携带 `correlation_id`；任何失败提示、订单详情和 Audit 跳转均可引用。
- 成功响应需区分同步完成（200/201）、异步受理（202 + job/run/status ref）和无内容（204）；前端不得把 202 显示为业务完成。
- 错误 envelope 至少冻结 `code`、安全可展示 `message`、`correlationId`、可选 `fieldErrors`、`retryAfter`、`currentVersion`；不得把堆栈、SQL、路径或凭据返回客户端。
- 401、403、404、409、422、429、5xx 严格执行设计规范第 6.2 节；未知错误 fail closed。
- 数据列表统一冻结 cursor/pageSize/nextCursor，实时事件统一冻结 streamId/sequence/eventId/occurredAt/correlationId/payloadVersion。

### 5.5 三条关键交互时序

**研究任务：** 获取 session/capability 与快照 → `create research`（Idempotency-Key）→ 接收 202/runId/correlationId → 以 sequence 订阅 SSE → 重复/乱序去重 → 断线按 afterSequence 回补 → cancel 返回 `cancel_requested` → 仅服务端终态显示 Cancelled/Succeeded/Failed → Artifact/Evidence 可跳 Audit。

**策略发布：** 加载 draft + objectVersion → 保存携带 expectedVersion → static check → 固定 DataSnapshot 发起 backtest → 校验环境/成本/泄漏报告 → 创建不可变 Release → 服务端返回 allowedTargets → 提交审批 → 审批通过后才可显示 Paper/Shadow 部署动作；任何 409/版本变化退回复核。

**建议到订单：** Proposal（不可执行）→ 刷新 proposal/snapshot/quote/account/venue/mode → request RiskDecision → deny 时终止；approval_required 时 MFA/审批且禁止自批 → 服务端签发短时 TradeCommand → 提交仅传 command ref + Idempotency-Key → Execution Gateway 再校验 → 返回受理/订单 ref → 订阅 Order/Fill 事实；过期、陈旧、kill switch、venue 异常或版本变化均退回相应前置步骤。

## 6. 联调与一致性校验机制

### 6.1 联调流水线

1. **契约设计：** BFF 在实现前提交 OpenAPI/Proto 变更、示例和兼容说明；前端和 QA 在 PR 内评审字段、状态、权限、错误与时序。
2. **生成与 mock：** CI 生成 TS client、Zod/fixture 类型；MSW 从同一契约提供成功、拒绝、冲突、限流、断流、陈旧与权限场景。
3. **Provider contract：** BFF 对 OpenAPI 示例运行响应校验；前端 consumer contract 对 staging BFF 运行，不允许仅 mock 通过。
4. **功能联调：** 按“单接口 smoke → 页面 query → command → realtime → 审计链 → 故障恢复”的顺序，每个接口记录 owner、环境、版本、证据和遗留项。
5. **Gate 回归：** 每阶段结束运行该阶段全部场景、全局安全回归、Web/Desktop 共用 E2E；契约未通过则阶段不能标为完成。

### 6.2 一致性自动校验

- `buf breaking`、Proto/JSON Schema/OpenAPI diff、TS client regenerate clean check 必须通过。
- 响应 fixture 使用 schema validator；required/enum/format/additionalProperties 策略一致。
- 前端禁止直接 import 内部数据库 DTO 或第三方 Engine/venue 类型；ESLint boundary rule 强制 `page → api-client/domain-ui`。
- 所有 command 测试断言 Idempotency-Key、request ID、correlation ID、expectedVersion 和审计事件。
- Realtime 测试覆盖重复、乱序、断连、漏通知、权限撤销和 schema version 不兼容。
- 敏感字段字典对网络响应、前端日志、监控事件、URL、下载和桌面缓存做自动扫描。

### 6.3 跨域与浏览器安全配置

| 项目 | 要求 |
|---|---|
| 同源优先 | 生产通过同站 BFF 路由；若必须跨域，仅允许明确的 Web/预览 origin allowlist，禁止 `*` + credentials |
| CORS | 限定 methods/headers；允许 `Idempotency-Key`、request/correlation/trace headers；预检缓存有版本化变更测试 |
| Cookie/CSRF | Secure、HttpOnly、SameSite；所有有副作用请求校验 CSRF token/origin；Tauri 使用受控回调与短时会话 |
| CSP | 默认拒绝；script/style/connect/img/font/frame 分别 allowlist；Sentry/WS/SSE 域名单独审计 |
| 下载/上传 | 短时签名 URL、内容类型/大小限制、恶意内容扫描、水印与导出审计；不让 Engine 直接读取本地文件 |
| 缓存 | 会话/受限响应 `no-store`；静态制品内容寻址；Service Worker 不缓存命令响应或敏感审计数据 |

### 6.4 接口变更同步机制

- 契约仓库/目录是单一事实来源；每个变更必须含 owner、版本、兼容性等级、影响页面、迁移期和回滚方案。
- 非 breaking 新增字段：前端必须容忍并记录覆盖；breaking 变更：新增 `/vN` 或兼容窗口，不允许直接修改既有语义。
- 每周一次 30 分钟契约评审；P0 阶段每日异步更新阻塞项。接口状态统一为 `Draft → Reviewed → Mocked → Implemented → Integrated → Verified`。
- 紧急变更必须由 BFF、前端、QA 和风险 owner 同意，带 feature flag/canary；高风险字段不允许口头或聊天消息直接变更。
- CI 自动生成契约变更报告并 @ 影响页面 owner；生成 client 有 diff 时不得跳过前端评审。

## 7. 测试与验收标准

### 7.1 测试分层

| 层级 | 覆盖要求 | 阻断标准 |
|---|---|---|
| 单元 | 领域组件/状态/格式化/权限解释/错误映射/stream reducer；TypeScript 新增领域代码行覆盖率 ≥80%，关键风险状态分支 100% | 任一 P0 状态分支缺失或覆盖率下降则阻断 |
| 组件 | P01–P23 的默认、加载、空、错误、无权、陈旧、离线、危险确认；Storybook + RTL + axe | 严重/高等级 a11y 问题为 0 |
| 契约 | OpenAPI schema、错误码、枚举、字段精度、分页、幂等、版本冲突、实时事件 | consumer/provider 任一不一致则阻断联调完成 |
| 集成 | TanStack Query 缓存/失效、OIDC、MFA、MSW/staging、SSE/WS、平台 adapter | mock 与 staging 行为不同或丢 correlation ID 则阻断 |
| E2E | 每角色关键旅程；研究、策略、风险审批、订单、审计、对账、运维；Web/Desktop 共用场景 | P0 旅程通过率 100%，不得以重跑掩盖 flaky |
| 视觉 | 1280/1440 宽屏、768 折叠、390 只读、深浅主题、关键危险状态 | 关键页面无未批准差异；其余像素差异阈值 ≤0.5% |
| 兼容 | Chromium/Firefox/Safari 当前稳定版；Desktop macOS/Windows；200% 缩放 | P0 功能/布局/键盘任一失败则阻断发布 |
| 安全 | 越权、IDOR、CSRF/CSP/CORS、XSS、敏感字段、缓存、深链、离线、依赖与 secret scan | 高危=0；未豁免中危=0；交易边界绕过=0 |

### 7.2 必测 E2E 场景

1. 研究员选择可用 DataSnapshot，创建研究，接收流式结果，断线续传，取消并进入 Artifact/Audit；全过程无订单入口。
2. 量化开发完成草稿、静态检查、固定快照回测、Release 和审批申请；验证失败/未审批/Assisted Live 均不可部署。
3. 交易员从有效 Proposal 或 Trade Ticket 发起风险评估；分别覆盖 allow、deny、approval-required、过期、重复、数据陈旧、kill switch。
4. 审批人完成 MFA 与审批；自批、第二人缺失、版本冲突、额度变化、命令过期全部拒绝。
5. 已批准 command 重复提交 1,000 次仅产生一个命令/订单事实；页面不在 ack 前显示成交。
6. 订单部分成交、拒绝、撤单延迟、断流回补；每个 Fill 可追溯 Proposal、RiskDecision、Approval、Command、Release 和 Snapshot。
7. 对账注入差异后，Orders/Performance/Alerts/Audit 一致显示 provisional/Investigating，且 UI 无改账入口。
8. 断网后 Web 与 Desktop 全部写操作禁用；Desktop 仅显示加密非敏感只读缓存，恢复后不自动提交旧意图。

### 7.3 页面还原度与功能完整性

- P01–P23 页面、路由、角色、主操作、文案、字段和状态与设计规格逐项对照，需求覆盖率 100%。
- 关键组件（App Shell、ModeBanner、DataGrid、EvidenceTimeline、RiskDecision、OrderStateMachine、DangerConfirmDialog）视觉基线由设计 owner 签署；关键页面设计验收评分 ≥95/100。
- 所有金融数值显示币种、精度、时区、`as_of` 与口径；所有证据对象显示 hash/版本/关联 ID。
- 所有危险动作只有一个明确主按钮，默认不获焦；状态变化来自服务端事实。

### 7.4 性能指标

性能按 staging 生产等价构建、受控网络与固定数据量采集 P75/P95；前端预算不得掩盖《可执行开发计划》的 BFF SLO。

| 指标 | 验收门槛 |
|---|---|
| 官网 Lighthouse | Performance/Accessibility/SEO/Best Practices 均 ≥90；核心内容 LCP ≤2.5s |
| Terminal 首次可用 | 典型办公网络冷启动 LCP ≤2.5s，INP ≤200ms，CLS ≤0.1；认证后 App Shell 可交互 ≤3.0s |
| 路由切换 | 已缓存 shell 下 P95 ≤500ms 出现可用骨架，P95 ≤1.5s 呈现首批有效数据（不含明确异步任务） |
| 交互响应 | 本地输入/展开/筛选反馈 ≤100ms；大表滚动保持 ≥55 FPS；高风险点击立即进入 pending 防重复提交 |
| BFF | 同区域授权读 P95 <100ms；风险/组合读模型 P95 <300ms；命令校验 P95 <200ms |
| 实时 | 已授权事件到 UI P95 ≤5s；研究取消确认 ≤2s；断线恢复后无事件丢失/重复副作用 |
| Bundle | 每路由设预算并在 G0 基线化；共享首屏 JS 初始建议 gzip ≤250KB，超限必须 ADR 与拆包证据 |

### 7.5 阶段完成定义

一个任务只有在代码、单元/组件/契约/E2E、可访问性、文案、观测、文档、联调记录和回滚说明全部完成后才能关闭。使用 mock 完成只可标记 `UI Complete`，只有 staging provider contract、真实权限、实时、错误和审计链通过后才能标记 `Integrated`；所属 Gate 全绿后才是 `Done`。

## 8. 风险管控与排期保障

| 风险 | 触发信号 | 影响 | 预案 | Owner |
|---|---|---|---|---|
| BFF 接口延期 | 契约未在阶段前一 Sprint 冻结；staging 连续 2 天不可用 | 页面联调与 Gate 延误 | schema-first + MSW；先完成无副作用页面；P0 command 不以 mock 代验收；必要时调整页面顺序而不缩减安全测试 | BFF TL + FE TL |
| 契约/字段频繁变更 | 一周内 breaking diff >1 次 | client/表单/测试返工 | 版本化 OpenAPI、兼容窗口、consumer contract、变更冻结日；breaking 必须 ADR | Architect |
| 设计变更 | 已开发页面结构/安全文案变化 | 视觉和交互返工 | token/组件优先；设计在 Sprint 前签署；安全含义变更需产品+风控复审 | Product + Design |
| 设计稿状态不全 | 缺错误/无权/陈旧/离线稿 | 边界状态临时发挥 | G0 必须补齐七态；未补齐页面不进 Sprint | Design owner |
| 实时链路不稳定 | 断线、重复、乱序、quota >70% | 状态错乱、重复提示 | cursor 回补、eventId 去重、轮询降级、只读降级；事实始终回查 BFF | BFF + FE |
| 权限/交易边界缺陷 | UI 可见越权数据或可绕过 Risk | 高危安全风险 | 默认拒绝、服务端权威、七类 E2E、IDOR/深链/缓存扫描；立即阻断发布 | Security + Risk |
| Web/Desktop 分叉 | 出现 `isDesktop` 业务判断或重复页面 | 双端语义不一致 | boundary lint、共享 E2E、平台接口评审；业务逻辑 PR 拒绝平台分叉 | FE TL |
| 图表/大表性能 | 10k+ 行或高频 candle 卡顿 | 专业使用不可用 | 虚拟化、服务端聚合、增量更新、路由拆包；阶段内做性能基线 | FE Performance owner |
| 第三方/许可问题 | CVE、许可证或上游 breaking | 构建/发布阻断 | 锁版本、SBOM、许可 Gate、adapter 隔离和替代方案；不让上游类型进入 UI | Supply-chain owner |
| 跨浏览器/OS CI 晚暴露 | Firefox/WebKit/macOS/Windows 失败 | Beta 延期 | 从 FEP-1 起每 PR 跑 Chromium，夜间跑全矩阵；每阶段至少一次完整矩阵 | QA |
| 人员/估算偏差 | Sprint burn-up 偏差 >20% | 里程碑滑动 | P0/P1 分层；锁定安全与契约任务，不删测试；官网/P1 报表或平台增强可后移 | PM + FE TL |

### 8.1 排期控制规则

- 每个阶段开始前满足 DoR：设计七态齐全、契约 Reviewed/Mocked、依赖后端 Gate 明确、验收 fixture 可用、owner 与估算已确认。
- Sprint 预留 20% 容量处理联调、可访问性、性能与缺陷；不得把这些工作推迟到最后一周。
- 阻塞超过 1 个工作日升级给 BFF/产品 owner；超过 2 个工作日由 PM 调整依赖顺序；不得通过硬编码返回值绕过。
- 每周发布集成环境候选；阶段中点做一次真实 BFF smoke，阶段末做 Gate，不把所有联调集中到最后。
- P0 阻断缺陷（交易边界、越权、数据/模式混淆、证据丢失、重复命令）为 0；P1 缺陷必须有 owner、修复版本和风险接受记录。

## 9. 执行看板与责任分工

| 角色 | 必须负责的签署项 |
|---|---|
| Frontend TL | 技术栈、目录边界、生成 client、共享实现、性能与阶段 Gate |
| BFF TL | OpenAPI、错误 envelope、权限裁剪、幂等、实时回补、correlation/审计 |
| Product/Design | 页面台账、优先级、七态设计、文案、还原度 |
| QA | fixture、契约/E2E/视觉/兼容矩阵、缺陷出口标准 |
| Security | OIDC/MFA、CSP/CORS/CSRF、敏感字段、Tauri capability、供应链 |
| Risk/Compliance | Proposal/Risk/Approval/Command 时序、模式/限额/kill switch、审计与导出 |
| SRE | staging、观测、性能采样、故障注入、Runbook 与发布回滚 |

每个看板任务必须包含：`页面 ID`、`前端任务 ID`、`契约 ID`、`后端计划 ID`、`风险级别`、`设计链接`、`测试用例`、`owner`、`依赖`、`目标 Sprint`、`契约状态`、`联调状态`、`Gate 证据`。

## 10. 最终发布检查表

- [ ] 官网首期页面与 Terminal P01–P23 的范围、角色、路由和七态全部交付。
- [ ] OpenAPI/Proto/JSON Schema/TS client 无未解释 diff，provider/consumer contract 全绿。
- [ ] Research、Strategy、Proposal → Risk → Approval → Command → Order → Reconciliation → Audit 全链路均有真实 BFF E2E 证据。
- [ ] Web/Desktop 共享业务代码和 E2E；平台差异只存在于 `packages/platform`。
- [ ] Proposal 无执行入口；客户端无 command 构造、venue 直连、密钥、离线写或乐观成交。
- [ ] 401/403/404/409/422/429/5xx、断线、陈旧、权限撤销和未知枚举均 fail closed。
- [ ] WCAG 2.2 AA、视觉、性能、兼容、安全和供应链 Gate 达标。
- [ ] 每笔抽样订单可在 5 分钟内还原完整证据链；每个错误可凭 correlation ID 定位。
- [ ] Paper/Shadow 清晰区分；M5 flag 关闭时 Assisted Live UI/API 100% 不可达；Guarded Live 不存在。
- [ ] 发布、灰度、回滚、桌面签名更新、告警与 Runbook 均已演练并归档。

