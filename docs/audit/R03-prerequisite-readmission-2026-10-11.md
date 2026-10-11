# R03 历史Supabase前置复评与 R02 保留事实用途处置

> 本报告保留旧Supabase前置profile及失败事实。当前R03开发准入依据[R03_LOCAL策略与复验](./R03-local-gate-policy-2026-10-11.md)；下文“当前”均指本次历史检查点。原manifest已[按字节归档](./evidence/r03-local-gate-policy-20261011/history/r03-supabase-prerequisite-manifest.json)。

**R03 engineering PASS；DEVELOPMENT Gate BLOCKED，formalAccepted=false。** 项目用户已确认独立限时数据用途；主轮冻结源码 `b358581d24e51d1e7dd4200176467c833d12a0f0` 的必要前置60唯一命令组已逐项处置：53 PASS、5 FAIL、2 NOT RUN。其中TP02两项随后在68acfa67修正并实际复验PASS，原失败保留；共享输入变化后的完整前置仍须重跑。开发Supabase在F07执行中进入只读，恢复/覆盖/服务失败，100个自有fixture任务当时无法收尾；后续已精确退役并读回pending=0，默认只读恢复仍待办，见[恢复记录](./R03-supabase-recovery-2026-10-11.md)。R03七组回归与完整生命周期在只读发生前实际PASS，但五项当前前置未准入；admission实际拒绝，未新增READY。

## 已确认的数据处置

用户在本会话对[完整文稿](../gate-records/R02-retained-data-disposition-draft-2026-10-11.md)直接答复“确认上述限时复验范围”。[原始答复记录](../provider-approvals/20261011-r02-retained-revalidation-confirmation.json)绑定文稿与[独立机器范围](../provider-approvals/20261011-r02-retained-revalidation-scope.json)的 SHA-256；草稿按用户实际审阅字节保留，其 PENDING 字样是审阅时状态，确认事实以独立记录为准。

仅允许原 tenant 的 BTC/USDT、ETH/USDT 各 sequence 1–16、共32条保留事实，在 `2026-10-14T00:00:00Z`（北京时间10月14日08:00）前用于内部 DEVELOPMENT 复验。[实际只读清单](../provider-approvals/20261011-r02-retained-events.json)锁定 event ID、原血缘 hash 和实际载荷规范化摘要；每次消费重新比对。禁止新采集、Binance API、扩大标的/记录、真实外部模型/工具、交易、展示、再分发、商用或生产。仅写本次自有派生快照/Artifact/审计，并停用自有 actor、回收 Engine。

旧30分钟采集授权仍于10月10日到期；旧 scope/provider 配置/原回执与不可变事实均保留原字节。新许可不延长旧窗口、不宣称第三方商用许可、不批准工程验收。运行中每秒重读许可，改变/撤销/到期则终止研究子进程；结束时再次核验许可。

## 已执行与原失败

- `bb4b5b1c` 初次复评的三轮独立构建、F01组件/负向/lint及F09目标检查通过；F06首次预检第二次严格连接未完成，原失败保留。两次独立严格TLS诊断及随后F06完整七段链路通过，未放宽CA验证。
- R02消费者检查首次实际运行成功返回 Research 5 / Proposal 3，但误把三个未启用的R03目标测试计数纳入旧五场景标记。增加显式筛选后 Research 2 / Proposal 3，检查通过；未将无目标执行的测试记为数据库证据。
- 新授权记录要求唯一ProjectUser的明确答复、完整文稿/范围摘要、独立期限和32条事实清单。旧授权的历史时钟单元fixture只用于拒绝机制回归，生产CLI使用当前时间。
- 初次复评在新用途确认后主动停止，未执行完的F01全量测试及其余命令不计PASS，不发布任何READY。该次专属Engine残留核查PASS。详见[原始证据](./evidence/r03-prerequisites-20261011/initial/interrupted-assessment.json)与[第一轮执行台账](./evidence/provider-a1-remediation-20261004/r03-prerequisites-20261011/attempt-01/execution-results.json)。
- 冻结 `c224a330` 的第二轮完成37/60组，36 PASS、F07覆盖1 FAIL；原日志确认通用worker只领取 `runtime.fixture.v1`，旧目标测试仍要求领取 `unsupported` 并失败，造成确定性契约冲突。修正测试为非所属工作流保持Queued，并将budget/retry调用顺序与实际领取一致。该轮主动停止、未完成23组不计PASS、未发布READY；[专属Engine核查](./evidence/r03-prerequisites-20261011/initial/attempt-02-engine-cleanup.json)无残留。修正后的Supabase定向完整gateway用例实际PASS（1 passed、96.24s，含预算/上传重试/归属/清理；原poison探针的预期panic不作失败）。[定向日志](./evidence/r03-prerequisites-20261011/initial/f07-worker-fix-target.log)保留。测试文件属于R03功能输入，新冻结源码必须重新执行R03回归及目标，不再沿用此前72文件字节一致的准入路径。

