# SERVICE:L03 本地服务功能交付确认文稿（待确认）

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "status": "PENDING",
  "request": {
    "nodeId": "SERVICE:L03",
    "stage": "DEVELOPMENT",
    "sourceCommit": "c276e947d8d326484d1a1f1284272ba20dc7405b",
    "inputsDigest": "sha256:dc7f2c8cb4f27f49be0f0c8cff95c4504dc3bc0d7c84c9eb10fe9a729884a4b6",
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

本稿仅供审阅。任务执行授权不等于验收确认，尚无本稿的实际用户确认，Codex 不自行批准。正式 checkpoint 维持 IN_REVIEW / NOT_ASSESSED；本地工程结果与真实环境、联调和发布分别记账。

拟确认对象为上述固定源码候选及 receipt.json 的输入清单：默认关闭的服务审批、当前 capability/账户绑定、独立 actor 和 user 双人审批、可信 step-up 接口、Decimal 单请求额度及白名单、原子 CAS/幂等恢复和 HMAC 审计链。当前 18 项检查符合预期，Rust 28/28、Node 80/80；50 个自有参数化 workflow 在 native 与实际 loopback HTTP 两面验证，每面 100 条审批审计。两面复用同类样本，不算 100 个独立场景；另有 flag-off 50 次全部 403、10 类 HTTP 拒绝、实际原生 AssistedLive 提交拒绝且 kernelCalls=0。

| 审阅维度 | 当前证据与范围限制 |
| --- | --- |
| Product | 服务审批及拒绝/恢复功能；所有 receipt 的 executionAuthority=false。 |
| Frontend | 前端未变；UI/M5 全状态和 testnet 业务闭环另验。 |
| BFF | 私有 owner HTTP adapter，经真实子进程/loopback 请求验证；未接公共 BFF/真实会话映射。 |
| QA | 固定源码、输入哈希、命令、原始日志及矩阵；保留早期失败。L02 binary 直接影响回归 4 项通过。 |
| Security | 当前作用域/能力、会话 generation、绑定 challenge/HMAC、默认关闭与篡改拒绝；身份/MFA 是明确受控端口，真实 IdP/部署安全未验。 |
| Risk | 两名独立 actor/user 均不能自批，当前风险投影/有效期/单请求 cap/白名单拒绝；没有真实来源/累计额度或交易授权声明。 |

未执行：真实 IdP/MFA、实际 R04/X02 来源组合、持久审批/公共审计与跨进程或多副本恢复、Supabase/角色/RLS、公共 BFF/CSRF/TLS/部署隔离/秘密生命周期、UI/testnet/真实执行、性能长稳/同 SHA CI/发布。HMAC 链只在当前进程验证，不是用户公钥签字或持久账本。完整 Gate NOT_READY_GAPS_OPEN，runtimeAdmission=DENIED，formalAccepted=false。没有使用生产凭据、下单、推送或外部发布。下一可执行原项 SERVICE:L04。

项目用户可直接确认或修改这份文稿；实际答复后再保存原文、时间、文稿与范围摘要并执行确认门禁。单人项目验收不替代交易双人职责分离。流程见 [用户确认规程](../../../gate-records/user-acceptance-confirmation-workflow.md)。
