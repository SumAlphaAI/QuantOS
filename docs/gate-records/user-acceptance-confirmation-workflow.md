# 项目验收确认流程

自 2026-10-05 起，按项目用户的明确要求，所有原需六方或其他多个项目角色确认的验收场景，统一采用 **Codex 拟稿 → 项目用户一人确认 → Codex 记录并执行门禁**。包括 G0–G8、BFF/provider 最终评审、Beta/Live-readiness 发布验收、Desktop D0–D4 及其后续检查点；原含 Domain 的七角色确认也适用。既有签署及审计报告保留为历史事实。

唯一确认人是项目用户，Codex 负责拟稿、核对技术证据和记录，不代用户批准。Product、Frontend、BFF、QA、Security、Risk（适用时含 Domain）作为文稿必须覆盖的审阅维度，不再要求各维度分别出具角色回执。owner、工程/环境证据、用途许可和业务权限控制继续按各任务要求执行。

## 执行步骤

1. Codex 写一份可审阅文稿，列明确认对象、阶段、当前输入/候选版本、已执行与未执行事实、各审阅维度、遗留和范围排除。
2. 用户直接在本会话确认这份文稿或提出修改；不必另填六份文件、不必提供多方身份资料。流程修改授权本身不等于确认某份验收文稿。
3. Codex 保存原始答复与确认时间、唯一确认人标识、文稿路径/摘要及范围摘要，记录为 `quantos-user-acceptance-confirmation/v1`。不虚构多个角色身份。
4. 门禁验证原始记录、文稿与范围一致，并独立验证该阶段技术证据及依赖。用户确认只满足人工确认条件，不能替代未执行/失败的测试或目标证据。
5. 实质范围、功能输入或文稿变化时，Codex 更新文稿并重新请用户确认。仅整理记录、补充不改变已确认范围的证据索引无需重复请求确认。RELEASE 的正式源码 SHA 绑定仍按候选提交验收，避免提交确认文件后把旧 SHA 当作新 HEAD 的通过证据。

当前 [G0 确认文稿](./G0-user-confirmation-draft-2026-10-05.md) 由 `pnpm draft:g0-confirmation` 生成。G0 用功能 `scopeDigest` 绑定范围；A1 最终评审使用 RELEASE、完整候选 SHA、契约/生成摘要及七类真实 staging 证据。

## 数据格式

待确认的 G0 登记为 `quantos-g0-scope-confirmations/v2`，`status=PENDING`、`scopeDigest=null`、`approval=null`。确认后由 Codex 填当前 `scopeDigest`，将 `approval` 指向实际用户确认记录（`record`、`recordSha256`），状态改为 CONFIRMED。

用户确认原始记录字段：`schema`、`mode=AGENT_DRAFT_USER_CONFIRMATION`、`decision=CONFIRMED`、`approver=ProjectUser`、`identity`、`confirmedAt`、`request`、`document`、`documentSha256`、`confirmationSource.kind=USER_MESSAGE` 与用户原始 `text`。这里记录本会话用户的确认，不宣称提供公钥签名或组织身份认证。

文稿首个 JSON 块为 `quantos-acceptance-draft/v1`，包含 `draftedBy=Codex`、`mode`、`request`、`reviewDimensions`。request 含 `nodeId`、`stage`、`inputsDigest`、`reviewDimensions`；RELEASE 另含 `sourceCommit`。JSON 与文稿摘要均须匹配确认记录。确认记录由 Codex 完成，用户只需审阅及答复。

A1 最终回执升级为 `quantos-bff-a1-acceptance/v2`，使用单份 `confirmation` 引用，不再以 `signatures` 数组逐角色放行。旧 v1 签署回执保留历史，不能作为新模式的自动通过依据。

共享策略见 [acceptance-confirmation-policy.json](./acceptance-confirmation-policy.json)，校验器为 [user-acceptance-confirmation.mjs](../../scripts/user-acceptance-confirmation.mjs)。此规则替代旧文档的多角色验收确认要求；交易系统双人职责分离、RBAC/MFA、第三方真实授权/许可证以及产物的密码学签名不属于该人工验收确认替代范围。
