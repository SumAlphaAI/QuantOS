# PRE-01 产出物一：页面台账与 Story 拆解

> 任务：PRE-01 需求拆解（FEP-0）
> 版本：1.0  日期：2026-08-14
> 依据：[前端开发执行计划](./SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md)（第 1、3.1、4、5 节）、[Terminal 全量前端页面设计规格](./SumAlpha-QuantOS-Terminal-Frontend-Design-Spec.md)（第 1–6 节）、[网站与终端设计方案](./SumAlpha-QuantOS-Web-and-Terminal-Design.md)（第 4–6 节）
> 配套文件：[路由/权限矩阵](./PRE-01-route-permission-matrix.md)、[验收场景表](./PRE-01-acceptance-scenarios.md)、[执行总结与风险登记](./PRE-01-summary-and-risks.md)

## 1. 标注口径

| 字段 | 取值与定义 |
|---|---|
| 优先级 | P0 = 阶段 Gate 阻断项，对应设计规格 5.1 的 P0 功能与执行计划七类高风险链路；P1 = 重要但不阻断首阶段 Gate，对应 F06–F09、F12、F14 与官网辅助页面 |
| 角色 | 研=研究员、开=量化开发、交=交易员、风=风控/审批人、运=运维/SRE、管=管理员、审=审计员、访=访客 |
| 平台 | Web = `app.sumalpha.ai`；DT = Tauri 桌面端；W/D = 双端共享；官网 = `apps/website` 独立应用 |
| 风险级别 | 高 = 涉及交易边界、风险审批、权限、密钥、审计证据、模式；中 = 涉及领域数据展示、异步任务、受控导出；低 = 纯内容/营销页 |
| 契约 | 执行计划第 5.2 节 C01–C17 逻辑契约包 |
| 阶段 | 执行计划第 4 节 FEP-1–FEP-8 |

## 2. 页面总台账（覆盖率基线：31/31）

| 页面 ID | 页面 | 有效设计稿 / 基准 | 路由 | 平台 | 主要角色 | 优先级 | 风险 | 契约 | 阶段 |
|---|---|---|---|---|---|---|---|---|---|
| GS | 全局壳 App Shell | UI-VIS-000；P02 与 P20 v3 为全局基准 | 全部受保护路由 | W/D | 全部登录角色 | P0 | 高 | C01、C16、C17 | FEP-1 |
| WEB-01 | 官网首页 | 设计方案 4.2 | `/` | 官网 | 访 | P0 | 低 | 无（静态） | FEP-1 |
| WEB-02 | 官网产品页 | 设计方案 4.1 | `/product` | 官网 | 访 | P0 | 低 | 无 | FEP-1 |
| WEB-03 | 官网架构与安全页 | 设计方案 4.1 | `/architecture-security` | 官网 | 访 | P0 | 低 | 无 | FEP-1 |
| WEB-04 | 官网使用场景页 | 设计方案 4.1 | `/use-cases` | 官网 | 访 | P1 | 低 | 无 | FEP-1 |
| WEB-05 | 官网文档中心 | 设计方案 4.1 | `/docs` | 官网 | 访 | P1 | 低 | 无 | FEP-1 |
| WEB-06 | 官网访问申请页 | 设计方案 4.1 | `/access-request` | 官网 | 访 | P0 | 中 | Access Request（C01） | FEP-1 |
| WEB-07 | 官网登录页 | 设计方案 4.1 | `/login` | 官网 | 访 | P0 | 中 | C01 | FEP-1 |
| P01 | 身份、访问与恢复 | v1 | `/login`、`/mfa`、`/auth/callback`、`/access-request`、`/unauthorized`、`/offline` | W/D | 访、全部 | P0 | 高 | C01 | FEP-1 |
| P02 | Command Center | v1 | `/command` | W/D | 全部登录角色 | P0 | 中 | C02、C06、C16 | FEP-1 |
| P03 | Research 列表与新建 | v1 | `/research`、`/research/new` | W/D | 研、开（其他只读） | P0 | 中 | C03、C04 | FEP-2 |
| P04 | Research 与 Artifact 详情 | v1 | `/research/:runId`、`/artifacts/:artifactId` | W/D | 资源级授权 | P0 | 中 | C03、C04、C10 | FEP-2 |
| P05 | 数据快照目录与详情 | v1 | `/data-snapshots`、`/data-snapshots/:snapshotId` | W/D | 研、开、风 | P0 | 中 | C04 | FEP-2 |
| P06 | Strategy 目录与 Lab | v1 | `/strategies`、`/strategies/new`、`/strategies/:strategyId/lab` | W/D | 开（其他只读） | P0 | 中 | C05 | FEP-3 |
| P07 | Backtest 详情与 Release | v1 | `/backtests/:runId`、`/releases`、`/releases/:releaseId` | W/D | 开、风、审 | P0 | 高 | C05、C08、C10 | FEP-3 |
| P08 | Portfolio 与 Risk | v1 | `/portfolio`、`/risk`、`/risk/rules/:ruleId` | W/D | 交、风 | P0 | 高 | C06 | FEP-5 |
| P09 | TradeProposal 列表与详情 | v1 | `/proposals`、`/proposals/:proposalId` | W/D | 交、风、审 | P0 | 高 | C07、C10 | FEP-5 |
| P10 | Approvals 与 RiskDecision | v1 | `/approvals`、`/approvals/:approvalId` | W/D | 风（审批人） | P0 | 高 | C07、C08、C10 | FEP-5 |
| P11 | Orders 与执行详情 | v1 | `/orders`、`/orders/:orderId` | W/D | 交、运、风 | P0 | 高 | C09、C10、C15 | FEP-5 |
| P12 | Audit Explorer 与导出 | v1 | `/audit`、`/audit/:correlationId`、`/exports/:exportId` | W/D | 审、管、资源级授权 | P0 | 高 | C10 | FEP-5 |
| P13 | Operations 与 Incident | v2 | `/operations`、`/operations/incidents/:incidentId` | W/D | 运、管 | P1 | 高 | C11、C16 | FEP-6 |
| P14 | Admin 治理 | v2 | `/admin/members`、`/admin/policies`、`/admin/capabilities`、`/admin/flags` | W/D | 管 | P1 | 高 | C01、C11 | FEP-6 |
| P15 | Profile、安全与通知 | v2 | `/settings/profile`、`/settings/notifications`、`/settings/security` | W/D | 全部登录角色 | P0 | 中 | C01、C17 | FEP-1 |
| P16 | Desktop Control Center | v2 | `/settings/desktop` | DT（Web 受限态） | 全部登录角色 | P1 | 中 | C17 | FEP-6 |
| P17 | Web Browser Capability | v2 | `/settings/browser` | Web（DT 不显示） | 全部登录角色 | P1 | 低 | C17 | FEP-1 |
| P18 | Markets 总览与标的详情 | v2 | `/markets`、`/markets/:symbol` | W/D | 全部（按行情授权） | P0 | 中 | C12、C16 | FEP-4 |
| P19 | K 线与市场分析 | v4 | `/markets/:symbol/chart` | W/D | 全部（按行情授权） | P0 | 中 | C09、C12 | FEP-4 |
| P20 | Trade Ticket 受控下单 | v3 | `/trade`、`/trade/:symbol` | W/D | 交（风/审批只读） | P0 | 高 | C07–C09、C12、C13 | FEP-5 |
| P21 | Performance 与报表 | v1 | `/performance`、`/performance/reports/:reportId` | W/D | 交、风、研（只读） | P1 | 中 | C14、C15 | FEP-4 |
| P22 | Reconciliation 与账本 | v1 | `/reconciliation`、`/reconciliation/:runId` | W/D | 交、风、运 | P0 | 高 | C09、C10、C15 | FEP-5 |
| P23 | Alerts 收件箱与处置 | v1 | `/alerts`、`/alerts/:alertId` | W/D | 全部（按事件授权） | P1 | 中 | C10、C11、C16 | FEP-6 |

