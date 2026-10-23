# UI-501 本机功能证据

状态：SOURCE_PREPARATION；冻结候选与最终有界测试结果待本轮执行填入。当前不能据此声明 Gate PASS。

适用：FE:UI-501 C01/C06/C16 本机实际 reference BFF 与 Chromium；合成身份/数据、回环 TLS/CORS 替代，不是生产验收。INTEGRATION/RELEASE NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。

`development/` 保留冻结前诊断（ORIGINAL_SCOPE_ONLY）：首次单元36项中35通过/1失败，原因是撤权测试使用了生成契约不允许的 sequence=0；改为有效的过期序号1。参考消费者前两次失败来自记录器重复消费 POST Request body，未到达服务端；已修复记录器并证明实际提交后丢失响应与原键恢复。初始通过记录只作原范围参考，不改绑最终候选。首次类型检查发现 nullable cursor、challenge 不含 expiresAt、测试 spawn NODE_ENV 缺失，均已修正。计划检查曾因证据 README 尚未创建拒绝，不计 PASS。

复核入口 `node scripts/ui501-review.mjs --verify`。新运行必须使用新的 `attempt-NN` 目录，保存失败/中断。阶段拒绝与下一开发允许由执行规程分别检查，历史证据不改绑。
