# F06/F07 Auth 500 与 F09 调度超时整改复评

本轮定位并修复开发目标检查的错误诊断和 F09 收尾缺陷；Supabase 平台只读限制尚未恢复。保持“不升级订阅、不使用生产凭据、不执行外部发布”，不运行本地 PostgreSQL/Supabase，不绕过服务端只读限制，不扩大 R03_LOCAL 范围。

北京时间 2026-10-12 08:46:04 的[实测诊断](./evidence/f0-target-diagnostics-20261012/diagnosis/live.json)在同一开发项目观察到事务和默认事务 `read_only=on`、`in_recovery=false`；现有测试用户登录返回 HTTP 500、unexpected_failure、Database error granting user。F06 500 来自远程 Auth，发生在本地 BFF 启动前；F07 上轮 500 来自远程 Auth 创建测试身份，同样发生在 BFF/Runtime 启动前。结合目标只读，对写入相关 Auth 失败的归因得到支持；未取得平台内部 Auth 日志，不能宣称服务端容量限制已解除。

原 F09 调度检查在只读目标无法生成 tick，后续 DELETE 再次触发 25006；清理失败跳过 `client.end()`，覆盖主错误并留下可能过早写出的 PASS。外层最终以 300 秒超时终止。[原源码与 VM 红测](./evidence/f0-target-diagnostics-20261012/diagnosis/f09-red-result.json)复现连接未关闭和 PASS 保留；这是假对象的生命周期回归，不能作为数据库验收。原 56 组失败索引、三份失败 Gate 及本轮覆盖前的 TP03/TP04 完整组件字节均绑定在[历史清单](./evidence/f0-target-diagnostics-20261012/history.json)。红测 VM 首次缺少 URL 全局的辅助脚本失败也保留。

代码调整：

- 共享只读状态观察用于 F06 preflight、F07 实际服务检查、F09 目标 Gate 和独立 scheduler；只读或恢复中明确 `TARGET_DATABASE_READ_ONLY`，在 Auth 写入/monitor 启动前拒绝，不作为 PASS。
- Auth 非成功响应只保存白名单状态/错误码/数据库错误类别，不保存任意响应、身份或 token，不重试 HTTP 500。
- F09 记录主错误及独立清理错误；先停止所属进程，再清理所属 scope、始终关闭连接，最后才能写 PASS。已信号退出的进程不等待已发生的 exit；忽略 SIGTERM 时有界 SIGKILL；无 owned rows 不执行 DELETE。
- 新生命周期及只读/错误分类回归接入原 F06/F09 必要负向命令，不修改严格 Gate 范围。

冻结前纯 JS/所属进程回归 43/43 PASS（含原 F07 17 项）；F06 必要负向 55 项、F09 必要负向 35 项 PASS。修复后定向实测三个检查均在约 2 秒以只读原因失败，F07 未启动服务/未发送 Auth 登录，F09 未启动 monitor、无 cleanup 写入、连接关闭；见[定向结果](./evidence/f0-target-diagnostics-20261012/diagnosis/prefreeze-target-checks.json)。此轮有源码变更，定向结果仅诊断，不作为准入。

已从干净冻结提交 `e4c45a7ca7f5ab716e0e001246b38a20559e9869` 完成 TP03、TP04、F0 必要 14 节点、56 组完整复验：**46 PASS / 10 FAIL**，本地45/45、目标1/11（RLS）。聚合 exit 1，未发布 READY；三份严格失败 Gate 为 BLOCKED，formalAccepted=false。工程、数据库、hosted CI、用户正式确认与发布验收分别记录。


冻结源码上的目标失败路径已确认：F06 build PASS，随后 preflight 在 2676ms 以明确只读原因拒绝，未进入 Auth；F09 Gate 在约 2011ms 以 DATABASE_WRITABILITY / TARGET_DATABASE_READ_ONLY 拒绝，未执行 scheduler 命令，fixtureCleanup 为 NOT_NEEDED_NO_REGISTERED_FIXTURE。独立冻结版 scheduler 同样明确失败，未启动 monitor，childStopped=true、connectionClosed=true、cleanup.failures=[]；真实 tick 验收仍未通过。[严格原始输出](./evidence/provider-a1-remediation-20261004/f0-target-readmission-20261012/attempt-01/execution-results.json)包含全部56组命令、退出码、日志/产物SHA及完整复验结果。


