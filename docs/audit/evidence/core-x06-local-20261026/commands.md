# CORE:X06 当前候选命令与结果

源码：`1a7e745bc8941bf76d32f3753de172de214dd13f`；目录：`docs/audit/evidence/core-x06-local-20261026/attempt-04`。所有命令由白名单环境执行，不读取私有 dotenv / DATABASE_URL。

| 检查 | 命令 | exit | 结果 |
| --- | --- | --- | --- |
| development | `node scripts/development-execution.mjs --development CORE:X06` | 0 | PASS（本命令范围） |
| bff-binary | `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | 0 | PASS（本命令范围） |
| operations-native | `cargo test --locked --offline -p quantos-operations --test service_x06` | 0 | PASS（本命令范围） |
| operations-contract | `cargo test --locked --offline -p quantos-operations --doc` | 0 | PASS（本命令范围） |
| execution-bff | `cargo test --locked --offline -p bff-gateway --lib execution::tests::` | 0 | PASS（本命令范围） |
| operations-bff | `cargo test --locked --offline -p bff-gateway --lib operations::tests::` | 0 | PASS（本命令范围） |
| audit-native | `cargo test --locked --offline -p bff-gateway --lib audit_core::tests::` | 0 | PASS（本命令范围） |
| audit-provider | `cargo test --locked --offline -p bff-gateway --test audit_export_provider` | 0 | PASS（本命令范围） |
| consumer | `pnpm exec vitest run apps/terminal/tests/audit-runtime.test.ts apps/terminal/tests/audit-gateway.test.ts apps/terminal/tests/audit-provider-consumer.test.ts apps/terminal/tests/ui501.test.ts apps/terminal/tests/ui501-provider-consumer.test.ts apps/terminal/tests/ui503.test.ts apps/terminal/tests/ui503-provider-consumer.test.ts apps/terminal/tests/ui504.test.ts apps/terminal/tests/ui504-provider-consumer.test.ts apps/terminal/tests/ui505.test.ts apps/terminal/tests/ui505-provider-consumer.test.ts apps/terminal/tests/ui601.test.ts apps/terminal/tests/ui601-provider-consumer.test.ts apps/terminal/tests/ui602.test.ts apps/terminal/tests/ui602-provider-consumer.test.ts apps/terminal/tests/ui603.test.ts apps/terminal/tests/fep5-closure.test.ts apps/terminal/tests/x06-scenarios.test.ts --reporter=verbose --reporter=json --outputFile=docs/audit/evidence/core-x06-local-20261026/attempt-04/consumer.json` | 0 | PASS（本命令范围） |
| types | `pnpm --filter @sumalpha/terminal typecheck` | 0 | PASS（本命令范围） |
| lint | `pnpm exec eslint apps/terminal/src/audit/runtime.ts apps/terminal/tests/audit-runtime.test.ts tests/e2e/x06-integration.spec.ts tests/e2e/fixtures/x06-reference.ts playwright.config.ts playwright.x06.config.ts scripts/core-x06-review.mjs scripts/core-x06-review.test.mjs` | 0 | PASS（本命令范围） |
| gate-tests | `node --test scripts/core-x06-review.test.mjs scripts/development-execution.test.mjs scripts/terminal-static-routes.test.mjs` | 0 | PASS（本命令范围） |
| terminal-build | `pnpm --filter @sumalpha/terminal build` | 0 | PASS（本命令范围） |
| x06-browser | `pnpm exec playwright test --config playwright.x06.config.ts --project chromium --output docs/audit/evidence/core-x06-local-20261026/attempt-04/x06-browser --reporter=list,json` | 0 | PASS（本命令范围） |
| audit-browser | `pnpm exec playwright test --config playwright.ui507.config.ts --project chromium --output docs/audit/evidence/core-x06-local-20261026/attempt-04/audit-browser --reporter=list,json` | 0 | PASS（本命令范围） |
| execution-browser | `pnpm exec playwright test --config playwright.frontend-g8.config.ts --project chromium --grep 'FEP5 ' --output docs/audit/evidence/core-x06-local-20261026/attempt-04/execution-browser --reporter=list,json` | 0 | PASS（本命令范围） |
| operations-browser | `pnpm exec playwright test --config playwright.frontend-g6.config.ts --project chromium --output docs/audit/evidence/core-x06-local-20261026/attempt-04/operations-browser --reporter=list,json` | 0 | PASS（本命令范围） |
| risk-browser | `pnpm exec playwright test --config playwright.ui-p08.config.ts --project chromium --grep 'DangerConfirm cancels\|lost committed reply' --output docs/audit/evidence/core-x06-local-20261026/attempt-04/risk-browser --reporter=list,json` | 0 | PASS（本命令范围） |
| plans | `node scripts/check-development-plans.mjs` | 0 | PASS（本命令范围） |
| integration-refusal | `node scripts/development-execution.mjs --integration CORE:X06` | 1 | 预期拒绝 STAGE_NOT_READY |
| next-development | `node scripts/development-execution.mjs --development CORE-GATE:X3` | 0 | PASS（本命令范围） |

当前计数：Rust 94；consumer 280（18 文件，Audit runtime 26）；Node 83；Chromium 21。均无当前失败/ignored/pending/skipped/flaky。自动 axe 1 次：0 violations、1 incomplete。

Consumer 包含 `x06-scenarios.test.ts` 的 8 个历史模型场景；其中 SLA、fill、controlled-retry、signedUrl 等是自有模型断言，不作为真实订单成交、Runbook HTTP、下载租约或五分钟指标验收。实际 Paper/mock 页面与下载以新 X06 浏览器原始回执为准。

没有运行：全仓及递归上游 Gate、F05/F07 campaign、真实数据库/IdP/venue/testnet、持久化恢复、完整跨浏览器/人工无障碍、性能/长稳、远程 CI 或发布。

只读复核：`node scripts/core-x06-review.mjs --verify`；完整证据复核：`node docs/audit/evidence/core-x06-local-20261026/verify.mjs`。
