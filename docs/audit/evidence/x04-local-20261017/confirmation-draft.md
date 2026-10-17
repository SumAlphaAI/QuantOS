# CORE:X04 项目用户确认文稿（待确认）

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "status": "PENDING",
  "request": {
    "nodeId": "CORE:X04",
    "stage": "DEVELOPMENT",
    "inputsDigest": "sha256:cf1a2dfb0bcb7b610356382bf7955750d6def2d6d089104b625f94a848e7b878",
    "sourceCommit": "0e93b885aa433accf3da426f5f22b9d44999f7f4",
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

本稿只确认上述固定源码及manifest摘要对应的X04功能开发：可信提交/取消、事件映射、append-only事实、anchor重放与Fill溯源。16组当前功能/直接影响检查全部PASS；完整业务联调、27组实际目标及发布NOT_RUN。不是正式发布、真实Nautilus或生产交易授权，任务执行请求不等于批准本稿。

| 审阅维度 | 已实现及边界 |
| --- | --- |
| Product | 提交/取消及拒绝审计、事实日志与读模型；自有Paper本地功能完成，持续业务链另验。 |
| Frontend | 无新增页面或公开订单HTTP；内部投影字段不冒充已发布客户端API。 |
| BFF | AuthContext/时钟/Command须由可信服务解析；当前capability、原requester/账户与consumer归属约束；实际会话联调待验。 |
| QA | 88 Rust PASS/1发布性能ignored；82 Gate+44计划负向PASS；100000混合kernel事件合法、146667事实重放、46667 Fill溯源；真实Paper子进程及九类取消传输故障通过。 |
| Security | 精确issuer签名绑定、当前授权、独立claim；清空子进程环境、私有cwd和有界协议；哈希链/anchor仅完整性，持久事务/跨实例/OS沙箱另验。 |
| Risk | submit仍复核当前风险/审批/期限/kill；cancel不增加新敞口，过期/kill可控制已归属订单；不确定结果保留请求并阻止换键重投。 |
| Domain | submitted/accepted/partial/filled/rejected/cancelled/expired合法转换；GTD到期先记Expired再拒绝cancel；Decimal数量/均价、费用与Fill→Order→Command关联。 |

未决：内存事实/claim/取消去重不提供持久或分布式保证；不确定结果仍须X05及目标对账恢复。GTD在控制请求时补记，无独立持续定时器。实际Nautilus bridge/API及法律/供应链准入、Supabase/RLS与anchor持久事务、跨进程恢复、可信部署身份/时钟/OS隔离、目标10万事件及cancel延迟、安全/负载/长稳、同SHA hosted CI和正式发布证据仍NOT_RUN。

唯一确认人为ProjectUser，Codex只拟稿与验证工程证据，不自行批准。不需收集七份角色回执。真实回复到达后，按[统一规程](../../../gate-records/user-acceptance-confirmation-workflow.md)保存原文、时间、身份及稿件/范围摘要再执行相应正式门禁；人工确认不能代替NOT_RUN目标。
