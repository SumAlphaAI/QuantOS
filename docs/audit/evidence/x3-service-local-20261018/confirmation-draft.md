# 待ProjectUser确认：X3服务本地功能组合准入

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "status": "PENDING",
  "request": {
    "nodeId": "CORE-GATE:X3-SERVICE",
    "stage": "DEVELOPMENT",
    "inputsDigest": "sha256:85cb27da7f4ef1046e163fc1aeccbdf121ec60bc8197fbeddd35dd2cd94b0fdc",
    "sourceCommit": "cd1961951e583a70cd1a5bfbd97f5457d3ba1f57",
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

状态PENDING。Codex仅拟稿；任务执行授权不是验收答复，无实际确认，不自行批准。

拟确认内容：我已审阅本轮CORE-GATE:X3-SERVICE源版本、代码/修复、文档、输入清单、原始命令/日志/LLVM及范围摘要，确认该候选固定输入Paper/Shadow服务组合的本地工程交付。17组检查PASS，Rust41项（LLVM另执行5项）、Node89项；真实签发/OMS事实/Fill/仓位与独立Shadow虚拟账本一致，20类差异定位并完成ack/证明/新修复源/关闭/复发；并发重放无重复、同租约实例及本地journal恢复无新增IO；kill及独立actor/user审批恢复、陈旧源/撤权/期限拒绝，无Shadow或实际venue提交路径。零异币费用不作FX，非零异币仍拒绝。

当前仅DEVELOPMENT READY / localServiceComposition=PASS。九个直接依赖NOT_REVALIDATED/referenceOnly，不拼接历史READY，不重授S2或各单任务准入。完整businessIntegration、releaseAcceptance均NOT_RUN，formalAccepted=false、runtimeAdmission=DENIED、venueAuthority=NOT_GRANTED。SERVICE:X06当前独立READY因共享输入变化撤回，旧源版本和证据保留原事实。

不包含实际Supabase身份/MFA/能力/RLS、持久事件/outbox/跨组件事务、跨进程/跨实例恢复、真实观察/凭据/OS出网隔离、敏感checkpoint/trace治理、BFF/页面完整链与全仓联调、TP07集成后的TP12完整复审、10个实际交易日Shadow、真实日终未解释差异0、目标检测SLA/P95/部署/安全/长稳/同SHA CI、生产实盘或外部发布。这些仍NOT_RUN。账本保留X01 f64与固定quote边界，不宣称精确会计/FX。

| 审阅维度 | 本范围事实及限制 |
| --- | --- |
| Product | X3本地服务功能准入，页面和发布另验。 |
| Frontend | 无页面改动；P0/A1前置核对后按全量API路线推进，不能直接跳到CORE:X06。 |
| BFF | 组合真实Rust服务，HTTP/会话与全消费者联调NOT_RUN。 |
| QA | 同源码17组、41项Rust/89项Node、原始LLVM修复行region；预检失败全部保留。 |
| Security | Shadow无submit/issuer/secret/network句柄，安全当前签发边界与权限拒绝；不代替目标隔离/凭据验收。 |
| Risk | 当前风险/kill/CAS/双人恢复、源陈旧拒绝和未知执行隔离；不授予生产或venue权限。 |
| Domain | 独立金融值和显式身份桥、20类差异全定位/证明关闭；非零异币费用不隐式转换。 |

项目用户一人可确认或修改本份文稿，无需收集七份角色回执。实际答复须原样记录身份/时间、文稿和范围摘要后执行 docs/gate-records/user-acceptance-confirmation-workflow.md。项目单人验收不替代交易职责分离，也不能把NOT_RUN改成PASS。
