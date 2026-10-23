# UI-303 当前功能证据

冻结源码 `c1774a744ecc9d4fc90559c9f26f47e44ef91951`；工程Gate `PASS_UI303_REFERENCE_FUNCTION`。应用/构建/测试/运行时fixture同一SHA；限定本机reference功能，确认PENDING。

- [完整报告](../../UI-303-current-function-review-2026-10-23.md)、[待确认稿](confirmation-draft.md)、[scope](scope.json)、[receipt](receipt.json)、[核验摘要](verification.json)、[文件清单](changed-files.json)。
- 最终[attempt-01](attempt-01)：125前端/真实consumer、20门禁/路由、21C05/C08、11Chromium；4axe扫描0 violations/0 incomplete。`node scripts/ui303-review.mjs --verify`独立核验源码、命令、日志和全部产物。
- [exploratory](exploratory/README.md)保留未冻结类型/lint与DTO比对失败、真实fixture诊断、首轮6通过/5失败浏览器记录及修复后11/11预检；不是候选验收。
- [UI302原确认](../ui302-confirmation-20261023/README.md)只绑定3f7f37cd/c61e1dc1/e42cdd84。原UI302 12、P06 18、先前UI301回归12、原UI301 8条incomplete分别保留，不去重、不宣称关闭；全部历史NOT_RUN保留。

stage_gate INTEGRATION/NOT_ASSESSED；formalAccepted=false；runtimeAdmission=DENIED。真实身份/目标数据库/持久服务/托管、Firefox/WebKit、人工读屏/native200%、跨OS、远程CI、性能/容量/长稳、完整联调/发布及P07高保真均NOT_RUN。无生产凭据、推送、部署、交易或外部发布。下一UI-P07。
