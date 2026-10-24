# UI-603 当前功能证据（2026-10-24）

本目录保留 preflight 工作树检查及冻结候选 attempt，源码提交与精确结果以 receipt.json/result.json 为准。运行 `node scripts/ui603-review.mjs --verify` 校验。源码、工具、原命令日志、BFF二进制、terminal构建和浏览器网络/截图摘要绑定同一候选；封包提交不改绑源码。

工程范围：C01/C16真实本机Rust reference BFF、F06二次验证/幂等恢复及C10审计，受控X06/F09输入。浏览器采用明确cookie身份桥接及回环TLS/CORS替代；故障注入另标SYNTHETIC。权限/离线/拒绝/未知结果/恢复不以UI乐观状态代替服务端事实。

preflight-01不是冻结源码验收：unit.log保留首轮6个fixture错误（StreamEvent缺字段、MFA响应fixture不完整），unit-2.log保留真实组合1个权限假设失败（Viewer C01不授予alerts.read），后改用真实Approver作只读告警消费者，unit-3.log为后续30项通过。browser/保留首轮5/6通过、Approver首次C16后撤权失败（冷C01错误声明默认禁用ops.approve，已修复并加原生回归）；其余终端类型/lint初始失败在当前功能复核文稿中列出，不计为通过。后续代码修正须用新attempt，不覆盖旧失败。

正式stage_gate=NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。G4 IN_REVIEW、G4/FEP-4 NOT_READY_GAPS_OPEN、FEP-4 PARTIAL及既有缺口不变；历史包逐字节保留ORIGINAL_SCOPE_ONLY。UI-P23高保真、目标环境、真实IdP/cookie/CORS、外部告警源、远程CI、Firefox/WebKit、性能长稳、完整I8及RELEASE NOT_RUN。未推送/部署/发布。
