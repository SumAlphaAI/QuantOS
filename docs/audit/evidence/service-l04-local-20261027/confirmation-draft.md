# SERVICE:L04 本地恢复检查点交付确认文稿（待确认）

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "status": "PENDING",
  "request": {
    "nodeId": "SERVICE:L04",
    "stage": "DEVELOPMENT",
    "sourceCommit": "4bf60cc109e337d618d8a0d73158cc2c8a3f505d",
    "inputsDigest": "sha256:910ca018e8d5e63cde65f99e499d5992ffb4747df3d215f6f4924948e3a6179f",
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

拟审阅范围为上述固定候选及 receipt.json 的输入清单：缺项/矛盾计数和重复演练拒绝，F05 只读恢复端口与 owned 事件重放，X06 同 gateway 租约的提交后恢复/未知结果隔离/独立审批恢复 kill，X05 直接来源/财务回归，F09 实际本地健康和 trace 导出查询，以及 fsync 安全证据归档和新进程只读复核。

当前最终 attempt-02 的 15 项检查符合预期，Rust 35/35、Node 66/66；四类受控演练分别成立。33 次恢复查询保持一次下游提交、一个 Fill 链接；全部 15 条服务审计写入本地 archive 后由新进程完整读回。16 个并发归档写者只有一个成功；覆盖、篡改、截断、错误锚、缺失来源/健康、重复命令/订单与审计 head 漂移拒绝。初始失败及 attempt-01 的原始源码/范围保留，不改绑到本候选。

| 审阅维度 | 当前工程事实与范围限制 |
| --- | --- |
| Product | 服务恢复、对账/告警和受控回滚机制的本地功能；恢复 kill 不撤销订单或改账。 |
| Frontend | 前端未变；UI/testnet 代表性闭环仍按 CORE:L04/I10 验收。 |
| BFF | 可信 F06 AuthContext 在 DB 读取之前校验；只读 PgEventStore adapter 编译，未接公共 BFF 或真实会话/数据库。 |
| QA | 固定源码、命令、退出码、时间、原始日志、输入/文件摘要和实际 verifier binary 绑定；Rust 35/35、Node 66/66，保留历史失败。 |
| Security | 当前 scope/能力检查、不可覆盖/限额归档与锚校验，严格 Clippy、限定秘密扫描及 2 条实际反例；并非完整安全/目标部署验收。 |
| Risk | 未知结果只查询真实 owned gateway 事实，拒绝换键/原键重发；恢复需独立 actor/user、更新健康和 CAS，executionAuthority=false。 |

边界：DB 事件来自 owned F05 envelope，来源 ID 是新建身份，不改绑为 X06 原始来源；财务结果相同不等于来源证明相同。归档中的对账报告是独立 owned golden books；当前 X04/X01 真实只读适配由独立直接回归验证，不拼成完整账户对账证明。HMAC/公开 checksum、局部计数、文件落盘和新证据进程都不能替代业务数据库持久性或跨重启交易恢复。

未执行：实际 Supabase/RLS/角色/事务、完整有界事件快照与独立最新 head、公共业务 audit/outbox/锚保管、跨进程/多副本交易状态恢复、实际来源账本对账、公共 BFF/UI/testnet、目标部署与主机死亡通知、目标负载/全面安全/持续窗口/同 SHA CI及发布。没有生产凭据、外部下单、push、部署或发布。

工程 Gate PASS_OWNED_LOCAL_SERVICE_L04_RECOVERY_CHECKPOINT；完整 Gate NOT_READY_GAPS_OPEN，stage NOT_ASSESSED，review IN_REVIEW，formalAccepted=false，runtimeAdmission=DENIED。下一可执行原项 CORE-GATE:L4-SERVICE 的 DEVELOPMENT 评估，不放行 I10 或真实交易。

状态 PENDING。任务授权不等于验收确认，Codex 不自行批准。项目用户可直接确认或修改本稿，之后再保存实际答复、时间、文稿与范围摘要并执行门禁；无需多方角色回执。参见[统一规程](../../../gate-records/user-acceptance-confirmation-workflow.md)。
