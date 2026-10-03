# BFF-FE-000 CI 整改与同 SHA 回执执行记录

> 日期：2026-10-03；修复起点：`ad85fc742994a9dff2e3e9f19f10a0728b2c99fd`。
> 本文件记录提交前的工程修复与执行规程。最终源码身份和提交后验收结果由当前 HEAD 的 Git notes 承载，避免在提交内嵌自身 SHA。

## 工程修复

- Secret scan：逐条读取历史 Git 对象，确认 156 个 generic-api-key 匹配均为 JSON 中的 64 位 SHA-256 证据摘要。对其中 138 个源码历史匹配和 18 个本地 notes 匹配登记精确 `commit:file:rule:line` 指纹；没有关闭规则、忽略整个目录或允许任意十六进制密钥。`scripts/check-secrets.sh` 对当前历史扫描通过。
- 安全反证：原 GitHub/Slack 密钥控制保留；新增审计 JSON 中的 64 位十六进制密钥与未审核 digest 控制。新提交即使路径和字段与摘要相似仍会被拒绝，两个扫描测试通过。
- BFF runner：修复两份 `run-checks.py` 的 9+8 项 E401/E701/E702，Ruff 检查和格式检查通过。归一化 Python AST 与原版本一致，执行行为不变。
- 历史证据：原日志和 manifest 未重写；每份 runner 的原始字节另存 `run-checks.original.py.txt`，与历史 manifest 对应的摘要一致。格式化后的脚本摘要登记在本次证据清单，历史 manifest 继续表达其历史版本。
- A1 回归：`make bff-contract-check` 通过。

工程证据：[manifest.json](./evidence/bff-fe-000-ci-receipt-remediation-20261003/manifest.json)；指纹审核清单随证据保存，不含凭据。

## 全仓 CI 边界

本次按指定清单修复 Secret scan 摘要误报及 BFF 审计 runner 的 17 项格式问题。重新执行全仓 Ruff 后仍有 779 项，位于其他历史审计脚本与 `scripts/p0-replay.py`，本次没有通过排除目录来使它们消失。此前 F09 的 Supabase 迁移状态失败也未在本次范围内修改；新提交的远端 CI 尚未运行，不能宣称全仓 CI 已绿。

补充执行 `make f02-check` 时，Secret scan 相关测试通过，但两个 F02-A11 视觉 fixture 测试失败；完整结果保存，未将该命令记为 PASS。这些失败未通过修改视觉验收门槛掩盖。P0 的真实浏览器矩阵须另外完整重放，不能用这些 fixture 或旧报告代替。

## 提交后 P0/F06 验收

现有 `.env.local` 的 Supabase 只读 preflight 为 READY_FOR_LIVE_VALIDATION：同项目、TLS 校验和 BFF 角色存在。后续仅使用此已配置测试目标及现有可清理/回滚探针，不建立本地数据库、不重置 schema、不创建新的项目或身份。

提交全部修复与上述证据后，按 [P0 规程](../P0-acceptance-runbook.md) 对最终完整 SHA 执行：

1. 从 Git archive 导出干净源码，重放 39 项准备/工程/三浏览器检查。
2. 在该导出副本执行七项契约执行反证，确认均真实拒绝。
3. 连接已配置 Supabase，重放真实 Auth/BFF/Runtime、Execution/Vault 与八项实际 PostgreSQL 测试；开发机延迟诊断继续排除。
4. 仅当全部必需项通过，使用 `record-p0-receipts.mjs` 写入最终 SHA 的 `refs/notes/f06-acceptance` 与 `refs/notes/p0-acceptance`。
5. 在干净工作区验证 `make f06-acceptance-gate`、`pnpm check:p0` 和 Secret scan。

本文件不预填提交后 PASS，不复制旧回执或仅更改 sourceCommit。Git notes 内嵌完整日志及摘要，是最终可复核证据；仓库外运行目录只作为过程日志副本。若回执验证失败，保持失败状态并保留原因。

## 下一步边界

P0 回执只放行 A1。即使本轮 P0/F06 通过，也不关闭 PROVIDER:A1、G0、A2 provider 或页面最终 Gate。BFF-FE-001 的代码复审可继续；staging 与当期组织签署仍留在最后评审。分支提交和两个 notes 均仅保存在本地，本次不自动推送。
