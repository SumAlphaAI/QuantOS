# G0 DEVELOPMENT 验收规程

> 最新确认（2026-10-06）：项目用户确认范围 `09bcaf7f28d9`，G0/FEP-0 严格 DEVELOPMENT READY；见[当前确认验收报告](../audit/G0-FEP0-user-confirmed-acceptance-2026-10-06.md)。下文含历史确认和执行说明，当前台账绑定最新用户答复。

G0 最低契约、追踪关系、Web/OIDC/SSE PoC 由 `scripts/g0-policy.json` 定义。人工确认统一按 [用户确认流程](./user-acceptance-confirmation-workflow.md)：Codex 拟稿，项目用户一人确认。

- `pnpm scope:g0-development` 输出当前 API、published、planned 排除、一期 Web、输入清单与 `scopeDigest`。
- `pnpm draft:g0-confirmation` 生成 [当前 G0 文稿](./G0-user-confirmation-draft-2026-10-05.md)；不生成用户批准。
- 用户确认后，由 Codex 保存原始答复及本文/范围摘要，更新 `G0-current-scope-confirmations.json`。无需六份角色文件。
- `pnpm assess:g0-development` 先验证当前上游，再实际执行 16 项工程检查，检查输入/计划漂移、构建来源和人工确认，生成内容绑定阶段回执。
- `pnpm check:g0-engineering` 仅验证完整工程回执及状态一致性；`pnpm check:g0-development` 严格要求人工确认和工程/依赖均通过。缺任一条件不得 READY。

当前项目用户已回复“确认 G0 DEVELOPMENT 文稿”，确认原文与不可变文稿/范围摘要保存在[当前台账](./G0-current-scope-confirmations.json)。确认提交 92dddbd 上重新执行 65 项上游与 16 项 G0 检查，全部通过，严格 DEVELOPMENT 门禁返回 READY；见[当前验收报告](../audit/FRONTEND-GATE-G0-user-confirmed-acceptance-2026-10-05.md)。前轮工程结果及流程授权保留历史，不作为本次实际确认或新执行替代。历史十项与当前 19 子项治理保留，人工批准集中不改变任务 owner 或未来交付范围。

Proto breaking 在本机受控 CI 模式显式比较受检源码父提交完整 SHA，并记录基线。数据库验证只能使用已配置 Supabase；G0 本身执行静态、mock/fixture、Chromium 和 loopback SSE。正式部署/IdP、发布性能/长稳、同 SHA hosted CI 与发布用户确认按 RELEASE；新页面还须 PROVIDER:ALL 阶段 READY。
