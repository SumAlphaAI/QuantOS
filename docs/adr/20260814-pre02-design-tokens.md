# ADR: QuantOS 设计系统 token 冻结（PRE-02）

- 状态：已冻结；仓库 Gate 于 2026-09-16 重验证通过（GPT-6 Astra 复审仍为 `NOT_STARTED`）
- 日期：2026-08-14
- 最近复核：2026-09-16
- 关联：PRE-02 设计系统预研；[设计规格 3.2/7 节](../SumAlpha-QuantOS-Terminal-Frontend-Design-Spec.md)；[执行计划第 2 节](../SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md)
- 事实来源：[`packages/ui/src/tokens/tokens.json`](../../packages/ui/src/tokens/tokens.json)

## 背景

FEP-0 必须在页面开发前冻结设计系统决策，避免逐页复制样式与状态口径漂移。token 集中管理于 `packages/ui`，Web 与 Desktop 共享；语义色不得挪作装饰色。任何变更须修订本 ADR 并重新通过 `packages/ui/scripts/pre02-checks.mjs`。

## 决策

### 1. 色彩与主题

- 双主题：dark（默认，机构级深色专业主题）与 light；主题仅为 token 切换，组件不得硬编码色值。
- 色板：surface 三级（页面/面板/浮层）、border 两级、text 四级（primary/secondary/disabled/inverse）、brand（蓝绿 #0F766E 系）、语义四色（success/warning/danger/info）。
- 语义约束：success 仅表示"已完成"；warning 表示"需关注"；danger 仅用于拒绝、故障、紧急停止；颜色必须配合图标和文字，不能单独传达含义。
- 运行模式色常驻且带文字：research=info 蓝、paper=success 绿、shadow=紫、assistedLive=danger 红（M5 前不开放）。
- WCAG 2.2 AA：正文/安全状态文案配对 ≥4.5:1，图表与焦点环非文本对比度 ≥3:1，由脚本强制校验（双主题 36/36 通过）。

### 2. 排版

- 正文 14px/20px，表格 13px/18px，页面标题 24px/32px/600。
- 金融数值一律 `tabular-nums` 等宽数字；ID、hash、correlation ID 使用 mono 字体。

### 3. 密度与间距

- 间距 4px 基栅（0–64 共 11 档）。
- 密度两档：compact（Terminal 默认：行高 32、控件 28、内边距 12）与 comfortable（官网固定：40/36/16）。密度是 token 切换，不改组件结构。

### 4. 断点与响应式

- ≥1280px 完整工作区；768–1279px 折叠侧栏 + 单列详情；<768px 只读监控，隐藏审批/下单/撤单/发布等全部高风险操作。
- 桌面端最小窗口 1180×760，无小屏只读档。

### 5. 状态枚举（冻结）

| 域 | 枚举 |
|---|---|
| 任务 | queued / running / succeeded / failed / cancelled |
| 风险 | allow / deny / approval_required |
| 订单 | draft / risk_checking / awaiting_approval / command_ready / submitted / accepted / partially_filled / filled / cancelled / rejected / expired |
| 行情 | live / delayed / stale / unavailable |
| 对账 | matched / investigating / resolved |

- 每个状态必须同时具备文字、图标、语义色与读屏标签；状态→语义色映射冻结于 tokens.json `stateColor`。
- 未知枚举统一显示"未知/需升级"（i18n key `state.unknown`）并阻断高风险动作，不得落入默认 allow。

### 6. 金融数值

- 数量/价格/比率使用 `DecimalValue.value` 字符串 + 十进制定点库格式化；金额使用 `MoneyValue{currencyCode, units, nanos}`；禁止先转 IEEE-754 number 再做交易计算。
- 展示必须包含币种、精度、时区与 `as_of`；P&L/收益率/估算值标注计算口径；provisional 值有醒目独立标识，不混入已确认总计。

### 7. 图表

- 风险/P&L/归因用 ECharts；OHLCV/K 线用 Lightweight Charts。
- 涨跌色 up=青 / down=红并配方向图标（不依赖红绿单独区分）；分类色板 8 色固定，深浅主题各一套。

### 8. 表格

- DataGrid：compact 密度、13/18 排版、列固定/显隐、服务端筛选/排序/分页、虚拟滚动、URL 同步；导出只走异步受控任务。

### 9. 危险动作模式

- 统一 `DangerConfirmDialog`：对象摘要 + 影响 + 不可逆提示 + 输入确认短语 + MFA（若适用）+ 服务端最终校验 + correlation ID 反馈。
- 危险按钮使用明确动词（"触发 Kill Switch""批准并签名"），每页仅一个主操作，危险操作永远不设默认焦点；点击后立即 pending 防重复提交。

### 10. i18n 与文案

- 通用安全文案 18 条全部入库：`packages/ui/src/i18n/{en,zh-CN}.json`，key 前缀 `safety.*`；页面仅替换变量，不得改写安全含义；Gate 强制 key 精确集合、规范中文原文、中英文非空与占位符一致。

## 后果

- 正向：token 单一事实来源；WCAG 与 i18n 完整性可 CI 强制；Storybook/视觉回归有统一基准。
- 约束：组件禁止硬编码色值/字号/状态文案；新语义色或新状态枚举必须走 ADR 修订。
- 验证：`pnpm check:pre02 && pnpm test:pre02`（token/状态、对比度、i18n、组件清单、Storybook 骨架及负向破坏回归）；已接入 Frontend Baseline CI。Storybook axe 面板是交互审查工具，其配置存在不等于全量页面 axe 验收完成。
