# CORE:X02 项目用户确认文稿（待确认）

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "status": "PENDING",
  "request": {
    "nodeId": "CORE:X02",
    "stage": "DEVELOPMENT",
    "inputsDigest": "sha256:c8b93616932d6b72a1d3a6861e32b794d69b80e1e00db61ba635ddd48c2d4c62",
    "sourceCommit": "5717f7a2b002ec65f9ebc0429364d565e86d1ec1",
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

确认对象仅为上述冻结候选的X02_LOCAL本地工程功能。41节点135组在本轮完整实际执行，131依赖先于4组自身，未拼接历史READY。formalAccepted=false；尚无项目用户原始确认，不自行生成批准或签署。

| 审阅维度 | 本地结果与边界 |
| --- | --- |
| Product | Pre/Post风险、三类各≥50 fixture、全部规则outcome及global/account kill typed API已实现并验证。 |
| Frontend | 本轮提供核心Rust API；页面、真实BFF/Runtime与X06消费独立待验。 |
| BFF | F06上下文的租户/工作区/账户/角色/capability/mode校验及X01/S03真实本地模块组合通过；部署JWT、财务与venue来源权限待验。 |
| QA | 完整41/135、新三次构建、lint/test通过，LLVM实测rules.rs规则分支达到≥95%，原始数据/日志与candidate SHA绑定；不是枚举计数或全crate覆盖率。 |
| Security | HMAC域隔离、完整请求/策略/来源绑定审批、禁止自批、篡改/过期/跨authority拒绝；密钥不序列化或Debug。部署密钥托管/轮换、durable kill与distributed一致性未执行。 |
| Risk | 显式UTC日损/权益/报价单位，逐symbol时效及Release universe/target/expiry；conservative gross+order。kill变更CAS与评估同锁，旧Allow修订失效。P95目标、X03原子签发/审批消费另验。 |

全部24组目标检查、实际Supabase/RLS/持久事务/跨进程恢复、真实F06身份/财务/venue/时钟/密钥来源、部署BFF/Runtime/issuer、代表性kill switch拒绝P95<1s、负载/长稳、安全、最新供应链/法律用途、同SHA hosted CI及正式验收仍NOT_RUN/PENDING。状态仅process-local，独立构造的authority和重启不共享kill/dedupe；Global指本配置authority的全部账户。f64、单报价单位及保守投影限制保留。旧RiskEngine的公开checksum不构成X02签名权威，不能签发交易命令。

ProjectUser可直接在本会话确认或修改本稿。Codex随后保存实际原始答复、时间、唯一确认人、文稿和范围摘要并独立执行门禁；本稿及流程授权不等于验收确认。无需六份角色回执；确认不能替代未执行的目标证据，也不授予交易/生产/外部发布权限。
