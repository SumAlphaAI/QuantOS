# SumAlpha QuantOS 前端开发执行计划

> 版本：2.9
> 更新时间：2026-09-16
> 状态：待产品、前端、BFF、QA、安全与风控联合评审后执行  
> 依据：[网站与终端设计方案](./SumAlpha-QuantOS-Web-and-Terminal-Design.md)、[Terminal 全量前端页面设计规格](./SumAlpha-QuantOS-Terminal-Frontend-Design-Spec.md)、[QuantOS 可执行开发计划](./SumAlpha-QuantOS-Development-Plan.md)  
> 目标：第一期交付官网与 `app.sumalpha.ai` Web Terminal；在页面、字段、请求响应、权限、实时流、风险审批、订单与审计链路上与后端保持可验证的一致性。第二期 Desktop 范围见[独立执行计划](./SumAlpha-QuantOS-Desktop-Development-Execution-Plan.md)。

## 版本变更说明

- `2.9`：完成 A2/BFF-FE-001 仓库交付；发布 OpenAPI 1.2.0 的 cookie session、CSRF、recent-auth、MFA 因素保护与 auditRef 契约，增加 Rust 本地参考 provider、撤销 SSE、前端 client 与可破坏 Gate。真实 IdP/Postgres、staging 消费者/provider 签署、GitHub CI 与 GPT-6 Astra 复审仍为独立未执行项。
- `2.8`：完成 A1/BFF-FE-000 仓库交付；冻结 C01–C17、一期 22 页的 published/planned operationId catalog，补齐 sort/filter、ETag、错误 correlation header 基线，并将依赖、生成漂移、页面追踪、CI 接线和负向破坏检查纳入可重放 Gate。A2–A6 provider 实现、staging 回执与 GPT-6 Astra 复审未据此提前完成。
- `2.7`：PRE-06 按 Web-only 边界完成当前仓库复核；将 Terminal 与官网的 Chromium/Firefox/WebKit、axe、真实入库视觉基线完整性、性能预算、BFF 1.1.0 contract fixture 与可破坏 Gate 接入 CI；Desktop 原生/深链测试迁至二期手动 workflow。本地 macOS 浏览器验收不代表 GitHub Actions、Linux 视觉或 staging 已运行。
- `2.6`：PRE-05 按 Web-only 边界完成当前仓库复核；冻结 local-mock、local-integrated、staging 三套 profile，将公开变量 allowlist、URL/callback、环境/mode、secret 负向扫描接入官网与 Terminal 的构建期 fail-fast，并从一期 Gate 排除 Desktop 环境。仓库 Gate 完成不代表 staging 基础设施或账号已配置。
- `2.5`：产品阶段调整为第一期仅交付 Web；迁出 Tauri、P16、桌面环境、原生测试、签名更新与 Desktop Gate 至独立第二期计划。第一期保留浏览器平台能力 P17 和 C17 Web 契约，不以已有桌面 PoC 扩大一期范围。
- `2.4`：PRE-04 接口盘点完成当前仓库复核；同步 BFF OpenAPI 1.1.0、55 operations、41 schemas 与 Proto 38 messages/15 enums 的实际基线，以 PRE-01 动态 P0 页面集合校验 C01–C17、GAP-01–17、144 行字段字典、owner 和 mock 状态，并新增六类可破坏 Gate。开发状态与接口实现状态、GPT-6 Astra 复审状态继续分开记录。
- `2.3`：PRE-03 技术栈落地完成当前仓库复核；固定 Node 24.12.0，按实际锁文件校验前端依赖，强化构建路由的可破坏 Gate，并以隔离环境重放 bootstrap/build/test。开发状态与 GPT-6 Astra 复审状态继续分开记录。
- `2.2`：PRE-02 设计系统预研完成当前仓库复核；强化 token/状态映射、36 组 WCAG 对比度、18 条规范安全文案、组件清单和 Storybook 骨架的可破坏 Gate。开发状态与 GPT-6 Astra 复审状态继续分开记录。
- `2.1`：PRE-01 需求拆解完成当前仓库复核；官网七页由聚合七态改为逐页七态，新增可执行的页面/Story/权限/场景/追踪完整性 Gate。开发状态与 GPT-6 Astra 复审状态继续分开记录。
- `2.0`：页面 API 与前端功能独立排期；先完成全量页面 API 开发与 provider 验证，再依业务依赖推进前端。FEP/Gate、UI、WEB、PRE、BFF-FE 与 C01–C17 标识保持稳定；P16 自 2.5 起迁入第二期。
- FEP-1 及 UI-101–UI-104、WEB-101 标记已开发完成，保留集成晋级条件，清除历史复验证据；为 GPT-6 Astra 设置全新复审入口。
- 采用[核心计划字段约定](./SumAlpha-QuantOS-Development-Plan.md#plan-review-schema) `quantos-plan-review/v1`。校验：`node scripts/check-development-plans.mjs`；结构通过不等于 Codex 平台加载、模型调用或真实联调验收通过。

## 1. 执行原则、范围与当前基线

### 1.1 不可变原则

1. 第一期只交付 Web；业务实现集中在 `apps/terminal`、领域组件、BFF client、路由和权限判断，不引入原生平台分支。
2. 浏览器只访问 Gateway/BFF，不直连 Supabase 数据库、Realtime 原始表、NATS、Engine、Execution Gateway 或 venue。
3. 服务端是领域状态、权限、capability、mode、数据时效与风险结论的唯一权威；前端只保留查询缓存、布局、偏好和未提交草稿。
4. `TradeProposal` 永远显示为“不可执行建议”；前端不得创建或修改 `RiskDecision`、拼装 `TradeCommand`、持有交易密钥或乐观展示订单成功。
5. 当前交付仅覆盖单主租户、单主工作区、单优先 venue、Research/Paper/Shadow。Assisted Live 只做 M5 testnet 评审准备，必须由服务端 flag/capability 放行；Guarded Live 不进入本计划。
6. 所有写操作必须幂等、可追踪、可审计；高风险动作必须执行“刷新对象版本与可操作性 → 必要的 MFA/审批 → 服务端最终校验 → 展示 correlation ID”。

### 1.2 交付范围

| 产品面 | 本计划交付 | 不交付 |
|---|---|---|
| 官网 | 首页、产品、架构与安全、使用场景、文档、访问申请、登录；后续补开发者与状态页 | 收益宣传、公众投资推荐、社区/跟单 |
| Terminal Web | P01–P15、P17–P23 全部页面与全局状态 | P16、原生平台能力、移动端高风险操作、浏览器内回测/任意脚本 |
| 模式 | Research、Paper、Shadow；M5 testnet 条件入口 | 默认生产实盘、Guarded Live |

### 1.3 工程基线与实施要求

`apps/website`、`apps/terminal`、`packages/ui`、`packages/domain-ui`、`packages/api-client` 承载第一期 Web 应用；QuantOS TypeScript Protobuf 类型和 U01/S04/X06/L03 场景测试继续作为契约与场景输入。目标运行时、设计系统、查询/表格/图表/表单、i18n、MSW、Storybook 与真实 BFF HTTP transport 按第 2 节实施。`InMemory*Backend` 只能作为场景 fixture，不能作为生产接口契约。

先冻结 OpenAPI/BFF 页面契约、建立真实应用运行时，并把已有 fixture 转成由同一 schema 驱动的 mock。FEP-1 的开发状态见第 4.2 节，不将初始工程骨架描述当作当前完成度结论。

### 1.4 设计稿与页面 API 覆盖要求

1. `design/` 中除 P16 外的 22 组高保真设计稿均须形成实际 React Web 页面；`UI-VIS-000`、`UI-P01`–`UI-P15`、`UI-P17`–`UI-P23` 是第 4.2 节可独立关闭的交付子任务。P16 迁入第二期计划。
2. F03、F06、F07、R01–R04、S01–S04、X01–X06、L01–L03 的服务能力与安全时序不能替代页面级 BFF HTTP 路径、method、响应 envelope、分页、异步任务与实时订阅 OpenAPI。
3. C01–C17 逻辑契约通过第 4.1 节 `BFF-FE-000`–`BFF-FE-011` 转为可生成客户端的版本化 OpenAPI，覆盖页面聚合、设置、报告、告警、运维治理与平台能力。
4. 同 schema MSW 仅支持 `UI Complete`；契约达到 `Implemented` 且 staging 真实权限、实时、错误、审计与 provider/consumer contract 通过后方可 `Integrated`。页面自定义 DTO、静态 JSON 或 `InMemory*Backend` 不得替代接口交付。本轮新增页面工作还须遵守第 4 节全量 API 前置门槛。

## 2. 技术栈与工程决策

以下选型继承两份设计文档，并在阶段 FEP-0 通过 ADR 锁定版本；没有 ADR 不得替换核心框架。

| 层 | 选型 | 执行约束 |
|---|---|---|
| 官网 | Next.js App Router + React + TypeScript | SSG/SSR、SEO、内容安全、访问申请；与 Terminal 分应用构建 |
| Terminal Web | Next.js App Router + React + TypeScript | 业务路由全部 `noindex, nofollow`；第一期不包含原生壳与本地平台能力 |
| 样式与无障碍 | Tailwind CSS + Radix UI + QuantOS Design System | token 集中管理；状态必须有文字、图标、语义色和读屏标签 |
| 服务端状态 | TanStack Query | 统一 query key、缓存、失效、重试和实时投影合并；领域真相不进 Zustand |
| 本地 UI 状态 | Zustand | 仅布局、抽屉、筛选偏好和未提交草稿；交易命令和权限禁止持久化 |
| 表格 | TanStack Table + TanStack Virtual | 服务端分页/筛选/排序；URL 同步；大列表虚拟化 |
| 图表 | ECharts + Lightweight Charts | 风险/P&L/归因使用 ECharts；OHLCV/K 线使用 Lightweight Charts |
| 表单 | React Hook Form + Zod | Zod schema 优先从 OpenAPI/领域 schema 生成或薄封装；服务端校验仍为准 |
| 国际化 | next-intl | 首发中英文；时间、币种、数字格式统一；安全文案不可随意改写 |
| 契约 | OpenAPI + 生成式 TypeScript client；Proto/JSON Schema 为领域事实来源 | 禁止页面手写重复 DTO；Buf breaking 与 client generation diff 进入 CI |
| 实时 | SSE 为任务/事件流默认方案，WebSocket 仅用于确需双向或聚合频道的场景 | 必须支持游标续传、乱序/重复去重、断线回补和权限变更断开 |
| 测试 | Vitest + React Testing Library + MSW + Playwright + axe + 视觉回归 | fixture 固定 clock/ID；覆盖目标 Web 浏览器 |
| 组件文档 | Storybook | 覆盖默认、加载、空、错误、无权、陈旧、离线、危险确认状态 |
| 观测 | Sentry/OTel Web SDK（按隐私策略启用） | 错误含 correlation ID；token、密钥、完整敏感载荷不得上报 |
| 包管理/构建 | 现有 pnpm workspace；Next.js 构建 | 锁文件、Node/pnpm 版本固定；Web 制品生成 manifest 与 SBOM |

## 3. 前期准备阶段（FEP-0，建议 2 周）

<a id="task-fep-0"></a>
### FEP-0：准备与契约

- task_id: `FEP-0`
- task_type: `MILESTONE`
- iteration: `P0`
- depends_on: ["CORE:F01", "CORE:F02", "CORE:F03", "CORE:F04", "CORE:F05", "CORE:F06"]
- development_status: `COMPLETED`
- review_entry: [GPT-6 Astra 复审入口](#review-fep-0)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：工程运行时、设计系统、接口台账、环境、测试底座
- 主要后端依赖：F01–F06，尤其 F03/F06
- 交付节点与放行条件：G0：Web 栈、OpenAPI、会话、错误、mock 与浏览器 PoC 冻结
- 范围说明：PRE-01–PRE-06 的准备里程碑；契约冻结与 PoC 不替代 A1–A6 的全量 API 开发及 provider Gate。

<a id="review-fep-0"></a>
#### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

### 3.1 工作包与产出

迭代 `P0`（W1–W2）只安排需求、设计、工程、接口盘点、环境和测试底座；PoC/fixture 不属于业务页面交付，PRE-04 只盘点接口，不承担页面 API 实现。按下列依赖顺序执行。

<a id="task-pre-01"></a>
#### PRE-01：需求拆解

- task_id: `PRE-01`
- task_type: `PREPARATION`
- iteration: `P0`
- depends_on: []
- development_status: `COMPLETED`
- review_entry: [GPT-6 Astra 复审入口](#review-pre-01)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：需求拆解
- 主要动作：将官网页面、P01–P15/P17–P23、全局壳、角色、状态和关键流程拆为 Web story；每项标注 P0/P1、角色、路由和风险级别
- 产出：页面台账、路由/权限矩阵、验收场景表
- 完成标准：页面覆盖率 100%；每页至少有默认/加载/空/错误/无权/陈旧/离线状态

<a id="review-pre-01"></a>
##### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-pre-02"></a>
#### PRE-02：设计系统预研

- task_id: `PRE-02`
- task_type: `PREPARATION`
- iteration: `P0`
- depends_on: ["PRE-01"]
- development_status: `COMPLETED`
- review_entry: [GPT-6 Astra 复审入口](#review-pre-02)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：设计系统预研
- 主要动作：固化 token、密度、断点、主题、状态枚举、金融数值、图表、表格、危险动作模式
- 产出：Design token ADR、组件清单、Storybook 骨架
- 完成标准：WCAG 2.2 AA 基础检查通过；通用安全文案全部入 i18n

<a id="review-pre-02"></a>
##### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-pre-03"></a>
#### PRE-03：技术栈落地

- task_id: `PRE-03`
- task_type: `PREPARATION`
- iteration: `P0`
- depends_on: ["PRE-02", "CORE:F01"]
- development_status: `COMPLETED`
- review_entry: [GPT-6 Astra 复审入口](#review-pre-03)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：技术栈落地
- 主要动作：在现有 workspace 引入并验证目标依赖；建立 Next.js 官网与 Web Terminal PoC
- 产出：运行时 ADR、依赖锁、最小 Web 构建与路由 smoke
- 完成标准：新环境 ≤30 分钟完成 bootstrap/build/test；官网与 Web Terminal 目标路由可打开

<a id="review-pre-03"></a>
##### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-pre-04"></a>
#### PRE-04：接口盘点

- task_id: `PRE-04`
- task_type: `PREPARATION`
- iteration: `P0`
- depends_on: ["PRE-01", "CORE:F03", "CORE:F06"]
- development_status: `COMPLETED`
- review_entry: [GPT-6 Astra 复审入口](#review-pre-04)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：接口盘点
- 主要动作：对照 F03、F05–F09、R02–R04、S01–S04、X01–X06、L01–L03 与现有 Proto/API client，建立本计划第 5 节契约台账
- 产出：OpenAPI gap list、字段字典、接口责任人、mock 状态
- 完成标准：每个 P0 页面有 Query/Command/Realtime 依赖；无“待开发时再定”字段

<a id="review-pre-04"></a>
##### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-pre-05"></a>
#### PRE-05：环境方案

- task_id: `PRE-05`
- task_type: `PREPARATION`
- iteration: `P0`
- depends_on: ["PRE-03", "PRE-04"]
- development_status: `COMPLETED`
- review_entry: [GPT-6 Astra 复审入口](#review-pre-05)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：环境方案
- 主要动作：建立 local/mock、local-integrated、staging 三套 Web 配置，定义 BFF origin、OIDC callback、feature flags、观测和测试账号
- 产出：`.env.example`、配置校验、开发说明
- 完成标准：缺必需变量 fail-fast；客户端 bundle 不含 server secret；环境/mode 明确分离

<a id="review-pre-05"></a>
##### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-pre-06"></a>
#### PRE-06：测试基线

- task_id: `PRE-06`
- task_type: `PREPARATION`
- iteration: `P0`
- depends_on: ["PRE-04", "PRE-05"]
- development_status: `COMPLETED`
- review_entry: [GPT-6 Astra 复审入口](#review-pre-06)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：测试基线
- 主要动作：建立 MSW contract fixtures、Playwright project、axe、视觉基线、性能预算
- 产出：测试目录与 CI job
- 完成标准：故意破坏 schema、权限、敏感字段或视觉基线能使 CI 失败

<a id="review-pre-06"></a>
##### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

### 3.2 前期 Gate G0

以下条件全部满足后才能进入页面功能开发：

- BFF 发布版本化 OpenAPI，至少冻结会话/上下文、Research、DataSnapshot、Strategy、Portfolio/Risk、Proposal/Approval/Order 与统一错误模型；未实现接口允许 mock，但 schema 不允许另起一套。
- 生成 client 与 Proto/JSON Schema 一致性检查进入 CI；现有手写 `InMemory*Backend` 已迁移为实现生成接口的测试 adapter，或明确标记为待删除。
- 页面台账能追踪到 `页面 → 前端任务 → BFF 契约 → 后端计划任务 → 测试用例 → Gate`。
- Web 页面 PoC、OIDC callback PoC、SSE 断线续传 PoC 均通过。
- 产品、前端、BFF、QA、安全与风控签署 G0 记录；未冻结项有责任人、截止日和兼容策略。

## 4. 页面 API 前置与前端迭代计划

排期基准为 3–4 名前端、1 名 BFF 联调接口人、1 名 QA，2 周一个 Sprint。以下为依赖满足后的相对建议窗口，不是已完成记录或固定交付承诺；外部核心服务未就绪时顺延所有依赖窗口。新增全量 API 前置阶段后不再沿用原 18 周总周期。官网可与同一前端迭代的 Terminal 工作并行。

- 执行顺序：`P0 → A1 → A2 → A3 → A4 → A5 → A6 → I1 → I2 → I3 → I4 → I5 → I6 → I7 → I8 → I9 → I10`。
- P0 完成准备工作后进入 A1；G0 中的正式 OpenAPI 冻结项由 A1 交付后关闭。G0 的最小冻结面与 A6 的全量 provider Gate 分别验证，二者都必须在新页面开发前满足。
- `A1–A6` 独立完成全部页面 API 的 OpenAPI、生成 client、实现、授权、安全/错误/幂等/实时恢复及 staging provider 验证；全部 API `review_status=ACCEPTED` 后才启动新的前端页面实现与既有页面真实联调。consumer/UI E2E 和 G1–G8 仍在前端迭代验证，不以前端尚未交付阻塞 provider Gate。
- `Reviewed + Mocked` 至少领先页面一个 Sprint 的要求保留；本轮排期进一步要求全量 API 已实现且 provider 验证通过。mock 可用于契约/组件 fixture 与复审，不能绕过全量 API 前置门槛。
- `CORE:<ID>` 是核心计划中服务部分的准入依赖。U01/S04/X06 等包含页面的总任务保留在契约追溯中，API 阶段只依赖其领域服务/审计/运维能力，页面验收回到对应 FEP，避免 API 等待其消费页面形成循环。L01–L03 仅为原有 testnet/平台安全范围。
- 同一迭代内按条目顺序与 `depends_on` 拓扑执行；不同任务类型分别排期。FEP 是稳定的业务范围/Gate 编号，不表示数字大小即执行先后。FEP-5 的审计基础先于 Research/Release 证据跳转交付；FEP-4 的市场先行，订单标记及收益报表放在订单/对账之后。跨页面导航引用保留在契约/路由验收中，不把双向跳转误作循环开发依赖。
- FEP-1 已完成开发的事实保留；本轮 I1 安排重新复审、集成与其逐页验收，不要求重复开发。未明确完成的任务使用 `UNSPECIFIED`，执行前盘点。

| 迭代 | 建议窗口 | 任务类型 | 范围 |
|---|---|---|---|
| P0 | W1–W2 | PREPARATION | PRE-01–PRE-06，工程与契约盘点 |
| A1 | W3–W4 | PAGE_API | BFF-FE-000 |
| A2 | W5–W6 | PAGE_API | BFF-FE-001、007 |
| A3 | W7–W8 | PAGE_API | BFF-FE-003、005 |
| A4 | W9–W10 | PAGE_API | BFF-FE-006、004 |
| A5 | W11–W12 | PAGE_API | BFF-FE-009、008、010 |
| A6 | W13–W14 | PAGE_API | BFF-FE-002、011；全量 provider Gate |
| I1 | W15–W16 | FRONTEND / WEBSITE | FEP-1：共享壳、认证、设置、官网及重新复审 |
| I2 | W17–W18 | FRONTEND | FEP-5 审计基础；FEP-2：Snapshot → Research → Artifact |
| I3 | W19–W20 | FRONTEND | FEP-3：草稿 → 回测 → Release |
| I4 | W21–W22 | FRONTEND | FEP-4 市场部分；FEP-5 组合与建议 |
| I5 | W23–W24 | FRONTEND | FEP-5：preflight → 审批 → Command/Order |
| I6 | W25–W26 | FRONTEND | FEP-5：对账；完成 G5 |
| I7 | W27–W28 | FRONTEND | FEP-4：订单标记、Performance/报表；完成 G4 |
| I8 | W29–W30 | FRONTEND | FEP-6：Alerts → Operations/Admin |
| I9 | W31–W32 | MILESTONE | FEP-7：全量硬化与 Beta |
| I10 | W33–W34 | MILESTONE | FEP-8：M5 testnet 评审准备 |

### 4.1 页面 API 开发任务（先行）

F03 的领域协议和 R/S/X 服务能力不能替代页面 BFF 契约。以下 operation 名称表达能力，不预设 URL；最终 path、method、request/response schema、分页和 envelope 必须由 BFF 在版本化 OpenAPI 中发布，前端只使用生成 client。每项“目标阶段与验收”保持原业务 Gate 绑定，实际 API 开发窗口以前置 A 迭代为准。

#### 迭代 A1：页面契约基线

<a id="task-bff-fe-000"></a>
##### BFF-FE-000：页面 BFF OpenAPI 基线

- task_id: `BFF-FE-000`
- task_type: `PAGE_API`
- iteration: `A1`
- depends_on: ["PRE-04", "PRE-06", "CORE:F03", "CORE:F05", "CORE:F06"]
- development_status: `COMPLETED`
- review_entry: [GPT-6 Astra 复审入口](#review-bff-fe-000)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：建立页面 BFF OpenAPI 基线；统一 session 注入、错误 envelope、cursor 分页、sort/filter、202 job、Idempotency-Key、ETag/objectVersion、correlation ID、SSE event envelope；生成 TS client/Zod/MSW
- 领域接口背景：F03 有领域 Proto/OpenAPI 生成，但无第一期 22 个 Web Terminal 页面完整 API 清单
- 覆盖契约/页面：C01–C17；P01–P15/P17–P23
- 目标阶段与验收：FEP-0/G0：每个 `UI-Pxx` 可追踪到 operationId；生成漂移、provider/consumer contract 与敏感字段扫描进入 CI

<a id="review-bff-fe-000"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

#### 迭代 A2：身份与审计

<a id="task-bff-fe-001"></a>
##### BFF-FE-001：身份、会话与设置 API

- task_id: `BFF-FE-001`
- task_type: `PAGE_API`
- iteration: `A2`
- depends_on: ["BFF-FE-000", "CORE:F06"]
- development_status: `COMPLETED`
- review_entry: [GPT-6 Astra 复审入口](#review-bff-fe-001)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：session/context/reauth/MFA/logout/access request；profile/locale/theme；active sessions revoke；trusted devices revoke；notification preferences/subscriptions；安全操作与审计引用
- 领域接口背景：F06 定义 Auth/RBAC/主上下文；未定义完整登录恢复、个人资料、会话、可信设备、通知偏好页面 API
- 覆盖契约/页面：C01、C17；P01/P15
- 目标阶段与验收：FEP-1/G1：401/403/404、CSRF、recent-auth、最后有效因素保护与撤销后实时失效测试通过

<a id="review-bff-fe-001"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-bff-fe-007"></a>
##### BFF-FE-007：Audit 与导出 API

- task_id: `BFF-FE-007`
- task_type: `PAGE_API`
- iteration: `A2`
- depends_on: ["BFF-FE-001", "CORE:F05"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-bff-fe-007)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：audit search/get chain；correlation/causation pagination；redacted payload；export create/status/cancel/download metadata；短时 URL、水印、retention
- 领域接口背景：F05/X06 有审计账本目标，未定义 Explorer 搜索、证据链和安全导出页面 API
- 覆盖契约/页面：C10；P04/P07/P09–P14/P22/P23
- 目标阶段与验收：FEP-5/G5：按 correlation ID ≤5 分钟还原；越权/过期下载拒绝；导出全过程有审计事件

<a id="review-bff-fe-007"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

#### 迭代 A3：研究与市场数据

<a id="task-bff-fe-003"></a>
##### BFF-FE-003：Research、Snapshot 与 Artifact API

- task_id: `BFF-FE-003`
- task_type: `PAGE_API`
- iteration: `A3`
- depends_on: ["BFF-FE-001", "BFF-FE-007", "CORE:F07", "CORE:F08", "CORE:R02", "CORE:R03", "CORE:R04"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-bff-fe-003)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：Research list/create/get/cancel；stream subscribe/replay；Artifact/Evidence get；Snapshot list/get；统一 cursor/filter、sequence/afterSequence 和 202 状态引用
- 领域接口背景：R02–R04/F07 已定义 Snapshot/Research/Artifact 服务能力，缺页面级列表/筛选/详情/流式封装
- 覆盖契约/页面：C03/C04；P03–P05
- 目标阶段与验收：FEP-2/G2：创建、取消、断线续传、重复/乱序、质量/许可阻断与 Audit 关联 contract 全绿

<a id="review-bff-fe-003"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-bff-fe-005"></a>
##### BFF-FE-005：市场目录、报价与 K 线 API

- task_id: `BFF-FE-005`
- task_type: `PAGE_API`
- iteration: `A3`
- depends_on: ["BFF-FE-001", "CORE:R01", "CORE:R02"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-bff-fe-005)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：instrument catalog/watchlist；authorized VenueQuote；candle series/history/realtime；series metadata、quality/gaps/event markers；symbol/venue/product/timezone/interval capability
- 领域接口背景：R01/R02 定义行情与快照，未定义市场目录、跨 venue 报价、K 线与图表元数据页面 API
- 覆盖契约/页面：C12/C16；P18/P19/P20
- 目标阶段与验收：FEP-4/G4：报价和 candle 均含 source/venue/asOf/quality/license；切换维度不混用缓存，断流可回补且不拼接

<a id="review-bff-fe-005"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

#### 迭代 A4：风险执行与策略

<a id="task-bff-fe-006"></a>
##### BFF-FE-006：Portfolio、Risk、Proposal、Approval 与 Order API

- task_id: `BFF-FE-006`
- task_type: `PAGE_API`
- iteration: `A4`
- depends_on: ["BFF-FE-003", "BFF-FE-005", "BFF-FE-007", "CORE:X01", "CORE:X02", "CORE:X03", "CORE:X04", "CORE:TP07"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-bff-fe-006)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：portfolio/risk projection；proposal list/get/evaluate；preflight/order capabilities；approval list/get/decide/MFA；command-ref submit；order list/get/cancel request/stream
- 领域接口背景：X01–X04 定义风险和执行服务，缺 Portfolio/Proposal/Approval/Trade Ticket/Order 页面组合契约
- 覆盖契约/页面：C06–C09/C13；P08–P11/P20
- 目标阶段与验收：FEP-5/G5：七类拒绝、职责分离、重复 1,000 次幂等、202 受理和订单事实流全部通过

<a id="review-bff-fe-006"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-bff-fe-004"></a>
##### BFF-FE-004：Strategy、Backtest 与 Release API

- task_id: `BFF-FE-004`
- task_type: `PAGE_API`
- iteration: `A4`
- depends_on: ["BFF-FE-003", "BFF-FE-006", "BFF-FE-007", "CORE:S01", "CORE:S02", "CORE:S03"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-bff-fe-004)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：strategy list/draft get/save；static check；backtest create/get/stream；release create/list/get；allowedTargets；approval timeline；expectedVersion/409 diff
- 领域接口背景：S01–S04 有 Strategy/Backtest/Release 能力，缺完整页面 API 与编辑冲突模型
- 覆盖契约/页面：C05/C08；P06/P07
- 目标阶段与验收：FEP-3/G3：并发编辑无静默覆盖；校验失败、未审批及非法 target 均由服务端拒绝

<a id="review-bff-fe-004"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

#### 迭代 A5：对账、分析与治理

<a id="task-bff-fe-009"></a>
##### BFF-FE-009：Reconciliation 与账本 API

- task_id: `BFF-FE-009`
- task_type: `PAGE_API`
- iteration: `A5`
- depends_on: ["BFF-FE-006", "BFF-FE-007", "CORE:X05"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-bff-fe-009)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：reconciliation list/get；break list/get；ledger entries；request rerun/re-evaluation；status stream；Order/Fill/Audit/Alert evidence refs；禁止任何 edit-ledger operation
- 领域接口背景：X05 定义 reconciliation worker/ledger，但未定义完整页面读写契约
- 覆盖契约/页面：C15/C09/C10/C16；P22/P11/P21
- 目标阶段与验收：FEP-5/G5：差异状态跨页面一致；重跑幂等；schema 和权限负向测试证明前端无法改账

<a id="review-bff-fe-009"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-bff-fe-008"></a>
##### BFF-FE-008：Performance 与报表 API

- task_id: `BFF-FE-008`
- task_type: `PAGE_API`
- iteration: `A5`
- depends_on: ["BFF-FE-009", "CORE:X01", "CORE:X05"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-bff-fe-008)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：performance summary/time series/attribution/drawdown/fees；valuation and ledger versions；report create/status/get/download；period/method/currency/coverage/provisional
- 领域接口背景：X01/X05 提供 Portfolio/对账基础；总计划未定义 Performance/Report API，原 C14 已标记“需 BFF 新增页面模型”
- 覆盖契约/页面：C14/C15；P21
- 目标阶段与验收：FEP-4/G4：所有结果含 account/currency/method/asOf/ledgerVersion/valuationSnapshotId；未对账数据强制 provisional

<a id="review-bff-fe-008"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-bff-fe-010"></a>
##### BFF-FE-010：Operations、Admin 与 Alert API

- task_id: `BFF-FE-010`
- task_type: `PAGE_API`
- iteration: `A5`
- depends_on: ["BFF-FE-001", "BFF-FE-007", "BFF-FE-009", "CORE:F09"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-bff-fe-010)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：service health/metrics projection；incident list/get/timeline；approved Runbook actions/prechecks；member/role/policy/capability/flag CRUD with versioning；alert list/get/ack/unack/subscriptions/stream
- 领域接口背景：F09/X06 有观测、运维目标；F06 有策略能力，未定义 Incident/Admin/Alert 页面 API
- 覆盖契约/页面：C11/C16；P13/P14/P23/P02
- 目标阶段与验收：FEP-6/G6：无任意命令参数；最后管理员和职责分离保护；ack 不改变 resolved；所有治理变更可审计

<a id="review-bff-fe-010"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

#### 迭代 A6：汇总与平台能力

<a id="task-bff-fe-002"></a>
##### BFF-FE-002：Command Center 聚合 API

- task_id: `BFF-FE-002`
- task_type: `PAGE_API`
- iteration: `A6`
- depends_on: ["BFF-FE-003", "BFF-FE-006", "BFF-FE-010", "CORE:F09"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-bff-fe-002)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：authorized command summary、priority queue、system health、risk/data/order/run counters、recent activity；返回 sampledAt/asOf、source 和资源级跳转引用
- 领域接口背景：F09、R/X 有指标和事件，未定义 Command Center 聚合页面模型
- 覆盖契约/页面：C02；P02
- 目标阶段与验收：FEP-1/G1：单次聚合或受控并发预算达标；不同角色字段裁剪和无权对象负向测试通过

<a id="review-bff-fe-002"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-bff-fe-011"></a>
##### BFF-FE-011：Web 浏览器平台能力 API

- task_id: `BFF-FE-011`
- task_type: `PAGE_API`
- iteration: `A6`
- depends_on: ["BFF-FE-001", "BFF-FE-010"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-bff-fe-011)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：server-visible BrowserCapabilities、浏览器权限策略/permission state、下载记录与平台降级说明；不得返回 token、secret 或本地敏感内容
- 领域接口背景：浏览器权限和下载策略需要页面级 BFF 模型，不能直接暴露内部会话或存储实现
- 覆盖契约/页面：C17；P17
- 目标阶段与验收：FEP-1/G1：浏览器 capability、permission state、短时下载与敏感字段负向测试通过

<a id="review-bff-fe-011"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

### 4.2 前端功能与逐页设计稿交付（后行）

以下 `UI-Pxx` 是各阶段 UI 任务的交付子任务。`design/` 中列出的有效稿是页面默认态的内容结构与视觉基准；若同一页面存在多个版本，以本节指定版本为准，旧版本仅保留追溯。开发必须将设计稿制作成可运行、可路由、可鉴权、可访问且接入生成式 BFF client 的 React 页面，同时按设计规范补齐加载、空、错误、无权、陈旧、离线/断线和危险确认状态。设计稿中的示例数据只能进入 Storybook/MSW fixture，不能硬编码进生产页面。

每个 `UI-Pxx` 任务关闭时必须附：设计稿对照截图、路由与权限测试、七态 Storybook、MSW 契约用例、staging 接口证据、键盘/axe 结果、1440 视觉回归、至少一个目标浏览器 E2E。仅提交静态 HTML、截图复刻或无接口组件不视为完成。

开发-复审流转：开发产物与测试齐备后 `REVIEW_READY → IN_REVIEW`；有问题进入 `CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW`，验证失败返回修复节点；无问题或问题全部验证关闭后 `ACCEPTED`，缺环境/依赖为 `BLOCKED`。`UI Complete → Integrated → Done` 保留原第 7.5 节定义，`ACCEPTED` 不能越过 staging 与所属 Gate；原接口状态链保持独立。

#### 迭代 I1：W15–W16

<a id="task-fep-1"></a>
##### FEP-1：壳与官网

- task_id: `FEP-1`
- task_type: `MILESTONE`
- iteration: `I1`
- depends_on: ["BFF-FE-000", "BFF-FE-001", "BFF-FE-002", "BFF-FE-003", "BFF-FE-004", "BFF-FE-005", "BFF-FE-006", "BFF-FE-007", "BFF-FE-008", "BFF-FE-009", "BFF-FE-010", "BFF-FE-011", "PRE-06"]
- development_status: `COMPLETED`
- 状态范围：已开发完成范围为 UI-101–UI-104、WEB-101；逐页 UI-Pxx 与 G1 的集成验收仍按独立条目判定。
- review_entry: [GPT-6 Astra 复审入口](#review-fep-1)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：官网首期；P01、P02、P15、P17；App Shell、路由、主题、i18n、全局状态
- 主要后端依赖：F06、F09
- 交付节点与放行条件：G1：认证/RBAC/模式/陈旧/离线/响应式可用，官网内容合规
- 范围说明：业务里程碑仅归组与约束下属任务；全部子任务和 Gate 通过后才能关闭。

<a id="review-fep-1"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-ui-103"></a>
##### UI-103：QuantOS UI/domain-ui、主题、i18n、表格/时间线/确认框

- task_id: `UI-103`
- task_type: `FRONTEND`
- iteration: `I1`
- depends_on: ["PRE-02", "PRE-03", "PRE-06", "BFF-FE-000", "BFF-FE-001", "BFF-FE-002", "BFF-FE-003", "BFF-FE-004", "BFF-FE-005", "BFF-FE-006", "BFF-FE-007", "BFF-FE-008", "BFF-FE-009", "BFF-FE-010", "BFF-FE-011"]
- development_status: `COMPLETED`
- 状态范围：已开发完成；UI Complete。组件及 Storybook 属于交付范围，本轮复审从空白开始。
- review_entry: [GPT-6 Astra 复审入口](#review-ui-103)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：QuantOS UI/domain-ui、主题、i18n、表格/时间线/确认框
- 接口绑定：无业务接口
- 验收重点：所有组件状态进 Storybook；键盘、焦点、200% 缩放和读屏通过

<a id="review-ui-103"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-ui-vis-000"></a>
##### UI-VIS-000：第一期 Web Terminal 共用视觉体系；以 P02 与 P20 v3 为全局基准

- task_id: `UI-VIS-000`
- task_type: `FRONTEND`
- iteration: `I1`
- depends_on: ["UI-103", "BFF-FE-001", "BFF-FE-010", "BFF-FE-011", "BFF-FE-000", "BFF-FE-002", "BFF-FE-003", "BFF-FE-004", "BFF-FE-005", "BFF-FE-006", "BFF-FE-007", "BFF-FE-008", "BFF-FE-009"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-ui-vis-000)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：P01–P15/P17–P23 共用视觉体系；以 P02 与 P20 v3 为全局基准
- 实际页面/路由交付：App Shell、导航、顶栏、状态条、栅格、token、边框、表格、表单、图表、Badge、危险确认与状态语义
- 契约绑定：C01、C16、C17
- 所属阶段：FEP-0/1
- 页面级完成标准：抽取为 `packages/ui`/`domain-ui`，禁止逐页复制样式；1440 基准视觉回归由设计签署；语义色不得挪作装饰色

<a id="review-ui-vis-000"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-ui-102"></a>
##### UI-102：OIDC、callback、MFA、401/403/404/maintenance/offline

- task_id: `UI-102`
- task_type: `FRONTEND`
- iteration: `I1`
- depends_on: ["UI-VIS-000", "BFF-FE-001", "BFF-FE-006", "BFF-FE-000", "BFF-FE-002", "BFF-FE-003", "BFF-FE-004", "BFF-FE-005", "BFF-FE-007", "BFF-FE-008", "BFF-FE-009", "BFF-FE-010", "BFF-FE-011"]
- development_status: `COMPLETED`
- 状态范围：已开发完成；UI Complete / Contract Integrated。staging IdP/MFA 联调签署是晋级 G1 Done 的前置条件。
- review_entry: [GPT-6 Astra 复审入口](#review-ui-102)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：OIDC、callback、MFA、401/403/404/maintenance/offline
- 接口绑定：C01、C08
- 验收重点：401 清内存态；403/404 不泄露对象存在性；return path 不含敏感参数

<a id="review-ui-102"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-ui-101"></a>
##### UI-101：App Shell、路由守卫、主工作区/账户/mode/数据新鲜度/风险/连接状态

- task_id: `UI-101`
- task_type: `FRONTEND`
- iteration: `I1`
- depends_on: ["UI-102", "BFF-FE-001", "BFF-FE-002", "BFF-FE-010", "BFF-FE-000", "BFF-FE-003", "BFF-FE-004", "BFF-FE-005", "BFF-FE-006", "BFF-FE-007", "BFF-FE-008", "BFF-FE-009", "BFF-FE-011"]
- development_status: `COMPLETED`
- 状态范围：已开发完成；UI Complete / Mocked。BFF-FE-002 发布后使用生成 client + 同 schema MSW，staging 签署前不得升级 Integrated。
- review_entry: [GPT-6 Astra 复审入口](#review-ui-101)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：App Shell、路由守卫、主工作区/账户/mode/数据新鲜度/风险/连接状态
- 接口绑定：C01、C02、C16
- 验收重点：守卫严格按 session → tenant/workspace → RBAC/capability → resource → mode → data 顺序；任一步失败停止后续请求

<a id="review-ui-101"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-ui-104"></a>
##### UI-104：Profile/安全/通知/浏览器能力

- task_id: `UI-104`
- task_type: `FRONTEND`
- iteration: `I1`
- depends_on: ["UI-101", "BFF-FE-001", "BFF-FE-011", "BFF-FE-000", "BFF-FE-002", "BFF-FE-003", "BFF-FE-004", "BFF-FE-005", "BFF-FE-006", "BFF-FE-007", "BFF-FE-008", "BFF-FE-009", "BFF-FE-010"]
- development_status: `COMPLETED`
- 状态范围：已开发完成；UI Complete / Local Provider Implemented。BFF-FE-001/011 Web 契约完成 staging 签署后才可 Integrated。
- review_entry: [GPT-6 Astra 复审入口](#review-ui-104)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：Profile/安全/通知/浏览器能力
- 接口绑定：C17
- 验收重点：会话撤销、通知降级、下载说明可用；小屏无高风险按钮

<a id="review-ui-104"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-web-101"></a>
##### WEB-101：官网首页、产品、架构安全、场景、访问申请、登录

- task_id: `WEB-101`
- task_type: `WEBSITE`
- iteration: `I1`
- depends_on: ["UI-103", "UI-102", "BFF-FE-001", "BFF-FE-000", "BFF-FE-002", "BFF-FE-003", "BFF-FE-004", "BFF-FE-005", "BFF-FE-006", "BFF-FE-007", "BFF-FE-008", "BFF-FE-009", "BFF-FE-010", "BFF-FE-011"]
- development_status: `COMPLETED`
- 状态范围：已开发完成；UI Complete / Local Provider Implemented。Terminal Auth/BFF staging 联调后配置真实 BFF origin 并晋级 G1；生产发布前在目标 CDN origin 验证 Lighthouse。
- review_entry: [GPT-6 Astra 复审入口](#review-web-101)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：官网首页、产品、架构安全、场景、访问申请、登录
- 接口绑定：Access Request/Auth
- 验收重点：Lighthouse、SEO、隐私、防滥用和禁用词检查通过
- 官网功能细则：首期七页为首页、产品、架构安全、使用场景、文档中心、访问申请、登录；使用场景 `/use-cases`、文档中心 `/docs`。复用冻结 design token（深色默认 + 浅色媒体查询）；文档中心支持搜索空态、首页文档入口及可展开的版本化正文。访问申请使用 C01 `submitAccessRequest` 生成类型，包含团队、用途、市场、预期模式（expectedMode）与隐私说明版本；支持 honeypot、客户端校验、pending 防重复、离线禁用/中止、429 文案及错误后输入保留，202 仅显示“已受理”。未配置 BFF origin 时使用同源 `/v1/access-requests`；登录页仅作 Terminal 受控入口，不内嵌认证。首页 title template 避免重复，官网 lint 覆盖 App Router TSX；SEO 包含 canonical/robots/sitemap。

<a id="review-web-101"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-ui-p01"></a>
##### UI-P01：P01-Identity-Access-Recovery-High-Fidelity-v1.png

- task_id: `UI-P01`
- task_type: `FRONTEND`
- iteration: `I1`
- depends_on: ["UI-102", "UI-VIS-000", "BFF-FE-001", "BFF-FE-000", "BFF-FE-002", "BFF-FE-003", "BFF-FE-004", "BFF-FE-005", "BFF-FE-006", "BFF-FE-007", "BFF-FE-008", "BFF-FE-009", "BFF-FE-010", "BFF-FE-011"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-ui-p01)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：`P01-Identity-Access-Recovery-High-Fidelity-v1.png`
- 实际页面/路由交付：`/login`、`/mfa`、`/access-request`、`/unauthorized`、`/offline`
- 契约绑定：C01
- 所属阶段：FEP-1
- 页面级完成标准：登录、MFA、访问申请、恢复与返回安全路由均可运行；错误不泄露账户存在性

<a id="review-ui-p01"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-ui-p02"></a>
##### UI-P02：P02-Command-Center-High-Fidelity-v1.png

- task_id: `UI-P02`
- task_type: `FRONTEND`
- iteration: `I1`
- depends_on: ["UI-101", "UI-VIS-000", "BFF-FE-002", "BFF-FE-006", "BFF-FE-010", "BFF-FE-000", "BFF-FE-001", "BFF-FE-003", "BFF-FE-004", "BFF-FE-005", "BFF-FE-007", "BFF-FE-008", "BFF-FE-009", "BFF-FE-011"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-ui-p02)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：`P02-Command-Center-High-Fidelity-v1.png`
- 实际页面/路由交付：`/command`
- 契约绑定：C02、C06、C16
- 所属阶段：FEP-1
- 页面级完成标准：卡片按 capability 裁剪；汇总状态、待办、健康与最近活动来自 BFF；无静态业务数据

<a id="review-ui-p02"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-ui-p15"></a>
##### UI-P15：P15-Profile-Security-and-Notification-Settings-High-Fidelity-v2.png

- task_id: `UI-P15`
- task_type: `FRONTEND`
- iteration: `I1`
- depends_on: ["UI-104", "UI-VIS-000", "BFF-FE-001", "BFF-FE-011", "BFF-FE-000", "BFF-FE-002", "BFF-FE-003", "BFF-FE-004", "BFF-FE-005", "BFF-FE-006", "BFF-FE-007", "BFF-FE-008", "BFF-FE-009", "BFF-FE-010"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-ui-p15)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：`P15-Profile-Security-and-Notification-Settings-High-Fidelity-v2.png`
- 实际页面/路由交付：`/settings/profile`、`/settings/notifications`、`/settings/security`
- 契约绑定：C01、C17
- 所属阶段：FEP-1
- 页面级完成标准：资料、区域、通知矩阵、MFA、会话、可信设备和安全操作全部接入接口

<a id="review-ui-p15"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-ui-p17"></a>
##### UI-P17：P17-Web-Browser-Capability-High-Fidelity-v2.png

- task_id: `UI-P17`
- task_type: `FRONTEND`
- iteration: `I1`
- depends_on: ["UI-104", "UI-VIS-000", "BFF-FE-001", "BFF-FE-011", "BFF-FE-000", "BFF-FE-002", "BFF-FE-003", "BFF-FE-004", "BFF-FE-005", "BFF-FE-006", "BFF-FE-007", "BFF-FE-008", "BFF-FE-009", "BFF-FE-010"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-ui-p17)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：`P17-Web-Browser-Capability-High-Fidelity-v2.png`
- 实际页面/路由交付：`/settings/browser`
- 契约绑定：C17、BrowserCapabilities
- 所属阶段：FEP-1
- 页面级完成标准：浏览器权限、下载、存储、兼容性与响应式能力检测落地；非浏览器能力不进入一期范围

<a id="review-ui-p17"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

#### 迭代 I2：W17–W18

<a id="task-fep-2"></a>
##### FEP-2：研究闭环

- task_id: `FEP-2`
- task_type: `MILESTONE`
- iteration: `I2`
- depends_on: ["BFF-FE-000", "BFF-FE-001", "BFF-FE-002", "BFF-FE-003", "BFF-FE-004", "BFF-FE-005", "BFF-FE-006", "BFF-FE-007", "BFF-FE-008", "BFF-FE-009", "BFF-FE-010", "BFF-FE-011", "UI-P17"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-fep-2)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：P03–P05；Research 创建、流式、取消、Artifact、DataSnapshot
- 主要后端依赖：R02–R04、F07/F08、TP01–TP05、U01
- 交付节点与放行条件：G2：固定输入可追溯与重放；取消 ≤2s；目标 Web 浏览器同用例全绿
- 范围说明：业务里程碑仅归组与约束下属任务；全部子任务和 Gate 通过后才能关闭。

<a id="review-fep-2"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-ui-507"></a>
##### UI-507：Audit Explorer 与受控导出

- task_id: `UI-507`
- task_type: `FRONTEND`
- iteration: `I2`
- depends_on: ["UI-101", "BFF-FE-007", "BFF-FE-000", "BFF-FE-001", "BFF-FE-002", "BFF-FE-003", "BFF-FE-004", "BFF-FE-005", "BFF-FE-006", "BFF-FE-008", "BFF-FE-009", "BFF-FE-010", "BFF-FE-011"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-ui-507)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：Audit Explorer 与受控导出
- 接口绑定：C10
- 验收重点：correlation/causation 链完整；导出异步、短时 URL、授权和审计

<a id="review-ui-507"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-ui-p12"></a>
##### UI-P12：P12-Audit-Explorer-and-Export-Jobs-High-Fidelity-v1.png

- task_id: `UI-P12`
- task_type: `FRONTEND`
- iteration: `I2`
- depends_on: ["UI-507", "UI-VIS-000", "BFF-FE-007", "BFF-FE-000", "BFF-FE-001", "BFF-FE-002", "BFF-FE-003", "BFF-FE-004", "BFF-FE-005", "BFF-FE-006", "BFF-FE-008", "BFF-FE-009", "BFF-FE-010", "BFF-FE-011"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-ui-p12)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：`P12-Audit-Explorer-and-Export-Jobs-High-Fidelity-v1.png`
- 实际页面/路由交付：`/audit`、`/audit/:correlationId`、`/exports/:exportId`
- 契约绑定：C10
- 所属阶段：FEP-5
- 页面级完成标准：服务端搜索/分页、因果链、脱敏载荷、异步导出和短时下载状态落地

<a id="review-ui-p12"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-ui-204"></a>
##### UI-204：DataSnapshot 目录/详情、质量/许可/时效

- task_id: `UI-204`
- task_type: `FRONTEND`
- iteration: `I2`
- depends_on: ["UI-101", "BFF-FE-003", "BFF-FE-000", "BFF-FE-001", "BFF-FE-002", "BFF-FE-004", "BFF-FE-005", "BFF-FE-006", "BFF-FE-007", "BFF-FE-008", "BFF-FE-009", "BFF-FE-010", "BFF-FE-011"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-ui-204)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：DataSnapshot 目录/详情、质量/许可/时效
- 接口绑定：C04
- 验收重点：`failed/degraded/expired/license missing` 明确阻断后续策略/交易用途

<a id="review-ui-204"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-ui-p05"></a>
##### UI-P05：P05-Data-Snapshot-Catalog-and-Detail-High-Fidelity-v1.png

- task_id: `UI-P05`
- task_type: `FRONTEND`
- iteration: `I2`
- depends_on: ["UI-204", "UI-VIS-000", "BFF-FE-003", "BFF-FE-000", "BFF-FE-001", "BFF-FE-002", "BFF-FE-004", "BFF-FE-005", "BFF-FE-006", "BFF-FE-007", "BFF-FE-008", "BFF-FE-009", "BFF-FE-010", "BFF-FE-011"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-ui-p05)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：`P05-Data-Snapshot-Catalog-and-Detail-High-Fidelity-v1.png`
- 实际页面/路由交付：`/data-snapshots`、`/data-snapshots/:snapshotId`
- 契约绑定：C04
- 所属阶段：FEP-2
- 页面级完成标准：目录、详情、血缘、质量、许可、时效与阻断状态均由接口驱动

<a id="review-ui-p05"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-ui-201"></a>
##### UI-201：Research 列表、新建与表单校验

- task_id: `UI-201`
- task_type: `FRONTEND`
- iteration: `I2`
- depends_on: ["UI-204", "BFF-FE-003", "BFF-FE-000", "BFF-FE-001", "BFF-FE-002", "BFF-FE-004", "BFF-FE-005", "BFF-FE-006", "BFF-FE-007", "BFF-FE-008", "BFF-FE-009", "BFF-FE-010", "BFF-FE-011"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-ui-201)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：Research 列表、新建与表单校验
- 接口绑定：C03、C04
- 验收重点：请求含 capability、snapshot、budget、deadline；后端拒绝字段原位显示

<a id="review-ui-201"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-ui-p03"></a>
##### UI-P03：P03-Research-List-and-New-Research-High-Fidelity-v1.png

- task_id: `UI-P03`
- task_type: `FRONTEND`
- iteration: `I2`
- depends_on: ["UI-201", "UI-VIS-000", "BFF-FE-003", "BFF-FE-000", "BFF-FE-001", "BFF-FE-002", "BFF-FE-004", "BFF-FE-005", "BFF-FE-006", "BFF-FE-007", "BFF-FE-008", "BFF-FE-009", "BFF-FE-010", "BFF-FE-011"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-ui-p03)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：`P03-Research-List-and-New-Research-High-Fidelity-v1.png`
- 实际页面/路由交付：`/research`、`/research/new`
- 契约绑定：C03、C04
- 所属阶段：FEP-2
- 页面级完成标准：列表分页/筛选与创建表单落地；预算、deadline、snapshot、capability 校验与 202 受理正确

<a id="review-ui-p03"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-ui-202"></a>
##### UI-202：Research 详情、SSE 流、取消与恢复

- task_id: `UI-202`
- task_type: `FRONTEND`
- iteration: `I2`
- depends_on: ["UI-201", "BFF-FE-003", "BFF-FE-000", "BFF-FE-001", "BFF-FE-002", "BFF-FE-004", "BFF-FE-005", "BFF-FE-006", "BFF-FE-007", "BFF-FE-008", "BFF-FE-009", "BFF-FE-010", "BFF-FE-011"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-ui-202)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：Research 详情、SSE 流、取消与恢复
- 接口绑定：C03
- 验收重点：以 sequence/cursor 去重；断线从最后确认游标回补；取消返回受理态而非伪造已取消

<a id="review-ui-202"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-ui-203"></a>
##### UI-203：Artifact/Evidence 详情与交叉跳转

- task_id: `UI-203`
- task_type: `FRONTEND`
- iteration: `I2`
- depends_on: ["UI-202", "UI-507", "BFF-FE-003", "BFF-FE-007", "BFF-FE-000", "BFF-FE-001", "BFF-FE-002", "BFF-FE-004", "BFF-FE-005", "BFF-FE-006", "BFF-FE-008", "BFF-FE-009", "BFF-FE-010", "BFF-FE-011"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-ui-203)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：Artifact/Evidence 详情与交叉跳转
- 接口绑定：C04、C10
- 验收重点：显示 input/content/environment hash、Engine/prompt/code 版本、证据与 correlation ID

<a id="review-ui-203"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-ui-p04"></a>
##### UI-P04：P04-Research-and-Artifact-Detail-High-Fidelity-v1.png

- task_id: `UI-P04`
- task_type: `FRONTEND`
- iteration: `I2`
- depends_on: ["UI-202", "UI-203", "UI-VIS-000", "BFF-FE-003", "BFF-FE-007", "BFF-FE-000", "BFF-FE-001", "BFF-FE-002", "BFF-FE-004", "BFF-FE-005", "BFF-FE-006", "BFF-FE-008", "BFF-FE-009", "BFF-FE-010", "BFF-FE-011"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-ui-p04)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：`P04-Research-and-Artifact-Detail-High-Fidelity-v1.png`
- 实际页面/路由交付：`/research/:runId`、`/artifacts/:artifactId`
- 契约绑定：C03、C04、C10
- 所属阶段：FEP-2
- 页面级完成标准：SSE 续传/去重、取消受理、Artifact/Evidence/Audit 跳转及全部终态落地

<a id="review-ui-p04"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

#### 迭代 I3：W19–W20

<a id="task-fep-3"></a>
##### FEP-3：策略治理

- task_id: `FEP-3`
- task_type: `MILESTONE`
- iteration: `I3`
- depends_on: ["BFF-FE-000", "BFF-FE-001", "BFF-FE-002", "BFF-FE-003", "BFF-FE-004", "BFF-FE-005", "BFF-FE-006", "BFF-FE-007", "BFF-FE-008", "BFF-FE-009", "BFF-FE-010", "BFF-FE-011", "UI-P04"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-fep-3)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：P06–P07；草稿、静态检查、回测、Release、审批时间线
- 主要后端依赖：S01–S04、R02、F06
- 交付节点与放行条件：G3：未验证/未审批不可部署；M3/M4 仅 Paper/Shadow
- 范围说明：业务里程碑仅归组与约束下属任务；全部子任务和 Gate 通过后才能关闭。

<a id="review-fep-3"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-ui-301"></a>
##### UI-301：Strategy 目录与 Lab 草稿

- task_id: `UI-301`
- task_type: `FRONTEND`
- iteration: `I3`
- depends_on: ["UI-203", "UI-204", "BFF-FE-004", "BFF-FE-000", "BFF-FE-001", "BFF-FE-002", "BFF-FE-003", "BFF-FE-005", "BFF-FE-006", "BFF-FE-007", "BFF-FE-008", "BFF-FE-009", "BFF-FE-010", "BFF-FE-011"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-ui-301)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：Strategy 目录与 Lab 草稿
- 接口绑定：C05
- 验收重点：自动保存带版本；409 保留草稿并提供 diff，不覆盖服务端

<a id="review-ui-301"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-ui-p06"></a>
##### UI-P06：P06-Strategy-Catalog-and-Strategy-Lab-High-Fidelity-v1.png

- task_id: `UI-P06`
- task_type: `FRONTEND`
- iteration: `I3`
- depends_on: ["UI-301", "UI-VIS-000", "BFF-FE-004", "BFF-FE-000", "BFF-FE-001", "BFF-FE-002", "BFF-FE-003", "BFF-FE-005", "BFF-FE-006", "BFF-FE-007", "BFF-FE-008", "BFF-FE-009", "BFF-FE-010", "BFF-FE-011"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-ui-p06)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：`P06-Strategy-Catalog-and-Strategy-Lab-High-Fidelity-v1.png`
- 实际页面/路由交付：`/strategies`、`/strategies/new`、`/strategies/:strategyId/lab`
- 契约绑定：C05
- 所属阶段：FEP-3
- 页面级完成标准：目录、Lab、版本化草稿、自动保存、校验与 409 diff 可用

<a id="review-ui-p06"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-ui-302"></a>
##### UI-302：静态检查、回测队列与报告

- task_id: `UI-302`
- task_type: `FRONTEND`
- iteration: `I3`
- depends_on: ["UI-301", "BFF-FE-004", "BFF-FE-000", "BFF-FE-001", "BFF-FE-002", "BFF-FE-003", "BFF-FE-005", "BFF-FE-006", "BFF-FE-007", "BFF-FE-008", "BFF-FE-009", "BFF-FE-010", "BFF-FE-011"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-ui-302)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：静态检查、回测队列与报告
- 接口绑定：C05
- 验收重点：固定 snapshot/clock/cost/slippage/environment hash；泄漏检查失败阻断 Release

<a id="review-ui-302"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-ui-303"></a>
##### UI-303：不可变 Release、审批申请与目标选择

- task_id: `UI-303`
- task_type: `FRONTEND`
- iteration: `I3`
- depends_on: ["UI-302", "UI-507", "BFF-FE-004", "BFF-FE-006", "BFF-FE-000", "BFF-FE-001", "BFF-FE-002", "BFF-FE-003", "BFF-FE-005", "BFF-FE-007", "BFF-FE-008", "BFF-FE-009", "BFF-FE-010", "BFF-FE-011"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-ui-303)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：不可变 Release、审批申请与目标选择
- 接口绑定：C05、C08
- 验收重点：hash/参数/回测/数据/证据齐全；目标完全取自后端 `allowedTargets`

<a id="review-ui-303"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-ui-p07"></a>
##### UI-P07：P07-Backtest-Detail-and-Strategy-Release-High-Fidelity-v1.png

- task_id: `UI-P07`
- task_type: `FRONTEND`
- iteration: `I3`
- depends_on: ["UI-302", "UI-303", "UI-VIS-000", "BFF-FE-004", "BFF-FE-006", "BFF-FE-007", "BFF-FE-000", "BFF-FE-001", "BFF-FE-002", "BFF-FE-003", "BFF-FE-005", "BFF-FE-008", "BFF-FE-009", "BFF-FE-010", "BFF-FE-011"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-ui-p07)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：`P07-Backtest-Detail-and-Strategy-Release-High-Fidelity-v1.png`
- 实际页面/路由交付：`/backtests/:runId`、`/releases`、`/releases/:releaseId`
- 契约绑定：C05、C08、C10
- 所属阶段：FEP-3
- 页面级完成标准：回测详情、校验报告、不可变 Release、审批时间线和 allowedTargets 落地

<a id="review-ui-p07"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

#### 迭代 I4：W21–W22

<a id="task-fep-4"></a>
##### FEP-4：市场与分析

- task_id: `FEP-4`
- task_type: `MILESTONE`
- iteration: `I4`
- depends_on: ["BFF-FE-000", "BFF-FE-001", "BFF-FE-002", "BFF-FE-003", "BFF-FE-004", "BFF-FE-005", "BFF-FE-006", "BFF-FE-007", "BFF-FE-008", "BFF-FE-009", "BFF-FE-010", "BFF-FE-011", "UI-P07"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-fep-4)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：P18–P19、P21；市场目录、报价、K 线、订单标记、收益与报表
- 主要后端依赖：R01/R02、X01、Performance/Valuation/Report API
- 交付节点与放行条件：G4：来源/venue/as_of/quality/口径完整；断流不拼接；provisional 正确
- 范围说明：业务里程碑仅归组与约束下属任务；全部子任务和 Gate 通过后才能关闭。

<a id="review-fep-4"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-fep-5"></a>
##### FEP-5：风险与执行闭环

- task_id: `FEP-5`
- task_type: `MILESTONE`
- iteration: `I4`
- depends_on: ["BFF-FE-000", "BFF-FE-001", "BFF-FE-002", "BFF-FE-003", "BFF-FE-004", "BFF-FE-005", "BFF-FE-006", "BFF-FE-007", "BFF-FE-008", "BFF-FE-009", "BFF-FE-010", "BFF-FE-011", "UI-P07"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-fep-5)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：P08–P12、P20、P22；Portfolio/Risk、Proposal、Trade Ticket、Approval、Order、Reconciliation、Audit
- 主要后端依赖：X01–X06、TP07
- 交付节点与放行条件：G5：七类高风险用例全绿；完整证据链 ≤5 分钟还原；无直连 venue
- 范围说明：业务里程碑仅归组与约束下属任务；全部子任务和 Gate 通过后才能关闭。

<a id="review-fep-5"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-ui-401"></a>
##### UI-401：Market Catalog、Watchlist、VenueQuote

- task_id: `UI-401`
- task_type: `FRONTEND`
- iteration: `I4`
- depends_on: ["UI-101", "UI-204", "BFF-FE-005", "BFF-FE-000", "BFF-FE-001", "BFF-FE-002", "BFF-FE-003", "BFF-FE-004", "BFF-FE-006", "BFF-FE-007", "BFF-FE-008", "BFF-FE-009", "BFF-FE-010", "BFF-FE-011"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-ui-401)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：Market Catalog、Watchlist、VenueQuote
- 接口绑定：C12
- 验收重点：每行含 source、venue、asOf、latency、quality、capability；不同产品不前端合并

<a id="review-ui-401"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-ui-p18"></a>
##### UI-P18：P18-Markets-Overview-and-Instrument-Detail-High-Fidelity-v2.png

- task_id: `UI-P18`
- task_type: `FRONTEND`
- iteration: `I4`
- depends_on: ["UI-401", "UI-VIS-000", "BFF-FE-005", "BFF-FE-010", "BFF-FE-000", "BFF-FE-001", "BFF-FE-002", "BFF-FE-003", "BFF-FE-004", "BFF-FE-006", "BFF-FE-007", "BFF-FE-008", "BFF-FE-009", "BFF-FE-011"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-ui-p18)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：`P18-Markets-Overview-and-Instrument-Detail-High-Fidelity-v2.png`
- 实际页面/路由交付：`/markets`、`/markets/:symbol`
- 契约绑定：C12、C16
- 所属阶段：FEP-4
- 页面级完成标准：市场目录、自选、报价比较、标的详情、许可/质量/as_of 与告警偏好接口化

<a id="review-ui-p18"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-ui-501"></a>
##### UI-501：Portfolio 与 Risk

- task_id: `UI-501`
- task_type: `FRONTEND`
- iteration: `I4`
- depends_on: ["UI-101", "BFF-FE-006", "BFF-FE-010", "BFF-FE-000", "BFF-FE-001", "BFF-FE-002", "BFF-FE-003", "BFF-FE-004", "BFF-FE-005", "BFF-FE-007", "BFF-FE-008", "BFF-FE-009", "BFF-FE-011"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-ui-501)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：Portfolio 与 Risk
- 接口绑定：C06、C16
- 验收重点：asOf/stale、仓位、P&L、敞口、规则命中、kill switch 常驻；陈旧即阻断写操作

<a id="review-ui-501"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-ui-p08"></a>
##### UI-P08：P08-Portfolio-and-Risk-High-Fidelity-v1.png

- task_id: `UI-P08`
- task_type: `FRONTEND`
- iteration: `I4`
- depends_on: ["UI-501", "UI-VIS-000", "BFF-FE-006", "BFF-FE-000", "BFF-FE-001", "BFF-FE-002", "BFF-FE-003", "BFF-FE-004", "BFF-FE-005", "BFF-FE-007", "BFF-FE-008", "BFF-FE-009", "BFF-FE-010", "BFF-FE-011"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-ui-p08)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：`P08-Portfolio-and-Risk-High-Fidelity-v1.png`
- 实际页面/路由交付：`/portfolio`、`/risk`、`/risk/rules/:ruleId`
- 契约绑定：C06
- 所属阶段：FEP-5
- 页面级完成标准：仓位、估值、P&L、敞口、规则、stale 与 kill switch 状态可验证；陈旧时禁写

<a id="review-ui-p08"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-ui-502"></a>
##### UI-502：Proposal 与风险评估

- task_id: `UI-502`
- task_type: `FRONTEND`
- iteration: `I4`
- depends_on: ["UI-203", "UI-501", "UI-507", "BFF-FE-006", "BFF-FE-000", "BFF-FE-001", "BFF-FE-002", "BFF-FE-003", "BFF-FE-004", "BFF-FE-005", "BFF-FE-007", "BFF-FE-008", "BFF-FE-009", "BFF-FE-010", "BFF-FE-011"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-ui-502)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：Proposal 与风险评估
- 接口绑定：C07
- 验收重点：永久显示 `executable=false` 语义；过期 Proposal 不允许评估

<a id="review-ui-502"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-ui-p09"></a>
##### UI-P09：P09-TradeProposal-List-and-Detail-High-Fidelity-v1.png

- task_id: `UI-P09`
- task_type: `FRONTEND`
- iteration: `I4`
- depends_on: ["UI-502", "UI-VIS-000", "BFF-FE-006", "BFF-FE-007", "BFF-FE-000", "BFF-FE-001", "BFF-FE-002", "BFF-FE-003", "BFF-FE-004", "BFF-FE-005", "BFF-FE-008", "BFF-FE-009", "BFF-FE-010", "BFF-FE-011"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-ui-p09)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：`P09-TradeProposal-List-and-Detail-High-Fidelity-v1.png`
- 实际页面/路由交付：`/proposals`、`/proposals/:proposalId`
- 契约绑定：C07、C10
- 所属阶段：FEP-5
- 页面级完成标准：列表/详情/证据/反方观点/失效时间落地；始终显示不可执行语义

<a id="review-ui-p09"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

#### 迭代 I5：W23–W24

<a id="task-ui-503"></a>
##### UI-503：Trade Ticket preflight

- task_id: `UI-503`
- task_type: `FRONTEND`
- iteration: `I5`
- depends_on: ["UI-401", "UI-501", "UI-502", "BFF-FE-005", "BFF-FE-006", "BFF-FE-000", "BFF-FE-001", "BFF-FE-002", "BFF-FE-003", "BFF-FE-004", "BFF-FE-007", "BFF-FE-008", "BFF-FE-009", "BFF-FE-010", "BFF-FE-011"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-ui-503)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：Trade Ticket preflight
- 接口绑定：C12、C13、C07
- 验收重点：每一步重新取报价、余额、限额、venue 健康、对象版本和 mode；只预填 intent，不生成 command

<a id="review-ui-503"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-ui-504"></a>
##### UI-504：Approval、MFA、职责分离

- task_id: `UI-504`
- task_type: `FRONTEND`
- iteration: `I5`
- depends_on: ["UI-503", "UI-102", "BFF-FE-006", "BFF-FE-000", "BFF-FE-001", "BFF-FE-002", "BFF-FE-003", "BFF-FE-004", "BFF-FE-005", "BFF-FE-007", "BFF-FE-008", "BFF-FE-009", "BFF-FE-010", "BFF-FE-011"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-ui-504)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：Approval、MFA、职责分离
- 接口绑定：C08
- 验收重点：自批/过期/冲突/额度变化明确拒绝；不采用乐观更新

<a id="review-ui-504"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-ui-p10"></a>
##### UI-P10：P10-Approvals-and-RiskDecision-Detail-High-Fidelity-v1.png

- task_id: `UI-P10`
- task_type: `FRONTEND`
- iteration: `I5`
- depends_on: ["UI-504", "UI-VIS-000", "BFF-FE-006", "BFF-FE-007", "BFF-FE-000", "BFF-FE-001", "BFF-FE-002", "BFF-FE-003", "BFF-FE-004", "BFF-FE-005", "BFF-FE-008", "BFF-FE-009", "BFF-FE-010", "BFF-FE-011"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-ui-p10)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：`P10-Approvals-and-RiskDecision-Detail-High-Fidelity-v1.png`
- 实际页面/路由交付：`/approvals`、`/approvals/:approvalId`
- 契约绑定：C07、C08、C10
- 所属阶段：FEP-5
- 页面级完成标准：RiskDecision、规则命中、MFA、职责分离、同意/拒绝/过期/冲突状态落地

<a id="review-ui-p10"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-ui-505"></a>
##### UI-505：Command 提交、Order/Fill 时间线、撤单请求

- task_id: `UI-505`
- task_type: `FRONTEND`
- iteration: `I5`
- depends_on: ["UI-504", "BFF-FE-006", "BFF-FE-000", "BFF-FE-001", "BFF-FE-002", "BFF-FE-003", "BFF-FE-004", "BFF-FE-005", "BFF-FE-007", "BFF-FE-008", "BFF-FE-009", "BFF-FE-010", "BFF-FE-011"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-ui-505)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：Command 提交、Order/Fill 时间线、撤单请求
- 接口绑定：C09
- 验收重点：提交只传服务端 command ref 与 Idempotency-Key；重复提交只产生一笔下游订单

<a id="review-ui-505"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-ui-p20"></a>
##### UI-P20：P20-Trade-Ticket-Controlled-Order-Entry-High-Fidelity-v3.png

- task_id: `UI-P20`
- task_type: `FRONTEND`
- iteration: `I5`
- depends_on: ["UI-503", "UI-504", "UI-505", "UI-VIS-000", "BFF-FE-005", "BFF-FE-006", "BFF-FE-000", "BFF-FE-001", "BFF-FE-002", "BFF-FE-003", "BFF-FE-004", "BFF-FE-007", "BFF-FE-008", "BFF-FE-009", "BFF-FE-010", "BFF-FE-011"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-ui-p20)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：`P20-Trade-Ticket-Controlled-Order-Entry-High-Fidelity-v3.png`
- 实际页面/路由交付：`/trade`、`/trade/:symbol`
- 契约绑定：C07–C09、C12、C13
- 所属阶段：FEP-5
- 页面级完成标准：订单意图、执行上下文、preflight、证据关联、风险评估、审批与 command ref 提交严格按服务端时序实现

<a id="review-ui-p20"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-ui-p11"></a>
##### UI-P11：P11-Orders-and-Execution-Detail-High-Fidelity-v1.png

- task_id: `UI-P11`
- task_type: `FRONTEND`
- iteration: `I5`
- depends_on: ["UI-505", "UI-VIS-000", "BFF-FE-006", "BFF-FE-007", "BFF-FE-009", "BFF-FE-000", "BFF-FE-001", "BFF-FE-002", "BFF-FE-003", "BFF-FE-004", "BFF-FE-005", "BFF-FE-008", "BFF-FE-010", "BFF-FE-011"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-ui-p11)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：`P11-Orders-and-Execution-Detail-High-Fidelity-v1.png`
- 实际页面/路由交付：`/orders`、`/orders/:orderId`
- 契约绑定：C09、C10、C15
- 所属阶段：FEP-5
- 页面级完成标准：Order/Fill 时间线、部分成交、拒绝、撤单请求、断流回补与证据链落地

<a id="review-ui-p11"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

#### 迭代 I6：W25–W26

<a id="task-ui-506"></a>
##### UI-506：Reconciliation 与账本差异

- task_id: `UI-506`
- task_type: `FRONTEND`
- iteration: `I6`
- depends_on: ["UI-505", "UI-507", "BFF-FE-009", "BFF-FE-010", "BFF-FE-000", "BFF-FE-001", "BFF-FE-002", "BFF-FE-003", "BFF-FE-004", "BFF-FE-005", "BFF-FE-006", "BFF-FE-007", "BFF-FE-008", "BFF-FE-011"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-ui-506)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：Reconciliation 与账本差异
- 接口绑定：C15、C16
- 验收重点：不能手工改账；差异贯通 Order/Fill/Performance/Alert/Audit

<a id="review-ui-506"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-ui-p22"></a>
##### UI-P22：P22-Reconciliation-and-Funds-Ledger-High-Fidelity-v1.png

- task_id: `UI-P22`
- task_type: `FRONTEND`
- iteration: `I6`
- depends_on: ["UI-506", "UI-VIS-000", "BFF-FE-006", "BFF-FE-007", "BFF-FE-009", "BFF-FE-000", "BFF-FE-001", "BFF-FE-002", "BFF-FE-003", "BFF-FE-004", "BFF-FE-005", "BFF-FE-008", "BFF-FE-010", "BFF-FE-011"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-ui-p22)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：`P22-Reconciliation-and-Funds-Ledger-High-Fidelity-v1.png`
- 实际页面/路由交付：`/reconciliation`、`/reconciliation/:runId`
- 契约绑定：C09、C10、C15
- 所属阶段：FEP-5
- 页面级完成标准：对账运行、差异、资金账本、证据、重跑请求与状态流落地；无手工改账入口

<a id="review-ui-p22"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

#### 迭代 I7：W27–W28

<a id="task-ui-402"></a>
##### UI-402：OHLCV/K 线、指标、订单/成交标记

- task_id: `UI-402`
- task_type: `FRONTEND`
- iteration: `I7`
- depends_on: ["UI-401", "UI-505", "BFF-FE-005", "BFF-FE-006", "BFF-FE-000", "BFF-FE-001", "BFF-FE-002", "BFF-FE-003", "BFF-FE-004", "BFF-FE-007", "BFF-FE-008", "BFF-FE-009", "BFF-FE-010", "BFF-FE-011"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-ui-402)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：OHLCV/K 线、指标、订单/成交标记
- 接口绑定：C12、C09
- 验收重点：series 元数据完整；切 venue/product 清空旧 series；断流停在最后确认时间

<a id="review-ui-402"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-ui-p19"></a>
##### UI-P19：P19-Candlestick-and-Market-Analysis-High-Fidelity-v4.png

- task_id: `UI-P19`
- task_type: `FRONTEND`
- iteration: `I7`
- depends_on: ["UI-402", "UI-VIS-000", "BFF-FE-005", "BFF-FE-006", "BFF-FE-000", "BFF-FE-001", "BFF-FE-002", "BFF-FE-003", "BFF-FE-004", "BFF-FE-007", "BFF-FE-008", "BFF-FE-009", "BFF-FE-010", "BFF-FE-011"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-ui-p19)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：`P19-Candlestick-and-Market-Analysis-High-Fidelity-v4.png`
- 实际页面/路由交付：`/markets/:symbol/chart`
- 契约绑定：C09、C12
- 所属阶段：FEP-4
- 页面级完成标准：Symbol/Venue/Product/Timezone/Quality 可选；周期仅 1m/5m/15m/1h/4h/1D/1W/自定义；K 线、指标、事件、数据缺口和元数据落地

<a id="review-ui-p19"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-ui-403"></a>
##### UI-403：Performance、归因、周期报表

- task_id: `UI-403`
- task_type: `FRONTEND`
- iteration: `I7`
- depends_on: ["UI-506", "BFF-FE-008", "BFF-FE-009", "BFF-FE-000", "BFF-FE-001", "BFF-FE-002", "BFF-FE-003", "BFF-FE-004", "BFF-FE-005", "BFF-FE-006", "BFF-FE-007", "BFF-FE-010", "BFF-FE-011"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-ui-403)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：Performance、归因、周期报表
- 接口绑定：C14、C15
- 验收重点：金额/币种/估值/账本版本/口径齐全；未对账数据标为 provisional

<a id="review-ui-403"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-ui-p21"></a>
##### UI-P21：P21-Performance-and-Reports-High-Fidelity-v1.png

- task_id: `UI-P21`
- task_type: `FRONTEND`
- iteration: `I7`
- depends_on: ["UI-403", "UI-VIS-000", "BFF-FE-008", "BFF-FE-009", "BFF-FE-000", "BFF-FE-001", "BFF-FE-002", "BFF-FE-003", "BFF-FE-004", "BFF-FE-005", "BFF-FE-006", "BFF-FE-007", "BFF-FE-010", "BFF-FE-011"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-ui-p21)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：`P21-Performance-and-Reports-High-Fidelity-v1.png`
- 实际页面/路由交付：`/performance`、`/performance/reports/:reportId`
- 契约绑定：C14、C15
- 所属阶段：FEP-4
- 页面级完成标准：收益、归因、回撤、费用、口径、provisional 和报表生成/下载落地

<a id="review-ui-p21"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

#### 迭代 I8：W29–W30

<a id="task-fep-6"></a>
##### FEP-6：Web 运维治理

- task_id: `FEP-6`
- task_type: `MILESTONE`
- iteration: `I8`
- depends_on: ["BFF-FE-000", "BFF-FE-001", "BFF-FE-002", "BFF-FE-003", "BFF-FE-004", "BFF-FE-005", "BFF-FE-006", "BFF-FE-007", "BFF-FE-008", "BFF-FE-009", "BFF-FE-010", "BFF-FE-011", "UI-P21"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-fep-6)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：P13、P14、P23；Operations、Admin、Alerts
- 主要后端依赖：F09、X05/X06、Auth/Policy/Incident/Alert API
- 交付节点与放行条件：G6：受控 Runbook、职责分离、Web 通知、权限与离线禁写通过
- 范围说明：业务里程碑仅归组与约束下属任务；全部子任务和 Gate 通过后才能关闭。

<a id="review-fep-6"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-ui-603"></a>
##### UI-603：Alerts 收件箱

- task_id: `UI-603`
- task_type: `FRONTEND`
- iteration: `I8`
- depends_on: ["UI-506", "BFF-FE-010", "BFF-FE-000", "BFF-FE-001", "BFF-FE-002", "BFF-FE-003", "BFF-FE-004", "BFF-FE-005", "BFF-FE-006", "BFF-FE-007", "BFF-FE-008", "BFF-FE-009", "BFF-FE-011"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-ui-603)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：Alerts 收件箱
- 接口绑定：C16
- 验收重点：BFF 授权/去重/限速；ack 仅代表已读，不代表解决；离线禁写

<a id="review-ui-603"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-ui-p23"></a>
##### UI-P23：P23-Alerts-Inbox-and-Response-High-Fidelity-v1.png

- task_id: `UI-P23`
- task_type: `FRONTEND`
- iteration: `I8`
- depends_on: ["UI-603", "UI-VIS-000", "BFF-FE-007", "BFF-FE-010", "BFF-FE-000", "BFF-FE-001", "BFF-FE-002", "BFF-FE-003", "BFF-FE-004", "BFF-FE-005", "BFF-FE-006", "BFF-FE-008", "BFF-FE-009", "BFF-FE-011"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-ui-p23)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：`P23-Alerts-Inbox-and-Response-High-Fidelity-v1.png`
- 实际页面/路由交付：`/alerts`、`/alerts/:alertId`
- 契约绑定：C10、C11、C16
- 所属阶段：FEP-6
- 页面级完成标准：授权收件箱、详情、ack/unack、处置导航、订阅与实时状态落地；ack 不等于 resolved

<a id="review-ui-p23"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-ui-601"></a>
##### UI-601：Operations/Incident/Runbook

- task_id: `UI-601`
- task_type: `FRONTEND`
- iteration: `I8`
- depends_on: ["UI-603", "BFF-FE-010", "BFF-FE-000", "BFF-FE-001", "BFF-FE-002", "BFF-FE-003", "BFF-FE-004", "BFF-FE-005", "BFF-FE-006", "BFF-FE-007", "BFF-FE-008", "BFF-FE-009", "BFF-FE-011"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-ui-601)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：Operations/Incident/Runbook
- 接口绑定：C11、C16
- 验收重点：只能触发服务端批准 actionId；无任意命令/脚本入口

<a id="review-ui-601"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-ui-p13"></a>
##### UI-P13：P13-Operations-and-Incident-Detail-High-Fidelity-v2.png

- task_id: `UI-P13`
- task_type: `FRONTEND`
- iteration: `I8`
- depends_on: ["UI-601", "UI-VIS-000", "BFF-FE-010", "BFF-FE-000", "BFF-FE-001", "BFF-FE-002", "BFF-FE-003", "BFF-FE-004", "BFF-FE-005", "BFF-FE-006", "BFF-FE-007", "BFF-FE-008", "BFF-FE-009", "BFF-FE-011"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-ui-p13)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：`P13-Operations-and-Incident-Detail-High-Fidelity-v2.png`
- 实际页面/路由交付：`/operations`、`/operations/incidents/:incidentId`
- 契约绑定：C11、C16
- 所属阶段：FEP-6
- 页面级完成标准：7 个服务健康视图、告警、incident 时间线、Runbook 检查与受控 actionId 调用落地

<a id="review-ui-p13"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-ui-602"></a>
##### UI-602：Admin 治理

- task_id: `UI-602`
- task_type: `FRONTEND`
- iteration: `I8`
- depends_on: ["UI-601", "BFF-FE-001", "BFF-FE-010", "BFF-FE-000", "BFF-FE-002", "BFF-FE-003", "BFF-FE-004", "BFF-FE-005", "BFF-FE-006", "BFF-FE-007", "BFF-FE-008", "BFF-FE-009", "BFF-FE-011"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-ui-602)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：Admin 治理
- 接口绑定：C11、C01
- 验收重点：成员、角色、policy、capability、flag 全量审计；最后管理员保护；职责分离

<a id="review-ui-602"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

<a id="task-ui-p14"></a>
##### UI-P14：P14-Admin-Governance-High-Fidelity-v2.png

- task_id: `UI-P14`
- task_type: `FRONTEND`
- iteration: `I8`
- depends_on: ["UI-602", "UI-VIS-000", "BFF-FE-001", "BFF-FE-010", "BFF-FE-000", "BFF-FE-002", "BFF-FE-003", "BFF-FE-004", "BFF-FE-005", "BFF-FE-006", "BFF-FE-007", "BFF-FE-008", "BFF-FE-009", "BFF-FE-011"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-ui-p14)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：`P14-Admin-Governance-High-Fidelity-v2.png`
- 实际页面/路由交付：`/admin/members`、`/admin/policies`、`/admin/capabilities`、`/admin/flags`
- 契约绑定：C01、C11
- 所属阶段：FEP-6
- 页面级完成标准：成员/角色/策略/能力/开关、版本冲突、职责分离、签名与审计落地

<a id="review-ui-p14"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

#### 迭代 I9：W31–W32

<a id="task-fep-7"></a>
##### FEP-7：硬化与 Beta

- task_id: `FEP-7`
- task_type: `MILESTONE`
- iteration: `I9`
- depends_on: ["BFF-FE-000", "BFF-FE-001", "BFF-FE-002", "BFF-FE-003", "BFF-FE-004", "BFF-FE-005", "BFF-FE-006", "BFF-FE-007", "BFF-FE-008", "BFF-FE-009", "BFF-FE-010", "BFF-FE-011", "UI-P01", "UI-P02", "UI-P03", "UI-P04", "UI-P05", "UI-P06", "UI-P07", "UI-P08", "UI-P09", "UI-P10", "UI-P11", "UI-P12", "UI-P13", "UI-P14", "UI-P15", "UI-P17", "UI-P18", "UI-P19", "UI-P20", "UI-P21", "UI-P22", "UI-P23", "WEB-101"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-fep-7)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：全量回归、兼容、性能、可访问性、安全、视觉、故障恢复
- 主要后端依赖：R1/S2/X3 Gate
- 交付节点与放行条件：G7：Paper + Shadow Beta 验收通过，阻断级缺陷为 0
- 范围说明：业务里程碑仅归组与约束下属任务；全部子任务和 Gate 通过后才能关闭。

<a id="review-fep-7"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

#### 迭代 I10：W33–W34

<a id="task-fep-8"></a>
##### FEP-8：M5 评审准备

- task_id: `FEP-8`
- task_type: `MILESTONE`
- iteration: `I10`
- depends_on: ["BFF-FE-000", "BFF-FE-001", "BFF-FE-002", "BFF-FE-003", "BFF-FE-004", "BFF-FE-005", "BFF-FE-006", "BFF-FE-007", "BFF-FE-008", "BFF-FE-009", "BFF-FE-010", "BFF-FE-011", "FEP-7"]
- development_status: `UNSPECIFIED`
- review_entry: [GPT-6 Astra 复审入口](#review-fep-8)
- workflow: `DEVELOPMENT → REVIEW_READY → IN_REVIEW → CHANGES_REQUESTED → FIX_VALIDATION → RE_REVIEW → ACCEPTED`
- 需求描述：P10/P11 的 testnet 条件入口、MFA 与双人审批
- 主要后端依赖：L01–L04，且仅 testnet
- 交付节点与放行条件：G8：flag 关闭时 UI/API 不可达；只形成评审证据，不开启生产实盘
- 范围说明：业务里程碑仅归组与约束下属任务；全部子任务和 Gate 通过后才能关闭。

<a id="review-fep-8"></a>
###### GPT-6 Astra 功能复审

- review_model: `GPT-6 Astra`
- review_status: `NOT_STARTED`
- review_conclusion: null
- issues: []
- fix_tracking: []

## 5. 接口对接清单与契约基线

### 5.1 契约状态说明

《可执行开发计划》冻结的是领域对象、协议元数据、错误稳定性、幂等/审计要求和业务时序，并没有给出第一期 22 个 Web Terminal 页面完整 REST URL 与统一 JSON envelope。下表中的 C01–C17 是前端需要 BFF 冻结的**逻辑契约包**，不是对尚未发布 HTTP 路径的臆造。实际路径、method、分页格式和 envelope 必须以版本化 OpenAPI 为准；页面只能引用生成 client。

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
| C17 Settings/Browser Platform | P15/P17 | profile/session/device/notification/download query/commands | locale、timezone、theme、session/device、browser notification permission、download record；不得包含领域秘密 | F06、F09 |

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
| 敏感字段 | BFF 先脱敏；Vault/venue/model secret 永不进入 schema | 日志、URL、analytics、Sentry、导出与浏览器存储均做负向检查 |

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

### 5.6 页面 API 任务入口与执行规则

`BFF-FE-000`–`BFF-FE-011` 的唯一任务定义及全量排期已前置到第 4.1 节。本节保留契约规则入口；C01–C17 仅为接口映射，不与前端任务混排。

#### 5.6.1 API 缺口任务执行规则

- `BFF-FE-000` 由 BFF TL 主责，Frontend TL、QA、安全和领域 owner 联合签署；其余任务必须在对应页面进入 Sprint 前一个 Sprint 达到 `Reviewed + Mocked`。
- 每项 operation 必须提供：权限/capability、请求/响应示例、字段 required/nullable、枚举、分页/排序、缓存与 `asOf`、错误码、幂等、对象版本、审计、限流、实时恢复和敏感字段说明。
- 对总开发计划已经存在的服务接口，BFF 只能做授权、裁剪、聚合和页面模型转换，不复制领域规则；风险结论、审批状态、订单事实和账本状态仍由原服务权威产生。
- 新增页面 API 不得扩展产品范围：不增加 workspace 切换、生产 Assisted Live、Guarded Live、任意 Runbook 命令、手工改账、客户端 command 构造或 venue 直连。
- BFF 契约未实现时允许同 schema mock；如果契约仍为 Draft、页面使用手写 DTO、provider contract 未通过或 staging 行为与 mock 不一致，对应 `UI-Pxx` 一律不能进入 `Integrated/Done`。

### 5.7 逐页接口覆盖 Gate

每个页面开始开发前建立一行 `Page API Coverage` 记录，最少包含：页面 ID、有效设计稿、路由、query operationId、command operationId、realtime channel/operationId、权限/capability、错误码集合、数据新鲜度字段、OpenAPI 版本、mock 版本、BFF owner 和最后验证时间。满足以下条件才算接口覆盖完成：

1. 页面展示的每个服务端字段都能追溯到 OpenAPI/领域 schema；不存在仅见于设计稿而无契约来源的业务字段。
2. 页面每个按钮均映射为明确的本地 UI 动作或 BFF command；危险按钮必须有服务端可操作性与版本校验。
3. 列表、详情、异步任务和实时事件分别有分页、终态、断线恢复和错误契约；不能用轮询/本地状态暗中替代未定义时序。
4. 默认、加载、空、错误、无权、陈旧、离线和危险确认状态均有 fixture，并至少一次在 staging 用真实 BFF 验证。
5. 契约变更报告能从 operationId 反查所有受影响的 `UI-Pxx` 任务和视觉/E2E 基线。

## 6. 联调与一致性校验机制

### 6.1 联调流水线

1. **契约设计：** BFF 在实现前提交 OpenAPI/Proto 变更、示例和兼容说明；前端和 QA 在 PR 内评审字段、状态、权限、错误与时序。
2. **生成与 mock：** CI 生成 TS client、Zod/fixture 类型；MSW 从同一契约提供成功、拒绝、冲突、限流、断流、陈旧与权限场景。
3. **Provider contract：** BFF 对 OpenAPI 示例运行响应校验；前端 consumer contract 对 staging BFF 运行，不允许仅 mock 通过。
4. **功能联调：** 按“单接口 smoke → 页面 query → command → realtime → 审计链 → 故障恢复”的顺序，每个接口记录 owner、环境、版本、证据和遗留项。
5. **Gate 回归：** 每阶段结束运行该阶段全部场景、全局安全回归和目标浏览器 E2E；契约未通过则阶段不能标为完成。

### 6.2 一致性自动校验

- `buf breaking`、Proto/JSON Schema/OpenAPI diff、TS client regenerate clean check 必须通过。
- 响应 fixture 使用 schema validator；required/enum/format/additionalProperties 策略一致。
- 前端禁止直接 import 内部数据库 DTO 或第三方 Engine/venue 类型；ESLint boundary rule 强制 `page → api-client/domain-ui`。
- 所有 command 测试断言 Idempotency-Key、request ID、correlation ID、expectedVersion 和审计事件。
- Realtime 测试覆盖重复、乱序、断连、漏通知、权限撤销和 schema version 不兼容。
- 敏感字段字典对网络响应、前端日志、监控事件、URL、下载和浏览器存储做自动扫描。

### 6.3 跨域与浏览器安全配置

| 项目 | 要求 |
|---|---|
| 同源优先 | 生产通过同站 BFF 路由；若必须跨域，仅允许明确的 Web/预览 origin allowlist，禁止 `*` + credentials |
| CORS | 限定 methods/headers；允许 `Idempotency-Key`、request/correlation/trace headers；预检缓存有版本化变更测试 |
| Cookie/CSRF | Secure、HttpOnly、SameSite；所有有副作用请求校验 CSRF token/origin |
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
| 组件 | P01–P15/P17–P23 的默认、加载、空、错误、无权、陈旧、离线、危险确认；Storybook + RTL + axe | 严重/高等级 a11y 问题为 0 |
| 契约 | OpenAPI schema、错误码、枚举、字段精度、分页、幂等、版本冲突、实时事件 | consumer/provider 任一不一致则阻断联调完成 |
| 集成 | TanStack Query 缓存/失效、OIDC、MFA、MSW/staging、SSE/WS、平台 adapter | mock 与 staging 行为不同或丢 correlation ID 则阻断 |
| E2E | 每角色关键 Web 旅程；研究、策略、风险审批、订单、审计、对账、运维 | P0 旅程通过率 100%，不得以重跑掩盖 flaky |
| 视觉 | 1280/1440 宽屏、768 折叠、390 只读、深浅主题、关键危险状态 | 关键页面无未批准差异；其余像素差异阈值 ≤0.5% |
| 兼容 | Chromium/Firefox/Safari 当前稳定版；200% 缩放 | P0 功能/布局/键盘任一失败则阻断发布 |
| 安全 | 越权、IDOR、CSRF/CSP/CORS、XSS、敏感字段、浏览器缓存、离线、依赖与 secret scan | 高危=0；未豁免中危=0；交易边界绕过=0 |

### 7.2 必测 E2E 场景

1. 研究员选择可用 DataSnapshot，创建研究，接收流式结果，断线续传，取消并进入 Artifact/Audit；全过程无订单入口。
2. 量化开发完成草稿、静态检查、固定快照回测、Release 和审批申请；验证失败/未审批/Assisted Live 均不可部署。
3. 交易员从有效 Proposal 或 Trade Ticket 发起风险评估；分别覆盖 allow、deny、approval-required、过期、重复、数据陈旧、kill switch。
4. 审批人完成 MFA 与审批；自批、第二人缺失、版本冲突、额度变化、命令过期全部拒绝。
5. 已批准 command 重复提交 1,000 次仅产生一个命令/订单事实；页面不在 ack 前显示成交。
6. 订单部分成交、拒绝、撤单延迟、断流回补；每个 Fill 可追溯 Proposal、RiskDecision、Approval、Command、Release 和 Snapshot。
7. 对账注入差异后，Orders/Performance/Alerts/Audit 一致显示 provisional/Investigating，且 UI 无改账入口。
8. 断网后 Web 全部写操作禁用；恢复连接后不自动提交旧意图。

### 7.3 页面还原度与功能完整性

- P01–P15、P17–P23 页面、路由、角色、主操作、文案、字段和状态与设计规格逐项对照，第一期 Web 需求覆盖率 100%。
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
| 权限/交易边界缺陷 | UI 可见越权数据或可绕过 Risk | 高危安全风险 | 默认拒绝、服务端权威、七类 E2E、IDOR/缓存扫描；立即阻断发布 | Security + Risk |
| 图表/大表性能 | 10k+ 行或高频 candle 卡顿 | 专业使用不可用 | 虚拟化、服务端聚合、增量更新、路由拆包；阶段内做性能基线 | FE Performance owner |
| 第三方/许可问题 | CVE、许可证或上游 breaking | 构建/发布阻断 | 锁版本、SBOM、许可 Gate、adapter 隔离和替代方案；不让上游类型进入 UI | Supply-chain owner |
| 跨浏览器 CI 晚暴露 | Firefox/WebKit 失败 | Beta 延期 | 从 FEP-1 起每 PR 跑 Chromium，夜间跑浏览器矩阵；每阶段至少一次完整矩阵 | QA |
| 人员/估算偏差 | Sprint burn-up 偏差 >20% | 里程碑滑动 | P0/P1 分层；锁定安全与契约任务，不删测试；官网/P1 报表或平台增强可后移 | PM + FE TL |

### 8.1 排期控制规则

本节 DoR 为最低要求；本轮新增页面还必须满足第 4 节全量 API 前置准入，不能仅凭 Reviewed/Mocked 开始。

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
| Security | OIDC/MFA、CSP/CORS/CSRF、敏感字段、浏览器权限、供应链 |
| Risk/Compliance | Proposal/Risk/Approval/Command 时序、模式/限额/kill switch、审计与导出 |
| SRE | staging、观测、性能采样、故障注入、Runbook 与发布回滚 |

每个看板任务首先包含 `task_id`、`task_type`、`iteration`、`depends_on`、`development_status`、`review_entry`、`workflow` 和四个复审字段，并必须包含：`页面 ID`、`前端任务 ID`、`契约 ID`、`后端计划 ID`、`风险级别`、`设计链接`、`测试用例`、`owner`、`依赖`、`目标 Sprint`、`契约状态`、`联调状态`、`Gate 证据`。

## 10. 最终发布检查表

- [ ] 官网首期页面与 Web Terminal P01–P15、P17–P23 的范围、角色、路由和七态全部交付。
- [ ] OpenAPI/Proto/JSON Schema/TS client 无未解释 diff，provider/consumer contract 全绿。
- [ ] Research、Strategy、Proposal → Risk → Approval → Command → Order → Reconciliation → Audit 全链路均有真实 BFF E2E 证据。
- [ ] Proposal 无执行入口；客户端无 command 构造、venue 直连、密钥、离线写或乐观成交。
- [ ] 401/403/404/409/422/429/5xx、断线、陈旧、权限撤销和未知枚举均 fail closed。
- [ ] WCAG 2.2 AA、视觉、性能、兼容、安全和供应链 Gate 达标。
- [ ] 每笔抽样订单可在 5 分钟内还原完整证据链；每个错误可凭 correlation ID 定位。
- [ ] Paper/Shadow 清晰区分；M5 flag 关闭时 Assisted Live UI/API 100% 不可达；Guarded Live 不存在。
- [ ] Web 发布、灰度、回滚、告警与 Runbook 均已演练并归档。
