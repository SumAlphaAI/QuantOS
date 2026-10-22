# G1-REC-02 本机reference旅程证据

工程 `38569928f3557f80ca8bf3717d1f77882cf1e5ae`，577项冻结输入。**PASS_LOCAL_JOURNEY_WITH_EXPLICIT_PORT_SUBSTITUTIONS**，确认PENDING；G1/FEP-1 NOT_READY_GAPS_OPEN、INTEGRATION NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。

[报告](../../G1-REC02-local-journey-review-2026-10-22.md)、[回执](./receipt.json)、[范围](./scope.json)、[命令/日志](./attempt-01/executions.json)、[10案矩阵](./journey-matrix.json)、[源码](./source-findings.json)、[全部尝试](./attempt-history.json)、[原NOT_RUN与阻塞](./retained-boundaries.json)、[整改状态](./remediation-status.json)、[待确认完整稿](./confirmation-draft.md)、[封存](./manifest.json)。最终30 Rust、10 Chromium、77门禁与9限定检查通过；4743字节附件通过内容attestation及一次性拒绝。所有旧包和原确认按各自SHA保留。

IdP/session建立为显式本机替身，导出创建为NODE_CONTROL_PORT；目标身份、Cookie/CORS、DB/Storage和完整无替身旅程仍NOT_RUN。短429为合成，真实MFA60秒冷却到期未执行。Firefox/WebKit阻塞、全部历史失败/NOT_RUN/incomplete不提升。预检trace保留公开合成测试数据；中间源码未完整冻结，预检PASS不拼入最终候选。应用取消不表示服务端回滚。

`node scripts/g1-journey-review.mjs --verify` 复核原范围；`python3 docs/audit/evidence/g1-journey-local-20261022/seal.py --verify` 复核本包。下一G1-DEP-01；P15独立确认与本稿确认均未获本次执行指令批准。无生产凭据、推送或部署。
