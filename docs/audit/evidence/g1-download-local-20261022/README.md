# G1-DL-01 / G1-DL-02 本机下载整改证据

工程 `71b26d54998c3117391f01cac9a7e8681c5880ac`，354输入。工程PASS_REFERENCE_DOWNLOAD_SCOPE；DL-01/02 IMPLEMENTED_VERIFIED_LOCAL_REFERENCE，人工确认PENDING。G1/FEP-1 NOT_READY_GAPS_OPEN、stage_gate NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。

[报告](../../G1-DL01-DL02-reference-download-review-2026-10-22.md)、[完整确认稿](./confirmation-draft.md)、[范围](./scope.json)、[回执](./receipt.json)、[16条执行](./attempt-02/executions.json)、[实际内容与Chromium](./attempt-02/reference-delivery.json)、[整改状态](./remediation-status.json)、[原NOT_RUN](./retained-boundaries.json)、[源码](./source-findings.json)、[全部历史](./attempt-history.json)、[自动审批拒绝与解决](./approval-review-rejection.json)、[hash索引](./manifest.json)。

最终40 Rust+107 Vitest+44负向，16命令exit0；Chromium实收4743字节与metadata/runtime哈希相同，临时loopback TLS/fixture无响应拦截或URL重写。Firefox、WebKit及原NOT_RUN不变，其他6项缺口保留。本机原始历史包只按原提交核验，不迁移历史READY。

复核：`node scripts/g1-download-review.mjs --verify`；封存：`python3 docs/audit/evidence/g1-download-local-20261022/seal.py --verify`。只核对当前下载范围与证据完整性，不授完整联调/运行/发布许可。下一任务G1-REC-01。