说明：官网「开发者」与「状态页」按执行计划 1.2 节为后续补充范围，不进入本期台账；进入时须重新评审并追加 story。

## 3. Story 拆解

### 3.1 全局壳（GS）

| Story ID | Story | 优先级 | 角色 | 路由/范围 | 平台 | 风险 |
|---|---|---|---|---|---|---|
| ST-GS-01 | 作为登录用户，我使用侧栏+面包屑+页面标题栏导航，Admin/Operations 仅有权时可见，键盘 `g`+快捷键可达 | P0 | 全部 | App Shell | W/D | 中 |
| ST-GS-02 | 作为登录用户，顶部常驻主工作区（只读）、账户、ModeBanner、数据新鲜度、风险状态；mode 标签不可隐藏，数据陈旧时阻断相关交易动作 | P0 | 全部 | App Shell | W/D | 高 |
| ST-GS-03 | 作为登录用户，底部状态栏显示连接/实时流/数据延迟/支持入口，离线、重连、降级始终可见，不把"已连接"误示为数据新鲜 | P0 | 全部 | App Shell | W/D | 中 |
| ST-GS-04 | 作为登录用户，路由守卫严格按 会话→tenant/主工作区→RBAC/capability→资源级→mode→数据 顺序执行，任一步失败停止后续请求 | P0 | 全部 | 全部受保护路由 | W/D | 高 |
| ST-GS-05 | 作为用户，我访问 `/unauthorized`、`/not-found`、`/maintenance`、`/offline` 获得统一恢复与支持入口，403/404 不泄露对象存在性 | P0 | 访、全部 | 状态页 | W/D | 中 |
| ST-GS-06 | 作为登录用户，中英文切换与深浅主题生效；安全文案仅替换变量不可改写，全部入 i18n | P0 | 全部 | 全局 | W/D | 中 |
| ST-GS-07 | 作为 Web 用户，≥1280px 完整工作区、768–1279px 折叠侧栏单列、<768px 只读监控且不出现审批/下单等高风险操作 | P0 | 全部 | 全局 | Web | 高 |
| ST-GS-08 | 作为桌面端用户，多窗口/多显示器/可恢复布局仅改变视图承载，不改变领域状态、权限与审计语义 | P0 | 全部 | 全局 | DT | 中 |
| ST-GS-09 | 作为用户，断网时 Web 全部写操作禁用；桌面端仅显示加密非敏感只读缓存，恢复后不自动提交旧意图 | P0 | 全部 | 全局 | W/D | 高 |
| ST-GS-10 | 作为登录用户，SSE 实时投影支持 sequence/cursor 去重、断线回补、权限变更即断开；未知枚举 fail closed | P0 | 全部 | 全局实时通道 | W/D | 高 |
| ST-GS-11 | 作为登录用户，⌘K 全局搜索与顶栏 Alerts 入口仅返回授权范围内结果 | P1 | 全部 | 全局 | W/D | 中 |
| ST-GS-12 | 作为登录用户，右侧 Evidence/Activity/Filter 抽屉不替代可分享详情路由，关闭不丢失草稿 | P1 | 全部 | 全局 | W/D | 低 |

