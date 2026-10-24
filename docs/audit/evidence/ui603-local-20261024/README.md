# UI-603 当前功能证据（2026-10-24）

本目录保留 preflight 工作树检查及冻结候选 attempt，源码提交与精确结果以 receipt.json/result.json 为准。运行 `node scripts/ui603-review.mjs --verify` 校验。源码、工具、原命令日志、BFF二进制、terminal构建和浏览器网络/截图摘要绑定同一候选；封包提交不改绑源码。

工程范围：C01/C16真实本机Rust reference BFF、F06二次验证/幂等恢复及C10审计，受控X06/F09输入。浏览器采用明确cookie身份桥接及回环TLS/CORS替代；故障注入另标SYNTHETIC。权限/离线/拒绝/未知结果/恢复不以UI乐观状态代替服务端事实。

preflight-01不是冻结源码验收：unit.log保留首轮6个fixture错误（StreamEvent缺字段、MFA响应fixture不完整），unit-2.log保留真实组合1个权限假设失败（Viewer C01不授予alerts.read），后改用真实Approver作只读告警消费者，unit-3.log为后续30项通过。browser/保留首轮5/6通过、Approver首次C16后撤权失败（冷C01错误声明默认禁用ops.approve，已修复并加原生回归）；其余终端类型/lint初始失败在当前功能复核文稿中列出，不计为通过。后续代码修正须用新attempt，不覆盖旧失败。

正式stage_gate=NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。G4 IN_REVIEW、G4/FEP-4 NOT_READY_GAPS_OPEN、FEP-4 PARTIAL及既有缺口不变；历史包逐字节保留ORIGINAL_SCOPE_ONLY。UI-P23高保真、目标环境、真实IdP/cookie/CORS、外部告警源、远程CI、Firefox/WebKit、性能长稳、完整I8及RELEASE NOT_RUN。未推送/部署/发布。

## 冻结验收结果

源码候选 `050c12a78bbd3e80f365cd98a3eece462855ead7`；attempt-01：PASS_UI603_ALERTS_INBOX_FUNCTION。35项UI603单元 + 1项UI603真实消费者 + 1项既有C16消费者 + 17项P18订阅 + 15项导航 = 69项；Rust C16 21项；Node门禁/静态路由/阶段政策61项；Chromium 6/6，无重试、skip或flaky。类型、lint、rustfmt、fresh BFF/terminal构建（含client-secret检查）、计划校验均通过。INTEGRATION退出1为预期拒绝，UI-P23 DEVELOPMENT退出0允许。

4次axe（dark/light × 1440/390）共0 violation，保留4项color-contrast incomplete（每次扫描1项），不是人工对比度或完整无障碍验收通过。截图中主滚动容器仅捕获当前可见区域，不声明完整长页视觉/高保真验收。已查看冻结候选dark1440和light390截图，未发现横向溢出；P23仍NOT_RUN。

G4/FEP-4两个历史包153个文件摘要与冻结输入一致，ORIGINAL_SCOPE_ONLY_UNCHANGED。全部159个stage_gate仍NOT_ASSESSED。精确命令和日志见attempt-01/executions.json，变更路径见changes.json，封包文件摘要见packet-manifest.json。
