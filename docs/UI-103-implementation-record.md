# UI-103 实施记录

> 阶段：FEP-1（W3–W4）  状态：UI Complete / Storybook Verified  日期：2026-08-15

## 需求拆解与交付

| UI-103 要求 | 可运行交付 | 质量证据 |
|---|---|---|
| QuantOS UI | `Button`、`InlineAlert`、`StateBadge`、`DataGrid`、`EvidenceTimeline`、`DangerConfirmDialog` | UI unit 7/7；Storybook 静态构建通过 |
| domain-ui | `DataFreshnessIndicator`、`RiskPostureBadge`、`ConnectionStatusBar` | domain-ui unit 16/16；未知风险枚举 fail closed |
| 主题 | `ThemeProvider` 将冻结 token 映射为 `--q-*` 语义变量；支持 dark/light | 双主题 Story、WCAG token 对比度检查通过 |
| i18n | `I18nProvider`、`translate`、zh-CN/en 安全文案回退 | 19 个双语 key 集合一致，18 条 safety 文案齐备 |
| 表格 | 服务端过滤/排序/分页回调、URL 同步、固定/显示列、虚拟滚动、`aria-sort`、数值等宽、完整状态矩阵 | 默认与七态、高级控制、1,000 行虚拟化 Story；错误态包含读屏 alert 与 correlation ID |
| 时间线 | 时间、actor、event、state、correlation ID、可展开证据 | `<ol>`/`<time>`/`<details>` 语义与七态 Story |
| 危险确认 | 摘要、影响、不可逆警告、确认短语、可选 MFA、最终服务端校验提示、correlation ID | 初始焦点为取消；确认非默认焦点；pending 防重复；短语/MFA 门槛 unit + 浏览器通过 |
| 多端适配 | 1440 完整、768 折叠、390 只读宽度、200% 缩放基线 | 三断点无页面级横向溢出；390 宽表仅组件内滚动；200% Story 无页面溢出 |

## Storybook 状态规范

- 全局工具栏提供 dark/light 与 zh-CN/en 切换。
- 数据容器覆盖 default/loading/empty/error/unauthorized/stale/offline；不适用的 danger-confirm 状态在 Story 中明确说明职责边界。
- domain-ui 原子指标覆盖其有效状态；由父级容器承担的状态在各自 Story 文档中标注 N/A 原因。
- fixture 只位于 `packages/ui/src/fixtures/ui103.tsx`，生产组件不包含业务硬编码数据。
- 视口基线：1440、1280、768、390；另提供 `DataGrid/Zoom200` 回流故事。

## 浏览器与无障碍验收

- Storybook axe：UI-103 所有组件默认 Story 均为 `0 Violations`；打开后的危险确认框为 `0 Violations / 11 Passes / 0 Incomplete`。
- DataGrid 默认 Story 为 `0 Violations / 25 Passes`；表格、排序列、分页、状态与错误关联 ID 均出现在无障碍树中。
- DataGrid 高级控制 Story 为 `0 Violations`；过滤值同步到 `orders.filter.symbol`，列选择器包含 6 列，首列固定在 `left: 0`。
- 1,000 行虚拟化基线仅渲染 17 个 body row（含 overscan/占位），可滚动高度 32,083px，视口高度 320px。
- 危险确认打开后 `document.activeElement` 为“取消”；精确短语输入前确认按钮 disabled，MFA 场景在六位验证码前保持 disabled；Escape 关闭并恢复流程。
- 390px：页面无横向溢出，表格容器 `clientWidth=324`、`scrollWidth=654`，滚动限制在组件内部；时间线切换为单列。
- 768px 与 1440px：页面无横向溢出；200% Story 的 computed zoom 为 `2`，页面无横向溢出且宽表内部可滚动。

## 时间节点与边界

- W3：主题/i18n、通用反馈原语、Storybook 全局装饰器完成。
- W4：DataGrid、EvidenceTimeline、DangerConfirmDialog、domain-ui 指标、状态故事、单测和多端/无障碍验收完成。
- UI-103 不接业务接口；真实 server pagination/filter/sort、危险动作最终校验与 MFA 提交由后续页面任务通过组件回调和冻结契约接入。
