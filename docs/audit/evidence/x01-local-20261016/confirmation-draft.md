# CORE:X01 项目用户确认文稿（待确认）

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "status": "PENDING",
  "request": {
    "nodeId": "CORE:X01",
    "stage": "DEVELOPMENT",
    "inputsDigest": "sha256:ed645cb4804419c94c163f2e46ffbb5e76a5515b2da947f0e2eaeb4f3e18d516",
    "sourceCommit": "e2b85a80654ba91992a8fb4e2fd9f127ba449740",
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

确认范围仅为上述冻结候选的 X01_LOCAL 本地工程功能。代码实现提交为3c742384；本轮以e2b85a80重新完整执行40节点131组，127依赖先于4组自身；未拼接历史READY。已有失败和中断记录全部保留。正式验收仍PENDING，当前不存在用户确认原始记录。

| 审阅维度 | 可确认事实与范围 |
| --- | --- |
| Product | Position、valuation、P&L、exposure、账户状态/时间及风险输入已实现；合成1万成交黄金回放与10次冷重建通过。 |
| Frontend | 本轮提供读模型与CLI；页面、G3及真实UI联调由后续任务验收。 |
| BFF | F05/R01真实本地模块组合、租户/账户绑定和拒绝路径通过；目标BFF与持久集成另验。 |
| QA | 三次独立构建、全工作区lint/test及完整40/131本地闭包通过；未把ignored/NOT_RUN当作通过。 |
| Security | 无效/跨租户/篡改/缺失或陈旧输入拒绝；新增迁移保留forced RLS、复合外键和只读权限设计；实际Supabase权限与事务尚未执行。 |
| Risk | 快照逐symbol绑定行情来源时间，要求active状态及消费者可信时钟；只提供输入，不授予交易权。f64、单报价单位、生命周期P&L不能代替X02日损/权益/kill switch规则。 |

全部23组目标检查以及真实Supabase迁移/RLS/并发事务/跨进程恢复、生产账户和行情来源授权、最新供应链与法律用途复核、目标1万订单/成交及100%重建、查询P95<300ms、负载长稳、部署和同SHA hosted CI均NOT_RUN。本地工程READY不表示RELEASE、生产或正式ACCEPTED。

ProjectUser可直接在本会话确认或修改本稿。Codex随后保存真实原始答复、时间和文稿摘要并执行门禁；本稿自身不构成确认。无需收集六份角色回执。确认不会补足未执行的目标检查。
