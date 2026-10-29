# CORE:X01 估值与风险输入快照验收文稿

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "CORE:X01",
    "stage": "DEVELOPMENT",
    "sourceCommit": "d739cc8b3924c25ba7ddc21099898261ea526b0d",
    "inputsDigest": "sha256:11286ef20f0391770958e934c50ee851c1700d4f7f7e24a6b20fc12f1f27b75f",
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

PENDING_USER_REVIEW；approval=null、selfApproved=false，未代用户批准。仅当前owned reference范围工程Gate通过；完整Gate NOT_READY_GAPS_OPEN，stage NOT_ASSESSED，formalAccepted=false，runtimeAdmission=DENIED，M5 PREPARED_NOT_READY。19gap/8义务OPEN，159阶段不提升。

- Product：当前不可变native账本到现金、权益、今日P&L和gross/net exposure，缺资金/可信mark拒绝；真实账户完整books与市场来源仍待接续。
- Frontend：公共只读契约、生成SDK及既有账本消费者直接回归；无新Web页面，新浏览器/人工无障碍NOT_RUN，原L4 axe incomplete2保持原范围。
- BFF：GET /v1/assisted-testnet/valuation；禁止浏览器注入mark/cash。source version/ledger hash/anchor/scope/current generation及原截止绑定，认证checkpoint保存后应答；重启按历史prefix重算，无旧缓存fallback。
- QA：20项命令均达到预期退出；Rust70（模型27/authority31/process12）、消费者11、契约27、Node64，无跳过。真实本机mTLS/native、到期/错误来源/版本fork/回退/现金基线替换/权限拒绝及OS写失败恢复有具名原始证据。预检失败保持，非冻结诊断不作为当前PASS。
- Security：认证来源端口固定owner reference；目标IdP/DB/RLS/Vault/venue/多主机与外部单调锚点未验收。来源及snapshot各512上限；完整宿主/目录/密钥共同回滚未证明。写失败后热服务可拒绝，冷恢复仅使用持久版本，不为可用性降低单调校验。
- Risk：Decimal字符串沿用账本有界平均成本；未使用f64或以成交价补mark。不生成新RiskDecision/Proposal，原ledger valuationReady=false及新Command409拒绝保持。UNKNOWN0入账/1隔离/2OPEN Alert/协议调用1、当前generation1、原签名预留和原generation均保持，不补发、不自动关闭。

下一 CORE:X02 DEVELOPMENT / L4-CURRENT-RISK-REFRESH-01。正式确认按 [统一规程](../../../gate-records/user-acceptance-confirmation-workflow.md)保存用户原答复与本稿摘要。
