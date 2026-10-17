# CORE:X03 功能开发确认文稿（待项目用户确认）

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "status": "PENDING",
  "request": {
    "nodeId": "CORE:X03",
    "stage": "DEVELOPMENT",
    "inputsDigest": "sha256:ab571b86126a1d40db600637333df3a2b04bb9ca9fd096ab1bf71dfbb5191417",
    "sourceCommit": "c720e7195b4b8da6dbcca152d84bc09658e3573f",
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

确认对象是上述源码与精确输入摘要的 X03 功能开发范围：12组功能/直接影响检查通过，未递归重新验收上游。功能DEVELOPMENT READY；完整业务联调、发布、生产和正式ACCEPTED均未授予。用户修改测试规程的指令不等于确认本稿。

| 维度 | 已完成与边界 |
| --- | --- |
| Product | 有效R04 Proposal及当前RiskDecision转短期HMAC命令；审批CAS、自批拒绝、单次消费、幂等及失败恢复。 |
| Frontend | typed Rust API，无新页面或HTTP/venue提交路径；完整页面/服务联调待验。 |
| BFF | 真实R04 schema、X01/S03/X02/F06模块fixture；实际部署仓库/会话/来源和撤权待验。 |
| QA | 8项X03行为、47兼容/2 ignored、9项X02回归、56门禁反例、98共享规则检查；覆盖率及编译/静态/计划检查通过。1000逻辑任务/16worker仅一命令一消费，非目标性能验收。 |
| Security | 域隔离HMAC、完整payload绑定、tenant/account/capability、CAS、禁止请求人及原发起人自批、审计链和跨issuer消费拒绝；持久事务及密钥托管待验。 |
| Risk | issuer→risk同锁覆盖当前风险重新计算和kill CAS，失败不消费；缓存重放仍验当前来源/策略/审批/时效，不能延长有效期。 |

实现仅process-local；独立guard、进程重启或副本不共享状态。全部25组目标义务NOT_RUN：Supabase/RLS与持久分布式审批/幂等/审计/kill/崩溃恢复，真实身份/来源信任/密钥托管，TP07下游消费及当前策略撤销，原签发P95<200ms、安全/负载/长稳和同SHA hosted CI等。verify_command不执行下游提交。Legacy公开checksum不能授权新路径。

首轮完整闭包136PASS/2FAIL保留；第二轮按最新用户指令中断，4组完成、134组未完整执行，637历史文件/15目录恢复。它们不被重写为PASS。新功能Gate采用分阶段规程，不把历史READY改绑当前源码。

ProjectUser可在本会话确认或修改本稿。Codex随后保存实际原始答复、时间、唯一确认人、文稿/范围摘要并独立执行门禁；无需六份角色回执。当前没有原始确认，formalAccepted=false，不自行批准。
