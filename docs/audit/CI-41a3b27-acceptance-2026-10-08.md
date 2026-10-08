# 41a3b27 CI 修复后续验收

日期：2026-10-08。验收完整SHA：`41a3b27af9f19229d549c604b43956354ffeb212`。承接[c6e55f6整改报告](./CI-c6e55f6-remediation-2026-10-08.md)。本次执行`git push origin HEAD:main`返回`Everything up-to-date`，远端main已包含本提交；按实际已完成的同SHA运行验收，不重复触发构建。

## 1. 任务完成概况

**CI修复范围PASS：9/9个push工作流完成且成功，F02重建/回放、F05数据库功能Gate、签名策略、主干签名、下载验签均闭合。** 本轮没有代码修改或阶段准入重评，不自行签署正式ACCEPTED。

完整统计：[同SHA运行清单](./evidence/ci-acceptance-41a3b27-20261008/remote-runs.json)共11个工作流，10成功/1失败。其中push为9成功/0失败；schedule为1成功/1失败。定时TP01同步阻断单独保留，不能用主线9/9隐藏全部运行中的失败。

## 2. 完成情况明细

| 同SHA push工作流 | 结果 | 运行 |
|---|---|---|
| QuantOS CI | PASS | [37763354707](https://github.com/SumAlphaAI/QuantOS/actions/runs/37763354707) |
| Frontend Baseline (FEP-0) | PASS | [37763354753](https://github.com/SumAlphaAI/QuantOS/actions/runs/37763354753) |
| F01 Clean Room | PASS | [37763354760](https://github.com/SumAlphaAI/QuantOS/actions/runs/37763354760) |
| F03 Protocol Acceptance | PASS | [37763354725](https://github.com/SumAlphaAI/QuantOS/actions/runs/37763354725) |
| F04 Core Branch Coverage | PASS | [37763354705](https://github.com/SumAlphaAI/QuantOS/actions/runs/37763354705) |
| F08 Engine CI | PASS | [37763354738](https://github.com/SumAlphaAI/QuantOS/actions/runs/37763354738) |
| F09 Observability Gate | PASS | [37763354769](https://github.com/SumAlphaAI/QuantOS/actions/runs/37763354769) |
| QuantOS Compatibility | PASS | [37763354800](https://github.com/SumAlphaAI/QuantOS/actions/runs/37763354800) |
| R01 Market Service Gate | PASS | [37763354764](https://github.com/SumAlphaAI/QuantOS/actions/runs/37763354764) |

QuantOS CI的`verify`、`signing-policy`、`sign-main`、`verify-download-main`、`verify-download`全部success。`verify-download-pr`在main push中按设计skipped，未计为PASS；各实际步骤见[作业原件](./evidence/ci-acceptance-41a3b27-20261008/quantos-ci-jobs.json)。

| 重点验收 | 实际证据与结论 |
|---|---|
| F02共享角色初始化与清理 | 原始database回执PASS、source完全匹配且dirty=false；集群角色复用、不兼容角色拒绝、事务fixture回滚检查通过。 |
| F02双库重建、checksum/catalog及回放 | 真实Ubuntu CI运行完成；自比较拒绝、RLS/FORCE/policy破坏、列/索引漂移、applied checksum篡改及两租户/匿名拒绝检查均通过，共8项回执。见[database.json](./evidence/ci-acceptance-41a3b27-20261008/f02-validation/database.json)。 |
| F05数据库功能Gate | 真实CI回执PASS：10000事件applied/dispatched/unique，checkpoint10001，1000并发、fencing/append-only/补偿/租户回放与快照持久化通过。见[CI步骤日志](./evidence/ci-acceptance-41a3b27-20261008/f05-database-ci.log)。 |
| 正式制品下载与签名 | [原始回执](./evidence/ci-acceptance-41a3b27-20261008/download-receipt/download-receipt.json)PASS；commit为本SHA，artifact为quantos-build-artifacts，downloadVerified=true、formalSignatureVerified=true；完成于2026-10-08T10:49:50.084Z。 |

F05当前CI测量：消费3658ms，correlation检索169.418095ms，原回执lookupScope=complete-client-retrieval；这是GitHub Ubuntu disposable PostgreSQL的完整client链检索结果，与历史已配置Supabase的target-event-id-client-retrieval口径分别保留，不迁移成Supabase、R02代表性发布P95或部署验收。结构化摘录见[原日志提取](./evidence/ci-acceptance-41a3b27-20261008/f05-database-extracted.json)。此次本机只读取远程证据，没有启动数据库、本机服务或重建现有Supabase。

本机补充payload摘要复核未完成：签名制品下载较慢，改用120秒有时限的API下载后超时，收到3587045字节，未取得完整zip。见[下载结果](./evidence/ci-acceptance-41a3b27-20261008/payload-fetch.json)。本地payload再验记NOT_RUN；正式下载/签名PASS依据上文取得的远端真实回执与成功作业，不声称本地重新验证了签名。读取进程已结束，部分zip仅留在/tmp，未计入有效制品。

## 3. 问题与风险

- **CI修复结论：** 原Cargo破坏测试污染、PRE-03版本遗漏、共享角色重复创建及API schema回放重名已获当前SHA主线CI验证，没有新同类失败。
- **TP01-E额外定时阻断：** [Sync Gate 37765837510](https://github.com/SumAlphaAI/QuantOS/actions/runs/37765837510)中六个模拟场景success，实际候选评估生成2个决策后以`TP01-E blocked: one or more sync decisions require manual action`退出2。保留[失败日志](./evidence/ci-acceptance-41a3b27-20261008/tp01-sync-failed.log)与[作业原件](./evidence/ci-acceptance-41a3b27-20261008/tp01-sync-jobs.json)；没有关闭fail-on-block或批准上游同步。
- **定时证据缺口：** live决策/issue原件的上传步骤skipped，实际live artifact未生成，无法完整还原两份决策。应补齐失败时上传与按候选实际执行许可/依赖复审后再处理阻断。
- **候选上下文：** 独立[Upstream Monitor 37764119537](https://github.com/SumAlphaAI/QuantOS/actions/runs/37764119537)success，其10:32监测报告发现v0.1.13→v0.1.16新tag、main推进及requirements/pyproject摘要差异，见[原报告](./evidence/ci-acceptance-41a3b27-20261008/tp01-upstream-monitor/upstream-candidates.md)。它早于10:48失败运行，不能代替缺失的live决策原件。
- **阶段边界：** 当前159节点仍NOT_ASSESSED；此回执不会恢复5547211的14份旧READY。R02当前C01需新内容复评；正式用户确认、C25/C26部署/代表性性能、R01 B01/FA-H01、长期运行/许可与原1800秒用途边界分别保留。

## 4. 后续建议

本轮CI修复可按本完整SHA关闭工程缺陷。R02 DEVELOPMENT严格准入需要在冻结源码和有效用途/具名actor下，以新的空证据目录执行完整当前闭包并登记真实结果；正式确认按项目用户统一规程执行。TP01-E按候选另行复审、保留阻断原件，不能自动同步生产依赖。Beta发布验收继续独立安排。

原失败轮、既有Supabase事实与历史确认保持原件。此次报告与证据作为独立文档提交归档；远程验收仍只绑定41a3b27，后续提交不继承该同SHA结论。
