# CORE:X05 DEVELOPMENT 当前观察对账

2026-10-29；基线 `abcea2032a00a53af1438f9c8c2ca96c63a0e7b6`；冻结源码 `dffb2dd4d45bc89e4ac7d30dbe9d10106dad1a2b`；当前执行 `attempt-02`；输入摘要 `sha256:b2f9aacdfef5332428bb9d074ba0d95fa9e63b79d92eb45e6c593fe5503c4cf5`。

已接通独立进程签名的原始协议观察、当前 native Order/Fill 与 X01 持久账本，提供来源绑定的对账历史和持久 OPEN Alert 证据。范围仅为 OBSERVED_EXECUTION_DELTAS_ONLY：独立观察在 native 映射前采集，验签后独立解析，未由 X01 复制。完整账户 books/marks 尚未具备；fullBooksReady/dayCloseAllowed/executionAuthority 均 false。UNKNOWN 即使观察到成交仍不入账、不补发、不关闭义务；恢复匹配不关闭已有 OPEN 证据。

工程 Gate：`PASS_CURRENT_X05_OBSERVATION_RECONCILIATION_ALERT_EVIDENCE`。28 项命令达到预期退出；Rust 65、前端消费者 109、契约 130、门禁 Node 108、Chromium 4 均通过；Chromium 无重试、跳过或 flaky。3 次 axe 零 violation，C10 有 1 项 incomplete（9 个非文字导航图标节点），人工读屏/200% 缩放/完整浏览器矩阵 NOT_RUN。正向浏览器旅程 18.518 秒，属于本地功能耗时。

OpenAPI 1.20.0，144 操作/142 schema；生成物一致、TypeScript、ESLint、Clippy、fmt、构建、纯域无 submit 检查及计划静态检查通过。integration/release 预期退出 1 是拒绝证据，不代表联调/发布通过。159 个规范 stage 保持原状态。

完整 Gate `NOT_READY_GAPS_OPEN`，stage `NOT_ASSESSED`，实现 `IMPLEMENTED_PENDING_ACCEPTANCE`，formalAccepted=false，runtimeAdmission=DENIED，M5 PREPARED_NOT_READY。19 gap/8 义务仍 OPEN。真实 IdP/Vault/Supabase/testnet、完整账户 books/估值、实际 Alert 消费/投递/关闭、异步成交对账、异币费用换算、跨主机恢复、目标性能/安全/长稳及同 SHA CI 均未执行。未使用生产凭据，未推送、部署或外部发布。

保留 preflight 52 文件/5 失败日志；attempt-01（源码 bda60e4d）28 命令虽达到预期，最终二进制 profile 哈希漂移验证 FAIL，70 个原始文件保持不变。修复测试/组合构建顺序并分别绑定二进制后，仅新 attempt-02 通过最终验证。详见 [失败记录](./failed-attempts.json)。X01 原 125 文件只保留原范围，不改绑。

[范围摘要](./scope-summary.json) · [变更文件](./changed-files.json) · [原始命令和日志哈希](./receipt.json) · [演练](./drill-report.json) · [视觉评审](./visual-review.json) · [移交](./handoff.json) · [待确认文稿](./review-draft.md) · [发布未执行项](./release-checklist.json) · [规程](../../../operations/core-x05-current-reconciliation.md)。

复核：`node docs/audit/evidence/core-x05-current-local-20261029/verify.mjs`。重新实际运行须新 attempt，不能覆盖当前证据。全部命令如下（环境与输入由冻结脚本/receipt 绑定）：