### 3.2 官网（WEB）

| Story ID | Story | 优先级 | 角色 | 路由 | 平台 | 风险 |
|---|---|---|---|---|---|---|
| ST-WEB-01 | 作为访客，我在首页看到品牌主张、提议—审批—执行—留证闭环、信任三承诺（Agent 不直接下单/默认 Paper·Shadow/全链路审计）与访问申请 CTA | P0 | 访 | `/` | 官网 | 低 |
| ST-WEB-02 | 作为访客，我在产品页了解 Research、Strategy Governance、Risk & Execution、Audit 四项能力并进入对应详情 | P0 | 访 | `/product` | 官网 | 低 |
| ST-WEB-03 | 作为访客，我在架构与安全页了解 Agent/风控边界、事件审计、权限、数据与供应链治理 | P0 | 访 | `/architecture-security` | 官网 | 低 |
| ST-WEB-04 | 作为访客，我在使用场景页按研究团队/量化开发/交易与风控协作理解适用对象 | P1 | 访 | `/use-cases` | 官网 | 低 |
| ST-WEB-05 | 作为访客，我在文档中心阅读架构、SDK、API、部署、Runbook 与变更日志 | P1 | 访 | `/docs` | 官网 | 低 |
| ST-WEB-06 | 作为访客，我提交包含团队信息、用途、市场、预期模式与条款同意的访问申请；具备防滥用、隐私告知与提交后状态反馈 | P0 | 访 | `/access-request` | 官网 | 中 |
| ST-WEB-07 | 作为访客，我从官网登录页经 SSO/OIDC 进入 Terminal，支持 MFA 与支持入口 | P0 | 访 | `/login` | 官网 | 中 |
| ST-WEB-08 | 作为合规 owner，全站通过禁用词扫描（无收益承诺/跟单/喊单/排行榜），Lighthouse 四项 ≥90 且 LCP ≤2.5s | P0 | 访 | 全站 | 官网 | 中 |

### 3.3 Terminal 页面（P01–P23）

#### P01 身份、访问与恢复

| Story ID | Story | 优先级 | 角色 | 路由 | 平台 | 风险 |
|---|---|---|---|---|---|---|
| ST-P01-01 | 作为访客，我通过 OIDC+PKCE 完成 SSO 登录，回调仅交换短期令牌并建立服务端会话，URL 不含 token | P0 | 访 | `/login`、`/auth/callback` | W/D | 高 |
| ST-P01-02 | 作为用户，我完成 MFA challenge；失败被限流且不透露账户是否存在 | P0 | 访 | `/mfa` | W/D | 高 |
| ST-P01-03 | 作为用户，会话失效后我重新认证并返回原始安全路由，return path 不含敏感参数 | P0 | 全部 | `/login` | W/D | 高 |
| ST-P01-04 | 作为访客，我提交访问申请并获得受理反馈 | P0 | 访 | `/access-request` | W/D | 中 |
| ST-P01-05 | 作为用户，我在 `/unauthorized` 与 `/offline` 看到规范文案、复制 support correlation ID 与恢复入口 | P0 | 访、全部 | `/unauthorized`、`/offline` | W/D | 中 |
| ST-P01-06 | 作为桌面端用户，认证优先走系统浏览器安全流，完成后经深链回到应用并重新鉴权 | P0 | 访 | `/login` | DT | 高 |

#### P02 Command Center

| Story ID | Story | 优先级 | 角色 | 路由 | 平台 | 风险 |
|---|---|---|---|---|---|---|
| ST-P02-01 | 作为登录用户，我看到按 capability 裁剪的聚合视图：PriorityQueue（审批/风险/失败任务）、HealthSummary、四张 KPI 卡、ActivityFeed | P0 | 全部 | `/command` | W/D | 中 |
| ST-P02-02 | 作为用户，任一卡片失败时该模块局部降级显示"暂不可用"，不阻塞其他模块 | P0 | 全部 | `/command` | W/D | 中 |
| ST-P02-03 | 作为用户，数据陈旧时 KPI 显示采样时间而非最新值 | P0 | 全部 | `/command` | W/D | 中 |
| ST-P02-04 | 作为用户，我从卡片跳转对应详情页，快捷入口"发起研究/创建策略草稿"按权限显隐 | P0 | 全部 | `/command` | W/D | 中 |
| ST-P02-05 | 作为用户，聚合视图实时增量更新；桌面端高优先级待办可弹系统通知，Web 用已授权浏览器通知 | P1 | 全部 | `/command` | W/D | 中 |

#### P03 Research 列表与新建

| Story ID | Story | 优先级 | 角色 | 路由 | 平台 | 风险 |
|---|---|---|---|---|---|---|
| ST-P03-01 | 作为研究员，我在 ResearchDataGrid 按状态/Engine/快照/时间筛选、排序、服务端分页，筛选与 URL 同步 | P0 | 研、开 | `/research` | W/D | 中 |
| ST-P03-02 | 作为研究员，我经三步 Composer（问题与范围→快照/Engine→审核启动）创建任务，Zod 校验后提交并携带 Idempotency-Key | P0 | 研、开 | `/research/new` | W/D | 中 |
| ST-P03-03 | 作为用户，我只能选择已批准且健康的 Engine capability；不健康、超预算、无快照或过期数据均阻止提交并原位显示原因 | P0 | 研、开 | `/research/new` | W/D | 中 |
| ST-P03-04 | 作为用户，提交收到 202+runId 后跳转详情页，不把受理态显示为完成 | P0 | 研、开 | `/research/new` | W/D | 中 |
| ST-P03-05 | 作为用户，我取消未完成任务；复制为新任务/保存模板/受权导出摘要 | P1 | 研、开 | `/research` | W/D | 中 |
| ST-P03-06 | 作为桌面端用户，本地文件仅作为"附件候选"经上传/扫描生成 Artifact 后使用；Web 走浏览器文件选择器，规则相同 | P1 | 研、开 | `/research/new` | W/D | 中 |

