# F02-A11 原始证据索引

- `ruleset-before.json`：整改前仅防删除/强推，管理员可绕过。
- `ruleset-request.json` / `ruleset-effective-probe.json`：实证期间同一个规则集同时覆盖 main 和隔离目标，8 项 GitHub Actions 来源检查，strict 开启，无 bypass。
- `main-effective-probe.json` / `target-effective-probe.json`：两个分支的实际生效规则，须完全相同。
- `failure-ci.json`：真实故障提交的 verify / verify-download 均 failure。
- `blocked-merge-response.txt` / `blocked-rule-suite.json`：GitHub HTTP 405 及 required_status_checks 拒绝审计。
- `local-a11-tests.txt`：本地 6 项既有 A11 回归全部通过。

故障源 SHA：`67cf71f40d276d50db2d976988a20ecdbac886df`。
最终恢复源 SHA：`577c2613f19dcf499eb047330f99dad9a548ec9e`。
PR 测试合并 SHA：`c9e02c0b5c2c35fa62e2da745e02eab9566ee9f4`。
实际隔离合并 SHA：`1ca34c70a0c5f25c09fec11a6bd46d7ff79ca841`。
主线源 SHA：`ac73a95a758cc95385b69e9d6f9376cef4a2af0b`。
隔离 PR：https://github.com/SumAlphaAI/QuantOS/pull/3 。

## 验收结果与其余证据

**required checks 保护验收 PASS**，完整离线字段核验结果见 `verification.json`，全部原始文件 SHA-256 见 `SHA256SUMS.json`。这不是当前 main 的全部 Gate 验收通过。

- `recovery-pr-before-merge.json` / `recovery-check-runs.json`：固定 head、base 及 8 项 GitHub Actions 检查成功。
- `recovery-merge.json` / `recovery-rule-suite.json`：实际隔离合并成功及 required_status_checks 的 pass 审计。
- `ruleset-final.json` / `main-effective-final.json`：最终 main-only 规则、strict、8 项 App 来源检查、零 bypass。
- `main-ref-final.json`：验收完成时主线仍为 ac73a95，未将故障测试历史合入 main。
- `recovery-ci-run.json` / `recovery-ci-jobs.json` / `recovery-download-receipt.json`：恢复 CI 与 PR 完整性下载复验；PR 不使用正式签名密钥，formalSignatureVerified=false 是正确事件边界。
- `recovery-clean-room-*.json` / `recovery-reproducibility.json`：恢复 SHA 的三次构建通过，实际执行绑定 PR merge SHA。
- `main-run.json` / `main-jobs.json` / `main-check-runs.json` / `main-artifact-index.json`：main CI 与制品来源；独立 reproducibility 失败单独保留。
- `main-download-receipt.json` / `main-validation/` / `main-ci-gate-excerpts.log`：main 正式签名与下载复验、完整扫描/DB/license、覆盖率和负向门禁日志。正式 HMAC 密钥未读取；签名成功依据独立远程 job 原始回执。本次未再次在本机下载完整二进制包。
- `main-reproducibility-failed.json` / `main-reproducibility-differences.json` / `main-clean-room-first.json`：当前 main 的 Terminal 构建摘要差异，仍为 FAIL。
- `first-recovery-failed.*` / `post-browser-*`：修复前 Playwright 浅历史问题的原始失败及脱敏指纹，不作成功证据。
- `playwright-history-regression.txt` / `local-f02-tests.txt`：真实 Git/Playwright 正反对照及本地 15/15 F02 回归。

所有时间按原始服务端字段保留；报告日期使用 Asia/Shanghai。日志节选保留原 step 与 UTC 时间，不把节选冒充完整日志。
