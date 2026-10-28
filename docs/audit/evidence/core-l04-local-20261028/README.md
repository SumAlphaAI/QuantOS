# CORE:L04 本机开发证据

源码候选 **41344ffcc40910662d3d043a494be41cfdbd1975**；校验器修正 **7b3ef529008eafcc56bbdc39b92f887e2b7c4bbe**。基线 58ebf4a9ca96e71059b0d4c80427fcd1052b6e75，接续 L03 原范围移交；历史回执不改绑。

工程 Gate：**PASS_OWNED_LOCAL_CORE_L04_MTLS_C10_DURABLE_RECOVERY**。开发 IMPLEMENTED_PENDING_ACCEPTANCE；完整 Gate NOT_READY_GAPS_OPEN，stage NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED、M5 PREPARED_NOT_READY，19项缺口保持OPEN。

22项命令完成预期结果：Rust **94**（新持久化5、当前L03审批24、实际公共进程3、BFF native5、Paper29、公共C10既有14、L02进程4/guard10），契约106、前端消费者26；原 Gate72、校验器修复后75，后两组重叠，不累加。clippy/fmt、生成物/OpenAPI、lint、计划与限定秘密扫描通过；INTEGRATION 入口预期退出1/STAGE_NOT_READY，下一 DEVELOPMENT 入口退出0。命令/退出码/时间/日志hash逐项见 [executions.json](./attempt-01/executions.json)。

双 BFF 实际进程12个并发请求只执行1次自有协议 IO，同一 Command/Order；C10呈现5个同链节点。另一个独立崩溃样本在受限进程已执行后 kill BFF，重启恢复原Command unknown、无补发，C10保留4个预留链节点。两组是隔离 owned 样本，不能合计成真实 venue 订单/目标容量。本机四类机制由重放、进程恢复、受限进程故障和原生持久kill测试承担，flag-off及登出拒绝另行验证。

第一次封存校验失败是工具把既有L02的4项写成2项（业务22命令已完成预期结果）；原始 [FAIL](./attempt-01/verification-failure.json) 保留。修正仅涉及2个校验器文件，业务源码不变；[validation-01](./validation-01/receipt.json) 单独绑定修正SHA、重跑75项工具测试与lint。现回执业务结果仍绑定41344ffc，没有重跑业务或把原FAIL改成PASS。

复核：

```sh
node scripts/core-l04-review.mjs --verify
node docs/audit/evidence/core-l04-local-20261028/verify.mjs
```

原采集命令为 `node scripts/core-l04-review.mjs --run docs/audit/evidence/core-l04-local-20261028/attempt-01`。修正后工具复核命令为 `node scripts/core-l04-review.mjs --reverify docs/audit/evidence/core-l04-local-20261028/attempt-01 41344ffcc40910662d3d043a494be41cfdbd1975`；该固定目录已存在，不得覆盖重跑。新运行需全新attempt并重新冻结源码。

[规程](../../../operations/core-l04-current-function.md)、[范围](../../../execution/core-l04-scope-assessment.json)、[评审文稿](./review-draft.md)、[移交](./handoff.json)、[文件清单](./changed-files.json)。七份未冻结FAIL见[索引](./preflight-index.json)。

只用环境白名单、pinned pnpm、locked/offline Rust、回环 HTTP/mTLS 和自有临时CA/signer；临时私有key、MFA原值和owner文件未进入证据。没有生产凭据、DB opt-in、外部 venue、push/部署/发布。本机文件持久化不是Supabase/分布式DB；未知结果需后续获授权只读对账。真实F06/R04/X02/Vault/DB/RLS、跨主机恢复、OS隔离、当前Fill对账/Alert、真实testnet、目标安全/容量/通知/长稳/同SHA CI/发布均NOT_RUN。未改页面，完整浏览器/手工辅助技术未执行，历史axe incomplete保留原SHA。下一原任务 CORE-GATE:L4 DEVELOPMENT。
