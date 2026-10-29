# CORE:X02 / L4-BOOKS-RISK-ADMISSION-01 验收文稿

当前功能范围：独立账户 books 和全部未决 X05 义务绑定新签名风险、新 Subject、审批与 IO 前复核。冻结源码/实际结果见同目录 result.json，不提前批准。

- Product：缺失/差异/过期/UNKNOWN/OPEN 拒绝；修正匹配不解除原义务，非完整账户或实际金融许可。
- Frontend：当前估值与账户核对分开呈现原因；新 Subject/Command books 一致，原审批不继承。模型/契约与当前浏览器验收分开。
- BFF：只接受 snapshotHash/generation，签名事实绑定服务端认证投影；稳定发布者锁跨真实 IO，原预留/来源/期限/审计和冷恢复保持。
- QA：具名领域、当前进程与直接影响回归、schema/消费者/静态和反例；原失败/诊断/NOT_RUN 保留，历史 L4 只在原 SHA/范围引用。
- Security：参考 cookie/MFA、临时证书/受控发布者；无生产凭据/推送/发布，实际IdP/Vault/RLS/跨主机与目标另验收。
- Risk：原限额不变，UNKNOWN/原generation/claims保留；匹配后的OPEN仍Deny，无补发/自动关闭。原零账本参考seed不等于当前风险或真实资金准入。

工程Gate目标 PASS_CURRENT_BOOKS_BOUND_RISK_SUBJECT_AND_IO_RECHECK；完整Gate NOT_READY_GAPS_OPEN / stage NOT_ASSESSED / formalAccepted=false / runtimeAdmission=DENIED / M5 PREPARED_NOT_READY，19gap/8义务OPEN、原分母不变。下一 CORE:X06 DEVELOPMENT / L4-FINANCIAL-OBLIGATION-REVIEW-01。

正式确认 PENDING_USER_REVIEW / approval=null / selfApproved=false；按 docs/gate-records/user-acceptance-confirmation-workflow.md，由用户审阅确认，未自行批准。
