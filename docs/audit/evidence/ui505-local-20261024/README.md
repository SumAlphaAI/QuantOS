# UI-505 本机功能证据

最终源码 **fd79185ff224b03fc5af385433e99458368292dc**；基线9ef62d37a3784855a2253ae1db114c434a09546e。限定工程 Gate **PASS_UI505_EXECUTION_FUNCTION**，最终 attempt-05；源码/输入/命令/日志/二进制/构建/网络/截图 hash 见 receipt.json，摘要 result.json。复核：`node scripts/ui505-review.mjs --verify`。

55项前端/真实消费者、28执行宿主、23Node门禁/路由、8Chromium（无重试/跳过）、4组axe零violations、8张截图；类型/lint/format、生成契约、构建/client-secrets和计划检查通过。2组color-contrast incomplete/20装饰图标节点保留待核，不算通过。

服务端Command ref提交、原键未知结果恢复、授权Order查询/Order-Fill连续事件回补、撤单及失权清除已落地。202仅受理，通用jobId不推断Order；首次读取前的提交与撤单可完整回补。reference合成身份/数据与明确回环TLS/cookie/CORS替身，未使用生产凭据、推送或部署。

计划 IMPLEMENTED_PENDING_ACCEPTANCE；正式 INTEGRATION/NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。真实身份/目标DB/持久恢复/真实风险与venue/远程CI/性能长稳/完整I5/发布均NOT_RUN。高保真UI-P20/UI-P11另行执行。

开发FAIL、attempt-01链接FAIL、attempt-02链接可访问性FAIL、attempt-03自动PASS/视觉FAIL、attempt-04原范围PASS及EOF损坏负面FAIL均保留ORIGINAL_SCOPE_ONLY；不改绑历史结果。

[完整报告](./DELIVERY.md) · [视觉复核](./VISUAL-REVIEW.md) · [待确认稿](./confirmation-draft.md)。全量变更 changed-files.txt，本目录全部文件hash见 delivery-manifest.json。下一可执行任务 **FE:UI-P20**。
