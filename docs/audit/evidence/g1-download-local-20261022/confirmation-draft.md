# G1-DL-01 / G1-DL-02 当前整改范围完整确认稿

状态 **PENDING**；唯一确认人为项目用户，Codex拟稿/核验/记录，不自行批准。本稿只接受本轮下载整改工程事实与边界，不请求G1/FEP-1 READY、完整联调、运行或发布许可；本次执行指令不是确认。

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "FRONTEND-GATE:G1",
    "stage": "INTEGRATION",
    "sourceCommit": "71b26d54998c3117391f01cac9a7e8681c5880ac",
    "inputsDigest": "sha256:1ad162dfa6c9058196949c42104895bec285957e1bc81aff78b14e6f902720fc",
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

工程 `71b26d54998c3117391f01cac9a7e8681c5880ac`、354 输入，范围摘要 `sha256:1ad162dfa6c9058196949c42104895bec285957e1bc81aff78b14e6f902720fc`（[scope.json](./scope.json)）；[实际16条执行](./attempt-02/executions.json)、[回执](./receipt.json)、[报告](../../G1-DL01-DL02-reference-download-review-2026-10-22.md)、[恢复/拒绝与原始尝试](./attempt-history.json)。后续文档提交不等于新HEAD已接受。

1. Product：reference下载从占位租约改为实际受控附件交付，用户显式申请和重取；仅DL-01/02，未纳入其他G1缺口或完整P17/跨页面旅程。
2. Frontend：C10/C17共用规范HTTPS BFF origin与资源/保留期/TTL校验；拒绝任意跨域/URL规范化和敏感history；迟到/关闭/离线/重载拒绝保留；未修改页面视觉。
3. BFF：reference内存票据、会话/权限/状态/签名、原子一次消费与内容完整性/审计；live使用显式public BFF origin，默认启动需新配置；legacy owner注入入口仅单origin，目标DB/Storage/signer/外部拓扑NOT_RUN。
4. QA：冻结工程40 Rust、107 Vitest（含6真实Node/reference内容组合及Chromium原字节实收）、44负向、必要构建/类型/格式/计划全部通过；4743字节与metadata/runtime hash一致。早期编译/预检失败、EPERM及未捕获中间源码快照局限保留，最终不拼接旧PASS。
5. Security：最早期限、512票据界限、错身份/权限、篡改/重放/取消/登出、存储失败后的显式新链、no-store/nosniff/attachment/no-referrer均有本机有界证据；只使用fixture，未用生产凭据，临时TLS例外仅测试context；真实Cookie/CORS/IdP/持久撤销NOT_RUN。
6. Risk：Firefox与WebKit阻塞及所有原NOT_RUN不变；DL-01/02仅IMPLEMENTED_VERIFIED_LOCAL_REFERENCE，其余6项义务保留。G1/FEP-1 NOT_READY_GAPS_OPEN、INTEGRATION NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。真实目标服务/生产TLS、完整业务组合、人工读屏/原生200%、原生通知、跨OS/设备、远程CI、性能/长稳/RELEASE均NOT_RUN；P15仍待独立确认，不推送/部署。

本稿即使后续由用户确认，也不改变未执行项或自动授G1 READY。下一可执行G1-REC-01，再组织G1-REC-02。
