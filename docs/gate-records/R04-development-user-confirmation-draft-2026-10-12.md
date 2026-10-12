# R04 R04_LOCAL DEVELOPMENT 项目用户确认文稿

状态：PENDING_USER_CONFIRMATION。本地工程 Gate READY；formalAccepted=false，尚无本稿用户确认，未授予正式 ACCEPTED 或发布权限。

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "CORE:R04",
    "stage": "DEVELOPMENT",
    "inputsDigest": "sha256:ad02435b4c6a6602947349adc063686b77db6debb8d4a5d1a616fbee71ee69c8",
    "reviewDimensions": [
      "Domain",
      "Product",
      "Frontend",
      "BFF",
      "QA",
      "Security",
      "Risk"
    ]
  },
  "reviewDimensions": [
    "Domain",
    "Product",
    "Frontend",
    "BFF",
    "QA",
    "Security",
    "Risk"
  ]
}
```

确认对象为冻结源码 `54aeff32d0903a6dcd94994aaedfaef80fd87baa` 的 R04_LOCAL 工程交付，绑定上述专用完成回执摘要。见[完成记录](../audit/R04-development-2026-10-12.md)、[专用回执](../audit/evidence/r04-completion-20261012/manifest.json)及[验收证据索引](../audit/evidence/r04-completion-20261012/summary.json)。

| 审阅维度 | 已执行范围及限制 |
|---|---|
| Domain | 自有合成 R03 研究产物经 Runtime 验证后进入 Signal/Proposal；来源、快照、策略、哈希、证据和消费期限绑定。未消费已退役的 32 条来源事实，不续签或扩大数据授权。 |
| Product | 公共校验器七类输入缺口修复；100 条 Proposal 均有证据、反方观点、失效时间且 executable=false；重放去重、到期拒绝及订单工具拒绝。 |
| Frontend | 本轮真实本地 Engine/Runtime 消费完成；实际页面与浏览器研究闭环待测试/发布阶段接入及验收。 |
| BFF | 认证会话的租户、工作区、Actor、能力与来源绑定通过；实际 BFF HTTP、Supabase Auth/JWT/RLS、私有 Storage 及持久消费仓库仍待补齐接入与目标验收。 |
| QA | 同一冻结提交 17 节点/56 组必要本地前置、R03 七组、R04 四组全部 PASS；公共契约 11、编排 4、Python 新边界 16、专用回执 35、综合负向 273 项 PASS；完整 Python 1382 项 PASS。历史失败原样保留。 |
| Security | 22 类无效引用/仓库篡改拒绝；拒绝执行权限注入、跨作用域引用和 order.execute；本轮无生产凭据、无数据库执行、无订阅升级或外部发布。 |
| Risk | 当前 R03 消费仓库为内存实现；Supabase 持久 Signal/Proposal、R03 私有 Artifact 读回、独立进程恢复、外部上游与代表性性能/容量/长稳、同 SHA CI 均 NOT_RUN，归 RELEASE-GATE:BETA 实际验收。 |

本地 READY 只供登记的开发消费者使用，全图 5 READY / 154 NOT_ASSESSED / 0 BLOCKED，不自动授予 R1-SERVICE、其他任务或上线准入。既有 Supabase 只读、Auth500 和调度失败未被本轮结果宣称解决。

按[统一规程](./user-acceptance-confirmation-workflow.md)，唯一确认人为 ProjectUser。Codex 仅拟稿；收到用户对本稿的实际确认或修改后，才保存原答复、时间及文稿/范围摘要并执行人工确认门禁。本任务执行授权不作为该确认；未执行项不能由确认补齐。
