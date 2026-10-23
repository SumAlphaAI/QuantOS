# UI-301 本机当前功能证据

- [规程](../../../operations/ui301-strategy-drafts.md)、[报告](../../UI-301-function-review-2026-10-23.md)、[机器回执](receipt.json)。执行 `node scripts/ui301-review.mjs --verify` 校验原源码提交与所有输入、日志、产物哈希。
- `attempt-01/unit.log` 是未冻结工作区的探索性失败：38 项中 2 失败（409 测试夹具缺失 parameters；目录刷新误用历史游标集合）。修正后使用全新 attempt，不覆盖原失败，不作为候选 PASS。
- 后续每次 attempt 记录 `inputs.json`、`executions.json`、日志和浏览器原始证据。`receipt.json` 只指向完整成功尝试；失败目录不删除、不拼接。
- 类型检查曾发现测试 handler 返回 void 与声明不符；已修正测试签名。lint 曾发现 Node 测试中的 structuredClone 全局声明；改为显式 globalThis。二者是冻结前探索，不宣称通过；冻结后重新执行并保存结果。
- 截图、axe incomplete、真实 C05 网络记录、明确的合成故障及身份/CORS 替代分别保留。本机结果不代替完整联调、目标环境、发布或用户确认。
