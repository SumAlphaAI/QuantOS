# PREPARATION:P0 整改记录

> 历史记录：以下为 2026-10-03 当时的验收规则与事实。2026-10-05 再复核结论及现行阶段边界见[当前报告](./PREPARATION-P0-comprehensive-review-2026-10-02.md)；旧文中的新 HEAD 重跑要求仅适用于正式同 SHA 声明。

> 初审日期：2026-10-02；完成日期：2026-10-03。源码提交：`0149e5681fde7c6b75f891f6708d63726f075fc9`。
> 3/3 问题关闭，16/16 控制点 PASS，A1_ONLY。后续文档提交必须另取当前 HEAD 回执。

## 逐项修复与验收

| 问题 | 级别/模块 | 修复 | 验收与结论 |
|---|---|---|---|
| B-01 | 阻塞 / PRE-04 → CORE:F06 | 固定已提交源码，沿用配置 Supabase；新增目标重放与回执记录入口，不降低完整 F06 前置要求 | 真实 Auth/BFF/Runtime 通过，Execution 6 场景、Vault 8 角色拒绝、PostgreSQL 8 测试通过；同 SHA F06 notes 和门禁 PASS，CLOSED |
| H-01 | 高危 / PRE-06 | 统一 beforeEach 强制 expect.hasAssertions；结构检查拒绝提前退出和非直接执行断言；增加实际进程变异回归 | 17 契约正常测试、17 门禁回归通过；7 项进程变异全部 exit 1；直接 Vitest 的提前返回/死分支/helper/空回调被零断言检查拒绝，CLOSED |
| M-01 | 中危 / P0 验收记录 | 新增当前 HEAD P0 notes 判定器、固定 39 命令、日志压缩及摘要、16 控制点和受限准入；计划登记已接受 SHA | 16 项 P0 正负回归通过；缺失/旧 SHA/失败/损坏/缺项证据及不完整前置均拒绝；实际 P0 notes 与门禁 PASS，CLOSED |

主要实现：`scripts/check-p0-acceptance.mjs`、`scripts/record-p0-receipts.mjs`、`scripts/run-p0-f06-target.mjs`、`scripts/p0-replay.py`、`scripts/p0-contract-execution-negative.mjs`、`scripts/pre06-test-structure.mjs`、`tests/contract/contract.test.ts`。CI 增加 `pnpm test:p0` 政策回归；该本地接线检查不宣称远端 CI 已运行。

## 证据与执行边界

[原审计](./PREPARATION-P0-comprehensive-review-history-2026-10-02.md)保留 81.25% 与三项原始发现；[当前报告](./PREPARATION-P0-comprehensive-review-2026-10-02.md)为完成视图；[清单](./evidence/p0-preparation-remediation-20261002/source-0149e56/manifest.json)记录原报告及全部本次文件 SHA-256。

本次已提交源码重放：39/39 联合命令、135/135 浏览器、7/7 反证拒绝、F06 7/7 步骤、8/8 实际数据库测试；39 项累计 116.295 秒。既有同目录下未带 `source-0149e56` 的日志属于提交前工程验证，不能单独充当已提交源码回执。

首次 F06 运行因 trace 路径缺失失败；已保留原结果与启动诊断，补齐仓库外临时路径后完整重跑。无凭据入库，无本地数据库；已配置测试项目未被创建或重置。测试夹具按现有脚本清理/事务回滚，Execution 保留空测试 tenant；Runtime 未操作 Storage。

审核者为用户授权的工程执行，不冒充组织签字。当前结论不覆盖 Linux/远端 CI、正式 G0、全 provider、页面联调、Desktop 或被排除的开发者延迟诊断。F06 本地修复夹具可选测试为 SKIP，未计为数据库验收通过。

## 提交与准入

方案避免在源码中嵌入自身提交号：计划登记上述已接受源码，实际当前提交的回执另写 Git notes。文档和证据提交后按同一规程再次完整重放，为最终 HEAD 写入两个 notes，再在干净工作树执行 `make f06-acceptance-gate` 与 `pnpm check:p0`。接收方以当前 HEAD 的双门禁结果为准，不能继承历史 PASS。

本轮只创建本地提交及 notes，不自动推送。执行方法见[P0 验收规程](../P0-acceptance-runbook.md)。
