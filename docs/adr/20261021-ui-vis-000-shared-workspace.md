# UI-VIS-000 共用 Web 工作区视觉层

P02 v1 与 P20 v3 定义全局几何参考：约196px侧栏、56px顶栏、底部连接状态条，P02的面板/表格分区与P20的三列“意图/上下文/检查”。色彩和状态真义继续使用 PRE-02 冻结 token；图片不是替换冻结风险语义的授权，也不要求逐像素复制其中演示数据。

`packages/ui`提供 TerminalFrame、WorkspacePanel/Grid/Field/Chart 及集中 workspace.css；`domain-ui/chrome`提供可复用的顶栏/导航，调用方必须先过滤权限。组件不加载账户或BFF、不生成RiskDecision或TradeCommand。静态主工作区保持只读，模式仅展示Paper/Shadow，未知模式明确UNKNOWN/只读；展示不是业务授权。

ThemeProvider扩展非状态视觉变量：`--q-accent`是装饰/导航品牌强调（dark #31C8F4、light #075985），不得作为健康或允许信号；图表线来自冻结chart分类色，mode.paper/shadow来自冻结mode；所有状态Badge及警告仍消费冻结语义色。PRE-02原tokens.json、安全文案及状态枚举不改写。

Command/Settings复用Frame/Header/Navigation；路由、六步守卫、原受控回调保持调用方所有。P20共用组件组合放入Storybook，明确仅视觉fixture，不提前实现受控下单API或向venue发单。图表附原始数据表，拒绝NaN/Infinity/空数据；表格、危险确认继续复用UI-103。768–1279折叠侧栏；<768仅只读监控，不以CSS隐藏替代服务端权限。

1440新视觉基线绑定本次工程输入和当前平台；历史PNG/已确认原件保留，不把新设计自动评为历史截图匹配。跨平台/跨浏览器、RELEASE设计签署和人工读屏/原生200%检查独立记录。
