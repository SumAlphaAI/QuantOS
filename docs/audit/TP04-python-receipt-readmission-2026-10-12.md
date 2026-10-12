# TP04 完整 Python 套件回执修复与前置复评

修复 TP04 将完整 Python 套件写死为 `1002 passed` 的校验。继续绑定完整目录命令、源输入、日志 SHA、退出码；要求最终纯通过摘要且至少 1002 项，允许套件增长与 warnings，拒绝失败、错误、跳过、筛选、异常尾部及缩小命令。本轮不扩大 R03_LOCAL 授权，不使用本地数据库，不修改生产或发布配置。

修复前红测已记录 exit 1，12 项中 4 PASS / 8 FAIL；旧实现既拒绝增长后的通过摘要，也误收含失败/错误/跳过/筛选或异常尾部的日志。见[失败日志](./evidence/tp04-python-readmission-20261012/red/tp04-summary.log)和[输入快照](./evidence/tp04-python-readmission-20261012/red/receipt.json)。修复后 TP04 42 项回执正负向测试 PASS：[冻结前日志](./evidence/tp04-python-readmission-20261012/tp04-negatives-prefreeze.log)。

| 验证层 | 修复后约束 |
|---|---|
| 命令 | 必须仍是 `engines/.venv/bin/python -m pytest engines/tests -q`，不能替换为单文件或缩小目录 |
| 执行事实 | 退出码 0、PASS 标记、真实执行时间、日志 SHA 和当前源码输入继续绑定 |
| 摘要 | 最后一行须为完整纯通过摘要；至少 1002 项，可增长，可含 warnings |
| 拒绝 | 非零 failed/error/skipped/deselected/xfailed/xpassed、低于基线、无耗时/无完整摘要、异常尾部 |
| Gate | 组件工程通过不能授予自身或 F0 的严格 READY；正式验收仍为 false |

旧 TP03、TP04 组件 receipt/log/wheel/matrix 已在覆盖前完整归档，并绑定逐文件 SHA：[历史清单](./evidence/tp04-python-readmission-20261012/historical-files.json)。R04 预检、旧 R03 manifest、原数据库只读及 fixture 退役失败/收尾证据保留。

已从新冻结干净源码 `d644b8c21384ed626bde029aea8f8e2aca4a528b` 完整执行 TP03、TP04、F0 必要闭包复评，覆盖 14 节点、56 组检查。结果为 **46 PASS / 10 FAIL**；45/45 本地检查通过，目标检查 1/11 通过（RLS）。因 Runtime/Engine/scripts 输入绑定发生变化，R03 原 READY 已撤为 NOT_ASSESSED，不能继承原结果。工程证据、目标数据库结果、正式验收及发布范围分开维护；`formalAccepted=false`。


本轮修复和复评任务已完成；严格前置准入尚未通过。源码修复提交为 `d644b8c2`，后续证据提交只更新文档和实测产物，不迁移正式或 hosted CI 验收。源输入清单和规范计划字段绑定在[源码快照](./evidence/tp04-python-readmission-20261012/source-snapshot.json)，完整命令、退出码、日志/产物 SHA 在[执行索引](./evidence/provider-a1-remediation-20261004/tp04-python-readmission-20261012/attempt-01/execution-results.json)，汇总见[机器回执](./evidence/tp04-python-readmission-20261012/summary.json)。

| 实际执行命令/范围 | 结果与边界 |
|---|---|
| `assess(..., ['CORE:TP03','CORE:TP04','CORE-GATE:F0'])` | 56 组全部执行；46 PASS / 10 FAIL；聚合 exit 1，未发布 READY |
| `node --test scripts/tp04-functional-artifacts.test.mjs` | 42/42 PASS，含本轮新增 19 项摘要/命令边界测试 |
| `node --test scripts/tp03-functional-artifacts.test.mjs` | 26/26 PASS |
| TP03 / TP04 `check-development.mjs --record` | 各 12/12 组件检查 PASS，组件 receipt 的 engineeringStatus=PASS、status=BLOCKED |
| `engines/.venv/bin/python -m pytest engines/tests -q` | TP03 1366 passed in 8.88s；TP04 1366 passed in 8.94s；均为完整目录 |
| 两组真实 schema/重放矩阵 | 100 条 Signal、100 条 Proposal PASS；Runtime 各 3 项集成 PASS |
| wheel 安装后的五 RPC / UI 取消桥接 | TP03 11.10ms、TP04 12.84ms；CANCELLED、无最终 Artifact、owned child 已收尾 |
| F01 三次独立目录构建 | 3/3 PASS、combined SHA 相同；开始时源提交干净 |
| `make lint` / `make test` | PASS；后者含 Python1366；TS domain-ui 25 passed / 3 skipped，不能称所有用例无跳过 |
| F04/F05/F08 本地覆盖率、安装服务、F02 静态/供应链等必要检查 | PASS；不代表目标数据库结果 |
| 两次 `node scripts/r1-process-cleanup.cjs` | PASS，scope `ae2fcb3e`；discovered=[]、remaining=[] |

