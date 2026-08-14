# UI-101 实施记录

> 阶段：FEP-1（W3–W4）  状态：UI Complete / Mocked  日期：2026-08-14

## 需求拆解与交付映射

| UI-101 要求 | 实现 | 验证 |
|---|---|---|
| App Shell 与导航 | Terminal 顶栏、capability 裁剪侧栏、底部连接状态栏；`/command` 共享 Web/Tauri 静态产物 | Next.js production build；ACC-GS-S1 |
| 严格路由守卫 | `session → tenant/workspace → RBAC/capability → resource → mode → data` 串行执行；deny、未知枚举、transport error 均 fail closed，失败后不调用后续检查 | `packages/domain-ui/tests/ui101.test.ts` |
| 主上下文与全局状态 | 主工作区只读、账户、Paper Mode、数据新鲜度、风险、连接/实时、最后同步时间常驻 | 桌面 1440、折叠布局、移动 390 浏览器验证 |
| P02 界面原型 | 按 P02 高保真稿实现 Priority、Health、KPI、Activity、Quick Start；筛选、刷新、侧栏折叠、反馈 toast 可交互 | Command Center E2E + 浏览器实际渲染 |
| 多端安全适配 | ≥1280 完整工作区；768–1279 折叠侧栏/单列详情；<768 只读监控且隐藏高风险入口；离线禁写且不自动提交旧意图 | CSS breakpoint + `writesAllowed` 单测 |
| 可访问性 | 语义 heading/nav/main/footer、按钮标签、状态文字+颜色、可见焦点、reduced motion、横向表格滚动 | Playwright axe，无 critical/serious |

## 时间节点与质量状态

- W3：需求/契约/守卫顺序冻结，App Shell 与 P02 原型完成。
- W4：交互、多端适配、unit/E2E/axe/build 验证完成；进入 BFF-FE-002 联调等待。
- 当前 C02/GAP-02 仍为 Open，因此页面为 `UI Complete / Mocked`，不得标记 `Integrated/Done`。示例投影只服务 local/mock 与视觉验收；生产联调时必须替换为版本化 OpenAPI 生成 client + 同 schema MSW。

## G1 尚待外部依赖

1. BFF-FE-002 发布 `getCommandSummary` 与授权聚合模型，回填 operationId、错误 envelope、`sampledAt/asOf` 和 realtime projection。
2. C16 告警实时订阅契约冻结后，接入游标续传、去重、权限撤销断开。
3. staging provider/consumer contract、真实 RBAC 负向测试与设计 1440 视觉签署完成后，方可由 `Mocked` 晋级 `Integrated/Done`。
