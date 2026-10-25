# 4ac41a53 CI 跟踪与修复（2026-10-25）

状态：`PASS_LOCAL_SCOPED_REPAIR_HOSTED_RECHECK_PENDING`。跟踪源码为 `4ac41a53a75dbb3e71838d4d93e8b196cb93fdfd`，在 main 完成本地修复与提交，不推送。本地证据以原 SHA 和修复文件字节绑定，不替代新提交 hosted CI。

## 远端结果

该 SHA 的 8 个 push 工作流全部结束，7 成功、1 失败。F01 Clean Room、F03 Protocol Acceptance、F08 Engine CI、Frontend Baseline、QuantOS Compatibility、F09、R01 均成功，上轮 TP08、Buf 及 TP07 修复涉及的入口已继续通过。F04 有路径触发条件，本轮未触发，不记为本轮通过。

唯一失败为 [QuantOS CI](https://github.com/SumAlphaAI/QuantOS/actions/runs/40192695153) 的 `Deliberately break quality gates` 步骤。52 项质量门禁自检中 51 项通过，Buf 历史协议破坏探针失败。原始日志已经显示被删除的 `Example.value` 字段正确触发兼容性拒绝，但进程退出码为 `100`，自检要求门禁返回 `1`。verify-download 正常传播上游未完成状态，未修改该失败门禁。

## 根因与修复

上轮 `check-proto-breaking.mjs` 接入有界重试后，直接透传 Buf 原始退出码，改变了该门禁既有的 0/1 接口。修复为失败统一退出 `1`，成功仍为 `0`。底层 `run-buf.mjs` 继续保留原始退出码和传输重试规则。

强化原有实际 Buf 探针：有效协议先通过；删除历史字段后，直接 Buf 必须返回 `100`，门禁必须返回 `1` 并保留字段删除诊断，且只能尝试一次；恢复字段后必须再次通过。HEAD baseline 仍必须拒绝。保留原精确退出码断言，没有放宽为任意非零，也没有跳过门禁。

## 本地验证

| 范围 | 结果 |
|---|---|
| 原失败步骤完整入口 `make quality-gate-self-test` | PASS；质量门禁自检 52/52，通过真实工具拒绝、恢复、scanner 故障及覆盖率策略探针 |
| 同入口身份与启动测试 | 10 PASS、1 SKIP；Supabase opt-in 测试未执行，不记为通过 |
| 同入口 Gitleaks 8.28.0 | 937 commits，约 1.93GB，0 leaks |
| Buf 重试、插件配置、baseline、receipt 与手工数据库策略 | 20 PASS，其中 F05/F07 手工策略 6 项 |
| 单独运行实际 Buf 删除字段负向探针 | PASS；原始 `100`、门禁 `1`、无重试、恢复成功 |
| 当前源码真实 breaking 对比 | PASS；可信基线 `7955c5cd3f381284ebf1d6b2fbded35a50a7b5a0` |

修复仅影响门禁退出码及直接相关探针，没有修改协议或生成物，因此未额外重跑完整协议生成、跨语言语料、全仓构建或数据库 campaign。原 SHA 的成功工作流保留自己的适用范围；新提交 hosted CI、原主 CI 失败点之后的完整步骤、真实数据库和发布验收为 `NOT_RUN`。

## 证据和手工边界

[证据目录](evidence/ci-4ac41a53-20261025) 保留原远端终态、job 元数据、失败日志和本地验证日志；`.gz` 可用 `gzip -dc` 无损读取，摘要见 `SHA256SUMS`。`source-binding.json.gz` 绑定两份修复源码字节，`validation-summary.json.gz` 记录验证与未执行范围。历史审计证据未改写。

该 SHA 的完整运行清单中 F05/F07 数量为零。两份工作流仍只允许 `workflow_dispatch`，确认默认 false，并要求 `QUANTOS_MANUAL_F05_F07=1`；本轮真实数据库、全量覆盖率与 campaign 均未执行，未修改 secrets。

下一步：用户推送本地修复提交后，跟踪同一新 SHA 的 QuantOS CI 以及后续步骤；没有把本地修复提升为全局 READY。
