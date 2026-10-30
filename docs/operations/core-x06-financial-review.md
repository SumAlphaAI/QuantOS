# CORE:X06 / L4-FINANCIAL-OBLIGATION-REVIEW-01

本轮接 [X02 books 风险移交](core-x02-books-risk-admission.md)，基线 6816ee8299a48fdd27de8ceaedea782852145336。实现参考账户的独立授权、追加式财务义务审查，供显式新风险、新 Subject 和 IO 前复核引用。[机器范围](../execution/core-x06-financial-review-scope.json)、[证据](../audit/evidence/core-x06-financial-review-local-20261030/README.md)记录实际冻结源码/命令/输入/原始结果；旧 X02 的 2005 输入/63 原始文件只在原 fbfed8c4 源码/hash 范围引用。

## 审查与 OPEN 历史

原 X05 outbox、AlertEvidence 和收件箱永远保留 OPEN/unacked/active，账单修正、阅读、一次 ack、审查或重启均不删除/关闭原证据。本轮单独记录当前财务审查 disposition，不把“原 OPEN 数量”改成零。BooksRiskInput.openObligations/obligationsHash 继续表示完整历史；新增 optional financialReview 只绑定精确当前输入、完整原义务集合与原期限，且进入 X02 签名 facts、新 Subject 和 Command。

范围只含账户 POSITION/CASH/FEE 三类已修正差异，最多128条；必须当前账户 books 与协议观察均 MATCHED、来源可认证/可信/完整、零 UNKNOWN。当前仍有差异、缺失/过期、分叉、协议/UNKNOWN/其他来源义务或不完整集合时拒绝。不能人工接受未修复损失、假定零费用、绕过原15项规则/额度或把 UNKNOWN 当已成交。非报价费、FX、异步成交、外部资金流、负债、open-order budgets、真实账户全集另验收。

## 独立授权与来源绑定

新增公共参考端点 `/v1/assisted-testnet/financial-reviews` GET/POST，及 `/{caseId}/endorse`、`authorize`、`retain-block` POST。C16 API 1.30.0，共155操作/172schema。HTTP只接 expectedRevision/contextHash、审查依据、确认短语与 MFA challenge/reauth refs；账户/身份/角色、来源、金融数值、证据和时钟全由服务端注入，不接受浏览器上传/覆盖。

1. Operator/Owner 显式发起并完成本会话 security_change MFA。
2. 不同 actor 且不同 user 的 Approver/Owner 独立复核，独立 MFA。
3. 另一名 Owner 再授权，actor/user 均不得等于前两人，独立 MFA。仅一次复核没有准入效果。
4. Owner/Approver 可显式追加 retain_block，阻止当前风险引用；不能删除前面的授权事实，也不能再次授权同一终结 case，须新审查。

所有新动作绑定完整当前 raw BooksRiskInput、全部原证据（原scope/ledger/booksHash/finding/OPEN身份）、kill generation、账单原期限及 journal CAS。当前来源/版本/ledger/义务/generation任一变化，都要求新 case；不能给原 case 换绑证据。原 key/path/body/If-Match/MFA 的恢复仅返回原回执，且必须仍有当前会话权限及原期限，不重新应用授权。

三个身份同时钉住已注册会话 revision 与原 expiresAt。新风险、审批和 IO 每次引用时复查实际当前身份/角色/用户/actor/revision/期限；身份重登记或撤销不能复活旧审查。授权截止取原账单 coverageThrough+30秒/validUntil、全部原步骤和 MFA/会话窗口交集，半开区间到期拒绝，不靠 GET 续期。当前参考账单窗口最多30秒，不能扩为真实业务处理 SLA。

## 持久化与共同 C10

request/endorse/authorize/retain_block 以顺序、previous hash、record hash 追加至金融审查 journal，与 proof 消费同一既有认证 approvals 事务 fsync 提交。校验完整证据 hash、scope、全部义务集合、独立用户/角色/原窗口、单次 proof 和暖恢复前缀；缺失/篡改/回滚拒绝。C10 由这些已提交事实生成 `assisted.financial_review_*`，caseId 为 correlation；原请求审计、原 Command/签名/generation/claims 不改写。

