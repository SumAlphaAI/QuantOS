# 7e38f7e8 CI 跟踪与修复（2026-10-27）

状态：`PASS_LOCAL_SCOPED_REPAIR_HOSTED_RECHECK_PENDING`。跟踪源码为 `7e38f7e8a881b88e1be52bff31465628d9c4f759`，在 main 完成本地修复与提交，不推送。本地结果绑定基线 SHA 和修改文件字节，不替代新提交 hosted CI 或发布验收。

## 远端结果

该 SHA 的 8 个 push 工作流全部结束，7 成功、1 失败。F01 Clean Room、F08 Engine CI、Frontend Baseline、QuantOS Compatibility（Linux 三浏览器）、F03、R01、F09 均成功。上轮 L01、F08 坐标、浏览器入口及 PRE-04 修复涉及的入口已继续通过；这些结果保留原 SHA/范围。F04 本轮未触发，不记为通过。

唯一失败为 [QuantOS CI](https://github.com/SumAlphaAI/QuantOS/actions/runs/40424827368) 的 `Secret scan`。实际 Gitleaks 8.28.0 完整历史扫描 947 commits、约 1.99GB，返回 1090 个命中；原日志只打印数量，未给出逐项报告。verify-download 正常传播上游未完成状态，没有修改该门禁。

本地使用相同固定版本、配置和现有 ignore 文件复现完整历史扫描；本地扫描 968 commits，得到同样的 1090 个新增命中。脱敏原始报告、原失败日志及运行元数据保留，没有通过缩小历史范围获得通过。

## 逐项核实与修复

1090 项均为 generic-api-key，来自 8 个历史提交：

| 类别 | 数量 | 核实依据 |
|---|---|---|
| 自有测试请求幂等键 SHA-256 | 1065 | 历史 JSON 中严格的 keyHash 字符串、64 位十六进制；所属对象具有 method/path/status/source，来自 reference 或 synthetic 测试请求。核对相关历史 fixture 的 idempotency-key → SHA256 → hex 输出代码 |
| 自有 R1 工作流幂等标识 | 24 | r1-chain 中的 idempotency_key 为 r1- 加 UUID；对应历史测试模块明确由 source.workflow_run_id 格式化生成，用于去重，不用于认证 |
| 负向输入 canary | 1 | core-l01-review.test.mjs 中公开 owned-canary 字面量，位于 assert.throws 拒绝测试，不是运行环境凭据 |

逐项读取实际历史 Git blob，记录 commit、path、rule、line、blob SHA-256、行 SHA-256、分类及对应 producer 输入；共核对 17 份历史 producer 快照。原始幂等键不写入这些日志，因此没有声称反推并重新计算其哈希。审阅过程及只读复核脚本见证据目录中的 `history-finding-review.json.gz` 和 `review-history-findings.py.gz`。

仅在 `.gitleaksignore` 追加这 1090 个固定的 commit/file/rule/line fingerprint，原文件字节作为完整前缀保留。没有增加目录、字段名、哈希值或规则的全局豁免；`.gitleaks.toml`、`scripts/check-secrets.sh`、Gitleaks 固定版本和完整历史扫描方式均不变。历史证据、运行时 producer 和 Git 历史未修改。

增强现有真实扫描器控制：在原三个测试路径之外，增加一个本轮有历史 fingerprint 的 R1 路径；每个路径先验证干净控制通过，再在新提交中写入 API 字段、未审阅 digest 字段和 keyHash 形状值，均必须被实际扫描器拒绝。已有 GitHub/Slack 正向命中与 scanner 故障控制保留。历史精确登记不能使后续提交的同路径或同字段值自动通过。

## 验证

| 范围 | 结果 |
|---|---|
| 修改前完整历史扫描 | FAIL；复现 1090 项，脱敏报告保留 |
| 逐项历史 blob/producer 复核 | 1090/1090 完成；分类 1065 + 24 + 1，无未分类项 |
| 修改后原入口 `bash scripts/check-secrets.sh` | PASS；968 commits、约 1.99GB，无命中 |
| 实际 Gitleaks 定向正负控制 | 2 个测试 PASS；包含新提交、相同历史路径、keyHash/API/digest 字段、GitHub/Slack 与工具故障 |
| 完整质量门禁负向套件 | 52 PASS，无 skip；包含真实工具拒绝与恢复探针 |
| L01 验证器与 F05/F07 手工策略 | 45 PASS，其中手工策略 6 项；canary 对应拒绝检查仍通过 |
| 原始证据目录扫描 | PASS，无命中；未放宽扫描配置 |

没有因这次扫描策略登记重跑编译、浏览器、数据库或完整业务链。新提交 hosted CI、原主 CI 后续尚未执行步骤、新构建/浏览器、真实数据库及发布验收均为 NOT_RUN；原 SHA 的其他七项成功保留自己的适用范围。

## 证据与后续

[证据目录](evidence/ci-7e38f7e8-20261027) 保留原始脱敏命中、审阅分类、精确 fingerprint 清单、完整历史重放和真实负向控制日志。`.gz` 可用 `gzip -dc` 无损读取，完整性见 `SHA256SUMS`。`ignore-change.json.gz` 验证原文件字节未重写，`source-binding.json.gz` 绑定两份修复文件和未改动的 scanner 输入；`validation-summary.json.gz` 记录范围、计数和未执行项。

F05/F07 在本 SHA 工作流清单中均无运行，仍仅 workflow_dispatch、确认默认 false 并要求 QUANTOS_MANUAL_F05_F07=1。本轮未读取或复制配置凭据、连接真实数据库、启动本地数据库、修改 secrets、推送或发布。

下一步：用户推送本地修复提交后，跟踪同一新 SHA 的完整历史凭据扫描及后续 CI 步骤；本地通过不提升全局 READY。
