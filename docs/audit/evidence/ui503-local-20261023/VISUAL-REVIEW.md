# UI-503 基本视觉复核

候选 `942c705003f74e534b1cfc8bec3c5458773132ab`；attempt-02/browser的dark-light场景4张原始图片已逐张检查。功能页基本布局检查，无另行宣称P10/P20高保真或发布验收。

- dark/light × 1440/390：共享终端导航/模式与固定状态栏，读取选择、当前事实、参考行情和intent草稿分区；移动控件换行、长UUID/精确数值换行，document无横向溢出。
- 本次4张截图记录第1步读取快照，原始axe文件逐张记录“当前核查有效 · 步骤1/3”。长事实区域继续纵向滚动，不声称初始视口同时可见所有字段；固定底栏始终显示executable=false/提交未开放。
- 可用现金未提供及submissionReady=false明确显示；C12市场参考与OWNED_PAPER执行价分开，金额/模式/版本均为来源事实。不存在下单、批准、MFA或Command提交控件；仅复制非执行草稿。
- 16个同候选浏览器场景另覆盖成功三步预填、每步实际重读、精确venue选择、版本变化、健康/限额拒绝、C12陈旧、缺少上下文、过期、真实Kill拒绝、断流、429、安全错误、权限/非法路由、离线/撤权、加载/空及P09入口。

Axe4组零violations；桌面每主题1条color-contrast incomplete组/10个共享非文本导航图标（共2组20节点）保留；移动无incomplete。人工读屏、原生200%缩放、Firefox/WebKit/跨OS和真实宿主NOT_RUN。本轮检查不提升正式ACCEPTED或I5/RELEASE。
