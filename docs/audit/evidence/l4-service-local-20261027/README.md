# CORE-GATE:L4-SERVICE 当前本地聚合证据

2026-10-27，main。冻结实现候选 `3b6e91d2e033c080a830ff05c4e4076fb46aa147`。[receipt.json](receipt.json) 绑定当前输入、23 项命令/时间/退出码/日志、实际 binary 与矩阵；后续证据提交不改绑到新 HEAD。

工程 Gate **PASS_OWNED_LOCAL_L4_SERVICE_AGGREGATE**。完整 Gate **NOT_READY_GAPS_OPEN**；stage NOT_ASSESSED、review IN_REVIEW、formalAccepted=false、runtimeAdmission=DENIED。六项依赖不是当前阶段 READY；L4-SERVICE 与 G8/I10 INTEGRATION 均保持 STAGE_NOT_READY。计划已同步本地评估完成/正式评审中。

- 当前 **Rust 49/49、Node 98/98**；严格 Clippy/fmt/ESLint、计划与限定秘密扫描通过。
- 协议 **200** 个 owned 样本分别在 direct/真实 stdio 两面复核；不是 400 个独立场景或 exchange HTTP。
- 实际临时证书 **mTLS**、进程内 synthetic signer 与一笔实际 X03→owned mTLS→L01→X04 Fill；SQL/网络模板仅静态契约。
- 审批 **50** 个 owned workflow 两面复核、每面 100 audit，flag-off **50/50** 次拒绝；不是 100 独立 workflow/真实 IdP MFA。
- 新增同 tenant/workspace/account、同 proposal hash 与实际 RiskDecision 的双审批拒绝组合：approved、2 条可验证 audit，但无 native ApprovalToken，签发命令 **0**；过期读取拒绝。不是正向 assisted 执行闭环。
- L04 四类受控演练，33 次恢复查询保持一次提交/一个 Fill 链接；15 条安全 evidence audit fsync 归档后由新进程完整读回，不是跨进程交易恢复。
- 六项历史仅核对原始内容/Git/artifact，**ORIGINAL_SCOPE_ONLY**，不汇总旧测试计数为本轮通过。没有运行旧 Gate campaign/浏览器/全仓/覆盖率/数据库。
- 秘密扫描只覆盖任务差异/当前 attempt：0 findings、1 条精确公共值例外、2 条实际反例拒绝；不是全仓安全审计。

[命令与结果](commands.md) · [变更文件](changed-files.md) · [原始执行](attempt-01/executions.json) · [组件来源](component-index.md) · [同 subject 证据](attempt-01/same-subject.json) · [移交义务](handoff.json) · [待确认稿](confirmation-draft.md) · [开发记录](development-notes.md) · [功能规程](../../../operations/l4-service-current-assessment.md)

未决功能：统一审批→原生签发→受限执行/取消/未知恢复桥、共同持久事实/审计、公共 P10/P11/BFF/M5 同源链和 X3/FEP-7/G8/FEP-8 原始缺口。真实 IdP/MFA、Vault/目标数据库/RLS/事务/锚与业务持久化、多副本恢复、目标网络/轮换 SLA、真实账本/venue HTTP/testnet、部署/通知、负载/全面安全/持续窗口/同 SHA CI与 RELEASE 均 **NOT_RUN**。没有生产凭据、外部交易、push、部署或发布。

下一可执行原项 **FRONTEND-GATE:G8 的 DEVELOPMENT 条件入口评估/整改**；I10 INTEGRATION 与真实 testnet 运行没有放行。正式确认 PENDING，不自行批准。

```sh
node docs/audit/evidence/l4-service-local-20261027/verify.mjs
```

manifest.json 是逐文件 SHA256 完整性索引，不是外部签署或阶段授权。artifact 与原始候选、输入及范围共同解释，不把不同源码或替代端口拼成完整业务验收。
