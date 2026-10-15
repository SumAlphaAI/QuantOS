# TP01-G：上游贡献与脱钩替换 — 本地开发证据

日期：2026-10-15。冻结候选：`f21318b709c0549e8b0ea21636ab08d110a05a30`。

结论：TP01-G 本地代码、测试、文档和验收证据完成，开发状态 `IMPLEMENTED_PENDING_ACCEPTANCE`；`TP01-G_LOCAL` 限定 DEVELOPMENT READY。完整必要闭包30节点/96组实际执行全部PASS，三次跨语言可复现构建PASS。只发布 `CORE:TP01-G`，全图1 READY / 158 NOT_ASSESSED / 0 BLOCKED。`formalAccepted=false`、`externalPublished=false`、`upstreamAccepted=false`，没有生产凭据、数据库连接、外部发布或push。

## 变更与控制矩阵

| 控制 | 实现与实际证据 | 结论 |
| --- | --- | --- |
| fork 类型隔离 | QuantOS-owned provider/translator/planner/auditor/projector/Artifact store 接口；Runtime Rust/Web TypeScript消费者扫描；既有严格AST导入策略与安装wheel/真实进程契约复验 | PASS，本机研究范围 |
| 任一模块替换 | 六类模块分别替换与完整组合，各20个fixture，真实UDS重复unary/stream；逐项比较business output、三阶段stream、audit、Artifact/evidence | PASS，140项差分 |
| 别名迁移 | 默认保留兼容alias，宿主可关闭；20个fixture验证canonical输出/stream不变、实际内容hash随字节变化 | PASS，20项 |
| 拒绝和恢复 | 错误协议/provider、workflow/audit/stream/translator异常、写入前拒绝与重建恢复；请求不可选择模块或扩大原生权限；store异常脱敏/重建 | PASS，26项；替换专项另含12项store响应拒绝，合计198项 |
| 上游贡献 | 固定基线通用EventBus重复事件bug的patch/说明/manifest；临时副本apply-check、基线原件与应用后同组unittest | PASS，基线2条预期失败，修复后4条通过；DRAFT_NOT_SUBMITTED |
| 证据防篡改 | 功能回执40项负向、准入/计划57项、真实完整index负向、共享回执策略54项 | PASS，内容核验而非只看JSON状态 |
| 前置与准入 | 实际重跑F01–R1-SERVICE及E/F等30节点必要闭包；LOCAL_READY只属于G消费者；发布写入或后验失败回滚 | PASS，96组；不授予前置独立READY |
| 冻结与历史保护 | 原候选输入文件/Gitlink对Git对象、原normative计划输入、96条命令/日志/支持文件；恢复canonical并逐字节核验历史文件 | PASS，详见独立核验与seal |

## 变更文件

完整逐文件清单：[changed-files.txt](./evidence/tp01-g-local-20261015/changed-files.txt)。生成证据逐文件哈希：[seal.json](./evidence/tp01-g-local-20261015/seal.json)。

| 文件组 | 主要文件与用途 |
| --- | --- |
| 引擎 | `engines/vibe-adapter/src/vibe_adapter/modules.py` 新增native接口/协议约束；`service.py` 宿主注入、不可扩大policy、stream写入前校验、store错误脱敏；`workflow.py` 可关闭兼容alias；`streaming.py` 消费注入audit；`local_drill.py` 明确本机mock存储类型 |
| Python测试 | `engines/tests/test_vibe_adapter_replacement.py` 新增198项；`test_vibe_adapter_contract.py` canonical消费者迁移；`test_vibe_adapter_rollout.py` 为既有mock存储断言补类型收窄，原47项保持 |
| 上游审阅包 | `forks/vibe-trading/upstream-prs/20261015-atomic-replay-handoff/{0001-atomic-replay-handoff.patch,manifest.json,README.md}` 与目录索引；不修改submodule/受控fork，不虚构PR URL |
| 可执行工具 | `scripts/tp01-g-{functional.mjs,functional.test.mjs,local-gate.mjs,local-gate.test.mjs,plan-contract.test.mjs,upstream-patch.py}`、`record-tp01-g-local.mjs`、`check-tp01-g-style.mjs` |
| 共用策略 | `provider-a1-{receipts.mjs,policy.json}`、`check-development-plan-order.mjs`、`development-plan-order-policy.json`、`frontend-gate-handoff-policy.json`；`Makefile`入口和精确raw Markdown whitespace豁免 |
| 文档 | 核心/前端执行计划、`docs/operations/tp01-g-local-admission.md`、`tp01_vibe_deprecation_plan.md`、本报告及原始证据 |

## 测试命令和结果

主执行入口：`node scripts/record-tp01-g-local.mjs docs/audit/evidence/provider-a1-remediation-20261004/tp01-g-local-20261015/attempt-02`，清洁树冻结f21318b7，全部30节点/96组PASS。等价入口 `make tp01-g-assess-local`。完整命令、开始时间、退出码和日志哈希见[execution-results.json](./evidence/provider-a1-remediation-20261004/tp01-g-local-20261015/attempt-02/execution-results.json)；[执行console](./evidence/tp01-g-local-20261015/assessment-console.log)与[runner状态](./evidence/tp01-g-local-20261015/assessment-run.json)保留。

