# CORE:X02 DEVELOPMENT / L4-CURRENT-RISK-REFRESH-01

基线 `a05e8e489b1e294ffa48f4dcea7d21559a148a41`，接最新X01估值移交。本项显式消费当前不可变native账本的Decimal风险快照，签发新RiskDecision并绑定同一R04 Proposal。旧决定、Subject、原审批、Command、generation与UNKNOWN事实保持；不以刷新名义延长原Proposal、资金或市场来源期限。

## 当前业务

公共 `POST /v1/assisted-testnet/subjects/{subjectId}/risk-reviews`，API1.25.0，只接受 `snapshotHash` 和字符串 `expectedGeneration`，要求当前C01请求权限、Origin/CSRF和Idempotency-Key。读取当前认证估值端口、账本和kill状态，缺mark/UNKNOWN/隔离/未建模在途订单/过期时拒绝；浏览器不能上传资金、mark、Proposal或决定。subjectId仅解析已有不可变源记录，刷新即使旧风险已过期仍不准替换或续期原R04 Proposal。已过期Proposal直接拒绝。

`RiskGuard::evaluate_native_review` 与原kill CAS共享同一实例和锁，输入包含精确snapshot、原认证input及不可变ledger checkpoint，按历史prefix重建估值验证hash/scope/source/version/generation/原截止。资金与持仓值不进入旧f64投影；原策略数值限额按其已声明十进制文本读取，用精确乘加和交叉乘积比较，溢出或精度损失拒绝。采用原保守 `gross_after=gross+orderNotional`、`symbol_after=abs(symbolMV)+orderNotional`，集中度分母为gross_after，不把反向意图作为减少占用。保留原逐单限额、leverage、集中度、已实现日损、数量/价格精度、scope/身份、release、venue、kill等15项检查。

所有未Deny的新原生评估均要求公共独立审批，输出ApprovalRequired，不签发Allow或直接执行令牌。原单BTC组合集中度100%高于原0.6限额，当前实际公共流程如实签名Deny且不创建Subject；未为测试放宽任何现有限额。满足规则的多资产精确模型形成新决定和新Subject，与原Proposal记录逐字一致，新审批revision0/approvers空；该模型结果不冒称真实公共成功或目标金融验收。

新决定复用既有签名GuardDecision review namespace（purpose=assisted_testnet_review），snapshot_hash为原生Decimal快照hash，facts_hash另绑定context/venue/release/保守风险和独立审批语义，签名包含原策略和当前kill generation。公开投影不是独立公钥验证或执行token。新Subject只在ApprovalRequired时注册；旧记录和旧审批不继承。所有native刷新Subject的Command在本轮继续拒绝，下一L03显式处理新评估动作及审批/执行接续；旧成交后的新Command拒绝仍在，UNKNOWN不重提或自动关闭。

## 当前性、幂等与恢复

每次显式评估及原key/body恢复，重读当前X01快照，检查scope/ledger/source hash、版本、current generation与原截止；同key异body拒绝，原响应已过期或当前来源变化不返回旧ready决定，不自动生成替代决定。新Subject列表、open与approve同样复核当前快照；旧请求只读仍可检查原事实。venue与release仍保留其原来源时间/有效期，不以估值刷新续期；真实R01/财务/venue adapter未验收。

评估、原签名、新Subject及幂等回执追加在同一认证审批checkpoint，保存后才应答；native reviews及回执各512上限，Guard总决定4096及原32MiB持久上限，满额拒绝，不淘汰历史。恢复校验签名/内容、原Proposal、新Subject和来源精确绑定，hot恢复禁止删除/替换已观察的评估。失败写入返回503、磁盘旧记录不改，不发布未提交响应；冷恢复后只有显式当前有效请求才创建新决定，不自动重试，未知响应结局不能作为执行依据。写失败后的热内存可能因单调时钟/未提交候选冲突继续拒绝，所有可用性恢复不降低反回退边界；完整目录/密钥/宿主共同回滚及跨主机事务未证明。

同一认证回执投影公共C10 `risk.native_review_created`，correlation为新decisionId；包含安全来源hash、结果、原Proposal关系和executionAuthority=false，不写私有现金或mark原文。旧请求审计前缀不改。原始HTTP取消保护仍只完成同一次已派发事务，无重试/补发。

## 验证与门禁

本任务仅当前原生风险来源/规则、共享BFF审批/恢复/kill/C11路径，以及直接公共契约/生成SDK/既有消费者回归；不递归上游Gate、全仓或数据库campaign。无新增前端页面，新评估Web动作/完整浏览器/人工无障碍NOT_RUN。真实身份/目标Supabase/Vault/RLS/venue/真实市场资金/独立books/异步成交/异币费用/外部通知/多账户跨主机/性能安全长稳/同SHA CI/发布继续NOT_RUN。

[机器范围](../execution/core-x02-native-review-scope.json)与[当前冻结证据](../audit/evidence/core-x02-native-review-local-20261029/README.md)为准。工程Gate目标PASS_CURRENT_EXACT_SNAPSHOT_NEW_SIGNED_RISK_SAME_IMMUTABLE_PROPOSAL，IMPLEMENTED_PENDING_ACCEPTANCE；完整Gate NOT_READY_GAPS_OPEN，stage NOT_ASSESSED，formalAccepted=false，runtimeAdmission=DENIED，M5 PREPARED_NOT_READY。继承19gap/8义务OPEN，159规范阶段和原分母不提升。验收文稿待用户确认，不自行批准。

入口：`pnpm assess:core-x02-native-review:local docs/audit/evidence/core-x02-native-review-local-20261029/attempt-NN`（新目录、已提交冻结源码），`pnpm check:core-x02-native-review:local`、`pnpm test:core-x02-native-review:gate`。

下一 `CORE:L03 DEVELOPMENT / L4-CURRENT-REVIEW-APPROVAL-01`，接显式新评估动作、Deny/ApprovalRequired分流及新Subject独立审批；原生执行接续须明确当前来源、审批/来源失效和受控边界。保留集中度Deny与UNKNOWN，不继承旧审批、不补发、不自动关闭。
