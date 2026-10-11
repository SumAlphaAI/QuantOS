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

## 当前工程步骤与边界

在新提交的干净源码上使用既有严格策略，完整执行 `CORE:R02` 与 `CORE:TP02` 的并集闭包（含F07/F08/F0与R01），保留每条实际命令、目标/构建/覆盖产物与日志hash；全部通过才发布当前递归门禁。之后核对R03功能输入字节，更新当前依赖绑定并运行 `make r03-admission-check`。

当前目标仅已配置开发Supabase，无本地PostgreSQL/Supabase、生产凭据、发布或推送。正式ACCEPTED、候选同SHA hosted CI、部署HTTP/JWT身份链、受限Storage身份、代表性性能/长稳与R1总Gate仍单独验收。下一阶段结果将追加到本报告，原失败不删除。