所有命令及实际输出均在执行索引对应文件中。`make test` 中数据库条件提前返回的测试不计作 Supabase 验收。TP01 上游治理核对未传 `--apply`，脚本只读验证，没有修改外部分支或保护配置。

| 失败检查 | 退出码 | 本轮观察 |
|---|---:|---|
| f05-database、f05-volume、storage-database、storage-target | 101 | SQLSTATE 25006，只读事务拒绝写入 |
| f07-recovery、f07-coverage | 2 | 目标数据库只读，SQLSTATE 25006 |
| f02-database | 1 | 事务内 disable RLS 被 25006 拒绝；独立只读 cleanup PASS，ledger/catalog 未变、连接关闭 |
| f06-target | 1 | build/preflight 通过，真实 BFF smoke 登录 HTTP 500 |
| f07-service | 2 | 目标服务 HTTP 500 |
| f09-target | 1 | build 通过；scheduler smoke 300000ms ETIMEDOUT，processGroupClosed=true；部分输出另有 25006 |

HTTP 500 和调度超时须独立排查，不能仅凭数据库只读推定全部根因。北京时间 2026-10-12 07:33:23 的[独立 TLS 只读探针](./evidence/tp04-python-readmission-20261012/supabase-readonly.json)观察到 `transaction_read_only=on`、`default_transaction_read_only=on`、`in_recovery=false`；BEGIN READ ONLY / ROLLBACK、连接关闭完成。F09 的[失败日志与清理回执](./evidence/tp04-python-readmission-20261012/f09-failure/)保留，状态为 NOT_NEEDED_NO_REGISTERED_FIXTURE、fixtures=[]，不宣称新一轮 R03 pending=0。

| Gate | 必要闭包结果 | 当前状态 |
|---|---|---|
| CORE-GATE:F0 | 12 节点 / 50 组：40 PASS、10 FAIL | BLOCKED |
| CORE:TP03 | 13 节点 / 53 组：43 PASS、10 FAIL | BLOCKED |
| CORE:TP04 | 14 节点 / 56 组：46 PASS、10 FAIL | BLOCKED |
| CORE:R03 | 本次产品输入变化使旧回执失效，未重跑 R03_LOCAL | NOT_ASSESSED |
| CORE:R04 | 此次未实现 R04 或专用准入入口 | NOT_ASSESSED |

全图 **0 READY / 156 NOT_ASSESSED / 3 BLOCKED**。三个失败 manifest 的 SHA 已写回计划 stage_gate，均 `formalAccepted=false`。R03_LOCAL 的 Supabase 延后策略不自动适用于 TP03、TP04 或 F0；历史正式验收和发布结论保留原源码边界。

失败证据包括修复前红测、完整旧组件字节归档、56 组原始输出和 10 项目标失败。证据汇总脚本第一次因把政策中的 regex 当作字面串而拒绝 TP01 PASS 标记，未发布 Gate；[原脚本与失败记录](./evidence/tp04-python-readmission-20261012/finalize-failed-attempt-01/)保留。修正为现有政策相同的 regex 校验后，重新核验所有 PASS 产物与 SHA，记录上述 BLOCKED；未替换或重试失败的目标结果。

变更主要为 TP04 检查器、回执负向测试、两份计划、此报告、TP03/TP04 新组件产物与完整失败/历史归档；完整文件清单见[changed-files.txt](./evidence/tp04-python-readmission-20261012/changed-files.txt)。本轮未升级订阅、使用生产凭据、运行本地数据库或执行外部发布。

下一可执行任务：排查 F06/F07 HTTP 500 及 F09 调度超时；若继续采用功能优先开发，显式定义 TP03/TP04/F0 的本地开发 Gate 和发布阶段目标验收边界，再从新冻结源码复评。Supabase 写入恢复仍未发生。R04 先前发现的公开 Rust 验证器 7/9 畸形输入缺口继续开放，见[原预检](./R04-interface-fixture-preflight-2026-10-12.md)，本轮没有修复或关闭该缺口。

最终回执复核：TP03/TP04 `--verify` 均 exit 0、engineeringStatus=PASS、stageGate=BLOCKED；两个 `--ready` 均 exit 2，F0 `--f0` exit 1，R03 admission exit 2，均按预期拒绝。计划结构/顺序检查和 `git diff --check` 通过。命令及原始日志见[最终检查](./evidence/tp04-python-readmission-20261012/final-checks.json)，源码、规范计划输入、逐文件摘要及 Gate 一致性见[完整性回执](./evidence/tp04-python-readmission-20261012/integrity.json)。

完整性辅助脚本首次运行在创建自身 integrity.json 前校验该链接而失败；[首次失败与原脚本](./evidence/tp04-python-readmission-20261012/integrity-failed-attempt-01/)保留。已修正首次生成顺序，后续 verify-only 要求实际文件存在；该错误未改变 56 组实测结果或 Gate。