- 冻结 `c8ac62a6` 第三轮完成6/60组、6 PASS后，在保留事实链执行前因静态来源兼容性问题主动停止，不发布READY；[中断记录](./evidence/r03-prerequisites-20261011/initial/attempt-03-interrupted-assessment.json)与专属Engine清理PASS保留。新增回归实际暴露原策略错误替换采集引用/版本，修正后60项策略/阶段/连接检查PASS：原采集引用/版本/文稿及scope摘要保持不变，新用途及其期限/摘要在 `retained_authorization` 独立记录，仅派生当前研究消费截止，不重启旧采集窗口。
- 独立32事实Supabase链首次已通过来源/快照Gate，实际在Engine边界因旧fixture的未声明 `retained_market` 顶层字段失败；保持Engine v1白名单，通过prompt传递32条必要研究投影。独立Rust契约测试1 PASS（精确小数/身份、数量/长度限制），[第二次真实链](./evidence/r03-prerequisites-20261011/initial/retained-compat-02/receipt.json)PASS_SCOPED_TARGET：32事实、Degraded、两个mock研究消费者、交易/Signal拒绝、actor/Engine清理均PASS。消费者Research2/Proposal3、撤销/变更真实子进程2项均PASS。原失败/修正日志均保留；该链Runtime为内存范围，不冒充持久R03目标。c8源码的R03目标/七组已PASS，但新增输入辅助文件后必须重新执行，旧工程结果仅[历史归档](./evidence/r03-prerequisites-20261011/history/c8-r03-engineering/README.md)。

## 当前复评与 admission

[主执行台账](./evidence/provider-a1-remediation-20261004/r03-prerequisites-20261011/attempt-04/execution-results.json)保存37组实际执行（34 PASS、3 FAIL）。为避免继续向只读目标写入，主动SIGTERM停止本会话进程组9452，未完成23组不计PASS；随后隔离数据库凭据执行[独立续验](./evidence/r03-prerequisites-20261011/static-continuation/execution-results.json)：19 PASS、TP02校验/负向2 FAIL，R01/R02目标2项NOT RUN。这不是完整复评PASS；[60组汇总](./evidence/r03-prerequisites-20261011/final/command-disposition.json)为53/5/2，不发布任何新的READY。

| 验证层 | 当前结果 |
|---|---|
| 数据用途/拒绝机制 | 60项策略/阶段/连接检查PASS；运行中撤销/变更[2项实际自有子进程测试](./evidence/r03-prerequisites-20261011/final/authorization-watch.log)PASS；新授权仅限定现有32条，不重启采集。 |
| R02 Engine v1输入 | [独立Rust契约](./evidence/r03-prerequisites-20261011/initial/retained-input-unit.log)1 PASS；32条数量、精确数值/身份及8192字符上限；本轮F01 workspace再次覆盖。不扩大v1输入白名单。 |
| F01/F03/F04/F05/F02/F06/F09 | 三次独立构建、全量lint/test、Proto/client、覆盖、安全/迁移/Storage/RLS及F06/F09实际目标均在本轮PASS；不能因此独立发布递归READY。 |
| F07 | recovery/coverage/service三组FAIL；恢复子进程的SELECT FOR UPDATE被只读事务拒绝，覆盖在只读环境失败，Auth admin创建测试用户HTTP500。100任务恢复未完成，数据库fixture收尾也失败。 |
| F08/TP01/TP02及剩余静态项 | 19组独立续验PASS，含F08功能/分支/实际wheel-UDS服务、只读Git治理、R01/R02静态组件与Research2/Proposal3；TP02十条命令均exit0，但旧433计数假设导致校验及负向两项FAIL，修正后组件另行实际复验PASS；数据库凭据隔离，仅组件工程证据，不授予前置READY。 |
| R01/R02当前数据库目标 | NOT RUN：服务器已只读，不继续创建fixture。此前[独立32事实链](./evidence/r03-prerequisites-20261011/initial/retained-compat-02/receipt.json)仅PASS_SCOPED_TARGET，不代替本轮完整目标。 |
| R03当前新目标 | [实际目标](./evidence/r03-prerequisites-20261011/r03-current/target/receipt.json)及七组回归PASS；74功能输入绑定b358581d，十次同hash、排队/运行中取消225/553ms，独立进程恢复、无重复Artifact/成本与目标清理PASS。目标在只读发生前执行，不能据此推定当前数据库仍可写。 |
| R03 admission | [原manifest](./evidence/r03-local-gate-policy-20261011/history/r03-supabase-prerequisite-manifest.json)摘要 `sha256:ee865d512d9bfed1ab135b3bea3667bdd951dec1ed488374aac37efa2d4b4cb2`；engineering PASS、Gate BLOCKED、formalAccepted=false。`make r03-admission-check`实际exit2，[日志](./evidence/r03-prerequisites-20261011/final/r03-admission.log)确认五项当前前置未准入；`--verify` exit0仅证明BLOCKED回执内容一致。 |

