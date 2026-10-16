# EVALUATION:TP12 本地评估验收报告

2026-10-16；QuantOS分支codex/evaluation-tp12，任务基线e82e8c8883bf5af7772bf7b47af9f14368348833。冻结功能候选 `04dc196570c0808dc88f5f8d155209c1dcee9e6e`；全部31组实际执行PASS，8依赖节点/28组先于本检查点3组，共9节点。F07与EVALUATION:TP07及其完整传递依赖在同一候选复验，不借用历史READY。三次独立构建、make lint/test PASS：Rust414 passed/11 ignored，Python1856 passed，Web233 passed/3 skipped。数据库条件返回NOT_RUN及ignored/skipped均不是目标验收。

## 代码、测试和设计结论

新增QuantOS自有离线评估器、14项正反例测试、61项门禁测试、完整闭包记录器和本地profile，覆盖固定源字节/伪造blob元数据/缺规则或接口/非法证据路径/行为锚点缺失/TP07错绑定/依赖删减/混SHA/目标越权声明/历史TP07替换，以及三文件发布事务回滚。自有适配器18项测试通过，包括新增10个顶层/嵌套venue、order_tool、approval_signature、api_key、executable夹带反例和1个有效research_context。未新增执行适配、风险签发器或运行时依赖。

固定agents `8d79877380f8617b45dff2b8c8b3790c2f9d963a`（crate0.2.0/protocol1.0/LGPL-3.0-or-later），12个只读参考源文件按完整Git commit/tree/blob路径及SHA256核对。采用无credential helper/全局Git配置的公开固定commit fetch，不安装、导入、构建或执行上游。此证明绑定指定commit，不证明远程签名真实性；法律/分发批准NOT_RUN。baseline.recordedAt是归一化评估日期，不是精确抓取时间；实际命令执行时间以execution-results.json的executedAt为准。

7条禁止耦合规则：Agent无venue/工具/凭据权限；TradeProposal始终executable=false；权威RiskDecision/审批不可由advisory代替；kernel只收净化BoundaryCommand；Agent trace不单独成为权威证据；评估/签发/提交的过期拒绝；Nautilus家族不得进入运行时依赖/lock/import。每条有源控制与行为测试映射，但符号存在只是可追溯性。现有runtime/issuer/gateway行为由完整复验执行，OS部署隔离仍待目标证据。

6组接口差异区分Observation/TradeProposal语义、AgentClient/ExecutionKernel层次、advisory/authoritative，以及留存/字段元数据候选。8条威胁按攻击者初始能力、边界、前提、影响、控制和未决项建模；残余风险UNASSESSED，不沿用历史笼统“低风险”。架构复核按codex-security:threat-model技能顺序完成，第二遍为串行复核，不是独立审计。依用户仅修改QuantOS要求输出在仓库指定文档，不建立插件共享缓存或全库安全扫描。

决定 `reference_only`，runtimeAdmission=DENIED。留存分类、字段ownership/digest元数据和advisory命名只作候选，不承诺采用。TP12 CVE审计NOT_RUN。TP07实际重跑保持1051锁条目、1004registry包/版本查询快照、56个advisory ID（不等于独立CVE数）和47个非registry未知项；不是无漏洞或当前可达性/修复结论，离线重放不刷新OSV快照。

## 文档、计划与原始证据

[完整变更索引](./evidence/eval-tp12-local-20261016/changed-files.json)、[本地manifest](./evidence/eval-tp12-local-20261016/manifest.json)、[摘要](./evidence/eval-tp12-local-20261016/summary.json)、[TP12实际评估](./evidence/eval-tp12-local-20261016/evaluation-evidence.json)、[新候选TP07重验](./evidence/eval-tp12-local-20261016/tp07-revalidation-evidence.json)。

[全部31组执行结果](./evidence/provider-a1-remediation-20261004/eval-tp12-local-20261016/attempt-01/execution-results.json)、[依赖先后证明](./evidence/provider-a1-remediation-20261004/eval-tp12-local-20261016/attempt-01/dependency-revalidation.json)、[canonical恢复](./evidence/provider-a1-remediation-20261004/eval-tp12-local-20261016/attempt-01/canonical-preservation.json)。选择的检查没有canonical输出目录：0文件/0目录，恢复证明如实记录空集合，未借用历史恢复数量。所有输入SHA/摘要和日志由consumer-scoped receipts绑定。

两份计划、回执/排序策略、Beta移交与Makefile已同步。共享功能输入变化使TP07旧独立READY撤回；保留c12b69cc/e82e8c88原始历史结论。本次只发布EVALUATION:TP12 DEVELOPMENT READY；依赖内部LOCAL_READY归本consumer所有，不提升F07/TP07全局Gate。全图1 READY/158 NOT_ASSESSED/0 BLOCKED。operations progress ledger记录冻结前准备时点，当前状态以本报告和计划为准。CORE:TP12任务卡完整X3复审保持未放行。

[预检](./evidence/eval-tp12-local-20261016/preflight/index.json)和[失败记录](./evidence/eval-tp12-local-20261016/preflight/early-failures.json)保留首次矩阵组装猜错测试名、Ruff导入位置、尚未创建报告的断链和web缓存未命中；修复后完整预检8组以及共享54测试/脱敏秘密扫描通过。预检不是冻结候选依赖闭包。完整attempt-01未失败或复用通过组。

[收尾检查](./evidence/eval-tp12-local-20261016/post/checks.json)记录本地Gate、发布拒绝、计划/交接与格式检查；raw生成日志/参考源码字节不因格式诊断而改写，源码/文档与raw格式状态分开记录。冻结后仅更新验收报告、计划状态和证据，不修改功能输入。

## Gate、未决风险及下一任务

仅 **EVAL-TP12_LOCAL / DEVELOPMENT READY**，engineeringStatus=PASS，formalAccepted=false，[六维用户确认文稿](./evidence/eval-tp12-local-20261016/confirmation-draft.md) PENDING。按项目规程等待ProjectUser直接确认，未自行生成确认原文或签署。CORE:TP12/X3、S2整体、Beta、数据库、生产和外部发布未放行。

9组继承目标和3类移交NOT_RUN：实际Supabase/身份/部署、真实进程transport与OS隔离、持久幂等/崩溃恢复、trace敏感留存、协议演进、完整供应链/最新漏洞/可达性/修复和法律分发、安全/性能/长稳与同SHA hosted CI。上游签名真实性与TP12 CVE审计仍未验证。静态依赖排除不是运行时网络沙箱。未使用生产凭据，未建立本地PostgreSQL/Supabase、未推送Git或执行外部发布。

下一可执行任务：**CORE-GATE:S2-SERVICE**，按任务卡在新冻结候选完整复验R1-SERVICE、SERVICE:TP01、S01/TP06/S02/S03/S04、TP08/TP09/TP10/TP11及EVALUATION:TP07/TP12，汇总S2本地功能准入；不可拼接历史READY。CORE:TP12完整复审继续保留X3、在CORE:TP07和S2之后执行。
