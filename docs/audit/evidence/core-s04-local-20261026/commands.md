# 冻结候选实际命令

源码：`1f3c8725bbd3f512938add4dab52363c380825d8`；[逐命令起止时间/退出/信号/hash](attempt-02/executions.json)。两个INTEGRATION拒绝的退出1均为预期，不是运行失败。

| 检查 | 实际命令 | 退出 | 原始日志 |
| --- | --- | --- | --- |
| development | `node scripts/development-execution.mjs --development CORE:S04` | 0 | [日志](attempt-02/development.log) |
| bff-binary | `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | 0 | [日志](attempt-02/bff-binary.log) |
| c05-c08 | `cargo test --locked --offline -p bff-gateway --lib strategy::tests::` | 0 | [日志](attempt-02/c05-c08.log) |
| worker-handoff | `cargo test --locked --offline -p bff-gateway --lib g3_research_tests::worker -- --nocapture` | 0 | [日志](attempt-02/worker-handoff.log) |
| s04-tcp | `cargo test --locked --offline -p quantos-strategy --test service_s04 -- --nocapture` | 0 | [日志](attempt-02/s04-tcp.log) |
| consumer | `pnpm exec vitest run apps/terminal/tests/ui301.test.ts apps/terminal/tests/ui302.test.ts apps/terminal/tests/ui303.test.ts apps/terminal/tests/strategy-recovery.test.ts apps/terminal/tests/strategy-provider-consumer.test.ts apps/terminal/tests/ui-p06-presentation.test.ts apps/terminal/tests/ui-p07-presentation.test.ts apps/terminal/tests/fep3-closure.test.ts apps/terminal/tests/ui504-provider-consumer.test.ts apps/terminal/tests/s04-scenarios.test.ts --reporter=verbose --reporter=json --outputFile=docs/audit/evidence/core-s04-local-20261026/attempt-02/consumer.json` | 0 | [日志](attempt-02/consumer.log) |
| types | `pnpm --filter @sumalpha/terminal typecheck` | 0 | [日志](attempt-02/types.log) |
| lint | `pnpm exec eslint apps/terminal/src/strategy/release-policy.ts apps/terminal/app/releases/workspace.tsx apps/terminal/tests/ui303.test.ts apps/terminal/tests/ui504-provider-consumer.test.ts tests/e2e/fixtures/frontend-g3-reference.ts tests/e2e/s04-integration.spec.ts playwright.s04.config.ts playwright.config.ts scripts/core-s04-review.mjs scripts/core-s04-review.test.mjs` | 0 | [日志](attempt-02/lint.log) |
| gate-tests | `node --test scripts/core-s04-review.test.mjs scripts/development-execution.test.mjs scripts/terminal-static-routes.test.mjs` | 0 | [日志](attempt-02/gate-tests.log) |
| host-build | `cargo test --locked --offline -p bff-gateway --lib --no-run --message-format=json` | 0 | [日志](attempt-02/host-build.log) |
| terminal-build | `pnpm --filter @sumalpha/terminal build` | 0 | [日志](attempt-02/terminal-build.log) |
| s04-browser | `pnpm exec playwright test --config playwright.s04.config.ts --project chromium --output docs/audit/evidence/core-s04-local-20261026/attempt-02/s04-browser --reporter=list,json` | 0 | [日志](attempt-02/s04-browser.log) |
| browser-regression | `pnpm exec playwright test --config playwright.frontend-g3.config.ts --project chromium --grep-invert G3  --output docs/audit/evidence/core-s04-local-20261026/attempt-02/browser-regression --reporter=list,json` | 0 | [日志](attempt-02/browser-regression.log) |
| plans | `node scripts/check-development-plans.mjs` | 0 | [日志](attempt-02/plans.log) |
| integration-refusal | `node scripts/development-execution.mjs --integration CORE:S04` | 1 | [日志](attempt-02/integration-refusal.log) |
| g3-refusal | `node scripts/development-execution.mjs --integration FRONTEND-GATE:G3` | 1 | [日志](attempt-02/g3-refusal.log) |
| next-development | `node scripts/development-execution.mjs --development CORE-GATE:S2` | 0 | [日志](attempt-02/next-development.log) |

复核：`node scripts/core-s04-review.mjs --verify`；包含失败历史、旧图与全证据摘要的复核：`node docs/audit/evidence/core-s04-local-20261026/verify.mjs`。
