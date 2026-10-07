# 47cb743 hosted CI 验收报告

> 验收日期：2026-10-07（Asia/Shanghai）；验收对象：`47cb743c4587f2eb866f39c594a472a86d262dfc`。本地 HEAD、远端 main、全部 Actions/check-runs 与 F02 失败 artifact 均绑定该提交。证据读取时间为 14:12 左右；所有本次 push 工作流均已结束。

## 一、任务完成概况

**hosted CI 验收未通过。** 本次 push 实际触发的 9 个工作流全部完成，8 PASS、1 FAIL；20 个作业中 14 成功、2 失败、4 跳过。两条失败来自 **1 个根因及其下游连带拒绝**，不是两项独立功能缺陷。

A2 所在 Frontend Baseline 成功：身份、Audit、当前开发回执与新增 PROVIDER:A2 聚合 Gate 均实际执行通过，聚合返回 READY、26 API、31/31 专用门禁用例 PASS。该成功子范围不能代替主 CI、数据库重建或 F02 构建下载签名验收。

[机器核验记录](evidence/ci-47cb743-acceptance-20261007/verification.json)与[完整运行原件](evidence/ci-47cb743-acceptance-20261007/runs.json)保留本次事实；原 A2 整改报告及其摘要索引保持历史原件，不将本轮失败覆盖为 PASS。

## 二、完成情况明细统计

| 同 SHA 工作流 | Run ID | 结果 |
|---|---:|---|
| [F01 Clean Room](https://github.com/SumAlphaAI/QuantOS/actions/runs/37578281105) | 37578281105 | PASS |
| [F03 Protocol Acceptance](https://github.com/SumAlphaAI/QuantOS/actions/runs/37578281197) | 37578281197 | PASS |
| [F04 Core Branch Coverage](https://github.com/SumAlphaAI/QuantOS/actions/runs/37578281270) | 37578281270 | PASS |
| [F08 Engine CI](https://github.com/SumAlphaAI/QuantOS/actions/runs/37578281295) | 37578281295 | PASS |
| [F09 Observability Gate](https://github.com/SumAlphaAI/QuantOS/actions/runs/37578281215) | 37578281215 | PASS |
| [Frontend Baseline (FEP-0)](https://github.com/SumAlphaAI/QuantOS/actions/runs/37578281222) | 37578281222 | PASS |
| [QuantOS CI](https://github.com/SumAlphaAI/QuantOS/actions/runs/37578281228) | 37578281228 | FAIL |
| [QuantOS Compatibility](https://github.com/SumAlphaAI/QuantOS/actions/runs/37578281199) | 37578281199 | PASS |
| [R01 Market Service Gate](https://github.com/SumAlphaAI/QuantOS/actions/runs/37578281153) | 37578281153 | PASS |

| 验收项 | 本轮实际结果 |
|---|---|
| 提交与运行绑定 | 9 run、20 check-run 全部为该完整 SHA；远端 main 一致，均 completed |
| Frontend / A2 | 身份、Audit、聚合、G0 工程与 FEP-0 内容 Gate 成功；聚合 31/31 PASS，[实际日志](evidence/ci-47cb743-acceptance-20261007/provider-a2-hosted.log) |
| A2 语义 artifact | Rust lib、reference provider、Terminal consumer 三条命令退出码 0；三个下载日志摘要与 semantics.json 一致，[原件](evidence/ci-47cb743-acceptance-20261007/a2-semantics/semantics.json) |
| 主 CI 上游检查 | 浏览器、锁文件、proto/BFF、lint/test、三类覆盖、许可证和 SCA 均成功 |
| F02 重建/漂移/RLS | `Rebuild isolated databases and test drift and RLS` 失败；[database.json](evidence/ci-47cb743-acceptance-20261007/f02-validation/database.json) 为 FAIL、checks=[]、dirty=false、source=验收SHA |
| 后续 F05/F02 | F05 数据库 Gate、F02 负向/恢复、构建打包等步骤 skipped，未执行不能记作通过 |
| 签名与下载 | signing-policy、sign-main、verify-download-main 被上游失败阻断；verify-download 返回 failure。PR专用 verify-download-pr 按 push 事件条件正常跳过 |
| 分支检查配置 | 读取到 required_status_checks 的 contexts/checks 均为空、enforcement_level=off；活动规则仅删除和非快进保护。此配置不替代实际 CI 验收条件 |

本轮没有在本机运行 PostgreSQL、Docker、Supabase local 或数据库复现；CI 日志中的 loopback PostgreSQL 属 GitHub runner 环境。本轮未重跑远端工作流或修改外部数据库。

## 三、问题清单及风险分析

| 优先级 | ID / 模块 | 具体表现 | 影响范围与证据 |
|---|---|---|---|
| 阻塞级 | CI-01：F02 Storage fixture / Audit 导出迁移兼容性 | `scripts/f02-db-gate.cjs:29` 只创建 id/name/public 三列；`20261006100000_bff_audit_exports.sql:54` INSERT 及第56行 UPDATE 使用 file_size_limit。迁移 apply 报 `column "file_size_limit" of relation "buckets" does not exist` | 主 CI verify 失败，重建/漂移/RLS未完成；F05/F02后续执行、构建、签名及下载受阻。[失败日志](evidence/ci-47cb743-acceptance-20261007/verify-failed.log) |

`verify-download` 的第二条错误是 CI-01 的连带结果：`MAIN_RESULT=skipped`，既有 fail-closed 聚合检查要求 main 下载验证 success，因此退出 1。[下游日志](evidence/ci-47cb743-acceptance-20261007/download-failed.log)与工作流 needs 链一致，无独立下载损坏或签名错误证据。

**同根因的潜在后续阻断（静态发现，未执行）**：`scripts/f05-db-gate.cjs:77` 同样仅创建三列 storage.buckets，随后执行完整 migration apply；只修 F02 fixture 后，F05 仍存在同一迁移兼容风险。本次 F05 步骤 skipped，不将此推断写成实际失败。核验记录已分别标记 STATIC_ONLY / SKIPPED。

Actions 有 Node 20 action runtime 迁移警告；警告没有使上述八个工作流失败，也不是这次数据库错误根因。当前问题影响 CI 完整准入，A2 开发内容 READY 和已确认的 G0 范围仍按既有阶段证据记录；没有将它们提升为 RELEASE 或正式 ACCEPTED。

## 四、整改建议与后续验收

1. 同步修复 F02 与 F05 的 Supabase Storage fixture，使 storage.buckets 定义覆盖当前迁移所需的 file_size_limit；建议共享该 fixture，减少两套定义继续漂移。
2. 增加能覆盖“完整当前迁移 + 两条 fixture”的兼容回归；保留数据库独立性、schema drift、RLS/FORCE RLS、权限与负向保护。不要删除 bucket 限额迁移或跳过失败门禁。
3. 本机数据库验证继续遵守 AGENTS.md，仅使用现有配置的 Supabase；GitHub runner 隔离 fixture 的实际验证由新候选提交 hosted CI 完成。静态或 Supabase PASS 不能替代 CI fixture 重建结果。
4. 修复后生成并推送新提交，再对新完整 SHA 验收：主 verify、F05/F02后续步骤、signing-policy/sign-main、verify-download-main/verify-download 全部成功，下载回执提交一致，且其他应触发工作流成功。保留本次失败原件。

当前结论为 **FAIL / 待整改**，没有重新运行原失败任务来改变该结论。本报告只记录验收发现；功能源码和已确认范围保持本次验收对象原字节。证据摘要见[索引](evidence/ci-47cb743-acceptance-20261007/evidence-index.json)。
