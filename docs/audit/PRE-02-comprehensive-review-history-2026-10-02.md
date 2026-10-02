# P0 / PRE-02「设计系统预研」全面复审报告

> 日期：2026-10-02（Asia/Shanghai）
> 检查基线：前端执行计划 v3.2；Git `838a769629bac54a04ad1f2f40aa56ae8e089980`；开始时工作区干净。
> 工程复审结论：**PARTIAL / CHANGES_REQUESTED**。三项产物齐全，静态 Gate 与构建通过，但基准组件和门禁存在实证缺陷，不能按严格验收计为完成。
> 当前问题：**阻塞级 0、高危 3、中危 4、低危 1，共 8 项 OPEN**。
> 本次为仓库工程审计，不冒充 GPT-6 Astra 模型复审；未修改开发计划、生产源码或历史验收记录。

## 一、任务完成概况

### 1.1 依据与范围

- [前端执行计划](../SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md) PRE-02：固化 token、密度、断点、主题、状态枚举、金融数值、图表、表格、危险动作模式；交付 token ADR、组件清单、Storybook 骨架；WCAG 2.2 AA 基础检查通过、通用安全文案全部入 i18n。
- [Terminal 设计规格](../SumAlpha-QuantOS-Terminal-Frontend-Design-Spec.md) §3.2–3.3、§6–8；一期 Web 范围按最新执行计划 §1.2 与[PRE-01 台账](../PRE-01-page-ledger-and-stories.md)限定。
- [token ADR](../adr/20260814-pre02-design-tokens.md)、[组件清单](../PRE-02-component-inventory.md)、[执行总结](../PRE-02-summary.md)、实际 UI token/组件/Storybook、Gate 与 CI 接线。
- WCAG 依据 W3C：普通文本至少 4.5:1，必要的非文本识别信息至少 3:1；装饰或禁用控件有适用例外。[文本对比度说明](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)、[非文本对比度说明](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)。

PRE-02 的组件清单是预研范围，不要求此时完成全部 44 条组件族的实现或全部页面八态。金融格式化、图表、表格、危险动作的模式以设计决策为本阶段交付；当前基准组件、可执行骨架和宣称冻结的门禁则须与约定一致。静态构建不能替代浏览器 axe、键盘、200% 缩放或视觉验收。

### 1.2 实际完成率

| 口径 | 实际结果 | 说明 |
|---|---:|---|
| 计划声明开发完成 | 1/1 = 100% | `development_status: COMPLETED` 是待核验声明 |
| 严格工程验收完成 | **0/1 = 0%** | 高危问题未关闭；不表示无产物 |
| 三项必需主产物存在 | 3/3 = 100% | ADR、组件清单、Storybook 骨架 |
| 完全达标控制点 | **8/14 = 57.14%** | 8 PASS、6 PARTIAL、0 MISSING；等权统计，PARTIAL 不折半 |
| 当前 Gate 内的 WCAG 配对 | 36/36 = 100% | 只覆盖原脚本配对，不等于整体 AA 通过 |
| 规范安全文案入双语词典 | 18/18 = 100% | 与规格中文原文、key、非空与占位符一致 |
| 既有验证 | 8/8 命令 PASS；5/5 Gate 测试 + 7/7 UI 测试 | 未覆盖本次复现缺陷 |
| 独立破坏探针拦截率 | **0/10 = 0%** | 10 类破坏输入全部仍返回 PASS |

14 控制点由 9 项主要动作 + 3 项产出 + 2 项完成标准组成，审计等权口径公开如下；不把页面实现、模型复审、阶段 Gate 混入本任务分母。计划的指定模型 `review_status: NOT_STARTED` 保持独立。

## 二、完成情况明细统计

### 2.1 逐项核对

