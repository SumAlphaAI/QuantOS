# P11 视觉与可访问性复核

源码 ad49394ea9b691646fc7c791413e618e8f19ba8a，attempt-02。design/P11-Orders-and-Execution-Detail-High-Fidelity-v1.png已读取并在inputs记录hash。已用view_image逐张检查本轮12张实际布局截图（dark/light × 1440/768/390、orders/execution视图）以及2张明确SYNTHETIC的partial/rejected状态截图。

1440左目录/右详情双栏，右侧内部摘要与关联信息双列；768侧栏收窄、详情单列；390目录/详情顺序堆叠。当前选中Order、真实状态、mode及202边界明确；数量/剩余/进度精确，百分比不拆行；partial 25.00%、375/1500、剩余1125只是合成呈现探针；拒绝状态禁撤单。未绘制没有观测到的未来状态。

真实长UUID/hash折行，表格提供命名region/Tab焦点和ArrowRight。新增p11-layout.json记录每组scrollLeft/clientWidth/表格及单元格几何/颜色；实际按键后等待正向且稳定滚动，手机内容可见。字/列在滚动边界可部分遮挡，但存在横滚访问，不把局部裁剪截图当信息删除。Terminal内部滚动，fullPage不是全页面长内容拼图；详情卡片、操作栏与兼容入口按文档流阅读，不宣称全状态视觉金图或像素级自动diff。

6次axe零violations。汇总(theme,width,violations,incomplete nodes)：[('dark', 1440, 0, 10), ('dark', 768, 0, 12), ('dark', 390, 0, 2), ('light', 1440, 0, 12), ('light', 768, 0, 12), ('light', 390, 0, 2)]。incomplete共6组50节点，40个nonBmp装饰图标、10个elmPartiallyObscured横滚边界文本。保留人工对比度核查待办，不归入PASS。人工读屏、原生200%缩放、跨OS/Firefox/WebKit/真机触控NOT_RUN。

14条浏览器验证实际accepted/cancelled/连续回补、C10链与C15拒绝、未知原键恢复、部分成交/拒绝合成呈现、source/correlation越界、失权/离线/注销、空/加载/429、兼容Command和输入边界。部分成交/拒绝的真实核心OMS投影独立通过，不提升为实际venue或完整I5验收。
