# UI506 本机功能证据

最终冻结源码 **9847d568dd35eab57ab7582e735082fdaf367d88**；基线 c38c2f2b7575d4c8338160a0d4132e50e5dd1f8f。限定工程Gate **PASS_UI506_RECONCILIATION_FUNCTION**，最终attempt-01。源码/输入/精确命令/原日志/binary/build/网络/截图hash见receipt.json，摘要result.json；`node scripts/ui506-review.mjs --verify`复核。

对账运行/详情、不可手工改账的差异与只读Ledger、审计重跑/原请求恢复、C15有限流/GET核对、C14精确账本来源与C16/C10关联落地。69前端/消费者、18 C15、10 C14、20 C16、25 Node、10 Chromium通过；4axe零violations，2mobile incomplete/132节点待人工完整核查。类型/lint/生成契约/构建/计划检查通过。

计划IMPLEMENTED_PENDING_ACCEPTANCE；正式INTEGRATION/NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。实际C09–C15与C15–C16正向匹配缺源NOT_RUN；真实身份/目标DB/RLS/venue/持久恢复/远程CI/性能长稳/完整I6/发布NOT_RUN。未使用生产凭据、推送或部署。

开发失败与原范围诊断保留ORIGINAL_SCOPE_ONLY，不重绑冻结候选。[交付报告](./DELIVERY.md) · [视觉复核](./VISUAL-REVIEW.md) · [待确认稿](./confirmation-draft.md)。全量变更changed-files.txt，目录hash清单delivery-manifest.json。下一开发任务 **FE:UI-P22**。
