# ADR：A1 基线安全契约修正与兼容准入

- 日期：2026-10-03
- 状态：工程修正已登记；`ENGINEERING_ONLY_PENDING_A1`；目标环境放行与联合签署未完成
- 决策依据：用户要求逐项整改 [BFF-FE-000 全面复审](../audit/BFF-FE-000-comprehensive-review-2026-10-03.md)
- 原基线：`75a563c62d3d7883d5b178111becec07d4da0301` / API 1.3.0
- 修正候选：API 1.4.0，保持 `/v1`；不表示已兼容历史生产调用方
- 机器登记：[精确变更与指纹](../../bff/compatibility/a1-security-correction.json)；有效期至 2026-11-03

原基线遗漏必需安全条件：Cookie 认证下缺 CSRF、业务写缺客户端请求 ID、审批缺 recent-auth、开放命令输入允许伪造上下文、SSE payloadVersion 未限制。补充这些约束会拒绝旧的不安全请求，因此属于显式登记的兼容性变更，不能通过重新生成资产或修改 minor 版本静默绕过。

本决策允许在尚未关闭 PROVIDER:A1/G0 的工程基线中修正这些缺口，不授权生产发布、批准组织签署或替代 `/v2` 的正常破坏性发布规则。`pnpm check:bff-compatibility` 比较可信 Git 历史基线；CI 使用 PR base 或 push before 的完整 SHA；缺少/非法基线、未登记差异、相同版本的破坏性修改、过期登记均失败。登记逐条绑定原值与新值的 SHA-256，仅当前列出的变化可通过；描述、示例和新增可选属性不计破坏项。约束和数组变化采取保守拒绝策略，可产生需要人工确认的兼容告警。

迁移要求：

1. 受认证写操作携带 CSRF Cookie、`X-CSRF-Token` 与受信 Origin。22 个业务写操作额外携带 UUID `X-Request-Id`、`Idempotency-Key`；后者在同一业务重试中保持不变。
2. 命令顶层禁止未知属性，身份由受信服务端会话注入。审批必须提供 `reauthTokenRef`。设置与策略编辑用 ETag/If-Match 检查对象版本。
3. `VERSION_CONFLICT` 必须返回 currentVersion；429 必须返回 retryAfter；所有响应发布 correlation/cache header 与安全 default 错误 envelope。
4. SSE canonical payloadVersion 为 `v1`，暂时保留既有 `1` 别名；其他版本终止消费且不应用状态。合法开放 payload/parameters 需完整保留。
5. 调用方、生成物、MSW、参考 provider 与 schema harness 同步更新后，仍需真实 staging 回执及当期各角色签署。到期未关闭 A1 时保持阻断，由 owner 另行决定迁移和续期，不自动延长登记。

原审计与历史签署保持原始文件；新增整改报告记录本次复验。新提交必须重新取得同 SHA 的阶段回执，不能继承原 P0/F06 的验收结论。
