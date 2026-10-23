# UI-P18 本机功能与视觉结构证据

任务UI-P18 / C12+C16，实际路由 `/markets` 和规范编码的 `/markets/:symbol`。最终冻结候选与结果以 receipt.json / result.json 为准；未产生最终回执前不能从README或预检推断通过。复核入口 `node scripts/ui-p18-review.mjs --verify`。

preflight-01：build通过；单测/consumer126/127，失败项把没有alerts.read的reference Viewer错误预期为C16 200；查明真实权限后保留403拒绝测试，并另用获授权Owner验证偏好隔离。Chromium12/15通过、3失败：相同Viewer权限误判、未知标的未等待后台目录完成造成网络计数竞态，以及摘要div有aria-label但没有对应role。已分别修正测试前置条件与摘要group语义；保留原日志/截图/报告，不修改为PASS。初始typecheck有fixture.environment字面量类型错误，lint有空catch，均已修复；未保存完整原始日志的开发输出只作为会话过程，不冒充冻结回执。

preflight-02为独立预检，不是源码冻结候选；所有实际结果见该目录原始文件。后续源码变动须冻结新候选并启用新attempt，不拼接历史PASS。

范围：生成client + 实际本机reference C01/C12/R01/C16，受控合成行情与临时TLS/cookie/CORS替代。24h数据/可执行交易/单标的告警规则缺失不伪造。完整INTEGRATION/目标/RELEASE、人工读屏/native200%、跨浏览器/远程CI/性能长稳均NOT_RUN；formalAccepted=false / runtimeAdmission=DENIED。下一原任务FE:UI-501。

preflight-02：实际consumer1/1通过（含Viewer403和Owner隔离），Chromium14/15通过。视觉矩阵在detail首组发现breadcrumb链接仅靠颜色区分（axe link-in-text-block，serious）；保留7组扫描、6张overview截图和失败上下文，修复为常驻下划线，随后对新冻结候选重新执行完整P18矩阵。其余预检不改记PASS。
