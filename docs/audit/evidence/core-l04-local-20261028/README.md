# CORE:L04 本机开发证据

本包仅用于 2026-10-28 CORE:L04 DEVELOPMENT；基线 `58ebf4a9ca96e71059b0d4c80427fcd1052b6e75`，接续 L03 原范围移交。源码候选、当前运行与 SHA 由 `receipt.json`、`result.json`、`attempt-01/executions.json` 固定；最终收集尚未执行时不据此声称 PASS。

入口 `node scripts/core-l04-review.mjs --run docs/audit/evidence/core-l04-local-20261028/attempt-01`；冻结代码后执行，使用白名单环境、pinned pnpm、cargo locked/offline，不读取私有 dotenv。当前 HTTP/mTLS 子进程只绑定 loopback，临时证书/签名 key/owner 文件在私有临时目录生成并清除，不进入本证据包。未使用生产凭据、数据库或外部 venue，未推送或发布。

完整范围见 [规程](../../../operations/core-l04-current-function.md)。预期工程 Gate 为 `PASS_OWNED_LOCAL_CORE_L04_MTLS_C10_DURABLE_RECOVERY`，完整 Gate 继续 `NOT_READY_GAPS_OPEN`，stage `NOT_ASSESSED`、formalAccepted=false、runtimeAdmission=`DENIED`，19项原 gap 保持 OPEN。原 L03/L02/FEP-8 与 CI 证据按各自 SHA 保存，不转成当前目标验收。

`preflight/` 保留未冻结开发失败：01 sandbox 不允许 loopback，02 旧受控时钟早于当前命令导致 unknown，03 store 首次 bootstrap 竞争，04 崩溃探针缺少必需 X-Request-Id，05/06 clippy，07 logout 探针给无 body 契约发送了空对象。它们是 FAIL/UNFROZEN，未改写为最终 PASS；后续实际结果以完整冻结 attempt 为准。
