# main 快速迭代期保护调整

日期：2026-10-02（Asia/Shanghai）。用户授权在快速迭代期解除直接提交 main 的限制，平稳期再恢复。

GitHub 仓库：`SumAlphaAI/QuantOS`；规则集：`F02 main required gates`（23727075）。

临时移除 `required_status_checks`，允许正常直接 push main；规则集保持 active，禁止删除与非 fast-forward（强推）两项保护继续生效。未修改 bypass actors、workflow 或 CI Gate 代码。推送后 CI 仍按原 workflow 运行；直接推送成功不代表测试或阶段验收通过。未执行代码提交或试验性 push。

修改前管理员权限已确认，无传统 branch protection（GitHub 返回 404 Branch not protected）。修改后独立 GET 读回与预期配置一致；main 有效规则仅含 deletion、non_fast_forward。配置读回通过，不是实际 push 测试。

## 配置与证据

- `original-ruleset.json`：修改前完整 GET 响应。
- `restore-ruleset.json`：恢复原始规则的 PUT 请求体，包含原 8 项必需检查及 strict 设置。
- `development-ruleset.json`：开发期 PUT 请求体。
- `update-response.json`：修改响应。
- `readback-ruleset.json`、`effective-main-rules.json`：修改后的独立读回。

## 平稳期恢复

由用户明确要求恢复时，在仓库根目录执行：

```sh
gh api --method PUT repos/SumAlphaAI/QuantOS/rulesets/23727075 --input docs/audit/main-protection-2026-10-02/restore-ruleset.json
gh api repos/SumAlphaAI/QuantOS/rulesets/23727075
gh api repos/SumAlphaAI/QuantOS/rules/branches/main
```

恢复前先读取最新规则并检查是否有后续变更；若有，应合并后续配置，避免旧快照覆盖新的治理规则。当前没有设定恢复日期或创建自动恢复任务。
