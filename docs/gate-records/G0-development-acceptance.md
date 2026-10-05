# G0 DEVELOPMENT 验收规程

当前 G0 的最低契约、追踪关系、Web/OIDC/SSE PoC 和范围确认由 `scripts/g0-policy.json` 定义。`pnpm check:g0-records` 仅核对历史记录与当前遗留子项；不能授权阶段 READY。

- `pnpm scope:g0-development` 输出当前 API 版本、published 列表、planned 排除、一期 Web 范围、输入清单与 `scopeDigest`，供六方审阅。
- `pnpm assess:g0-development` 在已提交工程源码、上游内容有效 READY 的条件下实际执行 16 项检查，保存日志、构建来源、依赖摘要及 scope 请求；只登记功能评估结果。
- `pnpm check:g0-engineering` 校验完整工程执行回执及状态一致性；六方确认缺失时返回工程 PASS、G0 BLOCKED，绝不放行新页面。
- `pnpm check:g0-development` 是严格准入入口。当前六方确认缺失、依赖失效、少跑检查、日志被替换、来源/契约/配置/测试漂移均返回非零。
- `pnpm test:g0-development` 与 `pnpm test:pre01` 持续拒绝以上反证；生产页面和 src 内不得导入 legacy backend、内部数据库/engine/venue 模块或测试 fixture。合法 fixture 仅位于 tests 中，生产组装必须显式注入 client。

当前用户已明确“暂无，先完成工程整改”，因此 `G0-current-scope-confirmations.json` 保留 PENDING。Product、Frontend、BFF、QA、Security、Risk 六方需要针对同一当前 scopeDigest 提供真实确认记录；执行修复授权、2026-08-14 历史签署、本机测试或正式 RELEASE 签署均不能替代该 DEVELOPMENT 确认。

补齐记录时，每角色条目需包含 `role`、`identity`、`authorization`、`confirmedAt`、`scopeDigest`、`record`（仓库内 JSON 路径）和 `recordSha256`。对应原始记录须保留相同身份、授权、时间及摘要字段，另含 `decision: CONFIRMED`、`stage: DEVELOPMENT`。记录者须核对真实组织授权；校验器检查来源与内容一致性，不冒充组织身份系统。六方条目齐全后将顶层状态改为 CONFIRMED，并填当前 scopeDigest，重新执行受影响上游与 G0 评估，不手工篡改 READY。

历史十项的日历截止日与逾期事实保留。当前 [19 个子项](./G0-current-disposition.md) 使用最晚检查点作为工程消费期限，未声明 owner 已签署新的日历承诺；子项 `IMPLEMENTED_ENGINEERING` 只说明已引用仓库交付，原整项与未来目标验收没有被关闭。

上游策略广泛绑定 scripts、CI、包配置及源码。本轮这些输入变化，需要重新取得受影响功能回执。提供 `pnpm assess:provider-a1 -- <原证据目录下的新快照目录>` 保存独立执行结果，原完整轮与失败证据不覆盖。数据库验证只能使用工程现有 Supabase 配置；G0 本身仅执行静态、mock/fixture、Chromium 和 loopback SSE。

正式 staging、真实 IdP、组织发布签署、远程同 SHA CI、完整平台矩阵及性能/长稳在 RELEASE 验收。新页面还须 PROVIDER:ALL 阶段 READY；工程 PASS 或 G0 单独 READY 均不授权绕过该依赖。
