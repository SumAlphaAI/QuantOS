# 当前功能验收文稿（待项目用户确认）

范围：CORE:L04 DEVELOPMENT / L4-CURRENT-REVIEW-EXECUTION-01。工程结果以本目录冻结 result.json、输入哈希和具名原始记录为准。用户尚未确认，approval=null、formalAccepted=false；本稿不构成执行授权或正式验收。

- Product：新风险 Subject 从独立两人审批接至显式 P11 提交；Deny 无可执行 Subject，原申请不继承审批。
- Frontend：当前身份、CSRF、原期限及 source/ledger/generation 核对；当前命令丢响应只 GET，UNKNOWN 不补发；小屏和默认关闭保持拒绝。
- BFF：实际 owned HTTP 与独立 mTLS 进程接续，认证输入与账本锁覆盖预留/IO；浏览器不能上传财务或执行上下文。
- QA：当前功能成功、拒绝、冷恢复、提交后崩溃、快照去重、直接回归、当前构建与 Chromium；保留原失败，无跳过冒充 PASS。
- Security：私有 owner 默认关闭开关；不同 MFA 操作人/用户，native 当前独立签名域和原最小租约，认证持久 high water；不使用生产凭据。
- Risk：不改原集中度/额度，当前签名决定绑定同一不可变 Proposal；一次快照只预留一次，旧接口拒绝 native Subject；UNKNOWN/原 generation/OPEN 义务保留。
- Domain：BTC 真实 owned 协议 Fill 入账后由独立参考资金/mark 估值，独立参考 S03/R04 ETH 候选获得 ApprovalRequired；参考输入不是实际市场或完整账户 books。

剩余范围：真实 R01/资金/IdP/DB/Vault/testnet、多主机与外部单调锚、一般 open-order 预算/异步成交/独立完整 books、部署安全容量长稳/同 SHA CI/发布及人工无障碍 NOT_RUN。完整 Gate NOT_READY_GAPS_OPEN / stage NOT_ASSESSED / runtimeAdmission DENIED / M5 PREPARED_NOT_READY；19 gap / 8义务 OPEN / 159规范阶段不提升。

下一可执行项：CORE-GATE:L4 DEVELOPMENT 当前组合与剩余缺口评估。确认本稿也不能替代缺失的目标或发布证据。
