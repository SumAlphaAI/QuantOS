# UI-P10 限定高保真功能待确认稿

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "FE:UI-P10",
    "stage": "DEVELOPMENT",
    "sourceCommit": "eb1bb3822e31aaec7cd218198dce0dc4348a279a",
    "inputsDigest": "sha256:da4d55e7e101d53150e22f9a20dc8a453363c4a0710d9949b0e8ded814e985ce",
    "reviewDimensions": [
      "Product",
      "Frontend",
      "BFF",
      "QA",
      "Security",
      "Risk"
    ]
  },
  "reviewDimensions": [
    "Product",
    "Frontend",
    "BFF",
    "QA",
    "Security",
    "Risk"
  ]
}
```

状态PENDING。确认对象仅上述冻结源码与attempt-02的本机功能范围，不包含后续封存HEAD或INTEGRATION/RELEASE。inputsDigest绑定inputs.json原始字节。无用户确认原文，不生成CONFIRMED或多角色伪造签署。

- Product：Approval目录/详情、RiskDecision/当前核查、规则/影响/Proposal与证据/反方观点、独立审批与三种决定、MFA、未知恢复和拒绝状态已落地。统计仅已加载子集，数据缺口不填假数据。
- Frontend：P10结构/明暗/桌面手机/操作栏、稳定来源重验、8秒窗口、持续C01清理、无乐观更新、MFA阶段、原键恢复和C10隔离拒绝；手机规则表焦点/键盘横滚验证。
- BFF：OpenAPI1.16只读opt-in兼容原消费者；原风险签名快照由owner验签且issuable=false，当前RiskGuard preview和保守组合影响真实投影；scoped证据绑定tenant/workspace/account/mode/role/capability，不授全局审计/导出。
- QA：131前端/消费者、27执行/24策略/2C10宿主、22Node门禁路由、17Chromium全部通过，4次axe零violations；原始日志/截图/源码/二进制/构建/hash可复核。开发与首轮失败及scope负面FAIL保留ORIGINAL_SCOPE_ONLY，不改绑。
- Security：reference合成身份/数据与回环TLS/cookie/CORS替身，外网拦截，MFA码不写证据正文/恢复body/存储；无生产凭据、推送或部署；无前端自造签名/Command或额外导出授权。
- Risk：自批/过期/冲突/当前deny/额度源变化禁批准，历史RiskDecision到期仅供审阅，人工决定需当前核查和有效Approval，最终签发仍由服务端重新评估；请求更多信息按现有rejected闭合，无权限授予。权益与可用现金、保守上界与预测分开。

遗留与范围排除：4组axe incomplete/84节点保持待核，不算通过。typed证据内容、真实IdP/MFA/cookie/CORS、目标DB/RLS/持久事务与恢复、真实风险源、同SHA远程CI、性能长稳、全面人工读屏/200%缩放、实机/跨OS/浏览器、完整I5与发布仍NOT_RUN。f64来源/固定quote模型未改造成精确货币引擎。正式stage_gate INTEGRATION/NOT_ASSESSED，formalAccepted=false，runtimeAdmission=DENIED。

见DELIVERY.md、VISUAL-REVIEW.md和操作规程。下一任务FE:UI-505，当前只开发准入允许。
