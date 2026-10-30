# CORE:X06 来源健康审查本地证据

任务 L4-SOURCE-OBLIGATION-REVIEW-01，基线 518d87488cfcd7b18a43bc306f9a2cf00dfc9d92。冻结源码及具名测试结论以 result.json 为准；preflight 均 UNFROZEN_DIAGNOSTICS_NOT_CURRENT_ACCEPTANCE。

运行 `node scripts/core-x06-source-review.mjs --run --attempt=attempt-01`；核对 `node docs/audit/evidence/core-x06-source-review-local-20261030/verify.mjs`。每次新 attempt，不覆盖失败；先验证全部输入、原始日志/业务数据/hash 再发布 PASS。使用白名单 fixture、本机临时证书和 loopback，无生产凭据/外部发布。

当前源码实现见[规程](../../../operations/core-x06-source-review.md)、[范围](../../../execution/core-x06-source-review-scope.json)。正式验收文稿待用户确认，不授予完整 Gate 或实际运行准入；目标及浏览器未执行见 scope.notRun。
