# UI-P10 Approval 与 RiskDecision 高保真页面

入口 `/approvals`、`/approvals/{approvalId}`，参照 `design/P10-Approvals-and-RiskDecision-Detail-High-Fidelity-v1.png`、Terminal Frontend Design Spec P10与ACC-P10-S1–S7。仅QuantOS/main，本地合成功能环境；无生产凭据、推送、部署。

## 页面与真实来源

桌面左侧审批目录、右侧详情；RiskDecision卡、15条规则/阈值、保守组合影响、独立主体、Proposal/Release引用、论证/反方观点、C10时间线和审批栏。手机改为单列、目录有界滚动、表格独立横滚、操作栏回到文档流；明暗主题和键盘确认。列表状态/严重性/搜索/到期排序仅作用于已加载页，标注已加载范围，不虚构全局总数/页数/人员名字。

OpenAPI1.16增加C08只读opt-in `includeReviewContext="true"`（字符串enum，沿用当前查询验证器），可选Approval.reviewContext及5个子schema；默认/false与POST返回原形状。只有Owner/Approver且strategy.approve可读opt-in，P10页面在C01通过前不读取任何审批域事实，非审批人不可见待办。旧UI504运行时调用保持兼容，不将旧原范围证据改绑。

Trade申请保存当时真实RiskGuard::preview签名决定与contextHash（不可签发），读时由owner核验签名完整性；返回Decision ID/Proposal/账户/mode/规则/政策与修订/signer/输入hash/时限/issuable=false，不返回私钥、原始签名、command_key、私有source_ref。当前核查重新执行只读preview，显示独立时限、当前规则/风险/上下文。历史决定过期仍可只读审阅；本次人工决定仅在Approval未过期及当前核查有效时允许，最终签发仍由服务端重评，不消费历史preview授权。

组合影响从当前portfolio/financials/venue与X02同一保守公式投影，数值由服务端f64源转Decimal字符串；买卖均增加gross/symbol名义值上界，不当执行后预测。权益不当作可用现金；集中度阈值是占gross比例，未编造参考图中的NAV/币种外换算或精确预测。策略发布审批没有Trade RiskDecision时明确“不适用”，使用真实kind/objectRef，不合成风险结果。

Proposal来自owner侧真实C07 projection，前端检查账户/mode/correlation/Proposal绑定及15条规则/判定一致性。generic evidenceRefs只有UUID、无类型/时间/正文，不构造Artifact外链，不伪造参考图的市场/链上/情绪证据表。审计时间线只用C10实际返回事实；不创建虚假“context refreshed/awaiting actor”审计。

## 审批、证据与拒绝

保留UI504的If-Match/幂等/CSRF/同步busy与未知原键恢复；P10新增已审阅勾选与三个明确动词按钮、逐次MFA/再认证阶段提示。确认前及验证后重读完整审批/当前review，source hash、政策/限额或建议变化须重审；当前风险deny禁批准但允许明确原因拒绝/request_info。不采用乐观更新；200回执才更新已加载状态并清除旧审阅上下文；结果未知锁新请求，仅内存原键原body恢复，审批/验证过期或失权后不重放。

C01双读、持续会话SSE与5秒核查/8秒窗口；离线/隐藏/失权/主体或scope变化清除风险详情、原因、证据与恢复引用。C08没有实时stream，不伪造Live状态，当前review 8秒后需显式刷新，无自动写入。

C10为reference审批身份提供 `approval.evidence.read`，仅getEvidenceChain对当前实际Approval已授权correlation开放；其他链404，全局search/export仍403。前端先重验当前审批与scope，分页100/最多20页2000节点，拒绝cursor循环、重复节点、跨关联/过期retention和排序错误；链失权只清理证据，401清理整页。无导出按钮或额外导出授权。

## 验证与Gate

`node scripts/ui-p10-review.mjs --run docs/audit/evidence/ui-p10-local-20261024/attempt-NN` 针对冻结本地源码、新目录执行；`--verify`核对源码输入/设计图hash、命令/日志、二进制/构建、网络、截图/axe与计划状态。当前功能与直接C08/C10/C01、UI504/执行恢复/SDK契约回归；不递归依赖、全仓覆盖率或数据库campaign。

限定工程Gate PASS_P10_HIGH_FIDELITY_FUNCTION；IMPLEMENTED_PENDING_ACCEPTANCE，stage_gate INTEGRATION/NOT_ASSESSED，formalAccepted=false，runtimeAdmission=DENIED。身份/数据为reference合成源，浏览器回环TLS/cookie/CORS显式替身。真实IdP/MFA/目标DB/RLS/持久恢复/真实risk来源/同SHA远程CI/性能长稳/人工读屏与原生200%缩放/跨OS浏览器/完整I5与发布仍NOT_RUN。未提供的typed evidence内容仍NOT_RUN，人工确认遵循统一规程，不由Codex代用户批准。
