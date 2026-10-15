# S03 本地开发验收报告（2026-10-15）

结论：CORE:S03 的 DEVELOPMENT READY（S03_LOCAL）。代码、测试、文档及本地验收证据已完成；正式项目用户确认 PENDING，formalAccepted=false。仅修改 QuantOS，未使用生产凭据、未连接数据库、未执行外部发布、Git推送或PR。S2整体及RELEASE-GATE:BETA仍NOT_ASSESSED，目标执行NOT_RUN。

冻结源码：`d10740c176a1becd1e9f69a44c91b171e0f337bf`。attempt-02在新候选完整重跑35节点/115组，全部PASS；34个依赖节点的111组检查先于S03自身4组完成（公共make test同时覆盖全工程代码）。直接依赖S02、F06、R1-SERVICE完整保留；内部LOCAL_READY只属于S03消费者，不传播上游独立READY。未以旧S02、预检或历史回执替代本轮。全图仅S03 1 READY /158 NOT_ASSESSED /0 BLOCKED。S02旧独立READY因共享功能输入变化撤回，历史原件保留。

## 实现与语义

DraftService::validated_backtest在实际S01/TP06/S02回测后签发不透明凭据，无公开构造器或Deserialize。凭据固定不可变草稿版本/实际Artifact参数、Snapshot hash/有效期及完整回测；请求JSON、任意报告或Some(hash)不能成为验证身份。Release v2 hash覆盖tenant/workspace、草稿版本、完整源码SHA、本地构建制品digest、参数、Snapshot、Artifact、报告和规范化目标。相同内容返回原Release，变更内容确定性冲突；历史hash-only候选保持未验证。

审批一次性绑定Release hash、actor、时间和有效期，候选hash不变；审批不能超过已验证Snapshot有效期。F06 PolicyEngine在发布/审批/部署/消费中检查capability及Paper/Shadow模式，复核tenant/workspace、完整性、目标与时效。共享Mutex保证20路审批只有一次成功、20路相同目标票据幂等。消费必须匹配已记录票据，从固定Artifact构造真实GeneratedStrategyAdapter；Paper与Shadow分别实际重放，报告逐字段等于审批前报告。此链路只消费本地策略配置，没有外部部署客户端或venue操作。

PgReleaseStore改为可信AuthContext加同一不透明凭据入口，审批hash CAS、票据幂等、部署策略重验，并修复读取列created_by_actor。审批时间按数据库微秒精度封存。前向迁移绑定workspace、存储Snapshot hash及草稿版本hash，约束不可变内容/单次审批/跨租户引用/有效期与工作区RLS；保留历史行和窄范围auth.users FK清理行为。实际迁移和数据库语义未执行；service_role仍是受信任写入边界，hash不是身份签名。设计见[ADR](../adr/20261015-s03-release-control.md)和[操作规程](../operations/s03-local-admission.md)。

## 实际执行证据

| 验证 | 结果 | 原始证据 |
|---|---|---|
| 新候选完整依赖与自身检查 | 35节点/115组PASS，111依赖+4自身，0 FAIL | [执行结果](./evidence/provider-a1-remediation-20261004/s03-local-20261015/attempt-02/execution-results.json)、[实际顺序](./evidence/provider-a1-remediation-20261004/s03-local-20261015/attempt-02/dependency-revalidation.json)、[递归索引](./evidence/provider-a1-remediation-20261004/s03-local-20261015/attempt-02/local-prerequisites.json) |
| 三次独立目录跨语言构建 | 3/3 PASS，组合产物hash一致 | [构建记录](./evidence/provider-a1-remediation-20261004/s03-local-20261015/attempt-02/f01-reproducibility.json) |
| make lint / make test | PASS；Rust407 PASS/11 ignored、Python1845 PASS、Web233 PASS/3 skipped | [lint](./evidence/provider-a1-remediation-20261004/s03-local-20261015/attempt-02/logs/f01-lint.log)、[test](./evidence/provider-a1-remediation-20261004/s03-local-20261015/attempt-02/logs/f01-test.log) |
| S03专项 | 6 PASS/0 ignored；100部署拒绝、去重/冲突、权限/时效/篡改、20路审批与幂等、真实进程/两个实际adapter消费重放与恢复 | [Rust日志](./evidence/provider-a1-remediation-20261004/s03-local-20261015/attempt-02/logs/s03-rust.log)、[完整Release与审批](./evidence/s03-local-20261015/release-evidence.json) |
| S03准入与回滚 | 89 PASS；缺节点/混候选/跳过/假审批/非法目标/假发布声明/事务回滚均拒绝 | [门禁日志](./evidence/provider-a1-remediation-20261004/s03-local-20261015/attempt-02/logs/s03-local-policy.log) |
| S03迁移静态契约 | 6 PASS；不可变/审批/来源/时效/版本与Snapshot/RLS/审计清理文本合同，非数据库执行 | [静态日志](./evidence/provider-a1-remediation-20261004/s03-local-20261015/attempt-02/logs/s03-migration.log) |
| S02、F06、R1-SERVICE完整依赖 | 本候选必要本地检查全部重跑PASS，22组共享目标明确延期 | [S02](./evidence/provider-a1-remediation-20261004/s03-local-20261015/attempt-02/core-s02.json)、[F06](./evidence/provider-a1-remediation-20261004/s03-local-20261015/attempt-02/core-f06.json)、[R1](./evidence/provider-a1-remediation-20261004/s03-local-20261015/attempt-02/core-gate-r1-service.json)、[依赖顺序](./evidence/provider-a1-remediation-20261004/s03-local-20261015/attempt-02/dependency-revalidation.json) |
| canonical组件输出恢复 | 637文件逐字节恢复，4个原本不存在目录恢复为不存在 | [恢复记录](./evidence/provider-a1-remediation-20261004/s03-local-20261015/attempt-02/canonical-preservation.json) |