#### P04 Research 与 Artifact 详情

| Story ID | Story | 优先级 | 角色 | 路由 | 平台 | 风险 |
|---|---|---|---|---|---|---|
| ST-P04-01 | 作为用户，我通过 SSE 查看流式事件，按 sequence 去重，断线从 last_event_id 回补 | P0 | 资源级 | `/research/:runId` | W/D | 中 |
| ST-P04-02 | 作为用户，我请求取消任务，UI 维持"正在取消"直至服务端确认终态（cancel_requested→Cancelled） | P0 | 资源级 | `/research/:runId` | W/D | 中 |
| ST-P04-03 | 作为用户，EvidencePanel 固定显示数据快照、Engine/模型版本、输入 hash、成本与 correlation ID，可跳快照/Audit | P0 | 资源级 | `/research/:runId` | W/D | 中 |
| ST-P04-04 | 作为用户，我查看 Artifact 的假设、输入、版本、环境 hash、血缘与证据引用，并可从完成研究创建策略草稿 | P0 | 资源级 | `/artifacts/:artifactId` | W/D | 中 |
| ST-P04-05 | 作为用户，敏感日志经 BFF 脱敏；离线仅显示加密缓存的最终摘要与非敏感 Artifact，取消/导出禁用 | P0 | 资源级 | `/research/:runId` | W/D | 中 |

#### P05 数据快照目录与详情

| Story ID | Story | 优先级 | 角色 | 路由 | 平台 | 风险 |
|---|---|---|---|---|---|---|
| ST-P05-01 | 作为研究员，我在目录中搜索/筛选快照并查看来源、时间窗、质量、许可、schema、hash | P0 | 研、开、风 | `/data-snapshots` | W/D | 中 |
| ST-P05-02 | 作为用户，详情页展示 QualityScoreCard、时间窗、字段 schema、血缘时间线与许可证标识 | P0 | 研、开、风 | `/data-snapshots/:snapshotId` | W/D | 中 |
| ST-P05-03 | 作为用户，质量受限（failed/degraded/expired/license missing）的快照被明确阻断用于策略/交易流程；质量状态由服务端返回前端不可覆盖 | P0 | 研、开、风 | `/data-snapshots/:snapshotId` | W/D | 高 |
| ST-P05-04 | 作为用户，未授权许可证数据仅显示最小元数据，不泄露内容 | P0 | 全部 | `/data-snapshots/:snapshotId` | W/D | 中 |
| ST-P05-05 | 作为用户，我复制快照引用、在允许时将其作为新研究/回测输入；可对比两个快照、订阅质量告警 | P1 | 研、开 | `/data-snapshots` | W/D | 低 |

#### P06 Strategy 目录与 Lab

| Story ID | Story | 优先级 | 角色 | 路由 | 平台 | 风险 |
|---|---|---|---|---|---|---|
| ST-P06-01 | 作为量化开发，我在目录（卡片/表格切换）浏览策略并进入 Lab | P0 | 开 | `/strategies` | W/D | 中 |
| ST-P06-02 | 作为量化开发，我在 Lab 三栏（FileTree/版本、CodeEditor+参数表单、ValidationPanel/实验队列）编辑草稿，自动保存携带版本 | P0 | 开 | `/strategies/:strategyId/lab` | W/D | 中 |
| ST-P06-03 | 作为用户，保存遇 409 时保留我的草稿并展示 diff，绝不自动覆盖服务端版本 | P0 | 开 | `/strategies/:strategyId/lab` | W/D | 高 |
| ST-P06-04 | 作为量化开发，我运行静态检查并查看 look-ahead/依赖/数据快照等阻断原因 | P0 | 开 | `/strategies/:strategyId/lab` | W/D | 中 |
| ST-P06-05 | 作为量化开发，我从研究 Artifact 建立引用、比较实验、发起回测 | P0 | 开 | `/strategies/:strategyId/lab` | W/D | 中 |
| ST-P06-06 | 作为桌面端用户，策略草稿本地导入/导出经受控通道；Web 仅服务器侧版本与受权下载 | P1 | 开 | `/strategies/:strategyId/lab` | W/D | 中 |

#### P07 Backtest 详情与 Strategy Release

| Story ID | Story | 优先级 | 角色 | 路由 | 平台 | 风险 |
|---|---|---|---|---|---|---|
| ST-P07-01 | 作为用户，我查看回测指标摘要、权益曲线、回撤、成交/成本分析与数据质量/验证结果 | P0 | 开、风 | `/backtests/:runId` | W/D | 中 |
| ST-P07-02 | 作为量化开发，我仅能以通过验证的输入创建不可变 Release，BFF 返回 hash；泄漏检查失败阻断 | P0 | 开 | `/releases` | W/D | 高 |
| ST-P07-03 | 作为用户，Release 页显示版本/hash/参数/快照/回测与 ApprovalTimeline，审批拒绝后保持可审计不可部署 | P0 | 开、风 | `/releases/:releaseId` | W/D | 高 |
| ST-P07-04 | 作为量化开发，部署目标完全取自服务端 `allowedTargets`；M3/M4 仅 Paper/Shadow，Assisted Live 不显示 | P0 | 开 | `/releases/:releaseId` | W/D | 高 |
| ST-P07-05 | 作为量化开发，我提交审批并可回滚到旧发布物；任何 409/版本变化退回复核 | P0 | 开 | `/releases/:releaseId` | W/D | 高 |

