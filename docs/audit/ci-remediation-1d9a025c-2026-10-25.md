# 1d9a025c CI 跟踪与修复（2026-10-25）

状态：`PASS_LOCAL_SCOPED_REPAIR_HOSTED_RECHECK_PENDING`。跟踪源码为 `1d9a025c80fa2023114b4d16feb731ffba983789`，在 main 修复、验证并生成本地提交，不推送。本地修复按源码文件字节绑定，不替代新提交 hosted CI。

## 远端结果

该 SHA 的 8 个 push 工作流全部结束，7 成功、1 失败。F01 Clean Room、F03、F08、Frontend Baseline、QuantOS Compatibility（三浏览器）、F09、R01 均成功。F04 本轮未满足路径触发条件，未运行，不记为通过。

唯一失败为 [QuantOS CI](https://github.com/SumAlphaAI/QuantOS/actions/runs/40195711752) 的 `Check F02 rejection and recovery paths`。该工作流已经通过上轮退出码修复涉及的质量门禁自检，继续通过 lint、全仓测试、三种语言覆盖率、license、SCA 及 CI runner 的隔离 PostgreSQL 检查；这些成功保留在本 SHA、相应环境和步骤范围内，不等同目标 Supabase 或发布验收。后续打包和下载验证未完成，verify-download 继续正常传播失败。

原 F02 拒绝恢复测试共 59 项，58 PASS、1 FAIL。失败用例为 `candidate import rejects tampering and stale source before writing, then imports the reviewed matrix`，报错 `Expected exactly 42 Linux snapshots`，本机在修改前已复现相同失败。

## 根因与修复

候选导入器使用 `candidateVisualPaths('linux')`，需要 42 张候选：12 张原 shell 矩阵，加 P01 的三浏览器、双主题、五页面，共 30 张。测试夹具仍使用 `requiredVisualPaths('linux')`，只生成原 12 张，因此正常恢复后的导入也被拒绝。此前负向分支只断言非零退出码，清单错误会提前阻断篡改和过期来源检查，使这些断言缺少针对性。

仅修改 `scripts/f02-a11-gate-negative.mjs`：使用完整候选集合生成合成 PNG；保留 42 张数量断言；增加缺少 P01、重复路径的拒绝检查；使用有效 PNG 的像素变化验证真实字节摘要拒绝；通过修改 rendering input 验证过期来源拒绝。每种失败必须匹配对应原因，并保持整个 manifest 字节不变、所有目标 PNG 均不存在。恢复输入后，必须成功导入全部 42 张，逐项核对导入路径和实际字节。

导入器、完整矩阵要求、工作流、实际截图和历史基线 manifest 均未修改；没有通过缩小矩阵或更新截图取得通过。合成 fixture 的导入成功仅证明工具测试，不是实际视觉验收。

## 本地验证

| 范围 | 结果 |
|---|---|
| 原始候选导入用例，修改前 | FAIL，复现远端 12/42 清单不一致，原日志保留 |
| 修复后的候选导入用例 | PASS；四类针对性拒绝、失败无写入、恢复完整导入 42 张 |
| 原失败步骤完整入口 `make f02-check` | 55 PASS、0 FAIL、1 SKIP |
| 实际 PostgreSQL storage fixture | `NOT_RUN`；未启用连接，父测试 SKIP，三个实际数据库子测试未执行；这是本地与远端测试数不同的原因 |
| F05/F07 手工策略检查 | 6 PASS，无全量 campaign |
| Linux 和 Darwin 实际基线 manifest 检查 | 均 PASS；142 entries，检查文件清单、尺寸与 SHA-256，不是浏览器重放 |

保留两次中间诊断断言失败：尝试对损坏 PNG 检查特定错误文字时，pngjs 分别返回未完成流和尾部内容错误；最终改为有效 PNG 像素篡改，直接验证导入器摘要检查。见 `execution-notes.json.gz` 与各次原始日志，未把中间失败记为通过。

## 证据与边界

[证据目录](evidence/ci-1d9a025c-20261025) 保留精确 SHA 的工作流终态、job 元数据、原远端失败、修改前复现和本地验证日志。`.gz` 可用 `gzip -dc` 无损读取；完整性见 `SHA256SUMS`。`source-binding.json.gz` 绑定唯一修复源码文件，`validation-summary.json.gz` 记录验证与未执行项。历史审计证据不改写。

F05/F07 在本 SHA 的工作流清单中均无运行，仍只允许 workflow_dispatch、确认默认 false，并要求 `QUANTOS_MANUAL_F05_F07=1`。本轮未连接真实数据库、启动本地数据库、修改 secrets 或执行全量覆盖率 campaign。

新提交 hosted CI、实际 PostgreSQL fixture、新浏览器运行、完整 F01、全量联调和发布验收均为 `NOT_RUN`。下一步为用户推送本地修复后，跟踪新 SHA 的 QuantOS CI 及后续打包和下载步骤；不提升全局 READY。
