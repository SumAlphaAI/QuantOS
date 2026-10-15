# TP10 ValueCell UX Gap Report 与交互模式映射

Baseline: `ValueCell-ai/valuecell@9793e9c0563fbf56fc096757d8bb80e209ac7aab`（2026-02-11，main HEAD，Apache-2.0）。

评估范围：投研 UI/工作流的**信息架构（IA）与交互模式**。明确不复制：ValueCell 的数据模型、账户体系、多 agent 运行时、自动交易表面、第三方数据 adapter。

## 一、ValueCell 信息架构摘要

主信息轴：**Market Observation / Industry Research / Stock Exploration / Strategy Backtest** 四个工作区 + 会话式 agent 对话流 + 组合管理面板。值得借鉴的是“研究对象 → 分析产物 → 可追踪证据”的浏览动线，以及会话产物与结构化面板并存的双栏组织。

## 二、可复用交互清单（12 个 UI 模式 → Terminal design spec 映射）

| # | ValueCell 模式 | QuantOS Terminal 映射（U01 P01–P05 / X06 P08–P14） | 采纳判定 |
| --- | --- | --- | --- |
| 1 | 四工作区主导航（观察/研究/选股/回测） | Terminal 左栏按 QuantOS 对象域组织：Research / Signal / Proposal / Portfolio / Risk / Audit / Ops（P01–P14） | adopt（IA 结构，不复制命名） |
| 2 | 会话式研究流（对话 → 结构化结论卡） | P03 Research 页：流式研究会话 + 结论收敛为 ResearchArtifact 卡 | adopt |
| 3 | 结论卡 → 证据下钻 | ResearchArtifact/Signal 卡片点击 → 证据面板（evidence_refs → artifact 预览） | adopt（X06 证据链还原 ≤5 分钟的关键路径） |
| 4 | 研究产物历史时间线 | Research/Signal 列表页：版本化时间线 + content-hash 去重标识 | adopt |
| 5 | 选股探索器（筛选 → 详情） | Signal 探索：按 symbol/direction/confidence 过滤 → Signal 详情（含 diagnostics/data_query_context） | adopt |
| 6 | 回测工作区（参数 → 结果对比） | S02 回测页（U 系列后续）：参数卡 + 结果对比表 + artifact 引用 | adopt（交互骨架，不复制实现） |
| 7 | 多 agent 观点并列展示 | TP04 委员会视图：supporting/counter views 并排 + 证据锚点 | adopt（R04 已有多观点数据，UI 借鉴并列呈现） |
| 8 | 状态徽标体系（进行中/完成/失败） | 统一 run 状态徽标：queued/leased/running/succeeded/failed/cancelled + 过期 proposal 的 expired 态 | adopt（语义色板自绘） |
| 9 | 详情页分区滚动（概览 → 明细 → 原始数据） | Proposal/Order 详情：概览 → 证据 → 审批 → 原始 JSON（可折叠） | adopt |
| 10 | 空态引导（无数据时给出下一步动作） | 各列表页空态：引导创建 Research run / 连接 snapshot / 查看 runbook | adopt |
| 11 | 桌面通知（任务完成/异常提醒） | desktop notifications（X06 已列入范围）：run 完成、proposal 过期、kill switch 触发 | adopt（复用 Tauri adapter，不复制其通知实现） |
| 12 | 本地优先隐私姿态（数据不出设备的承诺展示） | Terminal 设置页：数据驻留/遥测开关展示（F09 脱敏 + 本地优先叙事） | adopt（叙事框架，不复制文案） |

## 三、UX gap report（QuantOS Terminal 相对差距）

| Gap | 说明 | 建议归属 |
| --- | --- | --- |
| 证据下钻动线未定义 | 从列表到 artifact 证据面板的跳转层级、面包屑与返回栈未规范 | U01 design spec 增补 |
| 委员会观点可视化缺失 | R04 已产出 counter_views，UI 尚无并列/对比呈现规范 | X06 P10 Proposal 页 |
| 过期/失效状态视觉规范缺失 | proposal expired、snapshot stale、engine degraded 的统一视觉语言未定义 | U01 design spec 增补 |
| 危险操作确认模式未定义 | kill switch / 审批放行需要分级确认（type-to-confirm、MFA）交互规范 | X06（已列范围，模式可借鉴本报告 §8/§12） |
| 小屏降级策略缺失 | U01 要求小屏不显示高风险动作；ValueCell 无对应约束，需自研规范 | U01 design spec 增补 |

## 四、禁止耦合清单

1. 不复制 ValueCell 任何组件源码、样式表或图标资产（交互模式重新实现）。
2. 不采用其数据模型（conversation/task/result 表结构）或账户体系（本地用户模型）——QuantOS 走 F02 租户/工作区模型。
3. 不引入其多 agent 运行时（orchestrator/agno/LangChain 集成）。
4. 不引入自动交易 agent 的任何 UI 或 API 表面——QuantOS 决策链是 Proposal（`executable=false`）+ 审批 + 风控。
5. 不接入其第三方数据 adapter（yfinance/akshare/crypto）——数据走 TP05 `data.query.v1` 持牌 provider。
6. 不复制其 MCP 集成面（TP01 已拒绝的边界）。
7. 桌面壳不参考其 Tauri 配置的签名/发布管道细节（供应链口径不同）。

## 五、结论

12 个交互模式全部以“模式级采纳、实现级自绘”映射到 Terminal design spec；5 个 gap 已分配归属（U01/X06/S02）。差异全部记录于 ADR。无源码复制、无运行时依赖。
