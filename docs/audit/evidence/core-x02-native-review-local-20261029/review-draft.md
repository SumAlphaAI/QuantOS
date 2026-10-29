# CORE:X02 当前精确风险评估验收文稿

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "CORE:X02",
    "stage": "DEVELOPMENT",
    "sourceCommit": "d6b4cfbcd6dfef85cfdf2b8e46beed6b1ef023c8",
    "inputsDigest": "sha256:3a36f76edbb3f278085a13dbc34692c9b79418acf8e65821007d7c6560cdcc00",
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

PENDING_USER_REVIEW；approval=null、selfApproved=false，未代用户批准。工程Gate PASS_CURRENT_EXACT_SNAPSHOT_NEW_SIGNED_RISK_SAME_IMMUTABLE_PROPOSAL；完整Gate NOT_READY_GAPS_OPEN / stage NOT_ASSESSED / formalAccepted=false / runtimeAdmission=DENIED / M5 PREPARED_NOT_READY。19gap/8义务OPEN，159阶段不提升。

- Product：当前X01 Decimal快照显式形成新签名RiskDecision，绑定同一不可变R04 Proposal；旧决定/Subject/审批/Command不改。真实公共单BTC组合因原gross_after集中度限额Deny，不为得到成功改限额。
- Frontend：新增受控公共契约/生成SDK；既有账本和P10/P11消费者13项直接回归通过。没有新增评估页面或公共ApprovalRequired成功之声明，浏览器/人工无障碍NOT_RUN，旧axe incomplete2仍属原范围。
- BFF：只接受snapshotHash/expectedGeneration，当前C01/CSRF/Origin/幂等key下重读当前账本/认证来源；来源变化、缺mark、过期或UNKNOWN拒绝。回执/新决定与可选新Subject同一认证checkpoint保存后应答，恢复不续期；共同C10有同源新风险事件。
- QA：冻结22项命令达到预期；Rust104（source22/guard10/models27/authority31/process14）、消费者13、契约47、Node44，无跳过。实际本机mTLS/native签名Deny、原响应恢复、缺mark/到期、错误scope/hash/generation/角色/财务注入、实际OS写拒绝/冷恢复和UNKNOWN有具名原始证据；领域模块多资产新Subject/原Proposal逐字相同、零审批及独立fixture-HMAC另立范围。原预检失败保留。
- Security：沿用同一kill实例/锁与签名namespace；native exact context重建ledger/input/snapshot并绑定原期限，risk更短时效同样约束。owner参考文件和临时mTLS不代表真实R01/IdP/Vault/RLS/venue/跨主机或独立公钥信任。热写失败可能继续拒绝，不能降低反回退；全目录/密钥/宿主共同回滚未证明。
- Risk：精确乘加/交叉乘积不经f64财务投影；保留15项原规则，全部非Deny强制独立公共审批，不签Allow。新Subject不会继承旧审批，所有native刷新Subject Command继续拒绝。UNKNOWN保持0入账/1隔离/2OPEN/0snapshot、当前kill generation1与原签名generation0不改，不补发、不自动关闭。

下一 CORE:L03 DEVELOPMENT / L4-CURRENT-REVIEW-APPROVAL-01：显式新风险动作、Deny/ApprovalRequired分流与新Subject独立审批；已执行或UNKNOWN的原Proposal不能因此再次Command。正式确认按[统一规程](../../../gate-records/user-acceptance-confirmation-workflow.md)保存用户原答复与本稿摘要。