#### P08 Portfolio 与 Risk

| Story ID | Story | 优先级 | 角色 | 路由 | 平台 | 风险 |
|---|---|---|---|---|---|---|
| ST-P08-01 | 作为交易员，我查看账户上下文、KPI、权益/P&L 图、仓位 DataGrid 与敞口热图，全部数值带 as_of | P0 | 交、风 | `/portfolio` | W/D | 高 |
| ST-P08-02 | 作为用户，读模型滞后时页面标记"延迟/陈旧"并禁止以该数据执行命令 | P0 | 交、风 | `/portfolio`、`/risk` | W/D | 高 |
| ST-P08-03 | 作为风控，我查看风险预算仪表、规则命中时间线、集中度/杠杆图与规则详情抽屉 | P0 | 风 | `/risk`、`/risk/rules/:ruleId` | W/D | 高 |
| ST-P08-04 | 作为授权风控，我经 DangerConfirm+MFA+服务端签名触发 kill switch，触发后全局实时广播并拒绝新交易命令 | P0 | 风 | `/risk` | W/D | 高 |
| ST-P08-05 | 作为用户，我从风险事件跳转 Proposal/Order/Audit；可保存视图、下载受控报告 | P1 | 交、风 | `/portfolio`、`/risk` | W/D | 中 |

#### P09 TradeProposal 列表与详情

| Story ID | Story | 优先级 | 角色 | 路由 | 平台 | 风险 |
|---|---|---|---|---|---|---|
| ST-P09-01 | 作为交易员，我按状态/有效期/标的筛选建议列表 | P0 | 交、风 | `/proposals` | W/D | 高 |
| ST-P09-02 | 作为用户，详情页顶部常驻 NonExecutableBanner"这是交易建议，不是订单"，任何情况下无下单按钮 | P0 | 交、风、审 | `/proposals/:proposalId` | W/D | 高 |
| ST-P09-03 | 作为交易员，我请求风险评估，请求携带 proposal/version/context hash；过期、数据陈旧、策略未发布、无权限时服务端拒绝并原位展示 | P0 | 交 | `/proposals/:proposalId` | W/D | 高 |
| ST-P09-04 | 作为用户，我查看建议、Signal、论证、反方观点、失效时间与证据，并跳转 RiskDecision/Audit | P0 | 交、风 | `/proposals/:proposalId` | W/D | 高 |
| ST-P09-05 | 作为用户，详情实时订阅状态变化；可标注、订阅到期提醒、复制安全链接 | P1 | 交、风 | `/proposals/:proposalId` | W/D | 中 |

#### P10 Approvals 与 RiskDecision 详情

| Story ID | Story | 优先级 | 角色 | 路由 | 平台 | 风险 |
|---|---|---|---|---|---|---|
| ST-P10-01 | 作为审批人，我按严重性/过期时间排序查看待办列表 | P0 | 风 | `/approvals` | W/D | 高 |
| ST-P10-02 | 作为审批人，详情展示 RiskDecisionCard、规则命中/限额/组合影响与建议证据 | P0 | 风 | `/approvals/:approvalId` | W/D | 高 |
| ST-P10-03 | 作为审批人，我执行批准/拒绝/需要更多信息，经 MFA 签名；拒绝理由写入审计 | P0 | 风 | `/approvals/:approvalId` | W/D | 高 |
| ST-P10-04 | 作为系统，禁止审批本人发起对象；操作前重新拉取 Decision 状态与有效期；并发审批、过期、kill switch、额度变化时强制刷新并禁用操作 | P0 | 风 | `/approvals/:approvalId` | W/D | 高 |
| ST-P10-05 | 作为审批人，我在策略允许时委派、批量只读比较、接收到期提醒 | P1 | 风 | `/approvals` | W/D | 中 |

#### P11 Orders 与执行详情

| Story ID | Story | 优先级 | 角色 | 路由 | 平台 | 风险 |
|---|---|---|---|---|---|---|
| ST-P11-01 | 作为交易员，我按账户/模式/状态/标的/时间筛选订单列表 | P0 | 交、运、风 | `/orders` | W/D | 高 |
| ST-P11-02 | 作为用户，详情展示状态机时间线、Order/Fill 表、命令摘要、venue 健康与关联 Proposal/RiskDecision/Release | P0 | 交、运、风 | `/orders/:orderId` | W/D | 高 |
| ST-P11-03 | 作为交易员，我对有权且可撤订单发起撤单请求，仅发送服务端验证过的 command ref+Idempotency-Key；重复提交只产生一笔下游订单 | P0 | 交 | `/orders/:orderId` | W/D | 高 |
| ST-P11-04 | 作为用户，订单事件按 sequence 更新去重，断流回补；venue 不健康/kill switch 显示原因且无绕过动作 | P0 | 交、运、风 | `/orders/:orderId` | W/D | 高 |
| ST-P11-05 | 作为用户，Paper/Shadow 语义横幅常驻；可导出受控订单报表、保存筛选 | P1 | 交 | `/orders` | W/D | 中 |

#### P12 Audit Explorer 与导出

