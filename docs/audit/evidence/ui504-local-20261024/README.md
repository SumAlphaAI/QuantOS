# UI-504 本机功能证据

最终源码 **12798275ff861b0dcd86ad444c27b7aca8f83476**；基线 e1594962ed6fa6ec6b41c08b9ad640cc3f575c16。限定工程Gate **PASS_UI504_APPROVAL_FUNCTION**。最终attempt-02/，全部原始输入/命令/日志/二进制/构建/网络/截图hash见receipt.json，摘要result.json；`node scripts/ui504-review.mjs --verify`复核。

99项前端/消费者、24执行+24策略宿主、22Node门禁/精确路由/实际静态宿主、15Chromium（无重试/跳过）、4组axe零违规；生成契约、类型/lint/format、构建/client-secrets与计划检查通过。2条color-contrast incomplete组/14非文本导航图标节点完整保留，未算通过。

C08 Approval目录/详情、MFA/再认证、独立审批人、自批/过期/冲突/额度与健康拒绝，无乐观更新；未知原键原body恢复，过期/失权停止恢复。Release分支补实际决定与原因；request_info关闭为rejected、不授予权限。本页不提交Command、不生成订单或成交。真实reference BFF，身份/数据为合成，明确回环TLS/cookie/CORS替身。

development原始429冷却FAIL、Release响应关联ID假设FAIL、类型/lint FAIL与快照保留；首轮c19a92f7的13/15浏览器FAIL（自批提示/不支持的Approver注销）及99单元/24+24宿主/构建/4视觉全部保留ORIGINAL_SCOPE_ONLY，见attempt-01-result.json。新源码另跑attempt-02，不改绑旧结果。原始error-context空白通过.gitattributes精确路径豁免，未重写原件。

计划同步IMPLEMENTED_PENDING_ACCEPTANCE；正式INTEGRATION/NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。真实身份/目标DB/真实risk来源/持久恢复/同SHA远程CI/性能长稳/完整I5联调/发布仍NOT_RUN；内置Approver注销403不当作真实撤销通过，最终注销清理测试仅current发起人身份。未使用生产凭据、推送或部署。

完整文件/命令/风险：[DELIVERY.md](./DELIVERY.md)；视觉：[VISUAL-REVIEW.md](./VISUAL-REVIEW.md)；待用户确认：[confirmation-draft.md](./confirmation-draft.md)。changed-files.txt与delivery-manifest.json保存文件清单及本目录除自身外全部hash。下一可执行任务 **FE:UI-P10**。
