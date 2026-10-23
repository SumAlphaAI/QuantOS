# UI-302 当前功能证据

应用源码 `3f7f37cd1acb20f97962fd9fefcac212eb021eed`；工具 `c61e1dc1e94d05888688bb9e264eb1705290bf81`；工程Gate `PASS_UI302_REFERENCE_FUNCTION`。完整版本绑定、命令、日志、产物摘要见[receipt.json](receipt.json)，`node scripts/ui302-review.mjs --verify`可独立核对。

- [完整审阅报告](../../UI-302-current-function-review-2026-10-23.md)、[确认文稿](confirmation-draft.md)、[范围](scope.json)、[核验摘要](verification.json)、[变更文件](changed-files.json)。确认PENDING。
- 原始功能/构建：[attempt-01](attempt-01)。16条命令成功/预期拒绝，最终核验因空report采集失败；不作为最终完整PASS。见[失败说明](attempt-01-verification-failure.md)。
- 最终工具/浏览器：[attempt-03](attempt-03)，仅复跑lint/19门禁路由/11Chromium；其余89前端、20C05及3核心专项、构建原SHA未变复用。attempt-02 lint失败和exploratory原始失败全部保留。
- 最终14次axe零violations，12条incomplete扫描记录；原P06 18、先前UI301回归12及原UI301 8保留，未去重、不标闭环。
- UI-P06原文确认：[相邻确认包](../ui-p06-confirmation-20261023/README.md)，仅f2854052/0d998c4e，不改绑当前源码。

stage_gate INTEGRATION/NOT_ASSESSED；formalAccepted=false；runtimeAdmission=DENIED。真实身份/目标服务/数据库/持久恢复/托管、Firefox/WebKit、人工读屏/native200%、跨OS、远程CI、性能/容量/长稳、完整联调/发布及P07高保真全部NOT_RUN。无生产凭据，无推送或部署。下一UI-303。
