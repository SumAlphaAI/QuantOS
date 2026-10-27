# L02 当前本地功能验收文稿（待确认）

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "status": "PENDING",
  "request": {
    "nodeId": "CORE:L02",
    "stage": "DEVELOPMENT",
    "sourceCommit": "379f624b5e45fa4c22231f25ac06ad54f7c049ec",
    "inputsDigest": "sha256:71a4aef417274dcacc709a40c41421827aa57966969483a1a4cbaeb75fb37768",
    "reviewDimensions": [
      "Product",
      "Frontend",
      "BFF",
      "QA",
      "Security",
      "Risk"
    ]
  },
  "formalAccepted": false,
  "runtimeAdmission": "DENIED"
}
```

对象是固定候选的受控宿主、真实自有 mTLS、TTL/身份/版本/限流前置网络拒绝、静态 SQL/网络契约、受控时钟轮换/撤销及证据机制。Rust 54、Node 93、13 行 TLS 矩阵与实际 X03→自有 mTLS→L01→X04 一例成立。

| 审阅维度 | 当前事实和限制 |
| --- | --- |
| Product | 本地功能实现完成；不提供生产 ingress、Binance HTTP 或真实 Vault 准入。 |
| Frontend | 没有前端改动，不授予 UI/研究 Engine 新秘密权限；完整 UI/testnet 消费 NOT_RUN。 |
| BFF | 新 DB 函数仅 Execution grant；普通 BFF/Engine/UI DB 拒绝为静态契约，真实目标角色/RLS NOT_RUN。 |
| QA | 固定输入/日志/真实进程与扫描反例；全部历史失败保留，不将旧范围改绑新候选。 |
| Security | 真证书 CA/hostname/pin/有效期、会话/账户/版本拒绝、Drop zeroize 和 scoped scan；真实 OS/网络隔离、平台例外隔离和全仓安全审计 NOT_RUN。 |
| Risk | 签名后重检、半开有效期、未知不重发和原 X03 权限入口；受限取消/恢复全链、持久恢复、目标 ≤5 分钟 SLA、testnet/发布 NOT_RUN。 |

唯一确认人是 ProjectUser；本轮仅拟稿，没有用户对本份文稿的直接确认，不代用户批准。stage NOT_ASSESSED、完整 Gate NOT_READY_GAPS_OPEN、formalAccepted=false、runtime DENIED。下一可执行原节点 SERVICE:L03。