| 检查 | 实际命令 | 退出码 |
|---|---|---|
| development | `node scripts/development-execution.mjs --development CORE:X05` | 0 |
| scope | `node scripts/core-x05-current-review.mjs --audit` | 0 |
| restricted-zone | `cargo test --locked --offline -p execution-gateway --test l02_mtls` | 0 |
| build | `cargo build --locked --offline -p bff-gateway -p execution-gateway` | 0 |
| current-model | `cargo test --locked --offline -p quantos-reconcile --test current_join` | 0 |
| legacy-x05 | `cargo test --locked --offline -p quantos-reconcile --test x05_flow --test x05_sources --test x05_process` | 0 |
| ledger-model | `cargo test --locked --offline -p quantos-portfolio --test native_ledger` | 0 |
| native-facts | `cargo test --locked --offline -p quantos-execution --test core_x04_facts` | 0 |
| public-source | `cargo test --locked --offline -p bff-gateway --lib assisted::tests::` | 0 |
| public-process | `cargo test --locked --offline -p bff-gateway --test core_l04` | 0 |
| no-submit | `python3 scripts/check-x05-no-submit.py` | 0 |
| consumers | `pnpm exec vitest run apps/terminal/tests/core-l4-audit.test.ts apps/terminal/tests/audit-runtime.test.ts apps/terminal/tests/audit-gateway.test.ts apps/terminal/tests/audit-provider-consumer.test.ts apps/terminal/tests/core-l03-hardening.test.ts apps/terminal/tests/core-l03-provider-consumer.test.ts apps/terminal/tests/core-x04-facts.test.ts apps/terminal/tests/core-x01-ledger.test.ts apps/terminal/tests/core-x05-reconciliation.test.ts --reporter=json --outputFile=docs/audit/evidence/core-x05-current-local-20261029/attempt-02/consumers.json` | 0 |
| contracts | `pnpm exec vitest run tests/contract packages/api-client/tests --reporter=json --outputFile=docs/audit/evidence/core-x05-current-local-20261029/attempt-02/contracts.json` | 0 |
| generated | `node scripts/check-bff-generated.mjs` | 0 |
| openapi | `node scripts/check-bff-openapi.mjs` | 0 |
| types | `pnpm exec tsc --noEmit -p apps/terminal/tsconfig.json` | 0 |
| lint | `pnpm exec eslint scripts/core-x05-current-review.mjs scripts/core-x05-current-review.test.mjs apps/terminal/src/assisted/runtime.ts apps/terminal/src/assisted/workspace.tsx apps/terminal/tests/core-x05-reconciliation.test.ts apps/terminal/tests/core-l03-fixture.ts tests/contract/core-x05-reconciliation.test.ts tests/e2e/core-l4.spec.ts` | 0 |
| rust-lint | `cargo clippy --locked --offline -p quantos-reconcile -p bff-gateway -p execution-gateway --all-targets --no-deps -- -D warnings` | 0 |
| rust-format | `cargo fmt --check -p quantos-reconcile -p bff-gateway -p execution-gateway` | 0 |
| gate-tests | `node --test --test-reporter=tap scripts/core-x05-current-review.test.mjs scripts/development-execution.test.mjs` | 0 |
| plans | `node scripts/check-development-plans.mjs` | 0 |
| web-build | `pnpm --filter @sumalpha/terminal build` | 0 |
| browser | `pnpm exec playwright test --config=playwright.core-l4.config.ts --project=chromium --workers=1 --retries=0 --reporter=list,json --output=docs/audit/evidence/core-x05-current-local-20261029/attempt-02/browser/cases` | 0 |
| integration-refusal | `node scripts/development-execution.mjs --integration CORE:X05` | 1 |
| l4-refusal | `node scripts/development-execution.mjs --integration CORE-GATE:L4` | 1 |
| release-refusal | `node scripts/development-execution.mjs --release CORE:X05` | 1 |
| next-development | `node scripts/development-execution.mjs --development CORE:X06` | 0 |
| secret-scan | `node scripts/core-x05-current-review.mjs --scan docs/audit/evidence/core-x05-current-local-20261029/attempt-02` | 0 |

下一任务：CORE:X06 DEVELOPMENT，消费当前 X05 同源 OPEN 证据接入实际公共 Alert/审计工作流，保留 UNKNOWN 且不重发、不自动关闭。