来源读取和追加动作持现有账单发布者稳定锁；锁后重新采样时钟，复核当前来源与 generation。IO 持原审批/估值/发布者锁，重构当前审查投影，与签名风险完全一致才保留原 fsync-before-IO 路径。财务审查不会签发订单、解除 kill/C11 或改变任何执行预算。原空账本 reference seed 不能借审查记录回退使用。

实际本机故障测试在 journal 与 proof 已提交、HTTP 回执之前杀死 BFF，冷恢复返回同一原回执/记录，不追加第二条授权；记录篡改拒绝。实际当前 ETH 丢回复后即使独立账单声称成交，仍保留原 generation0/原 books/签名/claims、1已知入账/1隔离/OPEN，只能 GET，不允许财务审查或补发。

只保证合作的单主机进程和认证私有文件；不抵抗 owner 换钥/忽略发布协议/整体回滚目录，也不是数据库或跨主机单调事务证明。禁止生产凭据、实际 testnet、推送/部署/外部发布。

## 新风险与页面

只有完整当前授权仍有效时，raw OPEN 保留且新 riskBooks 带 financialReview，额外 account_books 原因可为 ELIGIBLE_REVIEWED_REFERENCE_BOOKS。此审查只是补足原 OPEN 阻塞所需的独立人工处置，原15项风险规则/限额全部保持；仍须显式新 X02 RiskDecision、同一不可变 Proposal 的全新 Subject、两名独立订单审批与原生 IO 前核对。旧 Deny key、旧风险/Subject/审批不继承。来源变化、撤销或期限到达后恢复阻塞，不能用旧授权继续 IO。

P23 在 Assisted 模式新增独立财务审查面板：展示当前版本、原OPEN/UNKNOWN、原截止、追加历史，显式发起/复核/Owner授权/保留阻塞，桌面、确认与MFA约束。权限钉住父级当前身份，动作前后重读；丢回复保留原key/body/CSRF/原期限，只有显式恢复，无自动评估、重新审批、提交或关闭。Paper/Shadow 原 ack 行为及 Assisted 只读 Alert/订阅限制保持；新审查与阅读确认分开。风险页校验 financialReview 与当前 books/义务/generation/截止，以及新 Subject/Command 一致。

## 验收与下一项

当前功能运行 `pnpm assess:core-x06-financial:local`，只读复核 `pnpm check:core-x06-financial:local`。审查模型、身份 revision/撤销、签名风险及当前原生组合为本轮必须项。审批/持久化/IO共享入口改变，因此直接回归 BFF core_l04 其余31项，以及相关消费者/合同、编译与静态；不递归全部上游、全仓或F05/F07 campaign，不连接数据库，不加载私有dotenv。模型/类型/契约不代表浏览器、人工无障碍或目标验收。

工程 Gate 目标 PASS_CURRENT_INDEPENDENT_APPEND_ONLY_FINANCIAL_REVIEW_RISK_RECHECK_C10，以冻结实际结果为准；IMPLEMENTED_PENDING_ACCEPTANCE。完整 L4 NOT_READY_GAPS_OPEN / stage NOT_ASSESSED / formalAccepted=false / runtimeAdmission=DENIED / M5 PREPARED_NOT_READY；19gap/8义务仍OPEN，159阶段与原200venue/50授权旅程/目标演练分母不变。fullBooksReady/dayCloseAllowed/executionAuthority仍false。真实金融/身份/MFA/DB/Vault/RLS/跨主机/通知/目标安全容量长稳同SHA CI/发布和当前浏览器/人工无障碍 NOT_RUN。

下一 CORE-GATE:L4 DEVELOPMENT：评估当前独立财务审查加入后的 X02/X04/X01/X05/X06、公共 kill/C11 与新风险/新审批/IO 组合及剩余缺口。保留 UNKNOWN、原 generation、OPEN 历史及所有未验收义务。


2026-10-30 接续：[来源健康独立审查](./core-x06-source-review.md)增加单独来源域及混合OPEN分域覆盖。旧财务None序列化/hash与原证据保留原范围；当前财务域只覆盖财务子集，每份授权仍绑定完整原OPEN。来源健康授权不能替代财务授权，两个域都不关闭原事实或授权交易。
