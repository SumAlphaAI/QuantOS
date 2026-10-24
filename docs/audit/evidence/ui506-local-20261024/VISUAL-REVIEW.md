# UI506 基本浏览器与视觉复核

范围源码 `9847d568dd35eab57ab7582e735082fdaf367d88` / attempt-01；功能布局，不代表P22参考图高保真验收。实际Chromium截图来自同一冻结构建与Shadow reference BFF；C01/TLS/cookie/CORS为显式回环替身。

4组实际主题/宽度：dark1440、dark390、light1440、light390；DOM data-quantos-theme与实际背景色断言通过，页面宽度不超过viewport，账本命名region可聚焦并键盘横滚。1440为左目录/右运行详情、Expected/Actual并排、完整只读账本与重跑；390为单列、长ID换行、账本局部横滚。深链接、scope拒绝、空/加载/429/409、暂定/过期、断流空洞重读、未知原请求恢复、离线/撤销均有浏览器验证。

本轮人工查看了light390及dark1440整页图，确认主题差别、分区层级、长引用换行和局部横滚边界；未声称逐字核查所有账本单元格。4组axe零violations；dark390及light390的color-contrast各66节点incomplete，均报告横滚区域部分遮挡，合计132节点仍待完整人工复核。桌面扫描无incomplete；不能将未判定对比度记PASS。人工读屏、原生200%缩放、真实移动端触控、跨OS/Firefox/WebKit未验证。

图片位于`docs/audit/evidence/ui506-local-20261024/attempt-01/browser/ui506-UI506-dark-light-responsive-ledger-keyboard-and-axe-chromium/reconciliation-主题-宽度.png`；raw axe JSON包含每个incomplete target和原始原因。开发browser-02命名light但样式暗色的问题已发现并修正；最终增加实际颜色断言后重新构建执行，旧图原样保留ORIGINAL_SCOPE_ONLY。
