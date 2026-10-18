# FE:BFF-FE-003 / A3 当前功能完整确认稿

状态：PENDING；尚未收到项目用户对本稿确认，formalAccepted=false。

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "FE:BFF-FE-003",
    "stage": "DEVELOPMENT",
    "sourceCommit": "aeab72a52cdd861312366abadbbf56c2fccb6784",
    "inputsDigest": "sha256:c6c3b0a3311912d97672fc5394c3db20bf1b54b8b4fbbc653a5898908b76ac2b",
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

请项目用户审阅并确认C03/C04九项当前本机API：Research list/create/get/cancel/subscribe-replay，Snapshot list/get，Artifact/attachment get，以及生成consumer与直接前置消费边界。19组检查与4个激活入口、237项Node/63项Rust/60项consumer契约、43条HTTP及26项限定控制点通过。认可三项reference修复：Research Audit关联与幂等单次事实、当前时钟deadline/陈旧snapshot拒绝、Artifact metadata/附件canonical hash一致；认可资源/statusRef/hash绑定与SSE恢复/撤权，以及本机实际Runtime→Manager→确定性Python RD-Agent UDS路径。允许继续FE:BFF-FE-005 / A3当前功能复核。

Product/Frontend/BFF/QA/Security/Risk为项目用户一人审阅维度；A2原确认保持3f0c9bd5功能/013c20e8回执，不批准本任务或新HEAD。九前置独立Gate不重授READY。未拼接旧READY，全部最终必要执行来自当前冻结源码。原失败与复现日志完整保留。

明确排除：reference默认Artifact是标注synthetic fixture，不能当R03 worker完成/私有对象或真实研究产物；本机UDS结果是内存store与确定性fixture Engine，不能当持久worker/真实模型或外部来源验收。实际PostgreSQL/RLS/跨租户作用域并发、持久worker/lease/取消/重启恢复、真实Engine授权/OS隔离、真实私有Storage、完整UI/API链、浏览器/部署、目标性能/容量/长稳与同SHA hosted CI、G2/FEP-2/PROVIDER:A3/ALL/RELEASE和运行时均不由本轮准入。全部目标NOT_RUN。

未使用生产凭据、未连接目标库或启动本地数据库、未推送或外部发布。functionImplementation=PASS、businessIntegration/releaseAcceptance=NOT_RUN、formalAccepted=false、runtimeAdmission=DENIED。Codex不得自行批准；收到用户明确答复后保存原文、时间/身份、原稿/范围摘要并执行[统一确认门禁](../../../gate-records/user-acceptance-confirmation-workflow.md)。
