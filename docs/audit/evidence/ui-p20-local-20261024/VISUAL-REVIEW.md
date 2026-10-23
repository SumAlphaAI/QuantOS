# P20 视觉与可访问性复核

源码 cb6965f002b1550e8d16eea81c00225bd1309eb1，attempt-02。已用view_image逐张检查该轮12张原始截图：dark/light × 1440/768/390，每组顶部范围/构图与PreTradeCheck滚动视图；参考design/P20-Trade-Ticket-Controlled-Order-Entry-High-Fidelity-v3.png原图已读取并在inputs封存hash。

1440三栏、768两栏+全宽预检、390单栏；标题/边界/范围/四阶段/三张核心卡片层级明确；Buy/Sell是服务端方向展示且带group语义，不能假编辑。数值用tabular/mono，Bid绿/Ask红附明确文字，source未知项用文字和颜色共同提示。长UUID折行/下拉框截断均在视口内，控件boundingBox有断言。源读取后选项锁定，清空新开再选源。

与演示图的适配：保留真实服务端ID、权限/来源缺口及解释，因此页面较长，摘要在文档流而非像素复刻固定栏；未为参考图填假五档、现金、费用、仓位影响、TIF或可执行订单。实际命令/批准阶段由11条浏览器行为和网络摘要证明，截图只展示本轮实际source审阅态，不声称覆盖每个状态的视觉金图。

Terminal内部滚动，fullPage只捕获当前scroll区域视图，不能声称12张已穷尽所有长内容。滚动后的PreTradeCheck、拒绝状态、证据details展开/来源hash和确认焦点/Escape/原键恢复均有浏览器断言。未做自动像素diff或全部状态视觉基准认证。

6次axe零violations。汇总(theme,width,violations,incomplete nodes)：[('dark', 1440, 0, 10), ('dark', 768, 0, 10), ('dark', 390, 0, 0), ('light', 1440, 0, 10), ('light', 768, 0, 10), ('light', 390, 0, 0)]。4组color-contrast incomplete/40个nonBmp装饰导航图标节点保留人工待核，不计PASS；首轮aria-prohibited-attr incomplete已通过role=group修复。人工读屏、原生200%缩放、真机触控、跨OS/Firefox/WebKit均NOT_RUN。
