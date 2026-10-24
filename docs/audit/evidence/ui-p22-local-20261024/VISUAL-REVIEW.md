# P22 视觉与交互复核

源码 `8c0286fa0a6ea6e2a5e55a5514c7ad6d024b8a10` / attempt-02，参考图design/P22-Reconciliation-and-Funds-Ledger-High-Fidelity-v1.png的hash包含于输入。实际本机BFF合成Shadow数据/回环身份与TLS-cookie-CORS替身，不是生产页面接受。

| 参考结构 | 当前交付与适配 |
|---|---|
| 全局顶栏、左侧Orders/对账、状态条 | 统一UI框架，实际workspace/account/Shadow，权限可见导航；通知数量/风险健康不补造 |
| 标题动作、黄色告警、上下文、四摘要 | Runbook实际可展开、Run目录/分页、provisional/expiry、readonly账户/UTC日/来源；matched/缺失数量未知 |
| 左BreakGrid、右差异详情 | 分类/类型/Order-Fill搜索、精确break深链接，原始值/来源/关闭hash、已观测检测时间线、Audit/证据；未提供的容差/严重度等明确缺失 |
| 账本来源/证据底栏 | Expected/Actual来源与版本/UTC checkpoint，新增可审阅Funds Ledger原始金额表与运行事实 |
| 受控调查动作 | reason+phrase重跑与原请求恢复；无契约的说明保存/导出禁用，无手工改账 |

1440左右并排、768/390单列，两表局部横滚，readonly字段在viewport内，根页面不溢出。主题DOM和实际文本颜色变化、区域相对几何、选择/空筛选/原精度/状态缺失、Runbook/确认Esc、deep link拒绝/源过期/断流/429/409/失权/未知原请求恢复通过。当前参考图示例数值/人物/healthy不作为实际来源；不宣称像素完全一致。

16张实际视口图：两主题×三尺寸×主视图/账本=12，加两主题×768/390金额列=4。ledger-amounts图经过实际横滚、两帧绘制等待和金额单元格位置验证，raw布局JSON保留文本/rect/color/scroll。另有合成closed状态图（SYNTHETIC）及移动单元格几何图。人工查看最终dark1440主视图与light390金额列图，确认层级、只读真实金额、源hash及边界；未声称逐字/全部主题所有单元格人工对比。手机端金额列实际可见，长表在局部滚动，不丢弃未显示列。

axe6组零violations；6组color-contrast incomplete共236节点（nonBmp 62、partially-obscured 158、short-text 16）完整人工核查NOT_RUN。原生200%缩放、人工读屏、其他浏览器/OS/真实触控未验证，不能把自动未判定记PASS。

旧attempt-01手机空白图保持原字节、ORIGINAL_SCOPE_ONLY；独立手机/axe诊断和增加绘制等待后的多尺寸诊断均保存。最终按新候选重新构建/执行，不把原PASS移绑。实际C09–C15/C15–C16跨来源阳性join未提供，视觉状态样例不补业务证据。
