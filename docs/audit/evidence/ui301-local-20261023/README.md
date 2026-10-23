# UI-301 本机当前功能证据

- [规程](../../../operations/ui301-strategy-drafts.md)、[报告](../../UI-301-function-review-2026-10-23.md)、[机器回执](receipt.json)。执行 `node scripts/ui301-review.mjs --verify` 校验原源码提交与所有输入、日志、产物哈希。
- `attempt-01/unit.log` 是未冻结工作区的探索性失败：38 项中 2 失败（409 测试夹具缺失 parameters；目录刷新误用历史游标集合）。修正后使用全新 attempt，不覆盖原失败，不作为候选 PASS。
- `attempt-02` 绑定源码 `19151b75`：38项前端、2项Rust、类型/lint/路由/构建通过；6项浏览器因前端误用不存在的 strategy.read 而在授权入口失败。真实C05用 strategy.write/strategy.approve授予读取，已修正到新候选；不拼接本轮通过项。
- `attempt-03` 绑定应用源码 `b0e998fe`：38项前端、2项Rust、14项路由/门禁、类型/lint/构建通过；浏览器5/6通过，12次axe零violations。失败为422文案断言忽略附加关联ID，产品实际已正确拒绝和暂停。仅修正测试断言并在全新attempt重跑浏览器；应用源码、binary和buildId保持原SHA，不重构建或改绑历史结果。
- `attempt-04` 保留失败：browser-only运行错误地向新HEAD的reference fixture传入旧应用SHA；fixture_source_commit要求checkout HEAD与GITHUB_SHA一致，C05 seed拒绝不一致来源。修正执行环境为工具/fixture实际SHA；应用buildId与binary仍绑定原b0e998fe，不修改fixture来源校验。
- `attempt-05` 浏览器5/6通过；真实只读审批者在C01成功后被reference会话流立即错误撤权。保留失败，修复C01/reference流身份有效性判断不一致并新增过期/撤权回归；这是实际代码变更，重新冻结候选并构建，不复用旧应用PASS。
- 最终 `attempt-06` 绑定完整源码 `0642eaadb7d84a76caec4c58aa153e0caa75a8b4`，15组检查全部符合预期：38前端、5Rust、14路由/门禁、6Chromium，12次axe零violations/8项incomplete。Gate=PASS_UI301_CURRENT_FUNCTION；不使用跨候选复用，确认待定，完整联调/发布NOT_RUN。
- 后续每次 attempt 记录 `inputs.json`、`executions.json`、日志和浏览器原始证据。`receipt.json` 只指向完整成功尝试；失败目录不删除、不拼接。
- 类型检查曾发现测试 handler 返回 void 与声明不符；已修正测试签名。lint 曾发现 Node 测试中的 structuredClone 全局声明；改为显式 globalThis。二者是冻结前探索，不宣称通过；冻结后重新执行并保存结果。
- 截图、axe incomplete、真实 C05 网络记录、明确的合成故障及身份/CORS 替代分别保留。本机结果不代替完整联调、目标环境、发布或用户确认。
