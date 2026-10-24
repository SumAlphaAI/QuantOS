# UI506 本机功能证据

范围：I6对账运行、只读账本差异、审计重跑/原请求恢复、C15实时事实、C14/C16/C10来源关联；P22高保真另行开发。

限定工程Gate `PASS_UI506_RECONCILIATION_FUNCTION`，冻结源码/attempt/精确命令/输入/日志/构建/二进制/网络hash见receipt.json，摘要result.json；`node scripts/ui506-review.mjs --verify`复核。开发状态IMPLEMENTED_PENDING_ACCEPTANCE，正式INTEGRATION/NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。最终数量和未执行项见DELIVERY.md，确认文稿PENDING。

原始开发失败和诊断保留于development，均为ORIGINAL_SCOPE_ONLY：不能重绑冻结候选，也不计最终验收通过。真实身份/目标DB/RLS/持久恢复/真实venue/同SHA远程CI/性能长稳/完整I6/发布NOT_RUN；实际C09–C15、C15–C16正向匹配尚无reference来源，保持NOT_RUN。未使用生产凭据，未推送或部署。

[交付报告](./DELIVERY.md) · [视觉复核](./VISUAL-REVIEW.md) · [待确认稿](./confirmation-draft.md)。下一任务FE:UI-P22。历史证据不改写，本次变更清单changed-files.txt及目录hash清单delivery-manifest.json于封存时生成。
