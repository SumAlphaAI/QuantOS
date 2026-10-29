# CORE:X06 公共停止控制验收文稿

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "CORE:X06",
    "stage": "DEVELOPMENT",
    "sourceCommit": "a9c94709a1b222a273f16c05c2b4e22ec7074820",
    "inputsDigest": "sha256:44b4f921b7324fdf72b72a49ef62d302ff1b958e443f9a6d2c05dd34d993f144",
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

PENDING_USER_REVIEW；approval=null，selfApproved=false，formalAccepted=false，runtimeAdmission=DENIED。没有用户确认记录，不自行批准。工程 Gate PASS_CURRENT_PUBLIC_KILL_X02_NATIVE_DURABLE_STOP_C10，完整 Gate NOT_READY_GAPS_OPEN / stage NOT_ASSESSED / M5 PREPARED_NOT_READY；19 gap/8 义务 OPEN。

- Product：公共当前账户/配置域全局停止与独立解除在 owned 单机范围实现；C11 版本化启用、全部账户/跨主机传播及正式准入未具备。
- Frontend：P11 当前状态、精确范围确认/MFA、独立复核及 Owner 解除；原 key/body/CSRF/原期限恢复，MFA 前后 generation 重读。审计链接遵守 audit:read；人工无障碍及完整浏览器 NOT_RUN。
- BFF：控制/当前 X02 签名状态/proof 消费同一认证事务；原生持久停止先于成功应答/下一 handler，真实进程死亡恢复。当前仅 HMAC/fsync/OS 锁与参考 C01/F06，目标数据库/身份/Vault/venue/跨主机 NOT_RUN。
- QA：23 项达到预期退出，Rust 31、前端消费者 77、契约 27、Node 43、Chromium 2；axe 零 violation、0 incomplete。原失败日志保留，不递归上游/全仓 campaign。
- Security：账户与全局角色、CSRF/Origin、独立用户复核、原 MFA 时限、代次 CAS、同键同 body 重放、撤权/错域/陈旧/损坏/回退拒绝；未使用生产凭据，不作目标零高危声明。
- Risk：实际 UNKNOWN 命令与签名预留不改写，X01 零入账/隔离1、公共 OPEN Alert2、原协议调用1，不补发/不自动关闭。解除不重置旧 RiskDecision，不清除另一层或永久停止；全部文件/宿主同时回滚、目标在途撤单与停止时延未验收。

下一 CORE:X06 DEVELOPMENT / L4-C11-ACTIVATION-01。任何正式确认按 docs/gate-records/user-acceptance-confirmation-workflow.md 保存真实用户原答复与本稿摘要；本次只封存工程证据。