| Story ID | Story | 优先级 | 角色 | 路由 | 平台 | 风险 |
|---|---|---|---|---|---|---|
| ST-P12-01 | 作为审计员，我以 correlation ID/领域对象检索，中央 EvidenceTimeline 依序展示完整证据链（5 分钟内可还原） | P0 | 审、管 | `/audit`、`/audit/:correlationId` | W/D | 高 |
| ST-P12-02 | 作为用户，原始事件按字段脱敏；无权对象在检索中不返回存在性 | P0 | 审、管 | `/audit` | W/D | 高 |
| ST-P12-03 | 作为授权用户，我创建异步受控导出，服务端生成、短时签名 URL、记录主体/范围/时间，可查看导出状态 | P0 | 审、管 | `/exports/:exportId` | W/D | 高 |
| ST-P12-04 | 作为用户，我从时间线跳转原对象；可固定筛选、复制引用、查看 redaction 摘要 | P1 | 审、管 | `/audit` | W/D | 中 |

#### P13 Operations 与 Incident

| Story ID | Story | 优先级 | 角色 | 路由 | 平台 | 风险 |
|---|---|---|---|---|---|---|
| ST-P13-01 | 作为运维，我查看服务健康条与 Engine/数据/队列/执行四组指标及告警列表 | P1 | 运、管 | `/operations` | W/D | 高 |
| ST-P13-02 | 作为运维，我在 Incident 详情查看时间线、影响范围、Runbook 与操作记录 | P1 | 运、管 | `/operations/incidents/:incidentId` | W/D | 高 |
| ST-P13-03 | 作为运维，我只能按已批准 Runbook actionId 发起受控重试/重启请求；UI 无任意命令/脚本入口 | P1 | 运、管 | `/operations/incidents/:incidentId` | W/D | 高 |
| ST-P13-04 | 作为运维，服务健康降级实时广播，交易相关限制同步到 Command/Orders | P1 | 运、管 | `/operations` | W/D | 高 |

#### P14 Admin 治理

| Story ID | Story | 优先级 | 角色 | 路由 | 平台 | 风险 |
|---|---|---|---|---|---|---|
| ST-P14-01 | 作为管理员，我邀请/停用成员、分配角色；禁止删除最后一个管理员 | P1 | 管 | `/admin/members` | W/D | 高 |
| ST-P14-02 | 作为管理员，我查看/提交受控策略与限额变更；高风险配置按策略走双人审批/MFA | P1 | 管 | `/admin/policies` | W/D | 高 |
| ST-P14-03 | 作为管理员，我批准已签名审核的 Engine/插件能力；未批准能力不可用于工作流 | P1 | 管 | `/admin/capabilities` | W/D | 高 |
| ST-P14-04 | 作为管理员，我灰度 feature flag；开关不会自动授予实盘权限 | P1 | 管 | `/admin/flags` | W/D | 高 |
| ST-P14-05 | 作为管理员，所有变更生成版本、审计与生效时间；一期仅 Primary workspace，无创建/切换 | P1 | 管 | `/admin/*` | W/D | 高 |

#### P15 Profile、安全与通知设置

| Story ID | Story | 优先级 | 角色 | 路由 | 平台 | 风险 |
|---|---|---|---|---|---|---|
| ST-P15-01 | 作为用户，我修改个人资料、语言/时区/主题，不影响领域权限或交易风险规则 | P0 | 全部 | `/settings/profile` | W/D | 低 |
| ST-P15-02 | 作为用户，我按告警严重性/渠道配置通知矩阵；浏览器通知须经用户手势申请，拒绝后不循环弹窗 | P0 | 全部 | `/settings/notifications` | W/D | 中 |
| ST-P15-03 | 作为用户，我查看/移除会话与可信设备、设置 MFA；安全变更需近期登录并写审计，保护最后一个有效因素 | P0 | 全部 | `/settings/security` | W/D | 高 |

#### P16 Desktop Control Center

| Story ID | Story | 优先级 | 角色 | 路由 | 平台 | 风险 |
|---|---|---|---|---|---|---|
| ST-P16-01 | 作为桌面端用户，我管理通知、窗口/显示器、布局恢复，均通过 Tauri adapter 的 capability 状态驱动 | P1 | 全部 | `/settings/desktop` | DT | 中 |
| ST-P16-02 | 作为桌面端用户，我管理受控文件访问与加密离线只读缓存；清除缓存需确认；本地文件必须先上传/扫描/生成 Artifact | P1 | 全部 | `/settings/desktop` | DT | 高 |
| ST-P16-03 | 作为桌面端用户，我检查/应用签名更新，更新验证签名后安装；可生成不含秘密的诊断包 | P1 | 全部 | `/settings/desktop` | DT | 高 |
| ST-P16-04 | 作为 Web 用户，访问该路由显示受限说明与桌面端下载链接 | P1 | 全部 | `/settings/desktop` | Web | 低 |

#### P17 Web Browser Capability

| Story ID | Story | 优先级 | 角色 | 路由 | 平台 | 风险 |
|---|---|---|---|---|---|---|
| ST-P17-01 | 作为 Web 用户，我查看浏览器通知/下载/存储/深链权限状态并申请或撤回授权；API 不可用时降级为页面内通知 | P1 | 全部 | `/settings/browser` | Web | 低 |
| ST-P17-02 | 作为 Web 用户，我查看已授权下载记录、复制受权深链（链接不含数据，接收者需重新登录鉴权） | P1 | 全部 | `/settings/browser` | Web | 中 |
| ST-P17-03 | 作为 Web 用户，我查看响应式与兼容性说明：小屏仅只读、业务页 `noindex`；桌面端不显示此入口 | P1 | 全部 | `/settings/browser` | Web | 低 |

