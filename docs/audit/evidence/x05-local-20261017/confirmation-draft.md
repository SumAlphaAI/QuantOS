# CORE:X05 项目用户确认文稿（待确认）

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "status": "PENDING",
  "request": {
    "nodeId": "CORE:X05",
    "stage": "DEVELOPMENT",
    "inputsDigest": "sha256:f51130a2afe4c33a343f7130bb61d154299a8fd34ecb65b39a1005bd3801a811",
    "sourceCommit": "4f527da80861bb1421c621a520ae1fb5a56917ff",
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

确认对象只包括上述固定源码/精确manifest的本地X05功能：Shadow对照建议与Decimal虚拟账本、订单/成交/仓位/账本四域对账、20类差异定位、CAS/复验关闭及追加journal恢复。15组当前功能/直接影响检查全部PASS；完整业务联调、28组实际目标和发布NOT_RUN。10个受控工作日不算真实行情持续窗口，任务请求不等于批准本稿。

| 审阅维度 | 当前功能及边界 |
| --- | --- |
| Product | 对照建议不生成TradeCommand；双路/内部独立对账、异常定位/ack/复验关闭/reopen及零差异日结。真实连续运行和部署组合另验。 |
| Frontend | 未新增页面、公开HTTP/BFF命令路由或可执行订单；worker只接收提供的数据。 |
| BFF | 当前F06 AuthContext/来源/现金/anchor由可信后端解析，Shadow模式及tenant/workspace/account/capability约束；真实会话/行情接入待验。 |
| QA | Rust24 PASS（含编译拒绝1）/Node125 PASS；20类受控故障全部定位且600秒检测；真实worker20类通过并拒绝submit/坏帧；10个受控工作日日结0未解释差异。不是实际SLA/持续窗口。 |
| Security | 无issuer/venue/client句柄；源码边界+无submit方法+原生协议拒绝；CAS及精确run key绑定、可信anchor完整性/重算恢复；hash不证明身份或持久原子性。 |
| Risk | 虚拟成交同一X02风险锁内重验当前Allow、kill/过期/陈旧/更换行情拒绝，克隆并发仅一虚拟事件；不消费审批/签发Command。 |
| Domain | 18位Decimal、多空反转、现金/费用/已实现和未实现PnL、mark-valued exposure；X04/X01只读溯源、20类双向缺失/独立重建及旧证据/删除实体拒绝关闭。 |

限制与未决：输入身份/行情许可/现金真实性和游标规范化仍需可信真实后端；UTC工作日标签不是交易所日历。Shadow为内存比较模型，无入出金/FX/公司行动/衍生品保证金或自动运行调度。异常journal可显式恢复，不提供Supabase/RLS持久事务、分布式单写者、身份密码学证明或持久anchor原子性。实际10交易日、目标20类15分钟、无venue submit部署证明、完整Paper/Shadow业务链、法律/OS隔离/安全/性能/长稳/同SHA CI等28组目标NOT_RUN。

唯一确认人ProjectUser。Codex只拟稿，不自行批准或要求七份回执。收到真实用户答复后，按[统一规程](../../../gate-records/user-acceptance-confirmation-workflow.md)保存原文、时间、身份与稿件/范围摘要并执行相应正式门禁；确认不能把NOT_RUN变成PASS。