TP02后续修正冻结于 `68acfa67a6b1079ab3a3ad05179a6b8221101479`：[独立实际复验](./evidence/r03-prerequisites-20261011/tp02-postfix/summary.json)10组组件全部PASS，完整Python1366 PASS、实际隔离wheel五RPC PASS，26项回执/不完整套件拒绝测试PASS，Engine清理PASS。完整套件可增长但必须有仅通过的最终摘要且不少于历史433项，不接受失败/跳过/未完成。原两项失败保留，不覆盖53/5/2台账；共享功能输入发生变化，全部必要前置必须从新提交重新完整复验，不能拼装为READY。R03自己的74功能输入未受该校验器修正影响，与b358581d目标逐项一致。

## 数据库阻塞与收尾

续验收集脚本在第一个process-cleanup产物处出现同路径复制错误（不是组件失败），[原始记录](./evidence/r03-prerequisites-20261011/static-continuation/interrupted/collector-failure.json)保留；修正收集路径后仅补跑未保存的四组，未重跑17个已通过项。

[严格TLS只读探针](./evidence/r03-prerequisites-20261011/final/database-readonly-probe.json)于11:54:37 UTC确认 `pg_is_in_recovery=false`、`transaction_read_only=on`、`default_transaction_read_only=on`、数据库1610894483 bytes（约1.61GB）。探针只读事务ROLLBACK、连接关闭，没有更改服务器设置。实际触发原因尚未确认，容量数据不作为配额根因证明。

本轮自有fixture tenant `01a12acb-6530-7432-88b5-a71f4ee28668` 的初始100个pending任务及原Drop/retire失败保留为历史事实。2026-10-11 12:28 UTC已按官方维护会话方式精确退役100任务、禁用1工具，独立新连接读回pending=0；[当前恢复记录](./R03-supabase-recovery-2026-10-11.md)及[COMMIT回执](./evidence/r03-supabase-recovery-20261011/retirement.json)闭合该fixture收尾。普通新连接默认仍只读，完整前置复验尚不能启动。保留审计和原始事件，没有批量清理历史tenant或永久覆盖服务器保护。[本轮Engine核查](./evidence/r03-prerequisites-20261011/final/attempt-04-engine-cleanup.json)及独立R03目标自有actor/Engine清理PASS。

[性能诊断](./evidence/r03-prerequisites-20261011/final/performance-diagnostics.json)：F05派发/副作用/回执各10000，消费359.636秒，单次event-ID取回8681.873ms（不是三路径P95）。F07仅完成100次调度，P95 878.490ms，超过200ms；恢复失败，性能及恢复验收均不得记PASS。

## 命令与验证证据

```sh
# 主复评的实际历史命令；输出目录不可复用，后续重跑须选新目录。
node --input-type=module -e 'import {assess} from "./scripts/provider-a1-receipts.mjs";assess("docs/audit/evidence/provider-a1-remediation-20261004/r03-prerequisites-20261011/attempt-04",["CORE:R02","CORE:TP02"]);'
QUANTOS_SKIP_ENV=1 make r02-admission-check  # exit2，当前前置不满足
QUANTOS_SKIP_ENV=1 make r03-admission-check  # exit2，正确拒绝
node scripts/r03-stage-check.mjs --verify  # exit0，工程PASS/Gate BLOCKED
node --test scripts/r03-stage-check.test.mjs  # 16 PASS
node scripts/check-development-plans.mjs  # PASS
```

