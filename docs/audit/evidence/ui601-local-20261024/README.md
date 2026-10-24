# UI-601 本机功能证据（2026-10-24）

复核入口 `node scripts/ui601-review.mjs --verify`；源码候选、原命令/日志与产物摘要以receipt/result为准。preflight为未冻结工作树检查，不能作为同SHA验收；冻结attempt才作当前工程结论。

preflight保留：consumer.log的1个错误预期（实际C11解决拒绝403/FORBIDDEN，测试原预期409），consumer-2.log修正后通过；browser首轮6/8，失败为测试未等待Incident确认完成就切换身份/重载，以及告警链接无下划线导致axe link-in-text-block violation。已修复等待和链接样式，原日志/截图/violation保留。预览构建早于后来补充的resolve仅允许acknowledged与非法kind拒绝，故preflight明确不绑定当前候选。未记录的终端输出不补造日志。

范围：实际本机Rust reference C01/F06/C11/C16/C10及受控X06/F09，原生C11新来源修复/解决/复发正向，单项X06 InspectEvidence核心正向。reference身份cookie桥接/TLS CORS代理是替代，Owner启用ops.approve是明确reference治理fixture；不是生产或目标治理授权。HTTP InspectEvidence正向及HTTP修复后解决正向仍NOT_RUN（当前reference未注入订单证据、没有修复端点）；内存/核心测试不替代它们。

正式stage_gate=NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。G4 IN_REVIEW、G4/FEP-4 NOT_READY_GAPS_OPEN、FEP-4 PARTIAL与原缺口不变；历史UI603/P23/G4/FEP4包逐字节保留ORIGINAL_SCOPE_ONLY。UI-P13高保真、目标环境、真实IdP/CORS/cookie、远程CI、性能长稳和RELEASE NOT_RUN。
