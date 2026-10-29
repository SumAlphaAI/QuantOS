# CORE:X06 DEVELOPMENT 当前公共 Alert 与审计接续

2026-10-29；基线 `5e317c69672a7a4b800ad4703ae936da236089a3`；冻结源码 `f7660fcbee2bce2b64bd8d9ebe4cedeea374304d`；当前实际执行 `attempt-02`；输入摘要 `sha256:5b7f45b49fd55a38857dc14840a11ae95139edfc766ffce39721c867bec590ff`。

当前 native/X01/X05 的 OPEN 同源证据进入认证持久收件箱，接现有公共 /v1/alerts 列表/详情、P23 和共同 C10 消费事件。Assisted Live 身份保持不变，不实例化 Paper/Shadow OperationsHost。每个 evidenceId 去重消费，来源/报告/ledger/books/request/command 绑定；旧 C10 请求前缀不改写。UNKNOWN 即使观察到 Fill 仍隔离、不入账、不重发；刷新、来源恢复或重启不把 Alert 变成 resolved。

工程 Gate：`PASS_CURRENT_X05_ALERT_PUBLIC_INBOX_COMMON_AUDIT`。25 项命令达到预期退出；Rust 56（Assisted 19 / 原 C11 22 / X05模型 12 / 实际进程 3）、前端 119、契约 139、Node门禁 57、Chromium 5 通过。浏览器无重试/跳过/flaky；4 次 axe 零 violation，2 项 incomplete：color-contrast (10 nodes), color-contrast (15 nodes)。人工读屏/200%缩放/完整浏览器矩阵 NOT_RUN。

生成物、OpenAPI 1.21.0（144操作/142schema）、类型、ESLint、Clippy、fmt、构建、纯对账域无 submit、计划检查通过；159 个规范 stage 保持原状态。integration/release 的退出 1 是预期拒绝，不能记为这些阶段通过。完整 Gate `NOT_READY_GAPS_OPEN`，stage `NOT_ASSESSED`，formalAccepted=false，runtimeAdmission=DENIED，M5 PREPARED_NOT_READY；19 gap/8 义务仍 OPEN。

当前投递范围为公共应用内拉取只读；外部通知、ack/unack、订阅/实时流、明确审批关闭、完整账户books/估值、原生kill与C11版本化激活、真实IdP/目标DB/Vault/venue、跨主机、异步成交/费用换算、性能/安全/长稳/同SHA CI和发布均未验收。未读取生产凭据，未推送、部署或外部发布。

保留预检 52 文件、10 失败与 1 零用例诊断。首轮冻结源码 6e82a5de 的 68 个文件保留原范围；后续像素检查发现新增来源 hash 截断，修复换行并补实际几何断言后以新源码/attempt-02 复核，不改绑首轮结果。所有失败及修复范围见[失败记录](./failed-attempts.json)。X05 212 个原始封存文件与原SHA保持不变，只保留原范围参考。

[原始命令、输入和日志哈希](./receipt.json) · [结果](./result.json) · [变更清单](./changed-files.json) · [演练](./drill-report.json) · [视觉检查](./visual-review.json) · [移交](./handoff.json) · [待确认文稿](./review-draft.md) · [发布未执行清单](./release-checklist.json) · [规程](../../../operations/core-x06-current-alerts.md)。

复核：`node docs/audit/evidence/core-x06-alert-local-20261029/verify.mjs`。重新实际执行必须创建新的 attempt，不覆盖原证据。

| 检查 | 实际命令 | 退出码 |
|---|---|---|
| development | `node scripts/development-execution.mjs --development CORE:X06` | 0 |
| scope | `node scripts/core-x06-current-review.mjs --audit` | 0 |
| build | `cargo build --locked --offline -p bff-gateway -p execution-gateway` | 0 |
| inbox-model | `cargo test --locked --offline -p bff-gateway --lib assisted::` | 0 |
| public-c11-regression | `cargo test --locked --offline -p bff-gateway --lib operations::tests::` | 0 |
| source-model | `cargo test --locked --offline -p quantos-reconcile --test current_join` | 0 |
| public-process | `cargo test --locked --offline -p bff-gateway --test core_l04` | 0 |
| consumers | `pnpm exec vitest run apps/terminal/tests/core-x06-alerts.test.ts apps/terminal/tests/ui-p23.test.ts apps/terminal/tests/ui603.test.ts apps/terminal/tests/ui603-provider-consumer.test.ts apps/terminal/tests/operations-provider-consumer.test.ts apps/terminal/tests/core-l4-audit.test.ts apps/terminal/tests/audit-runtime.test.ts apps/terminal/tests/core-x05-reconciliation.test.ts --reporter=json --outputFile=docs/audit/evidence/core-x06-alert-local-20261029/attempt-02/consumers.json` | 0 |
| contracts | `pnpm exec vitest run tests/contract packages/api-client/tests --reporter=json --outputFile=docs/audit/evidence/core-x06-alert-local-20261029/attempt-02/contracts.json` | 0 |
| generated | `node scripts/check-bff-generated.mjs` | 0 |
| openapi | `node scripts/check-bff-openapi.mjs` | 0 |
| types | `pnpm exec tsc --noEmit -p apps/terminal/tsconfig.json` | 0 |
| lint | `pnpm exec eslint apps/terminal/src/operations/gateway.ts scripts/core-x06-current-review.mjs scripts/core-x06-current-review.test.mjs apps/terminal/src/alerts/runtime.ts apps/terminal/src/alerts/policy.ts apps/terminal/src/alerts/p23-presentation.ts apps/terminal/app/alerts/workspace.tsx apps/terminal/tests/core-x06-alerts.test.ts apps/terminal/tests/fixtures/core-x06-alert.ts tests/contract/core-x06-alerts.test.ts tests/e2e/core-x06-alert.spec.ts tests/e2e/fixtures/frontend-g8-reference.ts` | 0 |
| rust-lint | `cargo clippy --locked --offline -p bff-gateway --all-targets --no-deps -- -D warnings` | 0 |
| rust-format | `cargo fmt --check -p bff-gateway` | 0 |
| gate-tests | `node --test --test-reporter=tap scripts/core-x06-current-review.test.mjs scripts/development-execution.test.mjs` | 0 |
| plans | `node scripts/check-development-plans.mjs` | 0 |
| no-submit | `python3 scripts/check-x05-no-submit.py` | 0 |
| web-build | `pnpm --filter @sumalpha/terminal build` | 0 |
| browser | `pnpm exec playwright test --config=playwright.core-l4.config.ts --project=chromium --workers=1 --retries=0 --reporter=list,json --output=docs/audit/evidence/core-x06-alert-local-20261029/attempt-02/browser/cases` | 0 |
| integration-refusal | `node scripts/development-execution.mjs --integration CORE:X06` | 1 |
| l4-refusal | `node scripts/development-execution.mjs --integration CORE-GATE:L4` | 1 |
| release-refusal | `node scripts/development-execution.mjs --release CORE:X06` | 1 |
| next-development | `node scripts/development-execution.mjs --development CORE-GATE:L4` | 0 |
| secret-scan | `node scripts/core-x06-current-review.mjs --scan docs/audit/evidence/core-x06-alert-local-20261029/attempt-02` | 0 |

下一可执行：CORE-GATE:L4 DEVELOPMENT，评估当前 X02/X04/X01/X05/X06 组合与剩余缺口，不自动提升 INTEGRATION/RELEASE。
