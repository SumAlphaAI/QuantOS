# G1-DL-01 / G1-DL-02 本轮用户确认

项目用户已确认原完整稿，**CONFIRMED，仅 G1_DOWNLOAD_REMEDIATION_ORIGINAL_REFERENCE_ONLY**。工程固定 `71b26d54998c3117391f01cac9a7e8681c5880ac`，原证据包固定 `1698bea12789d4219b3020d5ed3d6951b9756448`。Codex只记录用户直接答复并核验，不自行批准，不宣称整个G1、当前HEAD、联调或发布接受。

[原始答复](./raw-user-message.txt)、[确认记录](./user-confirmation.json)、[approval/hash](./approval.json)、[范围摘要](./scope-summary.json)、[更新后的整改账本](./remediation-status.json)、[确认门禁](./closure-proof.json)、[实际检查](./checks.json)、[封存索引](./manifest.json)。被确认的[完整稿](../g1-download-local-20261022/confirmation-draft.md)、[原工程回执](../g1-download-local-20261022/receipt.json)、[报告](../../G1-DL01-DL02-reference-download-review-2026-10-22.md)与原hash索引不改字节；原PENDING是当时事实，最新确认由本账本补记。

确认门禁验证原始用户文字、唯一确认人、文稿/request/范围digest、工程354项输入、64个原hash条目、原16条命令/日志/二进制/实际字节证据，并检查159个计划stage_gate和规范/实现状态不变。门禁内含39项篡改/范围提升负向探针，另执行17项共享确认规程回归、计划结构与ESLint；实际结果见checks.json。只核验原已执行的40 Rust/107 Vitest/44负向，不重跑这些功能检查，不授上游依赖READY。

G1/FEP-1仍 **NOT_READY_GAPS_OPEN**、INTEGRATION **NOT_ASSESSED**、formalAccepted=false、runtimeAdmission=DENIED；review_status仍CHANGES_REQUESTED。DL-01/02工程状态仍IMPLEMENTED_VERIFIED_LOCAL_REFERENCE，仅其确认改为CONFIRMED。原6项其他义务及P15待独立确认保留。

Firefox BLOCKED_ENVIRONMENT、WebKit BLOCKED_ENVIRONMENT_TEST_INTERCEPTION及全部原NOT_RUN/失败/预检源码未完整冻结的局限保留。真实DB/Storage/signer/IdP/Cookie/CORS、持久撤销、完整页面/跨页面旅程、人工读屏/原生200%、跨OS/设备、远程CI、性能/长稳/RELEASE未执行；本轮不读取生产凭据、不使用目标服务、不推送或部署。原4743字节Chromium实收仍只限原SHA内容传输，不能替代Firefox/WebKit或完整P17业务链。

复核：`node docs/audit/evidence/g1-download-confirmation-20261022/verify.mjs --verify`。下一可执行任务 **G1-REC-01** 实际路由撤权/失效与恢复，再组织G1-REC-02完整组合；不直接提升I2联调准入。
