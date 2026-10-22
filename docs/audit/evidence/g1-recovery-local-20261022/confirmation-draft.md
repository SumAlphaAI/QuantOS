# G1-REC-01 当前路由整改完整确认稿

状态PENDING；唯一确认人为项目用户，Codex拟稿/核验/记录，不自行批准。本稿仅本轮实际路由授权失效/恢复工程范围，不申请整个G1/FEP-1 READY、联调、运行或发布许可。

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "FRONTEND-GATE:G1",
    "stage": "INTEGRATION",
    "sourceCommit": "75451b08bf97f3b85d49d6f9eca9da23975e974a",
    "inputsDigest": "sha256:4177b1826191e68fb20592d3e94b60d385929dff8648c4cc378448115d84bcc6",
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

工程 `75451b08bf97f3b85d49d6f9eca9da23975e974a`、591输入，范围摘要`sha256:4177b1826191e68fb20592d3e94b60d385929dff8648c4cc378448115d84bcc6`（[scope](./scope.json)）；实现首提交bd3d9fe4，最终候选75451b08含直接mock模式回归/门禁调整。[回执](./receipt.json)、[11条命令](./attempt-02/executions.json)、[报告](../../G1-REC01-route-recovery-review-2026-10-22.md)、[恢复矩阵](./recovery-matrix.json)、[全部原始尝试](./attempt-history.json)。文档提交不代表新HEAD通过。

1. Product：实际Command/Settings接入授权失效，不再凭独立reducer或API存在声称路由受保护；失效清除私有数据/敏感草稿，恢复需显式新读，不重放写入；正常有效授权Settings刷新保稿。
2. Frontend：初次私有发布前SSE握手+C01双重scope复核；客户端5秒复查/3秒请求/8秒观测期限与session/context/资源最早期限，动作同步拒绝；取消/代际隔离阻止迟到读取/保存/高风险后续跳。背景隐藏/焦点/离线/跨标签页只减少授权；mock模式无真实SSE声明。
3. BFF：复用既有reference授权流及真实logout事件；普通会话事件不作为权限增量，全局sequence不做业务投影；provider生产接口/Rust/DB规则未改。实际live流、Cookie/CORS、DB/RLS和持久撤销NOT_RUN，服务端仍是写入权限权威。
4. QA：冻结最终候选146单元/消费者、15实际路由Chromium、6真实下载组合、8旧mock（含原两PNG）与39门禁负向，11限定命令全通过；integrated/mock各一轮必要构建，原失败与前一9检查范围独立保留。故障注入/fixture身份明确标记，不称真实目标，没捕获完整中间预检源码快照的局限保留。
5. Security：SSE终态/无效/断流失效、C01比对完整身份与capability、最早期限、跨标签页控制信号无秘密或授权授予、异步取消和scope拒绝有证据。已发写入可能已提交，取消不等于回滚；未知结果及幂等意图不自动重试。操作仅本机reference/公开配置，不读取生产凭据/不接目标服务。
6. Risk：本轮工程PASS_ROUTE_INVALIDATION_REFERENCE_SCOPE、确认PENDING；G1/FEP-1 NOT_READY_GAPS_OPEN、INTEGRATION NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。Firefox/WebKit阻塞与全部原NOT_RUN/incomplete/历史失败不变；目标服务、完整G1/跨页面旅程、领域实时、人工读屏/原生200%、跨OS/设备、CI、性能/长稳/OS后台调度/RELEASE未执行。DL原确认不改绑，P15原稿仍待独立确认，其他5项义务保留，不推送或部署。

即使后续确认本稿，也不把未验证项改为PASS。下一可执行G1-REC-02完整旅程；不直接授I2联调准入。
