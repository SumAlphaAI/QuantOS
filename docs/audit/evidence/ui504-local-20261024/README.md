# UI-504 本机功能证据

基线 e1594962ed6fa6ec6b41c08b9ad640cc3f575c16。源码冻结后执行有界功能验证；结果见 receipt.json/result.json，最终说明见 DELIVERY.md。预期工程Gate PASS_UI504_APPROVAL_FUNCTION；只有实际新候选命令通过后才记录PASS。

C08真实reference BFF，合成数据/身份与明确回环TLS/cookie/CORS桥接，不代表真实IdP或生产。IMPLEMENTED_PENDING_ACCEPTANCE，INTEGRATION/NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。

`development/` 保留首轮60项中59PASS/1FAIL原始日志与源码快照：通用429兜底错误覆盖了C08明确的2秒冷却，已修复且专项复验通过。该失败及中间开发日志均 ORIGINAL_SCOPE_ONLY，最终候选不复用历史PASS。完整未执行范围见操作规程与最终交付报告。未使用生产凭据、推送或部署。下一任务 FE:UI-P10。
