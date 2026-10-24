# P19 v4 本机可视核对

源码：c7d0cb0b1832a10a287a1f88b5506f963684bff6；参考文件：design/P19-Candlestick-and-Market-Analysis-High-Fidelity-v4.png，sha256:ced50dd78bfa15ff69d43c793e75e72ab35a198c6f67eb4d06ef81933b986a66。范围为工程师基于实际PNG进行的本机核对，不是项目用户确认或发布设计签署。

已查看最终attempt-04的 `p19-explicit-fixture-dark-1672.png`、`p19-chart-light-390.png`；同时查看attempt-02的 `p19-selected-dark-1440.png`，其选中栏/表格布局未在后续改动中变化，后续新源码独立截图也已生成，不将旧截图改绑为新来源。

- 参考层级：共享Shell、标题工具条、五维context/周期、图表/分析/状态三栏、OHLCV/缺口、选中Candle与连接状态分区均落地；1672/1440三列，1024重排数据状态，390纵向。
- 数据适配：实际reference仅5根稀疏Candle，不补造原稿长行情；单独79根显式合成数据验证曲线/成交量/缺口/指标视觉，license仍fixture-only，不能当真实行情。
- 指标色来自语义/图表tokens；上涨/下跌、Orders/Fills/缺口有文字图例，质量限制/断流有文字，不依赖颜色传达。SVG只用于近似可视化，原始表保留字符串精度；表中source/quality继承series上下文，不是逐bar独立质量证据。
- 390图表保留960px横向可读区域，截图显示滚动窗口；不声称在390同时看到完整图形/右轴。1440底部截图展示OHLCV与缺口、只读元数据、选择栏和只预填标的入口；页面可纵向滚动。
- 与原稿有意适配：完整C12元数据比原稿长；真实断流显示disconnected而不是Live；不显示无证据verified/License passed/风险Normal。受控导出和无correlationId的Audit入口明确禁用。

自动证据：八组P19 geometry断言（三列顺序/窄屏重排、960px图表、无document横向溢出）、八组axe零violations；SVG color-contrast仍8条incomplete（各宽度出现次数分别34/26/26/14，双主题共200次）。不等于人工对比度全完成、读屏/native200%或跨OS通过。
