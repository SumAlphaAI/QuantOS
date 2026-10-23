# 未冻结探索，非候选验收

- P07确认初次工具模板路径使用current-function而原稿是current-page，原tests-failed-01保留在确认目录，修复后2/2与确认门禁通过。
- host-build-01、producer-01成功。browser-01探索命令误传8位SHA，宿主拒绝启动，4条失败；后续仅用git当前完整40位SHA。原raw未改。
- lint-01失败：测试helper遗留未用resolve，删除；lint-02/types-02/gate-01通过。
- browser-02：真实IPC产物回测GET200但页面502。browser-03保存provider原JSON并定位metrics.max_drawdown=`8.60673226776097e-6`违反DecimalString正则。修复服务端格式，不放宽客户端；新增极大/极小浮点及大整数回归。
- browser-04：报告可读后创建Release409；Python参数24.0经JS回传24，serde Value类型表示比较造成误拒。三条超时45秒；外层spawn180秒超时，末条未完成、最终报告缺失。探索wrapper未正确把null退出映射非零，因此工具返回0不是通过。保留原部分stdout，按TIMEOUT/NOT_ACCEPTANCE记账。孤儿静态服务器经精确PID/命令核对终止，timeout-cleanup.json为证据。
- browser-05因上述孤儿3190服务拒绝启动。修复helper错误诊断/失败即停止；完整runner保存status/signal/errorCode、failure.json和剩余NOT_RUN，不将null退出视为通过。
- browser-06：真实IPC Artifact→Lab→回测→Release→审批→目标→Audit；拒绝、可信时钟过期和20路竞争，四条通过。所有产物与状态仍为未冻结探索，不拼入最终候选PASS。

20份实际IPC输出由自有合成输入产生；可信宿主注册、身份/Cookie/CORS及独立审批控制均显式替代，不冒充R03 worker或生产。所有历史失败/incomplete/NOT_RUN保留。

冻结记录：attempt-01源码6ff，Rust730/14 ignored和Python1908通过，Web组件样例失败；attempt-02源码e50保留A2/A6两处旧测试假设失败；attempt-03源码3d自动44通过但人工发现Audit文字重叠，原receipt/incomplete保存在history；最终9a/attempt-04修复并新增DOM断言后完整44例通过。之后的临时文件数量统计命令曾有括号语法错误，未用于验收结论；正式receipt/summary统计已独立核对。
