# CORE-GATE:X3 当前候选命令与结果

源码 `07c867ed3df10bd9ede2c3e54cd6730938ae71d9`；目录 `docs/audit/evidence/core-x3-local-20261026/attempt-03`。工具白名单剔除数据库/secret/目标开关，Cargo/pnpm/Python 离线；浏览器及 stdio/UDS 只用自有进程。

| 检查 | 命令 | exit | 结果 |
| --- | --- | --- | --- |
| development | `node scripts/development-execution.mjs --development CORE-GATE:X3` | 0 | PASS（本命令范围） |
| bff-binary | `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | 0 | PASS（本命令范围） |
| native-build | `cargo test --locked --offline -p bff-gateway --lib --no-run --message-format=json` | 0 | PASS（本命令范围） |
| native-c15 | `cargo test --locked --offline -p bff-gateway --lib x3_current_tests:: -- --nocapture` | 0 | PASS（本命令范围） |
| paper-process | `cargo test --locked --offline -p execution-gateway --test service_x06_process -- --nocapture` | 0 | PASS（本命令范围） |
| reconcile-flow | `cargo test --locked --offline -p quantos-reconcile --test x05_flow` | 0 | PASS（本命令范围） |
| reconcile-sources | `cargo test --locked --offline -p quantos-reconcile --test x05_sources` | 0 | PASS（本命令范围） |
| reconcile-worker | `cargo test --locked --offline -p quantos-reconcile --test x05_process` | 0 | PASS（本命令范围） |
| c15-bff | `cargo test --locked --offline -p bff-gateway --lib reconciliation::tests::` | 0 | PASS（本命令范围） |
| c14-bff | `cargo test --locked --offline -p bff-gateway --lib performance::tests::` | 0 | PASS（本命令范围） |
| tp12-dispatch | `cargo test --locked --offline -p quantos-execution --test tp12_boundary` | 0 | PASS（本命令范围） |
| tp07-dispatch | `cargo test --locked --offline -p quantos-execution --test tp07_dispatch` | 0 | PASS（本命令范围） |
| tp12-boundary | `engines/.venv/bin/python scripts/tp12-boundary-review.py` | 0 | PASS（本命令范围） |
| no-submit | `engines/.venv/bin/python scripts/check-x05-no-submit.py` | 0 | PASS（本命令范围） |
| tp12-python | `engines/.venv/bin/python -m pytest engines/tests/test_tp12_x3_boundary.py engines/tests/test_tp12_nautilus_agents_rules.py scripts/tests/test_tp12_evaluation.py -v --junitxml=docs/audit/evidence/core-x3-local-20261026/attempt-03/tp12-python.xml` | 0 | PASS（本命令范围） |
| consumer | `pnpm exec vitest run apps/terminal/tests/x3-provider-consumer.test.ts apps/terminal/tests/ui506.test.ts apps/terminal/tests/ui506-provider-consumer.test.ts apps/terminal/tests/ui-p22.test.ts apps/terminal/tests/ui403.test.ts apps/terminal/tests/ui403-provider-consumer.test.ts apps/terminal/tests/fep7-hardening.test.ts apps/terminal/tests/fep5-closure.test.ts --reporter=verbose --reporter=json --outputFile=docs/audit/evidence/core-x3-local-20261026/attempt-03/consumer.json` | 0 | PASS（本命令范围） |
| types | `pnpm --filter @sumalpha/terminal typecheck` | 0 | PASS（本命令范围） |
| lint | `pnpm exec eslint apps/terminal/src/reconciliation/runtime.ts apps/terminal/tests/x3-provider-consumer.test.ts tests/e2e/x3-integration.spec.ts tests/e2e/ui506.spec.ts tests/e2e/fixtures/x3-reference.ts playwright.config.ts playwright.x3.config.ts scripts/core-x3-review.mjs scripts/core-x3-review.test.mjs` | 0 | PASS（本命令范围） |
| rust-lint | `cargo clippy --locked --offline -p bff-gateway --tests --no-deps -- -D warnings` | 0 | PASS（本命令范围） |
| rust-format | `cargo fmt --check -p bff-gateway -p execution-gateway` | 0 | PASS（本命令范围） |
| gate-tests | `node --test scripts/core-x3-review.test.mjs scripts/development-execution.test.mjs scripts/terminal-static-routes.test.mjs` | 0 | PASS（本命令范围） |
| terminal-build | `pnpm --filter @sumalpha/terminal build` | 0 | PASS（本命令范围） |
| x3-browser | `pnpm exec playwright test --config playwright.x3.config.ts --project chromium --output docs/audit/evidence/core-x3-local-20261026/attempt-03/x3-browser --reporter=list,json` | 0 | PASS（本命令范围） |
| reconciliation-browser | `pnpm exec playwright test --config playwright.ui506.config.ts --project chromium --output docs/audit/evidence/core-x3-local-20261026/attempt-03/reconciliation-browser --reporter=list,json` | 0 | PASS（本命令范围） |
| paper-browser | `pnpm exec playwright test --config playwright.x06.config.ts --project chromium --grep 'X06 actual Paper' --output docs/audit/evidence/core-x3-local-20261026/attempt-03/paper-browser --reporter=list,json` | 0 | PASS（本命令范围） |
| plans | `node scripts/check-development-plans.mjs` | 0 | PASS（本命令范围） |
| integration-refusal | `node scripts/development-execution.mjs --integration CORE-GATE:X3` | 1 | 预期 STAGE_NOT_READY 拒绝 |
| next-development | `node scripts/development-execution.mjs --development FRONTEND-GATE:G7` | 0 | PASS（本命令范围） |

当前计数：Rust 64，0 failed/ignored；consumer 114（8 文件），0 failed/pending；Node 94；Python 83 + 2 个通过的子测试（JUnit 85 条记录），0 failed/errors/skipped；Chromium 13，0 failed/skipped/flaky，retries=0、workers=1。

类型、局部 ESLint、当前 BFF 严格 Clippy --no-deps、受影响包格式、当前 Terminal 构建/182 文件摘要、计划/阶段拒绝及只读证据复核通过。自动 axe 5 次：0 violations、5 incomplete。

114 项 consumer 含现有 FEP-5/FEP-7 明确内存/模型断言；它们不证明真实撮合、生产账本或 Beta 准入。原生 trusted constructor/handler、reference Web 身份及独立 seed 的适用范围不互相替代。

未运行：全仓集成、上游递归 Gate、F05/F07/LLVM/三轮独立构建 campaign、完整跨浏览器/人工无障碍、完整 TP07 业务联调后的 TP12 复审、真实 IdP/Supabase/RLS/持久恢复/venue/testnet、10 交易日 Shadow/性能/长稳/远程 CI/发布。

复核：`node scripts/core-x3-review.mjs --verify`；完整原始证据：`node docs/audit/evidence/core-x3-local-20261026/verify.mjs`。两者均不执行 SQL、引擎或外部操作。

补充归档检查：17 个源码/测试/规程文件的 diff --check exit 0；含原始失败输出的暂存包检查 exit 2，仅 attempt-02 两个 error-context.md 与两个 page-state.txt 的 12 处生成空白/制表符尾空格。按原始证据保留要求不改写、不删除，不能将该命令记 PASS；详见 diff-check.json。它不影响 28 组当前功能结果，源码格式检查单独通过。
