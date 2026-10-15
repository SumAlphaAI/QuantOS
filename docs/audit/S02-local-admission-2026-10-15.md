# S02 本地开发验收报告（2026-10-15）

结论：CORE:S02 的 DEVELOPMENT READY（S02_LOCAL）。代码、测试、文档与本地验收证据已完成；正式确认尚未取得，formalAccepted=false。仅修改 QuantOS，未使用生产凭据、未连接数据库、未执行外部发布或 Git 推送。S2 整体和 RELEASE-GATE:BETA 仍为 NOT_ASSESSED，目标执行为 NOT_RUN。

最终冻结候选：`5efa0be0e4340b38d814256da9560b7fe43ef691`。attempt-02 独立完整执行34节点/111组，全部PASS；33个必要依赖节点的108组检查先于S02自身3组完成。直接依赖S01、TP06、TP08、R1-SERVICE完整保留，内部LOCAL_READY仅属于S02消费者，不传播上游独立READY；未使用预检、旧TP06/S01或首轮通过结果代替本轮。全图仅S02 1 READY /158 NOT_ASSESSED /0 BLOCKED。原TP06独立READY因共享功能输入变化撤回，历史证据原件保留。

## 代码与语义

回测v2绑定DataSnapshot ID/tenant/hash及实际K线Artifact字节、全部有效参数、S01不可变版本、完整源码SHA、执行/runtime digest与固定clock。序列重算hash并校验index、OHLC、时序、窗口、质量与过期；历史Snapshot捕获时间不能晚于执行clock，不把历史归档时间误当决策可用时间。收盘信号在下一开盘执行，末根信号不成交，期末持仓按最后收盘估值。原生adapter每次reset，复用同一adapter也可确定性重放。

逐笔保存信号/成交index、数量、参考/成交价、手续费与滑点；净盈亏由现金及持仓市值计算，gross=net+fee+slippage，手算往返、零费用和未平仓终值均对账。拒绝非法数量、资金/成本越界、非有限输出及收益均值/方差溢出；Generated adapter的universe与开仓名义金额上限实际生效。报告hash覆盖全部来源、费用、指标、成交及泄漏摘要；float_roundtrip保证JSON写入/读回仍可验证。

DraftService::backtest在可信AuthContext下复核capability/tenant/workspace、S01 validation handoff、目录中的完整Snapshot、生成Artifact引用hash及实际参数；实际Python UDS产出进入S01版本，再消费为Rust回测。参数不一致拒绝，新版本恢复后可重试，旧报告版本不被改写。实现与边界见[ADR](../adr/20261015-s02-backtest-provenance.md)和[操作规程](../operations/s02-local-admission.md)。

## 实际执行证据

