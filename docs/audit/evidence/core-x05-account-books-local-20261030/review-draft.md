# 独立账户 books 当前功能验收文稿（待用户确认）

范围 CORE:X05 DEVELOPMENT / L4-INDEPENDENT-BOOKS-01。冻结源码与当前结果以同目录 result.json 为准，本稿不预填通过。仅 owned 参考来源、本机单主机文件持久与 mTLS 进程，不代表真实账户/联调/发布准入。

- Product：声明账户区间内仓位/现金/费用精确核对，缺行不推零，UNKNOWN不当作成交确认；不改变完整业务目标。
- Frontend：现有只读公共契约可消费账户级 OPEN Alert，accountBooks 为 optional；无新页面实现或浏览器验收声明。
- BFF：独立签名来源、scope/version/previous hash/期限校验，公网页面无法上传权威；fsync后才发布，冷恢复保留高水位。
- QA：具名当前模型、三项实际进程场景、当前L4直接回归和schema/消费者/静态检查；诊断失败与NOT_RUN保留。
- Security：临时owner证书/参考身份、私有受限输入；未使用生产凭据、未push/部署/发布；真实IdP/Vault/数据库/跨主机目标另验收。
- Risk：UNKNOWN和原generation/claims保留，差异OPEN，恢复匹配无自动关闭/补发/资金调整，不授予风险/日结/执行权限。

工程 Gate 与实际结果关联；完整 Gate NOT_READY_GAPS_OPEN / stage NOT_ASSESSED / formalAccepted=false / runtimeAdmission=DENIED / M5 PREPARED_NOT_READY。19gap/8义务OPEN，原分母不变。正式确认 PENDING_USER_REVIEW，approval=null，selfApproved=false；遵循 docs/gate-records/user-acceptance-confirmation-workflow.md，未代用户批准。下一 CORE-GATE:L4 DEVELOPMENT。
