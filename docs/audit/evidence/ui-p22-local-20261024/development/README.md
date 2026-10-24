# P22 开发诊断

全部ORIGINAL_SCOPE_ONLY。开发时未冻结源码；GITHUB_SHA基线仅标识启动基线，不包含未提交修改，不作为最终候选。最终候选另行构建和执行当前功能矩阵，不修改UI506/旧证据。

- 最早typecheck通过、lint报unused Break import（未独立保存原日志，原工具输出保留于会话）；删除未使用import，未调整lint规则。types/lint-01及-02通过原日志保存。
- unit-01：72/72展示策略/实际本机消费者/UI506/权限直接回归通过。
- build-01/02原始日志保留。
- browser-01：12/13通过。原始超时/错误上下文/page-state/截图保留；账本侧select的隐式标签不能精确定位，补充显式aria-label。6组axe无violations，incomplete仍保留，不能记PASS。
- browser-label-02：原失败用例定向复验，账本侧筛选/大Decimal/禁用动作步骤通过，但Runbook点击后内容hidden，整项FAIL；原日志/上下文/page-state/截图保留。改用React显式open状态及button，避免直接DOM属性和fragment默认行为竞争。该轮构建还未包含后续导航排序/布局断言，不重绑最终候选。

后续把对账子导航置于Orders与Audit之间；增加实际颜色变化、桌面并排/平板手机堆叠、只读字段边界及两张表键盘横滚检查；定稿后在冻结source commit执行全套P22当前功能验证。


冻结候选0201e8ae/attempt-01的72单元/25Node/13Chromium通过记录与receipt/result原始字节另存attempt-01-*-original.json，所有attempt-01原文件保持不变。人工截图发现连续切换viewport后的手机Ledger截图空白，该范围不能支持最终高保真通过，标记ORIGINAL_SCOPE_ONLY。mobile-diagnostic-03单独手机实际单元格与几何正常，mobile-axe-diagnostic-04扫描后也正常；viewport-diagnostic-05在滚动后等待两帧并记录单元格几何后，多尺寸/主题截图已显示实际账本。没有改动产品运行时/owner/账本逻辑；改进截图等待/可见性断言与手机金额列捕获，新增独立移动单元格用例，再按新源码候选复验。缺陷机制尚未独立证明为浏览器绘制问题，不宣称完成跨浏览器诊断。