#### P18 Markets 总览与标的详情

| Story ID | Story | 优先级 | 角色 | 路由 | 平台 | 风险 |
|---|---|---|---|---|---|---|
| ST-P18-01 | 作为用户，我用 WatchlistPanel（自选/最近/搜索）与 MarketGrid 浏览授权标的，每行含最新价、24h 变化、成交量、价差与数据状态 | P0 | 全部 | `/markets` | W/D | 中 |
| ST-P18-02 | 作为用户，标的详情 InstrumentHeader 显示规范化 symbol、计价货币、as_of、数据许可证与交易状态 | P0 | 全部 | `/markets/:symbol` | W/D | 中 |
| ST-P18-03 | 作为用户，VenueQuoteTable 逐 venue 展示 bid/ask、费用/滑点估算、lot size、健康与更新时间；每行有 source/as_of/延迟/质量；不同 lot/币种/产品不前端合并 | P0 | 全部 | `/markets/:symbol` | W/D | 高 |
| ST-P18-04 | 作为用户，我跳转 K 线或打开预填标的的 Trade Ticket；报价仅信息参考，不声称最优执行 | P0 | 全部 | `/markets/:symbol` | W/D | 中 |
| ST-P18-05 | 作为用户，我保存筛选/列布局、订阅价格与数据陈旧告警；自选仅为偏好不形成交易信号 | P1 | 全部 | `/markets` | W/D | 低 |

#### P19 K 线与市场分析

| Story ID | Story | 优先级 | 角色 | 路由 | 平台 | 风险 |
|---|---|---|---|---|---|---|
| ST-P19-01 | 作为用户，我在 ChartContextBar 选择 symbol/venue/产品/时区/质量/范围与 1m–1W 及自定义周期 | P0 | 全部 | `/markets/:symbol/chart` | W/D | 中 |
| ST-P19-02 | 作为用户，我查看 CandlestickChart+成交量、受控内置指标与订单/成交事件标记、OHLCVTable 与数据缺口列表 | P0 | 全部 | `/markets/:symbol/chart` | W/D | 中 |
| ST-P19-03 | 作为用户，查询返回完整 series 元数据（venue/产品/interval/timezone/source/quality/as_of）；断流后图表固定在最后确认时间 | P0 | 全部 | `/markets/:symbol/chart` | W/D | 高 |
| ST-P19-04 | 作为用户，切换 venue 或产品时清除旧 series，防止跨市场拼接；数据缺口/质量受限时明确提示 | P0 | 全部 | `/markets/:symbol/chart` | W/D | 高 |
| ST-P19-05 | 作为用户，我从选定 candle 打开 Trade Ticket（仅预填上下文，图表点击不是下单动作）；可保存视图、受控导出数据片段 | P1 | 全部 | `/markets/:symbol/chart` | W/D | 中 |

#### P20 Trade Ticket 受控下单

| Story ID | Story | 优先级 | 角色 | 路由 | 平台 | 风险 |
|---|---|---|---|---|---|---|
| ST-P20-01 | 作为交易员，OrderForm 字段（账户/方向/类型/数量/价格/有效期/reduce-only 等）完全由服务端 capability 定义；进入页面不创建订单不授予权限 | P0 | 交 | `/trade`、`/trade/:symbol` | W/D | 高 |
| ST-P20-02 | 作为交易员，VenueSelector 仅显示服务端返回的已连接/已授权/健康且支持当前标的类型的 venue；单一 venue 时锁定并说明 | P0 | 交 | `/trade` | W/D | 高 |
| ST-P20-03 | 作为交易员，ExecutionContext 展示所选 venue 报价、深度摘要、费用/滑点/名义估算（标注估算）与最小单位 | P0 | 交 | `/trade` | W/D | 高 |
| ST-P20-04 | 作为交易员，PreTradeCheck 展示数据时效、余额/仓位、限额影响与关联 Proposal/Strategy/证据 | P0 | 交 | `/trade` | W/D | 高 |
| ST-P20-05 | 作为交易员，我严格按 风险评估→（需要时）审批→提交已批准 command ref 时序操作；每步前重新拉取报价/余额/限额/venue 健康/对象版本/mode，任何变化回到对应步骤 | P0 | 交 | `/trade` | W/D | 高 |
| ST-P20-06 | 作为系统，离线、数据陈旧、kill switch、venue 不健康或无可用 venue 时全部提交入口禁用并解释原因；客户端不计算"可下单"、不生成 command、不持有密钥、不乐观显示成交 | P0 | 交 | `/trade` | W/D | 高 |
| ST-P20-07 | 作为交易员，我从 Markets/K线/Portfolio/有效 Proposal 预填上下文；Proposal 只能预填/关联，不能绕过风险链路 | P0 | 交 | `/trade/:symbol` | W/D | 高 |

#### P21 Performance 与报表

| Story ID | Story | 优先级 | 角色 | 路由 | 平台 | 风险 |
|---|---|---|---|---|---|---|
| ST-P21-01 | 作为交易员，我在 PerformanceContextBar 选择账户/基准货币/估值方法/时区/范围，查看 P&L、收益率、回撤、费用 KPI 与权益曲线、归因 | P1 | 交、风 | `/performance` | W/D | 中 |
| ST-P21-02 | 作为用户，所有结果显示计算方法、账本版本、估值快照与覆盖区间；未对账或估值陈旧的值醒目标为 provisional，不混入已确认总计 | P1 | 交、风 | `/performance` | W/D | 高 |
| ST-P21-03 | 作为用户，我用 ReportBuilder 按周/月/季/年生成异步版本化报表，固定口径/账本版本/估值快照/生成时间；回补修正后旧报表标注 superseded | P1 | 交、风 | `/performance/reports/:reportId` | W/D | 中 |
| ST-P21-04 | 作为用户，我从图表/报表跳转订单、成交、估值快照、对账与审计；报表短时授权下载并留审计 | P1 | 交、风 | `/performance` | W/D | 中 |

