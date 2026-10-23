# UI-502 本机功能证据

最终源码候选 `e497121f1e79cff5de508b03513d70933d080e23`；基线 `3d2eee0ff1be7f9e3c4a988a7e86d42b442f25a0`。功能实现与必要直接回归的有界工程 Gate：**PASS_UI502_REFERENCE_FUNCTION**。最终原始记录在 `attempt-02/`，入口回执为 `receipt.json`，汇总为 `result.json`；用 `node scripts/ui502-review.mjs --verify` 复核源码/日志/构建/二进制/网络/截图哈希。

121 项前端/消费者测试，C07宿主20项，Node门禁/路由/真实静态宿主21项，Chromium15项（零重试/跳过）；typecheck/变更范围ESLint/静态构建/计划检查通过。4组明暗1440/390扫描零axe违规；4个规则组、24个节点incomplete保留，详见VISUAL-REVIEW.md。

仅C01/C07与C13只读预检；实际reference BFF/本机Chromium，合成身份/数据及显式回环TLS/身份/CORS替代。IMPLEMENTED_PENDING_ACCEPTANCE；INTEGRATION/NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。目标环境/远程CI/性能长稳、P09高保真/C10内容增强均NOT_RUN；未使用生产凭据、推送或部署。

历史不改绑：`development/`保留首次实际消费者断言重复读取Request body的FAIL原件与修复后结果；`attempt-01/`保留源码d87af348的120项/15浏览器PASS原件，首轮receipt/result逐字节封存在`attempt-01-*.original.json`。首轮回执容量淘汰问题修复后使用新候选和新attempt，首轮仅ORIGINAL_SCOPE_ONLY，不能作为最终候选PASS。

完整交付、命令与风险见DELIVERY.md；全量文件见changed-files.txt；delivery-manifest.json校验本证据目录除自身外的全部文件。下一可执行任务：**FE:UI-P09：Proposal列表与详情高保真页面（C07/C10）**。
