# BFF-FE-006 / A4 完整确认稿（2026-10-19，PENDING）

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "FE:BFF-FE-006",
    "stage": "DEVELOPMENT",
    "sourceCommit": "aad08dd50347d696409db84f86b080c26296a9c3",
    "inputsDigest": "sha256:8aba10a53f2ed1fb4f6959f6d185052620d521032c8f9009f18bbdb7a2a2a53f",
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

唯一确认人为项目用户；Codex拟稿，不自行批准。范围只属于冻结源码 `aad08dd50347d696409db84f86b080c26296a9c3` 的 BFF006_SCOPE_LOCAL 当前本机功能。原 20261018 记录与用户原确认保留原 SHA，不扩为本轮确认。

Product：C06–C09/C13 的20项 Portfolio、Risk、Proposal、Approval、command-ref、Order、capabilities/preflight API 当前功能完成。Paper不连接venue，Shadow仅投影与kill control；没有新增生产账户、用途、外部来源或交易授权。

Frontend：保持 OpenAPI1.12.0、六生成产物及当前132操作/110schema一致；本任务只评估20项所属API。真实 generated consumer验证丢回复恢复、202只受理、事实更新、SSE去重/缺口/撤权与审计关联；49项consumer/契约测试通过。执行consumer行25/25、分支33/33；基本Chromium通过，完整P08–P11/P20页面及G5/FEP-5尚未联调验收。

BFF：保留真实X01投影、X02风险、X03原子审批签发和X04 Paper OMS组合。新增装配与源替换的账户/tenant/workspace/quote-unit绑定；失败前不改当前状态。页面preflight读取使用不登记的preview，只有最终evaluate决策可进入签发；账户风险使用当前账户规则，不依赖Proposal，也不使用首个提案代表全部账户风险。无提案时风险、Portfolio事件及kill engage/release正常返回。

QA：999项冻结输入，17/17组、5/5实际门禁入口、Rust89、Node154、consumer/契约49通过；20项API/1085条实际HTTP，各有成功/401/403，1000次同键提交与基本Chromium通过。当前证明只来自attempt02；attempt01为主动SIGTERM中断，不拼接其PASS。初始计划/策略不一致失败、沙箱loopback EPERM及全部历史记录保留。无关十万事件体量回放、全仓和递归上游门禁未执行。

Security：服务端绑定Context与资源；浏览器仅能提供引用/版本/选择器，不能提供actor、源事实、可执行命令或交易密钥。独立审批MFA/近期认证、职责分离、单次proof、CAS、contextHash和有效期拒绝仍有实测。preview签名投影无法通过登记决策校验。默认live缺host返回503，显式host仍为单进程受控租约；目标身份、RLS与持久事务及跨实例恢复均NOT_RUN。原53,689份audit/gate文件保持字节不变。

Risk：allow/deny/approval-required、七类拒绝、kill/陈旧/到期、幂等与恢复均有当前证据。风险/预检读取不再占用seen或决策登记；当前账户风险检查数值、快照/财务时效、kill、杠杆/集中度/日损，订单增量、Release/venue与审批条件由preflight及最终原子签发校验。继承X01 f64、USD自有合成输入限制，真实FX/会计精度与持续可信feed未验；非USD非零费用拒绝。

十个直接前置仅核对当前消费边界与不可变原回执，NOT_REVALIDATED/referenceOnly，不重授独立READY。完整业务联调、实际Supabase/Auth/RLS/F05持久事务、跨进程/实例恢复、真实来源/密钥/权限、部署、安全/容量/性能/长稳及同SHA hosted CI全部NOT_RUN。formalAccepted=false，runtimeAdmission=DENIED；未使用生产凭据、未推送、部署或外部发布。

确认依据：[报告](../../BFF-FE-006-functional-review-2026-10-19.md)、[manifest](./manifest.json)、[结果与精确命令](./review-results.json)、[控制矩阵](./control-matrix.json)。项目用户直接确认或修改本稿后，再按统一规程保存原答复、文稿摘要与范围并执行人工确认门禁；本稿当前PENDING。