| 验证 | 结果 | 原始证据 |
|---|---|---|
| 新候选完整依赖与自身检查 | 34节点/111组PASS，0 FAIL；108依赖+3自身，实际顺序已保存 | [执行结果](./evidence/provider-a1-remediation-20261004/s02-local-20261015/attempt-02/execution-results.json)、[顺序](./evidence/provider-a1-remediation-20261004/s02-local-20261015/attempt-02/dependency-revalidation.json)、[递归索引](./evidence/provider-a1-remediation-20261004/s02-local-20261015/attempt-02/local-prerequisites.json) |
| 三次独立目录跨语言构建 | 3/3 PASS，组合产物hash一致 | [构建记录](./evidence/provider-a1-remediation-20261004/s02-local-20261015/attempt-02/f01-reproducibility.json) |
| make lint / make test | PASS；Rust406 PASS/9 ignored、Python1845 PASS、Web233 PASS/3 skipped | [lint](./evidence/provider-a1-remediation-20261004/s02-local-20261015/attempt-02/logs/f01-lint.log)、[test](./evidence/provider-a1-remediation-20261004/s02-local-20261015/attempt-02/logs/f01-test.log) |
| S02专项 | 9 PASS/0 ignored；10次一致重放、100泄漏/100畸形输入/2统计溢出拒绝、手算成本、来源篡改、实际进程消费与版本恢复 | [Rust日志](./evidence/provider-a1-remediation-20261004/s02-local-20261015/attempt-02/logs/s02-rust.log)、[实际报告](./evidence/s02-local-20261015/validation-report.json) |
| S02准入/回滚负向 | 79 PASS，缺节点、混候选、跳过、假目标、报告缺失/篡改及事务回滚均拒绝 | [门禁日志](./evidence/provider-a1-remediation-20261004/s02-local-20261015/attempt-02/logs/s02-local-policy.log) |
| S01完整本地检查 | Rust26 PASS/1 ignored；迁移静态3 PASS、准入62 PASS；权限/版本/并发/引用复验 | [Rust](./evidence/provider-a1-remediation-20261004/s02-local-20261015/attempt-02/logs/s01-rust.log)、[迁移静态](./evidence/provider-a1-remediation-20261004/s02-local-20261015/attempt-02/logs/s01-migration.log)、[准入](./evidence/provider-a1-remediation-20261004/s02-local-20261015/attempt-02/logs/s01-local-policy.log) |
| TP06完整本地检查 | Rust5 PASS、功能210 PASS、回执33+准入62 PASS；本候选实际重跑 | [Rust](./evidence/provider-a1-remediation-20261004/s02-local-20261015/attempt-02/logs/tp06-rust.log)、[功能](./evidence/provider-a1-remediation-20261004/s02-local-20261015/attempt-02/supporting/tp06-functional/receipt.json)、[准入](./evidence/provider-a1-remediation-20261004/s02-local-20261015/attempt-02/logs/tp06-local-policy.log) |
| TP08及R1-SERVICE | 必要本地检查全部重新执行PASS，不提升独立Gate | [TP08](./evidence/provider-a1-remediation-20261004/s02-local-20261015/attempt-02/core-tp08.json)、[R1](./evidence/provider-a1-remediation-20261004/s02-local-20261015/attempt-02/core-gate-r1-service.json) |
| 历史输出恢复 | 637文件逐字节恢复，4个原本不存在目录恢复为不存在 | [恢复记录](./evidence/provider-a1-remediation-20261004/s02-local-20261015/attempt-02/canonical-preservation.json) |

实际报告hash：`sha256:647a46b9d611212b4caa5779d3e32537e380a417d5f7a7c5a12c046845891170`。执行制品digest是本机测试二进制，runtime digest绑定锁文件/工具链与OS/arch；不宣称部署镜像或真实目标验收。测试套件计数含显式忽略或缺少目标配置时提前跳过的数据库案例，不能当作Supabase验收通过。专项计数与全套Rust计数有重叠，不相加为独立案例总数。

## 失败、中断与修复

首轮冻结6db9a163在4组PASS后，复核发现有限极端价格可造成收益方差溢出并返回0 Sharpe，遂受控中断make test，保留SIGTERM和部分原始输出；637文件及4个原本不存在目录已恢复。首次溢出探针因资金拒绝而通过，未覆盖方差路径；改为已持仓后价格跳变，回归真实失败（exit101），随后加入均值/方差/收益序列有限性检查，9专项、Clippy与79门禁预检通过，再冻结5efa0be0完整重跑。见[首轮中断](./evidence/provider-a1-remediation-20261004/s02-local-20261015/attempt-01/interruption.json)、[首轮结果](./evidence/provider-a1-remediation-20261004/s02-local-20261015/attempt-01/execution-results.json)、[溢出失败及修复](./evidence/s02-local-20261015/preflight/refreeze-summary.json)。首轮三次构建和4组通过不进入最终候选准入。

更早预检的JSON浮点读回hash不一致已通过float_roundtrip修复；普通沙箱下Python子进程启动失败，在允许本机IPC后通过（首轮未输出子进程错误细节，不能据此断言目标服务故障）。Clippy collapsible_if已修复。原始失败及通过见[预检记录](./evidence/s02-local-20261015/preflight/receipt.json)，均明确workingTreeDirty，不能作为冻结候选证据。

## 未决风险与验收边界

