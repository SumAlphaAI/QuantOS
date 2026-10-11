# R03 DEVELOPMENT 项目用户确认文稿

状态：PENDING_USER_CONFIRMATION_AND_PREREQUISITES。当前工程验证 PASS，Gate BLOCKED。本稿未取得用户确认，不授予 READY 或 ACCEPTED。

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "CORE:R03",
    "stage": "DEVELOPMENT",
    "inputsDigest": "sha256:ee865d512d9bfed1ab135b3bea3667bdd951dec1ed488374aac37efa2d4b4cb2",
    "reviewDimensions": [
      "Domain",
      "Product",
      "Frontend",
      "BFF",
      "QA",
      "Security",
      "Risk"
    ]
  },
  "reviewDimensions": [
    "Domain",
    "Product",
    "Frontend",
    "BFF",
    "QA",
    "Security",
    "Risk"
  ]
}
```

确认对象为冻结源码 `b358581d24e51d1e7dd4200176467c833d12a0f0` 的 R03 限定开发工程交付，内容绑定上述 manifest 摘要。74功能输入绑定本轮新目标，依据[当前报告](../audit/R03-prerequisite-readmission-2026-10-11.md)及[完整证据](../audit/evidence/r03-20261011/manifest.json)。

| 审阅维度 | 范围与限制 |
|---|---|
| Domain | 原子研究请求、语义 hash、R02 snapshot/policy 前置拒绝；仅专属合成来源，无真实行情授权迁移。 |
| Product | Research workflow 与 Artifact repository 库交付；R03 Gate BLOCKED，不授予 R04/R1 总 Gate。 |
| Frontend | 保存 gRPC 流事件和证据供后续消费；没有浏览器实时 SSE/页面/部署验收。 |
| BFF | owner/tenant/actor 归属检查、可信调用上下文与真实 Storage bytes；HTTP/JWT 身份链未验收。 |
| QA | Runtime19、Storage22、编排5、TP02 131、Manager55、Gate16、本轮manifest探针9通过，TP02另行实际复验完整Python1366与26项拒绝测试PASS；目标十次同 hash、取消225/553ms、独立进程恢复无重复 Artifact/成本、清理通过。 |
| Security | create-only Storage、实际字节 hash、当前 actor/capability 取消拒绝、attempt fencing、verify-full/CA；部署受限凭据与RLS闭包另验。 |
| Risk | 五项当前前置未闭合；开发Supabase默认只读、F07三项失败；100个fixture任务后续已精确退役并确认pending=0，完整前置仍待复验；32条历史事实独立内部用途仅限北京时间10月14日08:00前，旧采集授权仍到期、无研究 heartbeat/真实模型预算、性能/长稳/候选CI/发布待办；不扩大数据用途、标的或运行时长。 |

唯一确认人为项目用户。Codex 在收到本会话实际确认或修改后保存原始答复、时间、文稿/范围摘要并独立执行门禁；继续开发指令不视为本稿确认。任何确认不能续签真实来源许可、补齐失败/未执行证据或绕过 BLOCKED 前置。按[统一规程](./user-acceptance-confirmation-workflow.md)执行。
