# CORE:X06 DEVELOPMENT / L4-SOURCE-OBLIGATION-REVIEW-01

本任务承接 2026-10-30 最新 L4 财务审查后组合评估的来源健康缺口。当前可信独立账户账单恢复 MATCHED，不会消除此前 ACCOUNT_BOOKS_STALE / ACCOUNT_BOOKS_UNAVAILABLE 的 OPEN。本实现提供单独的追加式来源健康审查，供显式新 X02 风险、新 Subject、独立订单双审批及 IO 前复核引用。它不会执行订单、关闭 Alert 或修改历史账本。

基线 `518d87488cfcd7b18a43bc306f9a2cf00dfc9d92`；代码与原始运行结果按[证据包](../audit/evidence/core-x06-source-review-local-20261030/README.md)分别绑定。旧 L4 `cb5a4eb206f81ef6238036db5793650b40d37638` 的 1921 输入 / 43 原始文件保持 ORIGINAL_SCOPE_ONLY。旧反例与历史失败均保留，不改绑为当前通过。

## 允许范围与拒绝

来源域只覆盖历史 ACCOUNT_BOOKS_STALE / ACCOUNT_BOOKS_UNAVAILABLE。当前输入必须来自已钉住的独立 owner 签名源及连续版本链，账户/覆盖范围/来源/账本/协议核对必须一致、可信、完整、在原半开期限内且无 UNKNOWN。当前 capturedAt 和 coverageThrough 均须覆盖每条来源健康义务的 observedAt。缺源、过期、未匹配、错账户、未可信、覆盖不支持、basis 缺失、协议未决、UNKNOWN 或绑定 Command 的证据均拒绝。UNAVAILABLE 的历史 booksHash 可以缺失，但当前可信源不可缺失。

财务域和来源域分别授权，每份 Context 都绑定完整未删减 OPEN evidence、原 obligationsHash、当前账户源/版本、ledger/report、原期限及 kill generation。可信 X05 仅在存在来源健康义务时增加 obligationCoverage；无来源义务的旧 None JSON/hash 形状不变。混合 3 财务 + 1 来源时，sourceReview 只覆盖 1，financialReview 只覆盖 3，必须同时有效。旧财务授权不会继承到新增来源义务后的完整集合。任何不在两个允许域的 OPEN 都继续阻塞。未放宽 128 evidence、256 journal 上限或任何原交易限额。

## 公共入口、授权与原子性

API 1.31.0，160 operations / 178 schemas，PRE-04 1066 字段行；同源生成 client/Zod/MSW/operations/input policy。C16 owner 仍为 BFF-FE-010。

- GET `/v1/assisted-testnet/source-reviews`：当前原始账单、两个域当前上下文 hash、有效引用与共享追加历史；读取不会发起 MFA、审查或 IO。
- POST 同路径：Operator/Owner 请求；`/{caseId}/endorse`：另一 actor 且另一 user 的 Approver/Owner 复核；`/{caseId}/authorize`：与前两者均不同的 Owner 授权；`/{caseId}/retain-block`：Approver/Owner 显式保留阻塞。
- 每步必须独立当前 MFA/recent-auth、CSRF、Origin、If-Match/CAS、原 key/body/path、会话授权 revision 和原授权截止。六字段请求不能上传财务值、OPEN 集合、来源或风险决定。来源/财务确认短语、Context、Record、intent 和 C10 kind 使用不同命名空间，不能跨域替用。
- 源发布 fence、共同审批事务锁内同时提交 journal、消费 proof 与共同 C10；复本 CAS 竞争只有一次成功。所有参与者当前身份/revision/原授权截止仍须匹配，撤销或重新登记不能恢复旧处分。
- 丢响应后只允许用户显式恢复原 key/body/path/MFA/原截止的已提交回执，不重新应用、不延长期限。已提交记录被改写、重排或截断时拒绝。原财务 journal 的 None 序列化和哈希域保留。

## 风险、执行与 Terminal

BFF 每次新风险、审批打开与 IO 前在现有 fence 下重建两个域引用；风险签名覆盖完整 books/两个授权，NativeRiskContext 校验两者 generation，截止取原账单和两个授权期限最小值。来源/集合/ledger/generation/身份/期限变化或任一 retain-block 均使旧引用失效。新风险仍绑定同一不可变 Proposal，Deny 不生成 Subject；ApprovalRequired 仍需新 Subject 和独立订单审批。已执行 Proposal 的一次性预算与原预留不重置。

P23 增加“财务义务 / 已恢复的可信来源健康义务”选择，明确混合范围、原 OPEN 和无执行授权。切换前禁止进行中/结果未知请求；所有动作显式审阅 + MFA，UNKNOWN 不可审查，无自动重试或源恢复自动放行。客户端校验完整原始 books、各域上下文/覆盖数/三人独立历史、原期限与回执；来源数据不能冒充财务授权。新风险消费者校验两域覆盖、generation 和最短期限。

实际本机 mTLS 测试包含已授权命令真实提交后 BFF 死亡：冷恢复保持原 generation 0、原 sourceReview/签名/claims，公共 kill/解除后仍 UNKNOWN、1 已知入账 / 1 隔离、原 1 来源 + 3 未知相关 OPEN；只查询，不补发或自动关闭。

## 验证、Gate 与移交

`node scripts/core-x06-source-review.mjs --run --attempt=attempt-01` 要求源码冻结后运行，只使用 webEnvironment 白名单与临时本机证书/loopback。`--verify` 只读核对 Git blob、输入/工具/原始执行日志/hash、完整 journal、MFA 消费、C10、风险/Subject/Command 和 OPEN；必须所有具名执行成功才写 PASS。失败、中断和未执行保留，不能用零执行或模型资料代替当前进程。

当前功能测试和直接影响回归覆盖 books/risk/journal、公共审批/IO 与 Terminal；共享验证器/双域投影实际影响既有 core_l04，因此重跑该文件原 40 项，未扩大为全上游或发布 campaign。人工浏览器与无障碍、真实 IdP/MFA、Supabase/Vault/RLS、目标数据库/分布式恢复、真实市场/资金/venue、安全容量长稳、同 SHA CI/外部发布均 NOT_RUN。

工程 Gate：`PASS_CURRENT_INDEPENDENT_APPEND_ONLY_SOURCE_HEALTH_REVIEW_RISK_RECHECK_C10`（以冻结证据为准）。功能 IMPLEMENTED_PENDING_ACCEPTANCE；完整 Gate NOT_READY_GAPS_OPEN、stage NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED、M5 PREPARED_NOT_READY。19 gaps / 8 规划义务全部 OPEN；159 阶段及原 200 venue / 50 授权旅程 / 4 目标演练等分母不变。fullBooksReady/dayCloseAllowed/executionAuthority 仍 false。来源健康显式审查只是既有 L4-CURRENT-SOURCE-01 / L4-LEDGER-01 的 owned 子范围进展，不关闭规划义务。

下一可执行任务：`CORE-GATE:L4 DEVELOPMENT`，评估来源健康与财务独立审查加入后的 X02/X04/X01/X05/X06、公共 kill/C11、UNKNOWN 与剩余缺口。正式验收文稿已准备，未替用户批准；参见[统一确认规程](../gate-records/user-acceptance-confirmation-workflow.md)。
