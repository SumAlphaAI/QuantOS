# PRE-02 产出物：组件清单

> 任务：PRE-02 设计系统预研  版本：1.1  日期：2026-09-16
> 依据：设计规格 3.1/3.2/4/7.1 节；执行计划 2、7.3 节；[组件状态基准](./PRE-01-acceptance-scenarios.md) 七态定义
> 归属规则：`packages/ui` = 无领域语义的通用组件；`packages/domain-ui` = 含领域语义组件。所有组件禁止硬编码 token 之外的色值/字号；领域组件必须覆盖八态（默认/加载/空/错误/无权/陈旧/离线/危险确认）。

统计口径：第 1 节为 19 个通用组件/组件族条目，第 2 节为 25 个领域组件族条目；斜杠分组是一条共同验收边界，不把分组内名称误报为已逐个实现。`pnpm check:pre02` 强制条目数和第 3 节关键约定不回退。

## 1. 通用组件（packages/ui）

| 组件 | 说明 | 状态覆盖要求 | 优先级 |
|---|---|---|---|
| AppShell | 顶栏/侧栏/页面标题栏/底部状态栏骨架 | 响应式三断点；侧栏按权限显隐 | P0 |
| Button / IconButton | 含 danger 变体；点击即 pending | loading/disabled/danger | P0 |
| Badge / StateBadge | 状态标签：文字+图标+语义色+读屏标签 | 五域状态枚举 + unknown fallback | P0 |
| ModeBanner | 运行模式常驻横幅（research/paper/shadow/assistedLive） | 不可隐藏；模式色+文字 | P0 |
| DataGrid | 服务端分页/筛选/排序、列固定/显隐、虚拟滚动、URL 同步 | 加载/空/错误/无权骨架态 | P0 |
| EvidenceTimeline | 时间、主体、事件、状态、correlation ID；可展开 hash | 加载/空/错误 | P0 |
| Drawer（Evidence/Activity/Filter） | 不替代详情路由；关闭不丢草稿 | – | P1 |
| Dialog / DangerConfirmDialog | 危险确认：摘要+影响+不可逆+确认短语+MFA 位 | 默认不获焦；pending 防重复 | P0 |
| Toast / InlineAlert | 反馈；错误含 correlation ID 展示位 | – | P0 |
| Form 控件族 | Input/Select/Combobox/DateRange/Checkbox/Radio/Switch（Radix 封装） | focus ring 可见；错误字段级 | P0 |
| Skeleton / EmptyState | 骨架屏；"下一步+原因"空态 | – | P0 |
| Tabs / Breadcrumb / Pagination | 导航基础件 | 键盘可达 | P0 |
| Tooltip / Popover | 读屏友好 | – | P1 |
| KpiCard | 指标卡：数值+口径+as_of+provisional 标记位 | 加载/陈旧/provisional | P0 |
| CodeEditor（受控封装） | Lab 用；禁用任意脚本执行 | 只读模式 | P1 |
| Chart 容器 | ECharts/Lightweight Charts 统一装载与主题注入 | 加载/空/断流定格 | P0 |
| CandlestickChart | K 线+成交量+事件标记层 | 断流停最后确认时间 | P0 |
| AuthCard | 480px 居中认证卡 | 错误提示位 | P0 |
| SearchCommandPalette | ⌘K；仅授权结果 | 加载/空 | P1 |

## 2. 领域组件（packages/domain-ui）

| 组件 | 绑定页面 | 关键语义 | 优先级 |
|---|---|---|---|
| DataFreshnessIndicator | 全局/P02/P08 | as_of、stale；陈旧阻断写操作联动 | P0 |
| RiskPostureBadge | 全局/P02/P08 | 风险状态常驻 | P0 |
| ConnectionStatusBar | 全局 | 连接/延迟/降级；不混淆"已连接"与"数据新鲜" | P0 |
| PriorityQueue / HealthSummary / ActivityFeed | P02 | capability 裁剪；局部降级 | P0 |
| ResearchComposer（三步） | P03 | capability/快照/预算/deadline 校验 | P0 |
| RunTimeline / EvidencePanel | P04 | sequence 去重；hash/版本/correlation ID | P0 |
| ArtifactCard / SnapshotQualityCard / LineageTimeline | P04/P05 | 质量受限阻断标识 | P0 |
| StrategyFileTree / ValidationPanel / BacktestDrawer | P06 | 409 diff；阻断原因列表 | P0 |
| BacktestMetrics / EquityCurve / ReleaseCard / ApprovalTimeline / DeploymentTargetSelector | P07 | allowedTargets 服务端驱动 | P0 |
| PositionGrid / ExposureHeatmap / RiskRuleList / KillSwitchControl | P08 | DangerConfirm+MFA；全局广播 | P0 |
| NonExecutableBanner / ProposalCard / CounterViewList | P09 | `executable=false` 永久语义 | P0 |
| RiskDecisionCard / ApprovalActionBar / MfaChallenge | P10 | 禁自批；版本/有效期刷新 | P0 |
| OrderStateMachine / FillTable / CommandSummary / VenueHealthBadge | P11 | Paper/Shadow 横幅；幂等键只读 | P0 |
| AuditSearchBar / RedactedPayloadViewer / ExportJobDrawer | P12 | 脱敏；异步导出+短时 URL | P0 |
| ServiceHealthStrip / IncidentTimeline / RunbookActionList | P13 | 仅 actionId，无任意命令 | P1 |
| MemberGrid / PolicyVersionTimeline / CapabilityApprovalList / FlagRolloutControl | P14 | 最后管理员保护；双人审批 | P1 |
| NotificationMatrix / SessionDeviceList / MfaSetupPanel | P15 | 近期登录门槛 | P0 |
| PlatformCapabilityCard | P16/P17 | capability 状态驱动；Web/DT 互斥渲染 | P1 |
| WatchlistPanel / MarketGrid / InstrumentHeader / VenueQuoteTable | P18 | source/asOf/latency/quality 每行齐全 | P0 |
| ChartContextBar / IndicatorPanel / EventMarkers / OhlcvTable / GapList | P19 | 切维度清 series；缺口提示 | P0 |
| OrderForm / ExecutionContext / PreTradeCheck / VenueSelector / ModeBanner(Trade) | P20 | capability 驱动字段；单 venue 锁定；每步刷新 | P0 |
| PerformanceContextBar / AttributionChart / DrawdownChart / PeriodReturnTable / ReportBuilder | P21 | provisional 醒目；superseded 版本 | P1 |
| ReconciliationSummary / BreakGrid / BreakEvidenceDrawer | P22 | 无手工改账入口 | P0 |
| AlertFeed / AlertDetail / SubscriptionRuleEditor | P23 | ack≠resolved | P1 |
| MoneyText / DecimalText / AsOfText / ProvisionalTag / CorrelationIdChip / HashText | 全部 | 十进制定点；币种/精度/时区；复制 correlation ID | P0 |

## 3. Storybook 覆盖约定

1. 每个组件一个 `*.stories.tsx`；领域组件必须包含八态 story（默认/加载/空/错误/无权/陈旧/离线/危险确认，无危险动作的组件标注 `N/A` 理由）。
2. 每个 story 标注关联验收场景 ID（如 `// ACC-P08-S6`），与 PRE-01 场景表互查。
3. 示例数据只能来自 MSW fixture/本地 fixture，禁止硬编码进生产组件。
4. axe 面板严重/高等级问题为 0；键盘、焦点、200% 缩放、读屏标签逐组件验证。
5. 视觉基线：1280/1440、768、390 只读、深浅主题、关键危险状态。
