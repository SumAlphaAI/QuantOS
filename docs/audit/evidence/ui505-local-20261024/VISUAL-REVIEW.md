# UI-505 视觉与可访问性复核

源码 fd79185ff224b03fc5af385433e99458368292dc，attempt-05。已通过view_image逐张检查该轮8张原始截图：明暗主题 × 1440/390宽度，每组顶部/受理/列表与下方Order事实两视图。Terminal内部滚动，因此fullPage截图并非所有内容展开的长图；不能据此声称整条时间线已完整截图。实际accepted/cancelled两条dense时间线由浏览器业务用例验证。

顶部明确PAPER、202受理与成交区别；受理回执和Order事实分开；真实UUID/Decimal数据折行、列表链接带下划线。手机长Approval选择框及箭头保持卡片和视口内，控件boundingBox新增断言；Order详情数量/已成交/均价、当前sequence、重新核对/撤单和无Fill提示可读。没有前端推断的成交。该功能布局不等于UI-P20/UI-P11设计验收。

4次axe零violations。扫描汇总(theme,width,violations,incomplete nodes)：[('dark', 1440, 0, 10), ('dark', 390, 0, 0), ('light', 1440, 0, 10), ('light', 390, 0, 0)]。2组color-contrast incomplete/20节点全部为nonBmp装饰导航图标；保留原始结果，人工颜色/读屏未验证，不算通过。

确认框初始焦点在取消，Escape不写入，未知结果显式恢复；已由8条Chromium用例覆盖。原生200%缩放、人工读屏、跨OS/Firefox/WebKit/真机触控为NOT_RUN。实际成交来自Rust PaperKernel测试；浏览器reference resting模式是accepted无Fill，不用合成成交截图冒充venue事实。

原attempt-02链接区别axeFAIL、attempt-03选择框越界视觉FAIL及修复过程全部保存ORIGINAL_SCOPE_ONLY。
