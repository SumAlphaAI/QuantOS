# UI-204 当前功能完整确认稿

状态 PENDING，唯一确认人为项目用户。Codex拟稿、验证技术证据和记录，不代用户批准。本稿只确认I2 UI-204当前功能及明示reference范围，不申请G1/FEP-1、INTEGRATION READY、运行或发布准入，不作为UI-P05开发前置。

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "FE:UI-204",
    "stage": "INTEGRATION",
    "sourceCommit": "54ab042b14b973cbe4e37dfcefdfafa351cc893d",
    "inputsDigest": "sha256:6128610d99ef2190d86b20036685a7d77e7c709632ae59f40b2c1150ead1e5c2",
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
  ],
  "approver": "ProjectUser",
  "decision": "PENDING"
}
```

工程候选 `54ab042b14b973cbe4e37dfcefdfafa351cc893d`，524项输入，摘要 `sha256:6128610d99ef2190d86b20036685a7d77e7c709632ae59f40b2c1150ead1e5c2`。见[工程回执](./receipt.json)、[实际命令](./attempt-02/executions.json)、[范围](./scope.json)、[报告](../../UI-204-data-snapshots-2026-10-23.md)。原 a7706db4 失败、预检查、0项误过滤记录及全部附件保留，不拼接为本候选通过。

- Product：实际目录、服务端筛选/排序/分页、规范/兼容详情、质量/许可/时效及用途阻断已交付；来源只展示C04来源引用。
- Frontend：C01双上下文、snapshot.read、持续授权监控、no-store、内存状态、拒绝歧义路由；离线/隐藏/失效清空，显式恢复仅读取，不重放业务操作。
- BFF：复用C04生成客户端与真实Rust reference返回；C01只为其既有C04当前reference资源主体补报snapshot.read，其他身份拒绝不变，live授权不变。旧245项Rust输入中243项不变，当前二进制独立重建和绑定。
- QA：同一候选23项Rust、110项前端直接功能/回归、50项门禁/路由及6项Chromium通过；types/lint/build和80文件客户端扫描通过，桌面/390宽截图已人工查看；未把截图当视觉基线或完整无障碍验收。
- Security：非verified、服务端阻断/缺失、缺许可、失效/未来/逆序窗口、未知契约均拒绝用途；用途核对还要求对应能力并重取详情。用途核对仅返回SNAPSHOT_CHECK_ONLY_NOT_PURPOSE_AUTHORIZATION，不创建策略/订单，不覆盖后端授权。
- Risk：reference身份cookie桥及loopback CORS代理均为显式替代；degraded/expired、503、能力收窄、800ms延迟为合成探测并在日志逐条标记。真实IdP/MFA、Cookie/CORS、目标数据库、生产托管、目标策略/交易提交、读屏/原生200%缩放、跨OS、远程同SHA CI、性能/长稳与发布全部NOT_RUN，Firefox/WebKit原阻塞保留。原历史ledger全部NOT_RUN不改。

确认后仅关闭原稿当前功能人工确认条件。此时人工确认仍PENDING，development_status=IMPLEMENTED_PENDING_ACCEPTANCE；159阶段Gate均NOT_ASSESSED，G1/FEP-1缺口保持NOT_READY_GAPS_OPEN，formalAccepted=false，runtimeAdmission=DENIED。无生产凭据、推送或部署授权。下一原任务I2 UI-P05可继续开发，无G1辅助项前置。