当前是单标的long/flat、初始现金100000、整数bps固定成本模型，开仓后保留正现金；无做空、组合调仓、部分成交或盘口冲击。Sharpe按样本窗口缩放，不宣称年化。真实市场费用、点时数据质量/模型选择偏差和代表性规模尚未校准；TP06仍为自有可替换fixture候选，没有接入live模型或承诺任意自然语言理解。原生adapter、目录及AuthContext依赖可信宿主，不是任意代码或OS网络沙箱。

DraftService和目录为进程内组合入口，未实现公开HTTP/页面验收或宣称持久Storage、RLS/事务与跨进程恢复通过。报告hash不是发布审批；S03必须继续绑定不可变源码/制品/参数/Snapshot/报告与实际审批，仅Paper/Shadow范围。

共享22组目标命令及S02四类继承目标全部NOT_RUN，含实际Supabase、来源/模型用途许可、部署安全、持久恢复、canary/回滚、负载性能/长稳、同SHA hosted CI及ProjectUser正式确认；由测试及Beta首次发布前实际验收。见[准入manifest](./evidence/s02-local-20261015/manifest.json)与[机器汇总](./evidence/s02-local-20261015/summary.json)。不把本地LOCAL_READY提升为上游、整体S2、生产或外部发布授权。

已按[统一确认规程](../gate-records/user-acceptance-confirmation-workflow.md)拟定[项目用户确认文稿](./evidence/s02-local-20261015/confirmation-draft.md)，覆盖Product/Frontend/BFF/QA/Security/Risk六维，状态PENDING、无用户答复记录；本轮未自行批准正式ACCEPTED。

## 变更、Git与后续任务

普通代码/文档共20个文件，完整路径与内容摘要见[变更索引](./evidence/s02-local-20261015/changed-files.json)。核心为crates/quantos-strategy的Cargo.toml、README和backtest.rs/drafts.rs/generated.rs；新增S02 gate/recorder/79项准入测试；更新provider执行策略、阶段/发布移交策略、Makefile、两份计划、TP06边界文档、S02 ADR/操作规程及本报告。原始证据单列，不计入20个普通文件。

Git分支`codex/s02-backtest-validation`；初始实现6db9a163，最终冻结源码`5efa0be0e4340b38d814256da9560b7fe43ef691`；后续封存提交只更新生命周期、报告和原始证据，不是另一份已测试源码。没有push、PR或外部发布。

下一可执行任务：CORE:S03“不可变策略Release”。先在S03新候选上完整复验S02、F06、R1-SERVICE，再完成不可变source/image/parameters/Snapshot/backtest/approval绑定和Paper/Shadow消费；不得把旧S02回执免检迁移到功能变化后的候选。

收尾校验与格式/扫描结果见[收尾记录](./evidence/s02-local-20261015/post/checks.json)、[格式范围](./evidence/s02-local-20261015/post/diff-status.json)。

封存时遇到11分钟前遗留的零字节Git index.lock；两次检查无活动Git进程、无文件持有者后，将锁移至可恢复临时备份，再恢复暂存，未重置源码或Git索引。见[锁恢复记录](./evidence/s02-local-20261015/post/git-lock-recovery.json)。该问题已解决，不是测试或目标环境通过凭据。

收尾计划命令修正：首次误用仅导出模块的check-development-plan-order.mjs，exit0只代表导入成功；已保留初始记录并更正为MODULE_LOAD_ONLY，实际执行check-development-plans.mjs通过，当前1 READY/158 NOT_ASSESSED/0 BLOCKED。冻结完整执行中的plans组本就使用真实校验器；预检空白plan.log不作为计划验收凭据。见[修正记录](./evidence/s02-local-20261015/post/checks.json)。

收尾结果：当前输入准入exit0、发布入口按预期拒绝exit2、实际计划CLI与前端移交校验exit0、普通代码/文档diff检查exit0。源码冻结与最终暂存gitleaks扫描均无泄漏。完整raw diff检查exit2，保留76条生成Markdown的EOF空行诊断，未修剪hash绑定的原始证据，不能记为全量格式PASS。见[扫描日志](./evidence/s02-local-20261015/post/staged-gitleaks.log)与[完整格式诊断](./evidence/s02-local-20261015/post/full-diff-check.log)。
