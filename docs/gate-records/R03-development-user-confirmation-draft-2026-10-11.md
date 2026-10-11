# R03 R03_LOCAL DEVELOPMENT 项目用户确认文稿

状态：PENDING_USER_CONFIRMATION。工程限定开发Gate READY；formalAccepted=false，未取得本稿确认，不授予正式ACCEPTED或发布权限。

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "CORE:R03",
    "stage": "DEVELOPMENT",
    "inputsDigest": "sha256:05c684e1953bf8e696d2c8679c1c13b3f0d609490203b3d095140ce4ec05fe7c",
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

确认对象为冻结源码`b2511e1d63508c61be5f304f0f0c02ec5001faae`的R03_LOCAL开发工程交付，绑定上述当前manifest摘要与97功能输入。依据[本轮报告](../audit/R03-local-gate-policy-2026-10-11.md)及[回执](../audit/evidence/r03-20261011/manifest.json)。

| 审阅维度 | 范围与限制 |
|---|---|
| Domain | 自有合成研究输入，十次稳定hash/可定位证据、快照/质量/许可拒绝；不继承或扩展真实来源许可。 |
| Product | Research workflow与Artifact repository限定本地功能交付；15节点LOCAL_READY只供R03使用，未自动放行R04/R1。 |
| Frontend | 保存gRPC流与证据；页面、浏览器SSE和部署未验收。 |
| BFF | 本地tenant/actor/capability、可信上下文、字节hash及取消拒绝；真实Supabase Auth/JWT/RLS/私有Storage链归发布。 |
| QA | 49组前置、R03七组、124门禁测试与清理PASS；Runtime19、Storage22、编排5、TP02 131、Manager55；完整Python1366与独立wheel功能PASS。真实持久强杀/数据库取消延迟不由本地结果推定。 |
| Security | 保留本地权限、create-only/hash、fencing、预算/deadline与许可拒绝；13组Supabase前置和R03真实持久生命周期均NOT RUN→RELEASE-GATE:BETA。 |
| Risk | 原目标容量/默认只读与性能失败待发布前整改复验；无lease heartbeat/真实模型费用与质量验收。无新候选同SHA CI、正式发布或付费授权。32条事实仅原限时内部范围至北京时间10月14日08:00，本轮不消费目标库数据。 |

用户已授权调整Gate，此授权不作为本工程文稿确认。唯一确认人为ProjectUser；按[统一规程](./user-acceptance-confirmation-workflow.md)，收到本会话实际确认或修改后才记录原答复、时间及文稿/范围摘要，并独立执行门禁。不能以确认补齐NOT RUN/失败证据或续签用途。

旧稿按原审阅字节保存在[历史](../audit/evidence/r03-local-gate-policy-20261011/history/r03-prior-confirmation-draft.md)。
