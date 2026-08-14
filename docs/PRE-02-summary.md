# PRE-02 执行总结与验收自检

> 任务：PRE-02 设计系统预研（FEP-0）  状态：已纳入 G0 联合评审
> 版本：1.0  日期：2026-08-14

## 1. 交付物

| 要求产出 | 交付 | 位置 |
|---|---|---|
| Design token ADR | 已冻结 10 项决策：色彩/主题、排版、密度、断点、状态枚举、金融数值、图表、表格、危险动作模式、i18n | [docs/adr/20260814-pre02-design-tokens.md](./adr/20260814-pre02-design-tokens.md) |
| token 事实来源 | tokens.json（双主题色板、状态枚举与 stateColor 映射、密度/断点/排版）+ 类型化导出 | [packages/ui/src/tokens/](../packages/ui/src/tokens/tokens.json) |
| 组件清单 | 18 通用（packages/ui）+ 28 领域（packages/domain-ui），含绑定页面、状态覆盖要求、Storybook 约定 | [docs/PRE-02-component-inventory.md](./PRE-02-component-inventory.md) |
| Storybook 骨架 | main/preview 配置（双主题、4 视口基线、axe 面板约定）+ StateBadge 基准组件与 7 个示例 story（含未知枚举 fail closed、浅主题、390 只读视口） | [packages/ui/.storybook/](../packages/ui/.storybook/main.ts)、[StateBadge](../packages/ui/src/components/StateBadge/StateBadge.stories.tsx) |
| 通用安全文案入 i18n | 设计规格 3.3 节 18 条全部入库（safety.*），中英文 key 集合一致 | [en.json](../packages/ui/src/i18n/en.json)、[zh-CN.json](../packages/ui/src/i18n/zh-CN.json) |
| 基础检查脚本 | WCAG 2.2 AA 对比度 + i18n 完整性校验，非零退出可入 CI | [pre02-checks.mjs](../packages/ui/scripts/pre02-checks.mjs)（`pnpm --filter @sumalpha/ui check:design`） |

## 2. 完成标准自检

| 完成标准（执行计划 3.1 节 PRE-02） | 结果 | 证据 |
|---|---|---|
| 固化 token | 达成 | tokens.json + ADR 第 1–4 节；组件禁止硬编码色值写入 ADR 后果约束 |
| 固化密度 | 达成 | compact（Terminal 默认 32/28/12）/ comfortable（官网 40/36/16）两档入 token |
| 固化断点 | 达成 | ≥1280 / 768–1279 / <768 只读 / 桌面最小 1180×760；与 PRE-01 矩阵小屏约束一致 |
| 固化主题 | 达成 | dark 默认 + light，双主题色板全部通过对比度校验 |
| 固化状态枚举 | 达成 | 任务/风险/订单/行情/对账五域枚举 + stateColor 映射 + 未知枚举 fail closed（`state.unknown`） |
| 固化金融数值 | 达成 | ADR 第 6 节：Decimal/Money 字符串、禁 IEEE-754 交易计算、币种/精度/时区/as_of/口径、provisional 独立标识 |
| 固化图表 | 达成 | ECharts（风险/P&L/归因）与 Lightweight Charts（K 线）分工；涨跌色+方向图标；8 色分类板双主题 |
| 固化表格 | 达成 | DataGrid 规范：compact、13/18、服务端分页/筛选/排序、虚拟滚动、URL 同步、异步受控导出 |
| 固化危险动作模式 | 达成 | ADR 第 9 节：DangerConfirmDialog 六要素 + 明确动词 + 不默认获焦 + pending 防重复 |
| WCAG 2.2 AA 基础检查通过 | 达成 | 36/36 配对通过（正文 ≥4.5:1，图形 ≥3:1）；首轮发现 dark brand.bgHover 3.74:1 不达标，修正为 #115E59（7.58:1）后复测全绿 |
| 通用安全文案全部入 i18n | 达成 | safety.* 18/18 条；中英文 key 集合一致性与空值由脚本强制 |

补充验证：`pnpm --filter @sumalpha/ui typecheck` 与 `lint` 均通过；新增 .tsx 骨架不进入现有 tsconfig 编译范围，不破坏现有构建。

## 3. 边界与遗留

1. Storybook/axe/Radix/Tailwind 等依赖安装与版本锁定属 PRE-03；骨架配置已按 PRE-03 落地即可运行的标准准备。
2. `check:design` 已接入 Frontend Baseline CI。
3. 领域组件八态 Storybook 全量覆盖随各 `UI-Pxx` 任务逐页补齐，基准为 StateBadge 示例与组件清单第 3 节约定。
4. 本任务交付物已纳入 2026-08-14 G0 六方联合评审；页面级七态稿按签署后遗留台账执行。
