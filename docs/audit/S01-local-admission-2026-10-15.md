# S01：策略草稿与参数模型 — 2026-10-15

范围仅 QuantOS，S2-SERVICE；不使用生产凭据、不创建本机数据库、不执行外部发布或推送。实现提交 `ee7b3528e4c1a4e740f1bb56a416ac353f37211d`；首轮工具链失败归档后，修正审计FK兼容性后，本轮完整执行候选为 `d021ac20f53c529afa0ffc9ffdbe87eb57433893`。最终证据提交与冻结源码提交分别记录，不能把证据提交当作重新执行过的功能源码。

## 依赖与 Gate 范围

S01 的计划直接依赖仍为 CORE:R02、CORE:R03、CORE-GATE:R1-SERVICE。用户另指定的 CORE:F08、SERVICE:TP01、R1-SERVICE 是 TP06 的直接依赖，本轮额外纳入审查；不改写 S01 的依赖语义。S01_LOCAL 以 CORE:S01 与 SERVICE:TP01 为联合执行 roots，完整32节点、103组本地必要检查，原22组外部/目标/性能检查单独保留NOT_RUN。

只登记 S01 DEVELOPMENT Gate；所有内部 LOCAL_READY 均由 S01 消费者持有，不传播上游独立 READY。共享功能输入变化后 SERVICE:TP01 旧独立 READY 已撤回为 NOT_ASSESSED，历史报告与原始证据保留。formalAccepted=false、databaseExecution=false、production=false、externalPublished=false、upstreamAccepted=false。

## 变更与发现修复

- 新增进程内 DraftService 库 API：create/save/versions/validate；由服务器注入已验证 AuthContext 和可信 Catalog，无新增 HTTP/UI。手动与自动保存均要求 base_version，原子比较保存，显式冲突，不自动覆盖。
- 补齐同租户不同工作区的写入/读取/验证隔离；验证重新核对 Artifact id/hash 与快照质量、许可、有效期；WIP 可缺引用，缺快照或 Artifact 不能发起验证。倒退时钟和版本溢出拒绝，失败不改变 head/history。
- 参数输入支持 serde 往返与未知字段拒绝；合成参数fixture保持字符串金额和确定性 canonical hash，审计作者来自服务器身份。
- PgStrategyStore 创建/保存/读取改用 AuthContext；auth.users 用户链不再由可空客户端字段控制。行锁+事务实现持久比较保存；持久验证重新加载R02来源/规则与Artifact。
- 前向迁移增加租户/工作区/作者/引用约束、版本不可变、版本与head提交一致性及强制RLS工作区读取。复核修正不可变作者字段阻断历史auth.users FK置空的问题，仅允许嵌套触发器且其他字段全部不变的FK例外；普通清空作者仍拒绝，目标专用断言已补充，实际数据库效果仍NOT_RUN。只做静态检查，未连接目标，不宣称迁移/RLS/事务已生效。
- 原“50并发”测试实际上串行，已准确重命名为过期编辑/恢复测试；新增50组各4真实线程竞争，200次编辑必须50胜/150显式冲突，逐组核对保存内容与验证handoff hash。
- 新增独立本地准入、完整输入hash/源码SHA/递归依赖绑定、证据篡改和候选混用拒绝、原件恢复及准入更新失败回滚；更新两份计划共享阶段契约与发布移交。

## 证据

首轮 `attempt-01` 在 pnpm --version 工具链预检处因 registry 签名元数据 fetch failed 停止，103组检查尚未开始；canonical原件恢复。正常联网签名校验成功后，未绕过签名或改锁文件，第二轮候选`7b6b986e`完成三次构建、F01及lint后，在make test执行中因人工复核发现审计FK兼容性问题而主动中断，仅停止核验过的本次进程树；637文件原件及原先缺席的目录恢复。中断原始记录、部分检查和恢复过程保留，未发布READY，也不把其结果拼入最终结论。修正后以新冻结候选`d021ac20`完整执行 `attempt-03`。初始编译错误摘要，以及Clippy、状态枚举和测试修复过程的原始失败日志均保留在 preflight，不能当作验收PASS。

| 范围 | 本轮结果 |
| --- | --- |
| 联合必要闭包 | 32节点 / 103组全部PASS，全部绑定d021ac20；无失败、超时或混用候选 |
| 可复现构建 | 三次独立Rust/Web/Python构建PASS，产物摘要一致 |
| 完整make lint | PASS |
| 完整make test | Rust 399 PASS / 9 ignored；Python 1635 PASS；Web 233 PASS / 3 skipped |
| quantos-strategy库测试 | 19 PASS / 1 ignored（发布性能） |
| 50组并发 | 每组4真实线程，共200调用；50胜 / 150显式冲突，无静默覆盖；历史与handoff hash一致 |
| S01门禁负向 | 62 PASS，包括跳过案例、缺项/重复/篡改、混候选、权限扩大、发布写入失败恢复 |
| S01迁移静态契约 | 3 PASS；只验证源码契约，不是PostgreSQL执行证据 |
| 原件恢复 | 637文件逐一hash验证并恢复，初始不存在的输出目录同样恢复为不存在 |
| Gate | S01_LOCAL限定DEVELOPMENT READY；全图1 READY / 158 NOT_ASSESSED / 0 BLOCKED；formalAccepted=false |
| 目标/发布 | 22组共享目标检查及11项汇总目标义务均NOT_RUN；保存P95<300ms、真实数据库并发/RLS/持久恢复、hosted CI与正式确认未验收 |

