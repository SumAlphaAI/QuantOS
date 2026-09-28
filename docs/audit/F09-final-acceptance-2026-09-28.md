# F09 最终开发阶段验收（2026-09-28）

## 1. 完成概况

验收基线：`81cb5ae43f87e7d4b4be059b9eed036b755b4986`，包含 `1ce64b6f0a33fff4b9ffb35f22c05ea642b3df69` 的窗口、监听与规则修复，以及后续就绪状态故障原因修正。

结论：**F09 开发阶段 ACCEPTED，F09-B04 关闭；当前开发阶段检查 6/6 通过**。验收范围遵循[开发期与运行期边界](F09-stage-gate-review-2026-09-27.md)。文档记录提交不自动继承本基线的远程回执；本报告不宣称后续 HEAD、main 合并或正式签名已验收。

## 2. 完成明细与独立证据

| 检查 | 同一完整 SHA 的证据 | 结果 |
| --- | --- | --- |
| CI 与下载校验 | [QuantOS CI 36367996325](https://github.com/SumAlphaAI/QuantOS/actions/runs/36367996325)：verify、verify-download-pr、verify-download 均 SUCCESS；下载回执内部 commit 与基线一致，status=PASS、downloadVerified=true | PASS |
| push 目标 | [F09 push 36367991959](https://github.com/SumAlphaAI/QuantOS/actions/runs/36367991959)：两项作业 SUCCESS；target v3 内部 sourceCommit 与基线一致、dirty=false、status=PASS | PASS |
| 手动调度／Nightly 路径 | [F09 workflow_dispatch 36369094723](https://github.com/SumAlphaAI/QuantOS/actions/runs/36369094723)：两项作业 SUCCESS；target v3 内部完整 SHA 一致、dirty=false、status=PASS | PASS |
| 回执完整性 | push 与手动调度各 7 个日志 SHA-256 与回执逐个一致；各三类 writeTraces 的 correlation ID 均能在对应日志定位 | 两次均 PASS |
| 实际数据库与组件故障 | Supabase 容量/消费者/会话终止 3/3；真实 BFF 会话撤销和 Runtime 调度各 1/1；Portfolio 实际写入、快照哈希及 trace；受监管 Engine 故障用例 1/1 | 两次均 PASS |
| 一分钟调度及缺采样 | scheduler v1 内部 SHA 与基线一致，连续两次真实缺覆盖 tick，间隔分别 60.001 / 60.055 秒，staleAdrEvidence=false | 两次均 PASS |

远程本地观测 Gate 同时通过 Rust 17/17、BFF 1/1、Runtime 2/2、Python 9/9、规则语义负向 2/2，以及批处理 trace、ADR 与规则检查；日志明确包含配额即时告警、重复/回退 tick、异常客户端及监听失败就绪回归。实际 Supabase 容量用例包含缺采样清空持久窗口及快速恢复重新累计断言。

PR 的 `formalSignatureVerified=false` 符合既有 F02 约束：正式签名只在 main 执行，未改变验签或漂移检查。手动调度运行同一 Nightly 工作流的目标路径；它不证明实际 cron 已触发。

目标回执的 `f09Accepted=false` 是组件 Gate 的固定边界；组件无法判断外部 CI 与 Nightly。完整开发阶段结论须汇总三次远程运行和内部回执，不修改组件历史记录，也不把 `remainingDevelopmentAcceptance` 生成时提示当作独立最终结论。

## 3. 问题与风险边界

原 14 项现为 **9 项关闭（8 项代码修复 + B04 回执闭环），5 项部分修复／移交，0 项开发期回执待齐**。原问题关闭率 9/14（64.3%），不等于运行期完成率，也不将 22 点历史检查全部改判通过。原严重度和逐项证据见[14 项复核归档](F09-findings-recheck-2026-09-28.md)，原始失败和 22 点分母保留在[初审归档](F09-initial-review-2026-09-27.md)。

F09-B01–B03、H05、M03 仍为部分修复／业务任务与 L04 移交：未来正式写入口、四类未交付业务来源与九类持续生产、跨服务同链故障、生产者身份/采样密度，以及看板查询/通知送达未通过运行期验收。阶段移交不计为修复完成。**F0 总 Gate 继续关闭。**

## 4. 后续安排

业务任务交付正式入口与 F09-D01–D04 来源；L04 在部署环境验证九类指标持续运行、告警通知、三类同链故障与无秘密泄露，取得候选发布完整 SHA 回执。F0 的其他任务与 main 正式签名单独复核。
