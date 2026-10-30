# CORE:X01 DEVELOPMENT / L4-CASH-ONLY-VALUATION-01

接[最新双来源 L4 移交](./core-l4-dual-source-assessment-20261030.md)，main 基线 `86e8c0de5d089adf03b063a7d8ba9fc4d65b0680`。支持经过独立批准账户 Opening/status 的无持仓估值与当前风险来源，无参考成交、假 mark、合成持仓或期初现金重基准。见[机器范围](../execution/core-x01-cash-only-scope.json)、[证据](../audit/evidence/core-x01-cash-only-local-20261030/README.md)。

## 当前行为

BFF 在同一账户来源/风险/审批/预留/IO fence 内，先认证独立账户产物，再以实际不可变 ledger 判断是否无非零持仓：scope、ledger hash/anchor 必须精确一致，consumerReady=true、无 UNKNOWN/隔离或未建模开放订单，raw marks 为空，且不存在客户端 market 证明。满足条件才省略市场产物消费，形成 `READY_OWNED_AUTHENTICATED_ACCOUNT_CASH_ONLY`。不读取或伪造一个无用 tick，不需要开启 R01 flag 或提供 R01 policy/artifact；已有 observer/市场公钥仍用于账户签名身份隔离。

账户原 Opening、cash/PnL/status/覆盖时间、用途批准与专用域签名、版本链、原截止和单宿主认证持久化继续生效。Snapshot 明确 accountProvenance，marketProvenance 缺省，不暗示认证市场来源。现金 = 原 Opening + 实际账本 cashDelta；空仓 gross/net/unrealized 均0，权益等于现金，已实现损益和费用保留。半开期限不续期，缺失/错误签名/改现金/撤销/旧 head/过期及冷恢复拒绝，不能回退裸 owner 或缓存。

持仓路径仍要求完整精确认证 R01 mark；cash-only 声明不能隐藏现有持仓。平仓后支持由实际账本回到现金模式，保持最初 Opening、所有账户/R01 高水位及原快照；恢复时按每个原 anchor 重建账本验证 cash-only 事实。再次持仓须重新消费当前认证 R01，旧产物、撤销前 head 或参考字符串不可授权。UNKNOWN 先保留查询拒绝；领域 observe 不为现金模式 UNKNOWN 追加来源或可用 Snapshot，不清零仓位/义务。

新公共场景从从未成交的独立 fixture 开始：现金10000、无持仓、0 claims/IO，先前 books 缺 basis 产生的1条 ACCOUNT_BOOKS_BASIS_UNAVAILABLE OPEN 保留。来源修复后独立 books 的账户层 MATCHED，原 OPEN 仍 blocked=1/financial=0/sourceHealth=0，两域均不可审查；没有扩展审查 allowlist、变更关闭流程或自动关闭。显式 X02 消费当前认证现金 Snapshot，绑定同一原 Proposal，按原集中度/审批/账户义务规则签名 Deny、无新 Subject；冷恢复相同幂等键返回原决定，不产生订单。零 IO 是该拒绝场景的要求，不计作成功交易。

该冷恢复回放发现共同 C10 重复读取会重复添加同一 risk.native_review_created event 的读投影。修复仅重建内存投影的对应命名空间，事实仍来自原持久 journal；具名测试连续读取两次 C10，核对相同风险投影和唯一 eventId/原 payload hash，正常追加 audit.search_accessed 事实，未删除审计或业务历史。

API **1.34.0 /160 operations /180 schemas**，PRE-04 **1100**字段行，client/Zod/schema/MSW/operations/input-policy/字典同步。Terminal 验证 cash-only 必须有独立账户来源、无市场证明、空 positions、零 exposure/unrealized、equity=cash，核对原期限与前后绑定；展示“认证账户无持仓、无需 mark”及 owned 非真实 venue 资金边界。cold Command 允许保留原 account-only 签名绑定，不以当前时钟重写旧证明。

## 验证、Gate 和移交

运行 `node scripts/core-x01-cash-only.mjs --run --attempt=attempt-01`；只读 `node docs/audit/evidence/core-x01-cash-only-local-20261030/verify.mjs`。先提交源码，再具名执行20项检查并封存原始输入、日志和实际 build emitted executable/hash。共享估值注册/恢复和 C10 读投影影响现有 core_l04 全部75条，故以其作为直接回归；不是递归上游或全仓复验。领域含 cash→held→flat→held、原 cash/fees/R01 heads/撤销/UNKNOWN；公共3新用例含真实账户认证、风险签名 Deny、原 blocked OPEN、幂等冷恢复、来源拒绝和过期。另输出当前双来源实际成功与 UNKNOWN 两场景，验证原 generation0/4或7 OPEN/claims/控制/原证明仍保留。前端20文件291用例是受控响应模型，不替代实际浏览器验收。

预检失败及诊断输出按原 hash 保留，不作为冻结通过。历史 L4 源码96b2e3b6的1964输入/46原始文件/16检查及先前 X01 结果仅 ORIGINAL_SCOPE_ONLY，历史 FAIL/ignored/NOT_RUN 不改绑。浏览器、人工无障碍、真实数据库/资金/账户全集/live R01/Research/R04/IdP/MFA/Vault/RLS/跨主机/外部锚、真实 venue/FX/外部流/负债/在途预算/日切/通知/源关闭、安全容量长稳同 SHA CI/发布未验收或 NOT_RUN。

工程 Gate 目标 **PASS_CURRENT_AUTHENTICATED_CASH_ONLY_VALUATION_AND_RISK_SOURCE**，以冻结具名结果为准；DEVELOPMENT IMPLEMENTED_PENDING_ACCEPTANCE，完整 Gate **NOT_READY_GAPS_OPEN** /stage NOT_ASSESSED /formalAccepted=false /runtimeAdmission=DENIED /M5 PREPARED_NOT_READY。19 gaps/8规划义务仍 OPEN、159阶段及原200 venue/50旅程/4演练分母、限额不变，fullBooksReady/dayCloseAllowed/executionAuthority=false。只使用 owned fixture、临时测试身份和 loopback；无生产凭据、推送、部署或发布。正式确认仅准备文稿，不自行批准。

下一可执行：**CORE-GATE:L4 DEVELOPMENT**，评估 cash-only 与双来源链组合及剩余缺口，特别是保留 blocked basis OPEN 的显式独立处置需求；不得将本次估值修复直接视作允许重审、清除 OPEN 或运行授权。
