# 待 ProjectUser 确认：TP12 当前功能边界核对

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "status": "PENDING",
  "request": {
    "nodeId": "CORE:TP12",
    "stage": "DEVELOPMENT",
    "inputsDigest": "sha256:157100722802afa81fb58387cf8a7c8e8dd7002f0c9105f1e52b40effa53249f",
    "sourceCommit": "6af44a970b2c25d75b61bde956143f927e231981",
    "reviewDimensions": [
      "Product",
      "Frontend",
      "BFF",
      "QA",
      "Security",
      "Risk",
      "Domain"
    ]
  },
  "reviewDimensions": [
    "Product",
    "Frontend",
    "BFF",
    "QA",
    "Security",
    "Risk",
    "Domain"
  ]
}
```


状态：PENDING。Codex 起草，尚未取得用户确认，不自行批准。范围摘要：QuantOS CORE:TP12 X3 的本地功能边界评估，固定 nautilus_agents 参考源码不变、7 条禁止耦合规则、6 面接口差异、8 项威胁假设、自有 Agent 本机进程与当前 X03/TP07/R04/X05 直接边界回归；dispatch原始租户/工作区/调用键泄漏修复为域分离摘要及其幂等/取消/Paper回归；代码、文档、门禁和独立证据。

拟确认内容：我已审阅本轮 TP12 审计报告、源版本/输入/执行日志及范围摘要，确认该范围的本地工程交付。Agent 无 venue 权限，无上游 SDK 运行时；建议始终非可执行，签发/审批/风险与事实/异常控制仍由 QuantOS 权威服务拥有。

本确认不包含 TP07 业务集成后 TP12 完整复审、目标身份/Supabase、OS隔离/凭据/egress、持久崩溃恢复、受限trace/字段治理实施、法律/最新供应链/CVE/可达性/签名、安全/性能/长稳/同SHA hosted CI、生产交易与外部发布。这些仍 NOT_RUN。Product/Frontend/BFF/QA/Security/Risk/Domain 的本范围文稿由项目用户一人确认；不需要分别收集七份签署。

用户可确认或修改以上文稿；实际答复须原样保存身份、时间、文稿和范围摘要哈希，再按 docs/gate-records/user-acceptance-confirmation-workflow.md 执行正式确认门禁。任务执行授权本身不等于验收确认。

| 审阅维度 | 本轮可确认事实及限制 |
| --- | --- |
| Product | 参考评估交付，7规则/6接口/8威胁；无上游采用和新增交易能力。 |
| Frontend | 无新页面或面向Agent的交易API；完整页面联调另验。 |
| BFF | Agent研究工具只读且建议不可执行；X03签发和SignedExecutionGateway仍为可信后端入口。 |
| QA | 源版本/输入/真实执行日志与负向门禁；早期失败/超时保留；联调和发布不能由本轮替代。 |
| Security | idempotency_key改为域分离摘要，禁止原始身份/调用键/签名进入kernel；没有OS/真实部署安全证明。 |
| Risk | 当前风险/kill/过期/权限复核、审批CAS和职责分离及下游唯一消费；持久恢复另验。 |
| Domain | Agent trace不替代RiskDecision、命令、Fill或异常关闭；账户/venue在kernel内按契约保留。 |