R03七组实际回归命令/日志摘要另存manifest：

```sh
env -u DATABASE_URL cargo test -p quantos-runtime -p quantos-storage --lib --locked
env -u DATABASE_URL cargo test -p quantos-runtime --locked --test research_orchestration --test signal_proposal_orchestration -- --skip r02_retained_market_persistent_research_chain --skip r03_configured_supabase_lifecycle --skip r03_worker
engines/.venv/bin/python -m pytest engines/tests/test_rd_agent_contract.py engines/tests/test_rd_agent_development.py -q
env -u DATABASE_URL cargo test -p quantos-engine-manager --locked
cargo clippy -p quantos-runtime -p quantos-storage -p runtime-gateway --all-targets --locked -- -D warnings
node scripts/check-development-plans.mjs
node --test scripts/r03-stage-check.test.mjs
```

[最终命令记录](./evidence/r03-prerequisites-20261011/final/commands.json)、[篡改拒绝探针](./evidence/r03-prerequisites-20261011/final/current-manifest-probes.json)、完整53项实际PASS/五项原FAIL/两项NOT RUN均可复核；正确拒绝是门禁行为通过，不等于R03准入通过。

## 变更文件与历史

代码：`scripts/r02-retained-source-policy.cjs`、`scripts/r02-chain-check.cjs`、`scripts/r02-engine-consumers.cjs`及策略测试；新增Rust输入契约/共享投影，修正`r02_persisted_chain.rs`与gateway的worker归属/预算/重试测试。独立用途授权绑定原始答复/期限/32条载荷；保留原采集引用/版本/文稿及scope hash，以`retained_authorization`独立绑定新许可，仅派生研究消费截止。运行时每秒重读并在撤销/变更/到期后终止自有研究子进程。

文档与证据：数据处置文稿/确认/范围/只读事实清单、两份计划、R03当前manifest/说明/待确认文稿及完整复评归档。详见[变更文件清单](./evidence/r03-prerequisites-20261011/final/changed-files.txt)。[五个历史文件](./evidence/r03-prerequisites-20261011/final/historical-immutability.json)重新与bb4b5b1c核对逐字节相同；原R03 BLOCKED [manifest](./evidence/r03-prerequisites-20261011/initial/r03-before-readmission-manifest.json)、旧TP02原始[回执/wheel](./evidence/r03-prerequisites-20261011/history/tp02-pre-revalidation/receipt.json)保留。当前源码有4个R03功能文件变化，[转换清单](./evidence/r03-prerequisites-20261011/final/r03-input-transition.json)明确74输入，因此使用本轮重新执行的新目标，不沿用72文件连续性声明。

## 未决风险、Gate与下一可执行任务

- **当前Gate：R03 BLOCKED、formalAccepted=false。** 计划0 READY、158 NOT_ASSESSED、1 BLOCKED；五项直接前置严格校验仍BLOCKED。没有推送、发布、部署、生产凭据或本地数据库。
- **下一可执行任务：核查并恢复既有开发Supabase可写性**，指定100任务/工具已退役并确认pending=0；项目用户已完成控制台登录，平台超限/磁盘压力已确认；解决容量限制并恢复普通新连接可写后，在干净提交上完整重跑R02/TP02必要前置闭包和R03 admission。不得把本轮53项PASS拼装为完整READY。R03闭合后再做TP03/TP04当前准入，之后才可执行R04/R1总Gate。
- 数据用途于北京时间10月14日08:00到期，撤销/变更即停止；过期不能复用，禁止新采集、交易、展示、再分发和商用。原30分钟采集授权仍过期。
- R03工程人工确认仍待办；R02 C25代表性查询P95/C26部署HTTP-JWT、受限Storage身份、候选同SHA hosted CI、代表性性能/长稳、研究lease heartbeat与真实模型费用仍未验收。

最终三项目录秘密扫描均exit0、no leaks found，见[扫描记录](./evidence/r03-prerequisites-20261011/final/secrets-scans.json)。本次本地提交包括授权/来源策略修正、worker测试修正、保留事实输入修正和TP02套件计数修正；不推送。全部变更与验收文件在最终[Git字节校验](./evidence/r03-prerequisites-20261011/final/git-evidence-tracking.json)中核对。