| # | 要求 | 实查结果 | 状态 | 关联问题 |
|---|---|---|---|---|
| C01 | 固化 token | JSON 与类型化导出存在；基准组件绕过 token，冻结校验不完整 | PARTIAL | H-03、M-02 |
| C02 | 固化密度 | compact 32/28/12、comfortable 40/36/16；默认与官网约定已写明 | PASS | 回退防护不足归 H-03 |
| C03 | 固化断点 | ≥1280、768–1279、<768 只读完整；Web 规则符合规格 | PASS | 原生项归属不清另见 M-04 |
| C04 | 固化主题 | 两色板存在，默认基准 Badge 不随 provider 切换 | PARTIAL | H-02 |
| C05 | 固化状态枚举 | 五域 26 枚举项、25 唯一状态键存在；特殊未知输入回退崩溃 | PARTIAL | H-01、H-03 |
| C06 | 固化金融数值 | ADR 定义 DecimalValue 字符串、MoneyValue、精度/币种/时间/口径/provisional；与现行 Proto 定义相符 | PASS | 本阶段不以未实现 MoneyText 判缺陷 |
| C07 | 固化图表 | ECharts / Lightweight Charts 分工、涨跌方向图标、双主题 8 色分类板已定义 | PASS | 不计作生产图表验收 |
| C08 | 固化表格 | DataGrid 密度、排版、服务端筛选/排序/分页、虚拟化、URL 与受控导出要求已定义 | PASS | 不计作所有功能已运行 |
| C09 | 固化危险动作 | 摘要/影响/不可逆/确认短语/MFA/最终校验/correlation、明确动词、不默认获焦、防重复已有 ADR | PASS | 实际安全服务验收仍属后续任务 |
| C10 | Design token ADR | 10 项决策齐全、来源可解析、变更约束明确 | PASS | token 消费违规归 C01 |
| C11 | 组件清单 | 19 通用 + 25 领域组件族，字段与状态约定齐全；P16/原生范围未拆分 | PARTIAL | M-04 |
| C12 | Storybook 骨架 | 可构建、插件/扫描/4 视口存在；主题/语言基准不闭合 | PARTIAL | H-02、H-03、M-03、L-01 |
| C13 | WCAG 2.2 AA 基础 | 原 36 配对通过；实际浅主题 Badge 不达标，必要控件边界未进入矩阵 | PARTIAL | H-02、M-01 |
| C14 | 通用安全文案入 i18n | 18 条规范中文与英文均入库；现有 key 完整 | PASS | 英文篡改防护归 H-03；状态词消费归 M-03 |

五域状态数量：任务 5、风险 3、订单 11、行情 4、对账 3；`cancelled` 跨域重复，合计 26 域内枚举项、25 唯一映射键。`StateBadge` 7 个基准示例不等于全仓库只有 7 个 Story，也不等于七态/八态已经逐项运行。

### 2.2 当前执行证据

| 命令 | 结果 | 边界 |
|---|---|---|
| `node packages/ui/scripts/pre02-checks.mjs` | PASS | 36 对比度、18 safety key、19/25 清单行、7 基准示例 |
| `node --test packages/ui/scripts/pre02-gate-negative.mjs` | PASS，5/5 | 原四类负向加当前基线 |
| `pnpm --filter @sumalpha/ui lint` | PASS | 当前 UI 源码与测试 |
| `pnpm --filter @sumalpha/ui typecheck` | PASS | 当前 TypeScript |
| `pnpm --filter @sumalpha/ui test` | PASS，2 文件 / 7 测试 | 不含 StateBadge 原型链输入或 provider 切换 |
| `pnpm --filter @sumalpha/ui build-storybook` | PASS | 8.6.18 静态构建；use-client/source map/大 chunk 警告不作阻塞问题 |
| `node scripts/check-pre01.mjs` | PASS | 上游当前一期需求拆解 |
| `node scripts/check-development-plans.mjs` | PASS | 结构与依赖，不证明模型调用或阶段签署 |
| `node docs/audit/evidence/pre02-review-20261002/probes.mjs` | 已复现缺陷 | 10 破坏输入均误通过；3 原型链名称抛错；light/en provider 未改变 fallback |

