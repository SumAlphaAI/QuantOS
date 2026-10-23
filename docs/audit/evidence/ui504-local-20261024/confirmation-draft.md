# UI-504 限定功能待确认稿

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "FE:UI-504",
    "stage": "DEVELOPMENT",
    "sourceCommit": "12798275ff861b0dcd86ad444c27b7aca8f83476",
    "inputsDigest": "sha256:c24ff14be42013b4c2bce2c906a0bf04b0a9d4ccd3c3526bc80d3bb7813bd491",
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

状态PENDING。仅请求确认上述源码的本机功能范围；不确认之后的证据封存HEAD、INTEGRATION/RELEASE、生产或真实外部环境。inputsDigest绑定attempt-02/inputs.json原始字节；工程Gate PASS_UI504_APPROVAL_FUNCTION。无用户确认原文，不生成CONFIRMED记录或伪造签署。

- Product：Approval列表/详情、三种决定/原因、MFA与职责分离、失败/未知状态均具备功能入口；request_info终结为rejected且不授予权限。
- Frontend：C01持续失权清理、确认前/验证后重新读取、同步busy、精确UUID与资源绑定、无乐观更新、未知原键恢复、过期后停止恢复；明暗/响应式基本复核，不包含UI-P10高保真完成。
- BFF：真实reference C08 Trade/Release组合；独立主体/MFA、If-Match、幂等、服务端风险/额度拒绝；Release补实际决定与拒绝原因。没有浏览器自造签名/Command/Order。
- QA：99前端/消费者、24执行+24策略宿主、22Node门禁/路由、15Chromium、4axe零违规；命令/原始日志/二进制/构建/网络/截图hash见receipt.json，原失败保留ORIGINAL_SCOPE_ONLY。
- Security：没有生产凭据、推送或部署，合成身份/数据与回环TLS/cookie/CORS桥接明确；前端能力不当权限。MFA码仅短时输入，不进入恢复body/存储/证据正文。内置Approver注销403不冒充真实IdP撤销通过。
- Risk：自批/过期/冲突/当前财务余量或健康变化拒绝、无乐观批准；仅真实服务端回执显示成功，批准也不等于交易准入。完整RiskDecision/真实风险源、跨访问持久恢复未完成。

遗留：2组axe incomplete/14非文本导航图标节点未算通过；真实IdP/cookie/CORS、目标DB/RLS/持久恢复/真实risk来源、远程同SHA CI、跨浏览器/OS、性能长稳、人工读屏/200%原生缩放、完整I5联调/发布均NOT_RUN。stage_gate INTEGRATION/NOT_ASSESSED，formalAccepted=false、runtimeAdmission=DENIED。

详见DELIVERY.md、VISUAL-REVIEW.md与操作规程。下一任务FE:UI-P10，当前仅开发准入允许。