原始执行索引：[attempt-03](./evidence/provider-a1-remediation-20261004/s01-local-20261015/attempt-03/local-prerequisites.json)；独立回执：[manifest](./evidence/s01-local-20261015/manifest.json)；全量回归统计：[regression-summary.json](./evidence/s01-local-20261015/regression-summary.json)。每条命令、时间、退出码、异常状态、原始log及其摘要均见execution-results.json；32份节点manifest记录规范范围、源码/测试/配置hash与递归依赖摘要。Rust统计中的默认未启用目标测试不能算数据库PASS。

独立复验均已完成：[Gate复验](./evidence/s01-local-20261015/post/verification.json)、[计划检查](./evidence/s01-local-20261015/post/plan-check.json)、[发布拒绝](./evidence/s01-local-20261015/post/release-rejection.json)与[637文件独立哈希复验](./evidence/s01-local-20261015/post/canonical-verification.json)。发布检查按要求退出2并拒绝本地回执，没有授予发布READY。Git分支为`codex/s01-strategy-drafts`，本报告随最终证据提交封存，不推送。最终证据提交SHA见交付回复，冻结功能源码仍为d021ac20。


最终Git暂存格式检查：全量 `git diff --cached --check` 退出2，共76条EOF空行诊断，全部来自本轮生成/复制且已hash绑定的原始审计Markdown。未改写原件；[完整诊断](./evidence/s01-local-20261015/post/staged-whitespace-raw.log)与[范围判定](./evidence/s01-local-20261015/post/staged-whitespace.json)保留。排除原始证据后的实现/规程/报告差异检查PASS。该格式警告不作为功能FAIL，也未冒记全量格式检查PASS。

## 保留风险和发布义务

1. 实际Supabase迁移、强制RLS、auth.users审计、跨租户引用与数据库事务/跨进程恢复尚未执行。迁移不回填旧行；历史created_by_user为空的草稿需目标迁移前审核。目标持久测试显式ignore+opt-in，不能将本地skip统计为数据库PASS。
2. 进程内DraftService不提供重启持久化，其Catalog是构造时的可信快照；动态数据库来源/规则由PgStrategyStore持久验证重新加载。可信Catalog/AuthContext必须由后续宿主服务加载，时间由宿主受控时钟赋值，不能信任请求JSON提供的身份、Catalog或时钟；HTTP/UI自动保存交互留消费页面任务。
3. 50组本机线程测试不替代目标数据库并发；目标50组无静默覆盖、缺权限/快照/Artifact拒绝、保存P95<300ms、负载长稳、部署与同SHA hosted CI全部NOT_RUN。
4. 继承SERVICE:TP01全部22组共享目标检查与7天canary、目标回滚、正式验签、持久审计/控制恢复等义务；所有上游正式/目标准入仍独立。用户正式确认遵循统一规程，本轮不自签。

下一可执行任务：TP06（自然语言策略生成候选的本地开发），须按其自身消费者范围重新验证 F08、SERVICE:TP01、R1-SERVICE，不能直接沿用S01内部LOCAL_READY；S02还依赖TP06/TP08，不应提前登记READY。

## 变更文件索引

- `Makefile`
- `crates/quantos-strategy/src/drafts.rs`
- `crates/quantos-strategy/src/lib.rs`
- `crates/quantos-strategy/src/pg.rs`
- `crates/quantos-strategy/tests/fixtures/draft-parameters.json`
- `crates/quantos-strategy/tests/postgres_drafts.rs`
- `docs/SumAlpha-QuantOS-Development-Plan.md`
- `docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md`
- `docs/operations/s01-local-admission.md`
- `scripts/check-development-plan-order.mjs`
- `scripts/development-plan-order-policy.json`
- `scripts/frontend-gate-handoff-policy.json`
- `scripts/provider-a1-policy.json`
- `scripts/provider-a1-receipts.mjs`
- `scripts/record-s01-local.mjs`
- `scripts/s01-local-gate.mjs`
- `scripts/s01-local-gate.test.mjs`
- `scripts/s01-migration.test.cjs`
- `supabase/migrations/20261015100000_s01_draft_integrity.sql`

原始证据目录：`docs/audit/evidence/s01-local-20261015/` 与 `docs/audit/evidence/provider-a1-remediation-20261004/s01-local-20261015/`，包括全部失败、中断与最终完整执行。完整文件索引见 `evidence/s01-local-20261015/changed-files.json`。