实际使用 Node 24.12.0 与其 Corepack shim 中的 pnpm 10.20.0；宿主默认 `~/.local/bin/pnpm` 不采用。最终探针通过 esbuild 编译并由 React SSR 渲染，不启动端口、不执行数据库或外部服务；SSR 与色值计算不冒充真实浏览器扫描。逐命令日志、摘要与基线绑定见[manifest](./evidence/pre02-review-20261002/manifest.json)，探针输入/输出见[脚本](./evidence/pre02-review-20261002/probes.mjs)和[结果](./evidence/pre02-review-20261002/probes.json)。

## 三、问题清单及风险分析

优先级口径：阻塞级为无法开展本阶段检查/交付或确定的交易安全边界旁路；高危为核心安全状态/基准可访问性错误或会持续放行严重回退的门禁；中危为部分基础验收、开发规范、双语或范围不闭合；低危为不改变行为的说明错误。所有问题当前 OPEN；未发现确定交易动作越权旁路。

| ID | 等级 / 所属模块 | 具体表现 | 影响范围 | 证据 |
|---|---|---|---|---|
| H-01 | 高危 / StateBadge 未知状态 | state in stateColor 与普通属性读取命中原型链；toString/constructor/__proto__ 在 resolveHex 的 split 抛错，未显示 unknown fallback。 | 以未来/异常枚举输入的状态标签及承载页面；未证明执行动作旁路。 | `packages/ui/src/components/StateBadge/StateBadge.tsx:35`；runtime |
| H-02 | 高危 / 主题 / Storybook 基准组件 | StateBadge 默认 theme=dark，不读取 ThemeProvider；切换 light 后仍用 #60A5FA，在 light surface.0 #F7F9FC 上的正文对比度 2.41055:1。 | 默认/审批/拒绝/陈旧/未知等基准 Story 与复用 StateBadge 的浅色主题；LightTheme 单独传 prop 不能证明全局主题切换正确。 | `packages/ui/src/components/StateBadge/StateBadge.tsx:45`；contrast |
| H-03 | 高危 / PRE-02 Gate / CI | 10/10 破坏输入仍 PASS：deny 改成功色/无效 token、英文安全语义反转、控件密度、焦点 token/宽度、断点上界、排版/基栅、危险组件替换、纯注释 Storybook、surface.2 破坏。 | Frontend Baseline 使用此 Gate；既有 5/5 负向测试不足以防止安全语义及设计系统冻结约定回退。 | `packages/ui/scripts/pre02-checks.mjs:75`；mutations |
| M-01 | 中危 / WCAG 基础矩阵 / 控件边界 token | 36 配对未覆盖 surface.2 文本、输入框识别边界及实际混合主题。现有 border.strong 对 surface.0/1：dark 2.194/1.986、light 1.675/1.767，均小于 3。 | 使用 q-input/q-button 等识别边界的基础控件；是否存在足够替代视觉提示须浏览器逐控件确认，不能仅按缺测认定所有页面 WCAG 失败。 | `packages/ui/scripts/pre02-checks.mjs:89`；contrast |
| M-02 | 中危 / token 单一来源 / StateBadge 样式 | 基准组件写死 fontSize 13、lineHeight 18px、gap 6；gap 6 不在 4px 基栅 scale 内，字号也未引用 typography.table。 | 修改 token 后基准组件不跟随，违反 ADR 后果约束与组件清单的禁止硬编码规则。 | `packages/ui/src/components/StateBadge/StateBadge.tsx:57`；source |
| M-03 | 中危 / Storybook locale / i18n 消费 | StateBadge 默认 locale=zh-CN，内置 UNKNOWN_LABEL，不读取 I18nProvider/state.unknown；在 light/en provider 下 unknown 的 aria-label 与文字仍为中文，已由 SSR 复现；基准 Story 的已知状态 label 也固定为中文。 | 英文工具栏的基准验收与未知状态读屏；18 条 safety 文案本身已入双语词典，此问题不等于 safety key 缺失。 | `packages/ui/src/components/StateBadge/StateBadge.tsx:21`；runtime |
| M-04 | 中危 / 一期范围 / 组件清单与 Gate | 组件清单仍以 P16/P17 + Web/DT 互斥渲染共同验收；当前一期 Gate 强制 desktopMin 1180×760，却没有标明是二期共享参考项。 | PRE-02 对一期 P17 与二期 P16 的责任、通过条件不明确，与 v3.2 Web-only 计划和已校准 PRE-01 范围未同步。 | `docs/PRE-02-component-inventory.md:54`；source |
| L-01 | 低危 / Storybook 源码说明 | StateBadge.stories.tsx 注释声称“八态基准 story”，实际只有 7 个示例导出，且其中含主题/视口变体，非八态场景集合。 | 维护者可能混淆 PRE-02 骨架示例与下游领域组件八态完成率；总结文档的 7 个示例统计是正确的。 | `packages/ui/src/components/StateBadge/StateBadge.stories.tsx:5`；source |

