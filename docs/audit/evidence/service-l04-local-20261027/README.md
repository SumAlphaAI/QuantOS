# SERVICE:L04 本地恢复检查点证据

2026-10-27，main。最终源码候选 `4bf60cc109e337d618d8a0d73158cc2c8a3f505d`；[receipt.json](receipt.json) 绑定 `attempt-02` 的固定输入、15 项命令/退出码/时刻/日志、原始 archive 和 verifier binary。后续证据提交不把结果改绑到新 HEAD。

工程 Gate **PASS_OWNED_LOCAL_SERVICE_L04_RECOVERY_CHECKPOINT**。完整 Gate **NOT_READY_GAPS_OPEN**；stage NOT_ASSESSED、review IN_REVIEW、formalAccepted=false、runtimeAdmission=DENIED，正式确认 PENDING。计划已同步当前功能完成/评审中；没有 stage READY、联调/发布或交易准入声明。

- **Rust 35/35、Node 66/66**；严格 Clippy、fmt、ESLint、计划校验通过。
- **四类受控演练**：owned F05→X01 重放、同 gateway 租约提交后恢复、failing kernel 未知结果隔离、kill/独立审批/更新健康/CAS 受控恢复。
- **33 次恢复查询、1 次下游提交、1 个 Fill 链接**；换键/原键重发、过期/自批/旧健康及重复消费拒绝。
- 全部 **15 条 audit** 写入 fsync 本地安全 evidence archive，新进程 env_clear 完整读回；16 个并发归档只有 1 个成功。篡改、截断、错误锚、覆盖和不一致报告拒绝。
- X05 当前来源/财务 2 项及 20 类差异定位、SERVICE:X06 23 项为直接影响检查；F09 实际 health/JSONL trace export/query。不是完整当前业务链或远端监控证明。
- 任务差异/当前 attempt 的秘密扫描 0 findings，1 条精确公共值排除，2 条实际反例拒绝；不是全仓安全审计。

[命令与结果](commands.md) · [变更文件](changed-files.md) · [当前原始执行](attempt-02/executions.json) · [本地 archive](attempt-02/packet.json) · [新进程结果](attempt-02/process.json) · [原始失败与历史范围](development-notes.md) · [待确认文稿](confirmation-draft.md) · [移交义务](handoff.json) · [功能规程](../../../operations/service-l04-current-assessment.md)

DB adapter 只编译，输入为 owned F05 record；新 envelope 不改绑 X06 来源 ID。X05 packet 是独立 owned golden books，来源组合另有直接回归。15/15 表示本地 evidence 审计落盘完整，**不等于业务数据库 audit/outbox 持久化或跨进程交易恢复**；新进程只是只读证据 verifier。archive 的 trusted digest 与父目录权限仍须 owner 独立保管，公开 checksum 不是身份授权或外部签署。

实际 Supabase/RLS/事务、数据库一致读/完整快照与最新 head、业务持久审计与多副本恢复、实际账户账本、公共 BFF/UI/testnet、部署和主机死亡通知、目标负载/全面安全/持续窗口/同 SHA CI、正式验收及发布均 **NOT_RUN**。没有生产凭据、外部下单、push、部署或发布。

下一可执行原项 **CORE-GATE:L4-SERVICE** 的 DEVELOPMENT 评估；I10 与 RELEASE 仍按原准入。attempt-01 保留原源码范围，不作为本候选证据。

```sh
node docs/audit/evidence/service-l04-local-20261027/verify.mjs
```

manifest.json 是逐文件 SHA256 完整性索引，不是外部签署；preflight/历史 attempt 不加入最终测试计数。
