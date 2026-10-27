# CORE-GATE:L4-SERVICE 本地聚合检查交付文稿（待确认）

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "status": "PENDING",
  "request": {
    "nodeId": "CORE-GATE:L4-SERVICE",
    "stage": "DEVELOPMENT",
    "sourceCommit": "3b6e91d2e033c080a830ff05c4e4076fb46aa147",
    "inputsDigest": "sha256:f649f84b72fc1f4c307e8166bae8d5980fb9c1b162d6a4606792210a4280d37c",
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

拟审阅对象为上述固定源码候选、receipt.json 的当前输入、23 项实际命令/日志/矩阵及原始组件来源索引。当前 Rust 49/49、Node 98/98，无失败/忽略/跳过；严格 Clippy/fmt/ESLint/计划及任务差异秘密扫描符合预期。当前结果是本地聚合检查完成，不能确认六项依赖阶段、I10、真实目标或发布已经通过。

| 审阅维度 | 当前事实与范围限制 |
| --- | --- |
| Product | L01/L02/L03/L04 当前协议、秘密权限、审批/默认关闭及恢复观测的本地聚合；完整审批→执行→统一审计恢复仍未贯通。 |
| Frontend | 前端未修改，X3/FEP-7 原始缺口保留；没有重跑其浏览器矩阵，也没有提升 G8/I10 或 M5。 |
| BFF | L03 是实际 owned 私有 HTTP，L02 是实际 owned mTLS；均不是公共 BFF/UI 当前来源完整正向链。 |
| QA | 当前固定源码、输入、命令、binary/日志/矩阵绑定；六项历史仅核对原内容/原 Git，不能累加为当前 READY。 |
| Security | mTLS 临时证书、受控签名器、capability/身份/有效期、精确作用域及签名审计；真实 IdP/Vault/数据库/网络强制/全面安全未验。 |
| Risk | 同 native account/proposal/risk 的 L03 双审批生成 2 条可验证 audit，但不授原生 token；Paper/AssistedLive issuer 都拒绝，command_issued 为零，到期读取拒绝。 |

当前 200 个协议样本在 direct/owned stdio 两面执行，不是 400 独立场景；50 个审批样本在内存服务/owned HTTP 两面执行，每面 100 audit，不是 100 独立 workflow。flag-off 50 次业务请求全部 403、无订单。L04 33 次原键恢复查询保持一次下游提交、一个 Fill 链接；15 条安全 evidence audit fsync 归档后由新进程完整读回。新 verifier 进程不恢复跨进程交易状态。

原始组件回执保留不同源码 SHA 和原范围；selectedCurrentDrift 只比较代表文件，不能证明全部源码未变。真实 native RiskDecision 被可信 owner 投影到服务自己的 subject UUID；服务 AssistedLive profile 没有改变原 Paper release target，也没有把服务 receipt 换成可执行命令。X05 归档内对账仍是 owned golden books，不构成真实账户独立账本或完整来源链证明。

未决功能组合：共同持久事实/审计、L03 到原生审批/签发/受限执行/取消/未知恢复正向桥、公共 P10/P11/BFF/M5 同源恢复，以及 X3/FEP-7/G8/FEP-8 的既有缺口。NOT_RUN 目标：真实 IdP/MFA、Vault/数据库事务/角色/RLS/完整快照/锚、多副本业务持久化去重与重启、目标网络/秘密轮换恢复 SLA、实际账本/venue HTTP/signing/testnet、主机死亡通知/部署、容量/全面安全/长稳/同 SHA CI和正式 RELEASE。

工程 Gate PASS_OWNED_LOCAL_L4_SERVICE_AGGREGATE；完整 Gate NOT_READY_GAPS_OPEN；stage NOT_ASSESSED、review IN_REVIEW、formalAccepted=false、runtimeAdmission=DENIED。L4-SERVICE 与 G8 的 INTEGRATION 都拒绝为 STAGE_NOT_READY。下一可执行原项是 FRONTEND-GATE:G8 的 DEVELOPMENT 范围评估/整改。

状态 PENDING。任务执行授权不等于确认本稿，Codex 不自行批准。项目用户可直接确认或修改文稿，之后再保存真实答复、时间、文稿与范围摘要并执行门禁；用户确认不能替代未完成的功能或 NOT_RUN。没有生产凭据、外部下单、push、部署或发布。参见[统一规程](../../../gate-records/user-acceptance-confirmation-workflow.md)。
