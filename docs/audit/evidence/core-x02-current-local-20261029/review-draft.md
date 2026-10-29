# CORE:X02 DEVELOPMENT 评审文稿（待用户确认）

```json
{
  "schema": "quantos-acceptance-draft/v1",
  "draftedBy": "Codex",
  "mode": "AGENT_DRAFT_USER_CONFIRMATION",
  "request": {
    "nodeId": "CORE:X02",
    "stage": "DEVELOPMENT",
    "sourceCommit": "14db5c0f0bfdf20e95d4463fa5097a0606736f6b",
    "inputsDigest": "sha256:50f4109b38b0b39b96aa84a77004b860605c38df2d00e467da8e8ad8f11aed43",
    "reviewDimensions": [
      "requirements",
      "implementation",
      "security",
      "testing",
      "usability",
      "operations"
    ]
  },
  "status": "PENDING_USER_REVIEW",
  "approval": null,
  "selfApproved": false
}
```

当前候选 14db5c0f0bfdf20e95d4463fa5097a0606736f6b；只确认本机当前来源接续与直接影响验证，正式确认尚未取得，不自行批准。

需求：R04完整不可变记录/manifest、X01/S03 owned来源及X02注册签名review（完整record hash、意图、facts/snapshot、policy、kill generation、原截止）接公共审批Subject。

实现：保持Assisted身份与capability，独立用途仅接受approval_required；审批、原key恢复与native IO检查当前绑定，风险锁覆盖提交，锁后采时；原证明/期限与unknown保留。认证来源与精确字节缓存仅复用相同已验证内容；仍读取当前文件/权限、观察其他写入者，纯查询不重写账本。

安全：原文/数量/账户/scope/签名/来源变化/撤销/过期/kill旧generation拒绝；release恢复需独立HMAC和证明完整性。仅Shadow研究前提与owned testnet profile，未开放真实Assisted部署资格；C10只读，无生产凭据。

测试：27项实际检查达预期；Rust68、consumer72、contract106、Gate104、Chromium4；3次axe零violation但一项color-contrast incomplete（9节点）。两轮30秒超时FAIL及各自5个NOT_RUN后续检查原件保留；最终旅程16.6秒，未更改30秒/60秒限制或50个样本。

使用体验：实看P11/C10当前截图；同一Subject、双审批、原生Order和5节点共同审计一致，无阻塞重叠。现有共享header UNKNOWN/只读保留；人工读屏/200%缩放及全浏览器NOT_RUN。

运维：原认证checkpoint/同主机文件锁/fsync机制验证；实际身份/研究资金源/Vault/Supabase/RLS、跨主机、真实testnet、目标覆盖率/P95、安全容量通知长稳/同SHA CI/完整联调发布NOT_RUN。旧无来源checkpoint在新组合拒绝读取和写入，无生产迁移。

工程Gate PASS_CURRENT_R04_X02_PUBLIC_SUBJECT_BINDING；完整Gate NOT_READY_GAPS_OPEN、stage NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED、M5 PREPARED_NOT_READY。19原gap和8项义务保持OPEN，原历史READY/FAIL不改绑。下一CORE:X04 DEVELOPMENT接原生Fill/公共成交，再供X01/X05/Alert同源接续。
