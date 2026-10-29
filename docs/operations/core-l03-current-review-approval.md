# CORE:L03 DEVELOPMENT / L4-CURRENT-REVIEW-APPROVAL-01

基线 `9564db8539902014b7b04be374eeed7473280c40`，接X02当前精确风险决定与同一不可变Proposal移交。本项接显式Web评估动作、Deny/ApprovalRequired分流及新Subject独立审批，不接执行放行。

## 页面与公共契约

API1.26.0新增只读 `GET /v1/assisted-testnet/risk-review-candidates`，只列当前C01域中原始R04记录仍有效的候选。旧风险过期或kill改变不隐藏仍有效Proposal，原记录到期立即移除；目录不授予风险/审批/执行权，不接受查询或正文。原`subjects`仍仅列当前有效可审批来源，不把旧审批静默改绑。

P10当前风险评估区域先由用户选择候选并点击“核对当前估值”，仅GET认证X01估值；缺可信mark、UNKNOWN、隔离或过期无可用snapshot。点击“评估当前风险”才POST原snapshotHash与expectedGeneration，不上传现金/mark或修改Proposal。当前单BTC按原0.6 gross_after集中度如实Deny：显示命中规则，不出现新Subject/审批入口。满足原限额时ApprovalRequired返回新Subject，用户另点发起独立审批；GET、页面加载和恢复都不会自动评估或审批。

公共Subject新增可选nativeRiskBinding，绑定snapshotHash、ledgerHash、sourceHash/version、killGeneration及原截止；原SubjectHash仍绑定原生Subject本身，附加来源元数据不伪称独立公钥证明。运行时严格校验响应与原候选/估值/决定的相同关系。新Subject审批从revision0、空审批列表开始，不继承原申请或原双人签署。不同审批者各自MFA，MFA前后再次读C01、原申请和当前快照；同人、自批、原proof/来源漂移或期限/generation变化拒绝。BFF在实际approve前重读当前估值，再调用同一风险/审批锁校验。

显式新评估提交后，同一Proposal先前Subject加入不可逆撤销集合；原签名、审批、Command与generation事实不改，不能回落旧评估。公共profile还以currentRiskReviewOnly拒绝旧种子来源发起新Command，原已签发结果只读保留。所有native刷新Subject的Command继续拒绝，P11不显示其提交入口，低层runtime直接submit同样拒绝。原已执行/UNKNOWN Proposal不能因再评估获得再次Command。原generation/签名预留、Fill/账本、OPEN Alert及UNKNOWN原样保留；不补发或自动关闭，不改变原限额。

## 恢复和权限

评估未知结果与原open/approve/submit意图互斥；重入/其他操作不清除原恢复所需条件，也不自动重发。手动恢复保留原key/body/CSRF、scope和最小原session/Proposal/snapshot截止，恢复前读取当前源；来源、版本、generation或原截止改变即停止，不发旧POST。当前权限真实401/403、scope/身份或原CSRF变化清除私有状态；小屏等本地只读约束拒绝写入而不推断权限撤销。关闭页面销毁私有内存意图，不自动跨页面恢复；用户只能通过已有只读事实/共同C10核对已记录评估。浏览器内存结果与当前状态不授予交易权限。

默认关闭/当前C11暂停时无风险动作，服务端新目录/写接口仍拒绝；小屏只允许核对，不出现评估或新Subject审批操作。来源事实当前不可读时不能回退到旧ready快照。共享durable取消保护仍只完成原已派发事务，无handler重试。

## 验证范围

直接验证新UI/runtime、契约/SDK、当前source/审批权限、共享恢复/kill/C11/UNKNOWN的受影响本机进程，单轮Web构建和当前Chromium三场景，不递归全链Gate或全仓/数据库campaign。实际参考BFF+临时mTLS+owned协议的单BTC组合仍Deny；浏览器验证来源缺失、显式评估、原响应丢失恢复、原申请不改、无新增Command、小屏只读、失权清除及默认关闭。

满足原规则的多资产领域模型使用同一RiskGuard/CurrentSubjectSource/AssistedApprovalService验证新Subject、新申请0审批、两个独立MFA签名审计、自批/重复/kill拒绝；页面响应模型另验证ApprovalRequired与原审批不继承。其范围不是完整BFF原生金融成功或真实目标验收，没有修改源金融值或放宽集中度来获取公共成功。

真实R01/市场许可/账户资金、完整独立books/异步成交/非quote费/外部流/FX/在途订单预留、完整公共原生ApprovalRequired金融链/执行接续、目标IdP/Supabase/RLS/Vault/venue/多主机/外部单调锚点、外部通知/人工关闭、安全容量长稳同SHA CI/发布和人工读屏/原生200%缩放/全浏览器均NOT_RUN或未接续。历史axe incomplete2不改绑当前；当前自动检查另立原始记录。

工程Gate目标PASS_CURRENT_RISK_ACTION_BRANCH_NEW_SUBJECT_INDEPENDENT_APPROVAL，以[冻结证据](../audit/evidence/core-l03-current-review-local-20261029/README.md)为准；[范围](../execution/core-l03-current-review-scope.json)继承19gap/8义务OPEN，IMPLEMENTED_PENDING_ACCEPTANCE、完整Gate NOT_READY_GAPS_OPEN、stage NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED、M5 PREPARED_NOT_READY，159阶段和原分母不提升。正式验收文稿待用户确认，不自批。

下一 CORE:L04 DEVELOPMENT / L4-CURRENT-REVIEW-EXECUTION-01：显式评估新当前来源与独立审批到受限执行的接续，核对原Proposal使用/nonce/预算/kill/C11及IO前当前来源；已执行/UNKNOWN的原Proposal不可重复Command。没有生产凭据或外部发布授权。