#### P22 Reconciliation 与账本

| Story ID | Story | 优先级 | 角色 | 路由 | 平台 | 风险 |
|---|---|---|---|---|---|---|
| ST-P22-01 | 作为交易员，我查看账户/venue/账本区间上下文与 ReconciliationSummary（matched/待调查/已解决/缺失） | P0 | 交、风、运 | `/reconciliation` | W/D | 高 |
| ST-P22-02 | 作为用户，BreakGrid 展示内部/外部数量、价格、费用、时间与差异原因，详情含关联 Order/Fill、脱敏回报与处置时间线 | P0 | 交、风、运 | `/reconciliation/:runId` | W/D | 高 |
| ST-P22-03 | 作为授权运维，我只可按 Runbook 请求受控重新对账或标记调查说明；UI 无手工修改余额/成交入口 | P0 | 运 | `/reconciliation/:runId` | W/D | 高 |
| ST-P22-04 | 作为用户，待调查差异实时推送 Alerts 并使 Performance 相关数值标为 provisional；修正记录主体/原因/证据/correlation ID | P0 | 交、风 | `/reconciliation/:runId` | W/D | 高 |

#### P23 Alerts 收件箱与处置

| Story ID | Story | 优先级 | 角色 | 路由 | 平台 | 风险 |
|---|---|---|---|---|---|---|
| ST-P23-01 | 作为用户，收件箱按严重性/未确认/领域/账户/venue 筛选，AlertFeed 显示摘要、时间、数据新鲜度与关联对象；仅见授权事件 | P1 | 全部 | `/alerts` | W/D | 中 |
| ST-P23-02 | 作为用户，我确认/取消确认告警（策略允许时）；确认仅代表已读不代表解决，确认行为可审计 | P1 | 全部 | `/alerts/:alertId` | W/D | 中 |
| ST-P23-03 | 作为用户，详情展示影响、建议下一步、确认记录、订阅规则与 Audit 链接；收件箱内无绕过风控的修复/交易动作 | P1 | 全部 | `/alerts/:alertId` | W/D | 高 |
| ST-P23-04 | 作为用户，BFF 对事件授权/去重/限速；重大风险、kill switch、订单拒绝、对账差异、报表完成保留关联 ID；离线显示最后同步时间并禁止确认写操作 | P1 | 全部 | `/alerts` | W/D | 中 |

## 4. 关键流程 Story（跨页面）

| Story ID | Story | 涉及页面 | 优先级 | 风险 |
|---|---|---|---|---|
| ST-FLOW-01 | 研究闭环：选快照→创建研究（幂等）→202 受理→SSE 流式（去重/回补）→取消受理→服务端终态→Artifact/Evidence→跳 Audit；全程无订单入口 | P03/P04/P05/P12 | P0 | 高 |
| ST-FLOW-02 | 策略发布：草稿+objectVersion→expectedVersion 保存→静态检查→固定快照回测→校验报告→不可变 Release→allowedTargets→提交审批→审批通过才显示 Paper/Shadow 部署 | P06/P07/P10 | P0 | 高 |
| ST-FLOW-03 | 建议到订单：Proposal（不可执行）→刷新 proposal/snapshot/quote/account/venue/mode→RiskDecision→deny 终止 / approval_required 走 MFA 审批（禁自批）→服务端签发短时 TradeCommand→仅传 command ref+幂等键→Execution Gateway 再校验→订阅 Order/Fill 事实 | P09/P10/P20/P11 | P0 | 高 |
| ST-FLOW-04 | 高风险动作统一流程：对象摘要+影响+有效期+证据→明确动词按钮→重新获取版本与可操作性→MFA→服务端最终校验+审计→展示服务端结果与 correlation ID | P08/P10/P11/P14/P20/P22 | P0 | 高 |
| ST-FLOW-05 | 审计回溯：任一订单/策略/研究/审批/告警"查看证据链"→Audit Explorer 按 correlation ID ≤5 分钟还原全链路 | P12 及全部领域页 | P0 | 高 |
| ST-FLOW-06 | 对账差异联动：注入差异→Orders/Performance/Alerts/Audit 一致显示 provisional/Investigating；无改账入口 | P11/P21/P22/P23/P12 | P0 | 高 |
| ST-FLOW-07 | 离线安全：断网后 Web/Desktop 全部写操作禁用；桌面仅加密非敏感只读缓存；恢复后不自动提交旧意图 | 全局 | P0 | 高 |
| ST-FLOW-08 | 认证与恢复：OIDC 登录→MFA→会话失效→重认证→安全 return path；401 清内存态；403/404 不泄露存在性 | P01/GS | P0 | 高 |

## 5. 台账追踪性

每行页面均可按 `页面 ID → 前端任务（UI-1xx–6xx / UI-P01–P23）→ 契约（C01–C17）→ BFF 任务（BFF-FE-000–011）→ 后端计划（F/R/S/X/L）→ 测试用例（验收场景表）→ Gate（G0–G8）` 追踪，满足 G0 条件"页面台账能追踪到 页面 → 前端任务 → BFF 契约 → 后端计划任务 → 测试用例 → Gate"。映射明细见验收场景表第 4 节。