实际Release hash：`sha256:142807e1a7c8b19ea0ac4508d768421ad6dabddb58d7194d949e055b364320ad`；嵌入回测报告hash：`sha256:42ac43bab071ddf59eaf02de182174000b44c8ec685eb30dcd879512d78c08b2`。本轮制品digest是本机测试二进制，不能当作外部部署镜像。全套Rust统计包含显式ignored或缺目标配置后提前返回的历史数据库案例，不能据此宣称Supabase通过；新增S03 PostgreSQL测试显式ignored且保留真实目标调用代码。专项与全套统计有重叠，不相加为独立案例总数。

## 预检失败与修复

初始编译将Release字段误加入草稿版本映射，已修复；普通沙箱真实Python子进程未就绪导致5 PASS/1 FAIL，在正常本机IPC权限下6 PASS。中间API调整时全目标编译使用了未同步的凭据访问器，修复后完整模块与Clippy通过。计划预检发现边界固定前缀、development_status枚举和镜像stage登记问题，已修复；门禁测试夹具的S02报告标记错误也已修复。冻结24496060的首轮在4组PASS后受控中断完整测试：复核发现迁移保留的历史NULL workspace可能由row.get触发panic，改用try_get传播错误，新增真实Postgres Row只读回归（显式ignored，未运行目标）。首轮SIGTERM、部分日志及637文件/4个目录恢复证据均保留，未复用首轮通过组。修复后重新冻结并在attempt-02完整重跑。见[首轮中断](./evidence/provider-a1-remediation-20261004/s03-local-20261015/attempt-01/interruption.json)。全部原始失败与后续通过保留在[预检记录](./evidence/s03-local-20261015/preflight/receipt.json)，明确workingTreeDirty，不作为冻结候选证据。最终候选只使用本轮attempt-02完整结果。

## 未决风险与Gate边界

ReleaseService及目录、审批/票据是进程内状态，重启不持久；API参数AuthContext、源码/构建来源及clock必须来自可信宿主，不能直接采用用户请求。公开授权HTTP API、拒绝/过期/并发审计状态与页面联调由SERVICE:S04/CORE:S04继续完成。当前业务审批与项目用户正式工程验收是两个流程。

实际Supabase迁移、RLS、事务并发/恢复、真实auth.users与Storage审计、跨进程消费/禁用恢复，授权Paper/Shadow外部部署、安全/回滚/负载/性能/长稳、来源用途许可、候选同SHA hosted CI均NOT_RUN。22组共享目标和S03四类继承义务全部保留；实际目标首次发布前由测试及Beta验收，不把本地READY提升为上游、整体S2、生产或外部发布许可。

历史hash-only Release不自动升级；同草稿版本内容改变会冲突，需新版本验证/发布。新迁移不自动撤回已存在的外部部署。审批有效期不得超过验证Snapshot有效期，长期策略须以新版本重新验证、发布及审批；实际部署生命周期仍待后续检查点实现。目标数据库测试虽已更新并可编译，但未执行，不能排除SQL/目标行为差异。

按[统一规程](../gate-records/user-acceptance-confirmation-workflow.md)拟定[项目用户确认文稿](./evidence/s03-local-20261015/confirmation-draft.md)，覆盖Product/Frontend/BFF/QA/Security/Risk六维，状态PENDING、无用户原始答复记录；未自行批准正式ACCEPTED。

## 变更、Git与下一任务

实现集中于quantos-strategy的release.rs、drafts.rs、pg.rs及实际/目标测试夹具；新增前向迁移、6项静态契约、S03 gate/recorder/89项准入测试、ADR/操作规程/本报告；同步Makefile、通用执行策略、发布移交和两份计划。完整变更文件与逐文件hash见[变更索引](./evidence/s03-local-20261015/changed-files.json)，原始证据单列。

分支`codex/s03-release-target-control`；冻结源码提交`d10740c176a1becd1e9f69a44c91b171e0f337bf`。后续证据封存提交只更新生命周期、文档与原始证据，不是另一份已测试源码。无push、PR或外部发布。

下一可执行任务：SERVICE:S04授权策略目录/Lab/Backtest/Release API与approval integration检查点；先在其新候选完整复验S01、S02、S03、F06、R1-SERVICE，再完成capability/allowedTargets及未验证/未审批/过期/并发拒绝状态与审计。CORE:S04的页面联调还需U01和FE:FEP-3，不能凭S03本地回执直接完成。

收尾当前输入校验、实际计划CLI、发布拒绝、源文档格式、扫描与原始格式范围见[收尾记录](./evidence/s03-local-20261015/post/checks.json)、[格式范围](./evidence/s03-local-20261015/post/diff-status.json)。raw日志及生成Markdown按原字节保存，不因EOF空行诊断改写。

最终收尾：普通代码/文档共23个文件。当前输入准入exit0、发布按预期拒绝exit2、实际计划CLI及前端移交exit0；冻结源码之后功能文件未改变。源文档格式exit0；完整raw格式exit2，保留76条生成Markdown的EOF空行诊断。源冻结与最终暂存gitleaks扫描均无泄漏，原始证据未修剪。见[扫描日志](./evidence/s03-local-20261015/post/staged-gitleaks.log)和[格式诊断](./evidence/s03-local-20261015/post/full-diff-check.log)。
