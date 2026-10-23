# UI-504 基本视觉复核

候选12798275ff861b0dcd86ad444c27b7aca8f83476，attempt-02。Codex实际查看了approvals-dark/light-1440/390四张原始PNG，hash在receipt.json。

1440：终端导航高亮Approvals，列表/事实/原因/确认分组可见；身份、版本、期限、缺失业务字段与服务端最终核验说明清晰，未将批准状态改绘为交易。390：页头收缩、长UUID与日期换行、事实改为单列，页面无水平溢出（浏览器断言）；截图只覆盖主区当前滚动位置，表单在下方，不把该截图当完整手机操作路径验收。UI-P10仍需高保真风险详情与更完整视觉状态矩阵。

4次axe扫描均零violations；dark1440/light1440各1条color-contrast incomplete，分别7个aria-hidden非文本导航图标，总14节点（Command、Portfolio、Trade、Proposals、Approvals、Orders、Operations）；390两组无incomplete。工具原因是Element content contains only non-text characters；未自动归类为通过或确认全部图标对比度。

桌面对话框初始取消焦点、Esc关闭、短语/MFA后显式确认由Chromium功能测试验证。未执行完整手机键盘/触控实机路径、人工屏幕阅读器、原生200%缩放、跨OS/Firefox/WebKit，均NOT_RUN。基本本机功能布局可审阅，不等于UI-P10或发布视觉验收。
