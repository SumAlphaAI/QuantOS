# SERVICE:S04 项目用户确认文稿（待确认）

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "status": "PENDING",
  "request": {
    "nodeId": "SERVICE:S04",
    "stage": "DEVELOPMENT",
    "inputsDigest": "sha256:65b519bb5fdec7ac22055f3c4e55903e8d1438d0746d6ab20396e071951ff420",
    "sourceCommit": "1ce8e8998a769e1bf0a04670e1422739c4992788",
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

确认对象仅为上述冻结候选的SERVICE:S04本地DEVELOPMENT实现与证据。Codex已拟定文稿，项目用户尚未确认；无答复记录，不构成正式ACCEPTED、数据库、生产或发布批准。

| 审阅维度 | 实际范围与边界 |
|---|---|
| Product | 策略目录、Lab预览、版本保存、静态检查、回测、Release、审批与Paper/Shadow配置消费的本地授权API闭环。拒绝/过期与恢复可验证。 |
| Frontend | capability、can_approve与deployable_targets由服务端推导；公共BFF映射归BFF-FE-004，P06/P07和20个UI fixture归CORE:S04/G3，页面与完整浏览器矩阵未验收。 |
| BFF | 每请求可信SessionResolver；目标适配器复用F06，输入/clock/source/image/不透明回测凭据均来自宿主；无客户端身份或来源覆盖。真实Supabase适配器未连接。 |
| QA | 本候选36节点118组完整重跑，115依赖后3自身，三次独立构建；6项真实HTTP与109项准入测试，100拒绝、100伪造、20路审批与两种原生adapter回放一致。预检失败保留。 |
| Security | tenant/workspace及显式capability、独立审批者、hash/TTL/CAS、body/分页/并发边界；成功及拒绝在同锁追加hash链审计；不存原始请求或bearer。未使用生产凭据，无外部发布。 |
| Risk | 未验证/未审批/过期/拒绝100%阻断；Assisted Live禁止；当前状态进程内，实际身份撤权、持久审计/事务/跨进程恢复、部署/性能/长稳/同SHA CI仍NOT_RUN。 |

建议项目用户确认原文：

> 我已审阅SERVICE:S04冻结候选 1ce8e8998a769e1bf0a04670e1422739c4992788 的本地实现与证据，并确认上述六维及范围边界。此确认仅适用于SERVICE:S04本地DEVELOPMENT；不代替未执行的Supabase、公共BFF/页面、实际部署、安全/性能/长稳、同SHA hosted CI或生产/外部发布授权。

状态：PENDING。收到本会话项目用户原始答复后，按docs/gate-records/user-acceptance-confirmation-workflow.md保存原文、摘要并执行门禁；不得自行批准。
