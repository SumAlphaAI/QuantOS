# 待 ProjectUser 确认：SERVICE:X06 本地功能交付

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "status": "PENDING",
  "request": {
    "nodeId": "SERVICE:X06",
    "stage": "DEVELOPMENT",
    "inputsDigest": "sha256:f30e053adac3d4fa08b287e0138e325c2d68688ebbcdf7b1583f9a77ca3108c2",
    "sourceCommit": "bcadfef9f0501975fcbcdbd14dd25f45bd3943de",
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

状态PENDING；任务执行授权不等于验收确认。Codex起草，尚无真实用户验收答复，不自行批准。

拟确认范围：我已审阅本轮SERVICE:X06代码、测试、文档、源版本/输入清单与原始日志，确认固定账户Paper/Shadow可信后端的授权查询与受控操作、订单/成交/仓位证据链、告警/健康/incident、无改账/任意Runbook、独立actor/user职责分离、幂等消费及同gateway租约实例恢复的本地工程交付。源码为bcadfef9f0501975fcbcdbd14dd25f45bd3943de；20组检查PASS，Rust41项（覆盖率另重跑23项）、Node87项，LLVM三模块行≥90%/区域≥85%。

本轮仅功能DEVELOPMENT READY；businessIntegration/releaseAcceptance=NOT_RUN，formalAccepted=false、runtimeAdmission=DENIED、venueAuthority=NOT_GRANTED。八个直接依赖NOT_REVALIDATED/referenceOnly，不拼接历史READY；TP12因共享输入变化撤回当前独立READY，旧证据不改写。

不包含真实Supabase会话/MFA/能力/RLS、F05 durable ledger/outbox/跨组件原子事务、可信checkpoint保管与跨进程/跨实例崩溃恢复、部署F09/X05观察、BFF/页面完整链路、OS隔离/敏感留存、精确会计/FX、安全/性能/长稳/部署/同SHA CI、生产交易与外部发布。这些仍NOT_RUN。checkpoint含敏感签名对象且仅服务端使用；未知执行结果无证明时继续隔离，不能改账或强制关闭。

| 审阅维度 | 可确认事实与限制 |
| --- | --- |
| Product | 服务功能与恢复/异常闭环；页面联调另验。 |
| Frontend | 无页面改动，P08–P14/P20–P23在CORE:X06/G4/G5/G6联调。 |
| BFF | 新增可信Rust服务入口，真实会话/MFA解析与公共HTTP消费者未接入。 |
| QA | 同源20组检查、真实Paper进程、负向门禁与LLVM原始数据；全部早期失败保留。 |
| Security | 精确作用域/能力/step-up，安全查询脱敏，无任意Runbook/凭据/改账；真实目标身份/隔离另验。 |
| Risk | 当前风险/kill/审批原子边界、独立actor及user恢复、CAS与未知结果隔离；不授予venue权限。 |
| Domain | Fill只能由真实X04事实投影X01，虚拟账本沿用f64固定quote；不替代真实会计与持久账本。 |

项目用户一人可确认或修改本份文稿，无需收集七份角色回执。收到实际答复后，Codex原样保存身份/时间/答复、文稿与范围哈希并执行用户确认门禁。单人项目验收确认不替代交易双人职责分离。参见 docs/gate-records/user-acceptance-confirmation-workflow.md。