| 冻结源码上的实际检查 | 结果 |
|---|---|
| `assess(..., ['CORE:TP03','CORE:TP04','CORE-GATE:F0'])` | 56/56 组执行，46 PASS / 10 FAIL，exit 1；无替代失败结果或部分发布 READY |
| F01 三轮独立目录构建 | 3/3 PASS，产物 combined SHA 相同，开始/结束源码检查干净 |
| `make lint` / `make test` | PASS；完整 Python1366 passed in 9.57s；TS domain-ui 25 passed / 3 skipped |
| F06 必要负向命令（含新只读/Auth错误分类回归） | 55/55 PASS |
| F09 必要负向命令（含13项scheduler/所属进程收尾回归） | 35/35 PASS |
| TP03 `check-development.mjs --record` | 12/12 组件 PASS，完整Python1366 passed in 8.84s；回执 status=BLOCKED |
| TP04 `check-development.mjs --record` | 12/12 组件 PASS，完整Python1366 passed in 8.75s；回执 status=BLOCKED |
| TP03 / TP04 回执负向 | 26/26、42/42 PASS |
| 两组 schema/双RPC重放、Runtime | 100条Signal、100条Proposal及各3项Runtime检查 PASS |
| wheel安装后五RPC取消 | TP03 12.68ms、TP04 12.61ms；CANCELLED、无最终Artifact、ownedChildReaped=true |
| 实际UDS/UI取消桥接 | TP03 11.75ms、TP04 12.58ms；artifactDelta=0 |
| TP03 / TP04 scope进程清理 | PASS，scope 5792890b，discovered=[]、remaining=[] |

完整命令在[执行索引](./evidence/provider-a1-remediation-20261004/f0-target-readmission-20261012/attempt-01/execution-results.json)。`make test` 的数据库条件提前返回不计作数据库验收；TS三项跳过不写成全部用例零跳过。纯JS模拟与本地UDS检查均不代表真实Supabase写入或部署验收。上游治理核对未使用 --apply，不修改外部分支或保护配置。

| 严格目标失败 | 退出码 | 当前归因 |
|---|---:|---|
| f06-target | 1 | preflight记录只读并拒绝；Auth登录未执行 |
| f09-target | 1 | DATABASE_WRITABILITY / TARGET_DATABASE_READ_ONLY；scheduler未启动，无外层ETIMEDOUT |
| f07-service | 2 | database-writability拒绝；Auth创建、BFF/Runtime启动均未执行，fixtureCleanup PASS |
| f05-database、f05-volume、storage-database、storage-target | 101 | SQLSTATE 25006，写入被只读事务拒绝 |
| f07-recovery、f07-coverage | 2 | SQLSTATE 25006，目标恢复/覆盖率未通过 |
| f02-database | 1 | 25006；独立只读cleanup PASS，ledger/catalog未变、connectionsClosed=true |

10项失败均归类 TARGET_DATABASE_READ_ONLY，见[机器汇总](./evidence/f0-target-diagnostics-20261012/summary.json)。本轮修复了本地探针的收尾及诊断缺陷；**未恢复Supabase可写性、未证明远程Auth 500已消失，也未通过真实一分钟scheduler tick**。此前500和300秒超时均留在原失败证据中。当前预检不会把这些路径改记为PASS。

| Gate | 必要闭包结果 | 状态 |
|---|---|---|
| CORE-GATE:F0 | 12节点 / 50组：40 PASS、10 FAIL | BLOCKED |
| CORE:TP03 | 13节点 / 53组：43 PASS、10 FAIL | BLOCKED |
| CORE:TP04 | 14节点 / 56组：46 PASS、10 FAIL | BLOCKED |
| CORE:R03、CORE:R04 | 本轮未重新准入 | NOT_ASSESSED |

全图 **0 READY / 156 NOT_ASSESSED / 3 BLOCKED**，formalAccepted=false。三份[失败manifest](./evidence/f0-target-diagnostics-20261012/gates/)绑定1241个当前产品输入、14个节点的规范计划字段及实际日志摘要；计划stage_gate已写入对应manifest SHA。R03_LOCAL仍仅供R03消费，不扩展到上述严格Gate；源码变化后R03旧回执继续失效。

变更包括共享只读观察/Auth错误分类/所属进程停止工具、F06/F07/F09目标脚本、两份新回归测试及必要负向命令接入，以及计划、报告和完整历史/本轮证据。完整清单见[changed-files.txt](./evidence/f0-target-diagnostics-20261012/changed-files.txt)。代码冻结提交 e4c45a7c；后续提交仅文档/实测证据，产品输入保持冻结。辅助脚本首次VM缺少URL、计划链接创建顺序失败及红测归档输入重放修正均保留在diagnosis，不影响56组结果。

下一可执行任务：为TP03/TP04/F0单独制定功能开发Gate与发布目标验收拆分方案，以便在保留Supabase目标未通过事实的前提下推进开发；本轮没有修改严格Gate范围。R04先前7/9畸形输入校验缺口仍开放，见[原预检](./R04-interface-fixture-preflight-2026-10-12.md)。

最终检查：TP03/TP04 --verify 均 exit 0，engineeringStatus=PASS、stageGate=BLOCKED；--ready 均 exit 2，F0 --f0 exit 1、R03 admission exit 2，均按预期拒绝。计划结构/依赖顺序与 git diff --check 通过。见[最终命令与摘要](./evidence/f0-target-diagnostics-20261012/final-checks.json)及[源码/计划/历史与本轮证据完整性回执](./evidence/f0-target-diagnostics-20261012/integrity.json)。
