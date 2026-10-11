# R03 当前前置复评与 R02 保留事实用途处置

状态：REVALIDATION_IN_PROGRESS；当前不新增 READY 或正式 ACCEPTED。项目用户确认了独立限时用途；工程准入仍须实际复评。原 R03 工程证据保持原始范围。

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

## 当前工程步骤与边界

在新提交的干净源码上使用既有严格策略，完整执行 `CORE:R02` 与 `CORE:TP02` 的并集闭包（含F07/F08/F0与R01），保留每条实际命令、目标/构建/覆盖产物与日志hash；全部通过才发布当前递归门禁。重新执行R03七组回归及完整Supabase生命周期目标，保存新的源码输入/原始日志/目标回执，绑定当前依赖后运行 `make r03-admission-check`。原失败、原BLOCKED manifest及原目标证据保留历史字节。

当前目标仅已配置开发Supabase，无本地PostgreSQL/Supabase、生产凭据、发布或推送。正式ACCEPTED、候选同SHA hosted CI、部署HTTP/JWT身份链、受限Storage身份、代表性性能/长稳与R1总Gate仍单独验收。下一阶段结果将追加到本报告，原失败不删除。