机器可读问题清单见[findings.json](./evidence/pre02-review-20261002/findings.json)。上述源文件行号固定于本次 Git 基线。

风险关联：H-01/H-02 是当前实际源码问题；H-03 解释它们为何未被现有“全绿”发现，并覆盖其他冻结约定回退风险。M-01 的四个边界色配对低于 3:1 已计算确认，但单控件是否具有充分替代识别提示仍须浏览器验证，未宣称全站 WCAG 失败。M-02/M-03/M-04 是现有约定消费或范围差异；L-01 不影响构建。相关问题共享证据但按独立整改责任列项，不重复增加完成率分母。

当前没有浏览器 axe、键盘、读屏、200% 缩放、远程 CI、指定模型或新的 G0 联合签署回执；这些边界不得由静态 Gate 代替。全量领域组件八态、目标环境 provider 和页面完整验收属于后续任务，不因尚未执行而额外记作 PRE-02 缺陷。历史 2026-09-16 证据保留为旧基线，不反向覆盖成本次结果。

## 四、整改建议

1. **先修 H-01/H-02**：对未知状态使用 own-property/值类型检查，统一安全回退；将 Badge 主题纳入统一 provider，验证每个状态在双主题下的有效配对。回归必须包含 `toString`、`constructor`、`__proto__`、普通新枚举与 light provider；渲染未知状态不能被当作已实现高风险 action guard。
2. **关闭 H-03**：对照 ADR 冻结 schema/数值/区间、状态映射和合法 token path；配置按可执行结构检查，清单按稳定身份检查。中文规范与英文翻译以受控基线和产品/风控语义审查保护，不能只看 key/非空。原四类测试保留，新增本次 10 类探针的拒绝断言及组件行为回归。
3. **逐项关闭 M-01–M-04**：建立适用的文本/控件边界/焦点/hover 对比度表；基准组件消费 token，移除未经 ADR 允许的 6px 间距；状态词从 i18n 入口读取且与读屏标签一致；明确一期 P17 与二期 P16/native 的验收责任，共享 token 可保留但不得强制一期原生验收。
4. **整理 L-01 与文档证据**：修正七示例/八态说明，逐项复验后更新总结、当前报告与计划的仓库工程结论。GPT-6 Astra 字段只在实际模型复审后更新；历史签署不扩展到修订产物。
5. **关闭条件**：本次 8 项都有变更与可重放证据；原命令继续 PASS；10 类破坏均被拒绝；未知输入、双主题/双语基准回归通过；控件对比度缺口得到达标修复或有明确适用性说明。再按 14 项控制点重算完成率，不以测试条数增长代替需求验收。

本次按用户要求交付审计报告与证据，未执行生产修复、Git 提交或推送。修复应先消除高危项，再验证基础契约和范围，最后整理文案说明。
