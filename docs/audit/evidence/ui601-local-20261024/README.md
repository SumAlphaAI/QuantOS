# UI-601 本机功能证据（2026-10-24）

复核入口 `node scripts/ui601-review.mjs --verify`；源码候选、原命令/日志与产物摘要以receipt/result为准。preflight为未冻结工作树检查，不能作为同SHA验收；冻结attempt才作当前工程结论。

preflight保留：consumer.log的1个错误预期（实际C11解决拒绝403/FORBIDDEN，测试原预期409），consumer-2.log修正后通过；browser首轮6/8，失败为测试未等待Incident确认完成就切换身份/重载，以及告警链接无下划线导致axe link-in-text-block violation。已修复等待和链接样式，原日志/截图/violation保留。预览构建早于后来补充的resolve仅允许acknowledged与非法kind拒绝，故preflight明确不绑定当前候选。未记录的终端输出不补造日志。

范围：实际本机Rust reference C01/F06/C11/C16/C10及受控X06/F09，原生C11新来源修复/解决/复发正向，单项X06 InspectEvidence核心正向。reference身份cookie桥接/TLS CORS代理是替代，Owner启用ops.approve是明确reference治理fixture；不是生产或目标治理授权。HTTP InspectEvidence正向及HTTP修复后解决正向仍NOT_RUN（当前reference未注入订单证据、没有修复端点）；内存/核心测试不替代它们。

正式stage_gate=NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。G4 IN_REVIEW、G4/FEP-4 NOT_READY_GAPS_OPEN、FEP-4 PARTIAL与原缺口不变；历史UI603/P23/G4/FEP4包逐字节保留ORIGINAL_SCOPE_ONLY。UI-P13高保真、目标环境、真实IdP/CORS/cookie、远程CI、性能长稳和RELEASE NOT_RUN。

## 冻结验收结果

源码 `40290ef5e177720e6d8c052e9442c16544a7a100`，attempt-01完整有界矩阵通过：PASS_UI601_OPERATIONS_FUNCTION。前端/消费者89项（UI60135、实际消费者3、UI60335、P23策略16）；BFF C11/C16原生22项；单项X06 InspectEvidence核心1项；Node门禁/路由/阶段政策65项；Operations Chromium8/8、P23直接回归7/7，无skip、重试或flaky。typecheck/lint/rustfmt/fresh BFF及terminal构建（含client-secret检查）、计划均通过。INTEGRATION退出1为预期拒绝，UI-P13 DEVELOPMENT退出0允许。

四组dark/light × 1440/390 axe零violation，保留4项color-contrast incomplete（每组1项），原link-in-text-block violation已修复。生成4张功能主页面、2张移动Runbook区域、确认弹窗和Incident详情截图。人工查看本次dark1440、light390 Runbook下部和dark确认弹窗，未见截断/横向溢出；不冒充P13高保真、全长页或完整无障碍验收。

HTTP Runbook inspect-health及Incident创建/确认/回放/时间线、审批权限声明与403/FORBIDDEN拒绝使用实际reference BFF；native/core两类正向与明确前端内存模型分别保留边界。HTTP InspectEvidence正向与HTTP修复后resolve正向仍NOT_RUN，未增加修复/注入端点。故障注入probes标明synthetic；治理bootstrap控制请求有control标记。

UI603/P23/G4/FEP4历史313个文件摘要与冻结候选一致，ORIGINAL_SCOPE_ONLY_UNCHANGED。159项stage_gate均NOT_ASSESSED，formalAccepted=false、runtimeAdmission=DENIED；G4/FEP4缺口、目标/CI/性能/RELEASE NOT_RUN保持。源候选与封包提交分开，变更见changes.json，原命令/日志见attempt-01/executions.json，封包摘要见packet-manifest.json。
