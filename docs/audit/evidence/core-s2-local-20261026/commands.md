# 冻结候选实际命令

源码：`e15cc359b6b8c185cd7c7b6ca9d4c5c4a153b5da`。逐命令起止时间、退出/信号和日志hash见[executions](attempt-02/executions.json)。两个runtime拒绝和完整INTEGRATION拒绝退出1均为预期。

| 检查 | 实际命令 | 退出 | 原始日志 |
| --- | --- | --- | --- |
| development | `node scripts/development-execution.mjs --development CORE-GATE:S2` | 0 | [日志](attempt-02/development.log) |
| bff-binary | `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | 0 | [日志](attempt-02/bff-binary.log) |
| strategy-domain | `cargo test --locked --offline -p quantos-strategy --lib -- --nocapture` | 0 | [日志](attempt-02/strategy-domain.log) |
| s04-tcp | `cargo test --locked --offline -p quantos-strategy --test service_s04 -- --nocapture` | 0 | [日志](attempt-02/s04-tcp.log) |
| risk-consumer | `cargo test --locked --offline -p quantos-risk --lib --test x02_guard` | 0 | [日志](attempt-02/risk-consumer.log) |
| execution-consumer | `cargo test --locked --offline -p quantos-execution --test x03_authority --test tp07_dispatch --test tp12_boundary` | 0 | [日志](attempt-02/execution-consumer.log) |
| pg-compile-only | `cargo test --locked --offline -p quantos-strategy --test postgres_releases --no-run` | 0 | [日志](attempt-02/pg-compile-only.log) |
| worker-handoff | `cargo test --locked --offline -p bff-gateway --lib g3_research_tests::worker -- --nocapture` | 0 | [日志](attempt-02/worker-handoff.log) |
| c05-c08 | `cargo test --locked --offline -p bff-gateway --lib strategy::tests::` | 0 | [日志](attempt-02/c05-c08.log) |
| consumer | `pnpm exec vitest run apps/terminal/tests/ui303.test.ts apps/terminal/tests/strategy-recovery.test.ts apps/terminal/tests/strategy-provider-consumer.test.ts apps/terminal/tests/fep3-closure.test.ts apps/terminal/tests/ui504-provider-consumer.test.ts --reporter=verbose --reporter=json --outputFile=docs/audit/evidence/core-s2-local-20261026/attempt-02/consumer.json` | 0 | [日志](attempt-02/consumer.log) |
| tp07-reference | `engines/.venv/bin/python scripts/tp07-evaluation.py` | 0 | [日志](attempt-02/tp07-reference.log) |
| tp12-reference | `engines/.venv/bin/python scripts/tp12-evaluation.py` | 0 | [日志](attempt-02/tp12-reference.log) |
| tp08-reference | `node scripts/tp08-evaluation.mjs --workspace` | 0 | [日志](attempt-02/tp08-reference.log) |
| tp09-reference | `node scripts/tp09-evaluation.mjs --workspace` | 0 | [日志](attempt-02/tp09-reference.log) |
| tp10-reference | `node scripts/tp10-evaluation.mjs --workspace` | 0 | [日志](attempt-02/tp10-reference.log) |
| tp11-reference | `node scripts/tp11-evaluation.mjs --workspace` | 0 | [日志](attempt-02/tp11-reference.log) |
| tp07-runtime-refusal | `engines/.venv/bin/python scripts/tp07-evaluation.py --runtime` | 1 | [日志](attempt-02/tp07-runtime-refusal.log) |
| tp12-runtime-refusal | `engines/.venv/bin/python scripts/tp12-evaluation.py --runtime` | 1 | [日志](attempt-02/tp12-runtime-refusal.log) |
| governance | `node scripts/core-s2-review.mjs --inventory` | 0 | [日志](attempt-02/governance.log) |
| governance-python | `engines/.venv/bin/python -m pytest scripts/tests/test_tp07_evaluation.py scripts/tests/test_tp12_evaluation.py -v --junitxml=docs/audit/evidence/core-s2-local-20261026/attempt-02/governance-python.xml` | 0 | [日志](attempt-02/governance-python.log) |
| gate-tests | `node --test scripts/core-s2-review.test.mjs scripts/development-execution.test.mjs scripts/tp08-evaluation.test.mjs scripts/tp09-evaluation.test.mjs scripts/tp10-evaluation.test.mjs scripts/tp11-evaluation.test.mjs` | 0 | [日志](attempt-02/gate-tests.log) |
| lint | `pnpm exec eslint tests/e2e/fixtures/frontend-g3-reference.ts tests/e2e/s2-integration.spec.ts playwright.s2.config.ts playwright.config.ts scripts/core-s2-review.mjs scripts/core-s2-review.test.mjs` | 0 | [日志](attempt-02/lint.log) |
| format | `cargo fmt --check -p quantos-strategy -p bff-gateway` | 0 | [日志](attempt-02/format.log) |
| host-build | `cargo test --locked --offline -p bff-gateway --lib --no-run --message-format=json` | 0 | [日志](attempt-02/host-build.log) |
| s2-browser | `pnpm exec playwright test --config playwright.s2.config.ts --project chromium --output docs/audit/evidence/core-s2-local-20261026/attempt-02/s2-browser --reporter=list,json` | 0 | [日志](attempt-02/s2-browser.log) |
| browser-regression | `pnpm exec playwright test --config playwright.frontend-g3.config.ts --project chromium --grep actual immutable Release|stale saved head|readonly approver|offline clears Release|empty catalog --output docs/audit/evidence/core-s2-local-20261026/attempt-02/browser-regression --reporter=list,json` | 0 | [日志](attempt-02/browser-regression.log) |
| plans | `node scripts/check-development-plans.mjs` | 0 | [日志](attempt-02/plans.log) |
| integration-refusal | `node scripts/development-execution.mjs --integration CORE-GATE:S2` | 1 | [日志](attempt-02/integration-refusal.log) |
| next-development | `node scripts/development-execution.mjs --development CORE:X06` | 0 | [日志](attempt-02/next-development.log) |

复核：`node scripts/core-s2-review.mjs --verify`；含全部失败/原始文件摘要复核：`node docs/audit/evidence/core-s2-local-20261026/verify.mjs`。

PG no-run只编译，未执行SQL；Rust另有3项明确ignored（授权Supabase 1、发布性能2），不计入96通过。Web复用S04原导出，未执行新构建。
