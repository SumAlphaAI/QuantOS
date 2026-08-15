# UI-101 实施记录

> 阶段：FEP-1（W3–W4）  状态：UI Complete / Mocked  日期：2026-08-14

## 需求拆解与交付映射

| UI-101 要求 | 实现 | 验证 |
|---|---|---|
| App Shell 与导航 | Terminal 顶栏、capability 裁剪侧栏、底部连接状态栏；`/command` 共享 Web/Tauri 静态产物 | Next.js production build；ACC-GS-S1 |
| 严格路由守卫 | `CommandRuntimeSource → runRouteGuard → loadProjection` 在 Terminal 运行时按 `session → tenant/workspace → RBAC/capability → resource → mode → data` 串行执行；未全部 allow 前不加载页面投影 | domain-ui 12 tests + Terminal runtime 4 tests + 静态首屏 E2E |
| 主上下文与全局状态 | 主工作区只读、账户、Paper Mode、数据新鲜度、风险、连接/实时、最后同步时间常驻；新鲜度、风险、连接状态复用 UI-103 `DataFreshnessIndicator`、`RiskPostureBadge`、`ConnectionStatusBar` | 桌面 1440、折叠布局、移动 390 浏览器验证；领域组件语义 E2E |
| P02 界面原型 | 按 P02 高保真稿实现 Priority、Health、KPI、Activity、Quick Start；投影类型位于 `src/command/model.ts`，Contract Mock fixture 位于 `src/command/fixture.ts`，页面不再声明业务 mock | Command Center E2E + 浏览器实际渲染 |
| 多端安全适配 | ≥1280 完整工作区；768–1279 折叠侧栏/单列详情；<768 只读监控且隐藏高风险入口；离线禁写且不自动提交旧意图 | CSS breakpoint + `writesAllowed` 单测 |
| 可访问性 | 语义 heading/nav/main/footer、按钮标签、状态文字+颜色、可见焦点、reduced motion、横向表格滚动 | Playwright axe，无 critical/serious |

## 时间节点与质量状态

- W3：需求/契约/守卫顺序冻结，App Shell 与 P02 原型完成。
- W4：交互、多端适配、unit/E2E/axe/build 验证完成；2026-08-15 完成交付核查整改，进入 BFF-FE-002 联调等待。
- 当前 C02/GAP-02 仍为 Open，因此页面为 `UI Complete / Mocked`，不得标记 `Integrated/Done`。示例投影只服务 local/mock 与视觉验收；生产联调时必须替换为版本化 OpenAPI 生成 client + 同 schema MSW。

## G1 尚待外部依赖

1. BFF-FE-002 发布 `getCommandSummary` 与授权聚合模型，回填 operationId、错误 envelope、`sampledAt/asOf` 和 realtime projection。
2. C16 告警实时订阅契约冻结后，接入游标续传、去重、权限撤销断开。
3. staging provider/consumer contract、真实 RBAC 负向测试与设计 1440 视觉签署完成后，方可由 `Mocked` 晋级 `Integrated/Done`。

## 2026-08-15 交付核查整改

1. 已确认并修复运行时守卫未接线：静态首屏只渲染 `data-guard-state="checking"`，六步通过后才挂载带 `data-smoke="route-/command"` 的业务页面；RBAC deny 与未知 mode 测试证明后续检查和 `loadProjection` 均不执行。
2. 已确认并修复页内硬编码投影：C01 会话部分直接使用 OpenAPI 生成 `SessionContext`，C02 未冻结字段集中于独立 model/fixture/runtime source；页面明确显示 `C02 Runtime Guard Mocked`。
3. 已确认并修复 UI-103 组件未复用：顶部 freshness/risk 与底部 connection 全部使用 domain-ui 导出组件，未知 risk 继续 fail closed。
4. 浏览器复验额外发现并修复 390px 页面级横向溢出：最终 `document.scrollWidth=390`，Activity `364/720` 与 Health `364/620` 的横向滚动限制在组件内部；高风险入口可见数为 0。
5. Chromium Command E2E 7/7 通过，axe 无 serious/critical；1440 深色视觉基线已按经审查布局更新。