| 命令/检查 | 结果 |
| --- | --- |
| 三次fresh目录跨语言release构建 | PASS：Rust、Python wheels、TypeScript内容可复现 |
| `make lint` | PASS |
| `make test` | Rust 396 PASS / 8 ignored；Python 1635 PASS；Web 233 PASS / 3 skipped |
| `python -m pytest engines/tests/test_vibe_adapter_replacement.py -q` | 198 PASS，实际命令使用工程 `engines/.venv/bin/python` |
| `python scripts/tp01-g-upstream-patch.py --output-dir ...` | apply-check/apply PASS；相同4条unittest在原件预期2 FAIL、修复后4 PASS；固定原件/修复原件/测试源码/日志均保存 |
| `node --test --test-reporter=tap scripts/tp01-g-functional.test.mjs` | 40 PASS |
| `node --test --test-reporter=tap scripts/tp01-g-local-gate.test.mjs scripts/tp01-g-plan-contract.test.mjs` | 57 PASS |
| `node scripts/check-tp01-g-style.mjs` | ruff check/format、pyright PASS |
| 同轮E/F功能与负向 | E 55+49、F 37+57专用测试PASS；F47条Python、19条UDS演练、15条模拟回归PASS；保留目标边界 |
| 收尾检查 | 11/11命令达到预期退出码；G ready=0，G release=2，E/F旧ready=2；计划/移交/26项真实index负向/独立核验/whitespace PASS |

首轮冻结5df1b36a在3组通过后因提交范围whitespace检查主动中断，lint未完成、不记PASS，未发布Gate；637个canonical文件从备份恢复并记录哈希。见[中断记录](./evidence/provider-a1-remediation-20261004/tp01-g-local-20261015/attempt-01/interruption.json)。原始[前置日志](./evidence/tp01-g-local-20261015/preflight/gate.log)、[第二轮日志](./evidence/tp01-g-local-20261015/preflight/gate-02.log)保留：初始计划摘要缺少报告链接、测试fixture误改F配置导致负向用例未抛错，均修复后57/57 PASS；类型检查曾发现存储Protocol接入后的mock私有字段需要收窄及异常details可空以及新测试的枚举标注，修复后G/F style PASS。这些是冻结前失败，不覆盖为PASS、不拼接成冻结闭包结果。上游未修改基线的2条失败是同一回归对缺陷的预期复现。

## Gate、证据与未决风险

当前[manifest](./evidence/tp01-g-local-20261015/manifest.json)、[完整闭包](./evidence/provider-a1-remediation-20261004/tp01-g-local-20261015/attempt-02/local-prerequisites.json)、[独立核验](./evidence/tp01-g-local-20261015/verification.json)、[收尾命令](./evidence/tp01-g-local-20261015/post-checks.json)、[canonical恢复清单](./evidence/provider-a1-remediation-20261004/tp01-g-local-20261015/attempt-02/canonical-preservation.json)。

E/F的旧独立READY因共享源码变化撤回；本轮重跑E/F作为G内部依赖，不重新发布它们的独立Gate。历史证据保持原件。SERVICE:TP01、R1-SERVICE、TP01总项、Beta和正式ACCEPTED均未授予。

| 未决项 | 状态/责任与关闭条件 |
| --- | --- |
| 22组共享Supabase/外部治理/性能前置 | NOT_RUN；测试及RELEASE-GATE:BETA按计划实际执行，不能用静态检查代替数据库验收 |
| E/F目标canary与回滚 | NOT_RUN；保留7天无未解释P1、目标回滚≤5分钟、正式制品/drill验签、持久控制/审计、真实监测/影子消费和同SHA hosted CI义务 |
| G真实目标模块组合/消费与性能 | NOT_RUN；目标持久Artifact/audit/恢复、代表性性能/长稳、同SHA hosted CI；本机fixture只证明native接口行为 |
| 宿主扩展与持久存储 | 模块为受信任Python代码，接口不提供OS沙箱；替换store须实现其契约及事务保证。本轮是内存mock，未证明实际Supabase持久性/多进程控制 |
| alias与包名迁移 | 默认alias保留；无alias模式改变字节/hash及Artifact identity，应新建host并独立验证消费方；generic包命名Phase3协调迁移仍延期，当前接口无fork类型依赖 |
| 上游贡献 | DRAFT_NOT_SUBMITTED，未检查最新线上HEAD，未开启PR/被上游接受；单独授权后才能rebase/提交。本次本地Gate不等待上游接受；patch以外的队列容量、clear/shutdown及跨线程顺序问题不在修复范围 |
| 正式确认 | 尚无用户对本轮范围的确认原始答复，不自签；按统一规程由ProjectUser一人确认，人工确认不能替代目标证据 |

源码提交：`f21318b709c0549e8b0ea21636ab08d110a05a30`；后续提交仅同步执行状态和封存证据，不把证据提交冒充新的功能候选。未push。

下一可执行任务：`SERVICE:TP01` 本地服务功能准入汇总，按当前输入核对A–G完整依赖、三次构建/20个回放/安全负向/取消/Artifact去重/分级阻断/回滚；不得仅用G READY自动放行SERVICE、TP06或TP01总项。Web Research E2E仍在U01/FEP-2后的TP01 INTEGRATION范围。
