# 冻结候选实际命令

候选：`921a125c48e0f493c4f15fb12b7ac03b4e625eba`。逐命令起止时间、退出/信号、日志hash见[executions](attempt-01/executions.json)。`integration-refusal`的退出1是预期拒绝，无失败转PASS。

| 检查 | 实际命令 | 退出 | 日志 |
| --- | --- | --- | --- |
| manager-unit | `cargo test --locked --offline -p quantos-engine-manager --lib` | 0 | [原始日志](attempt-01/manager-unit.log) |
| manager-negative | `cargo test --locked --offline -p quantos-engine-manager --test manager_negative` | 0 | [原始日志](attempt-01/manager-negative.log) |
| manager-idempotency | `cargo test --locked --offline -p quantos-engine-manager --test python_mock_engine duplicate_key_returns_same_result_and_changed_input_is_rejected` | 0 | [原始日志](attempt-01/manager-idempotency.log) |
| manager-engines | `cargo test --locked --offline -p quantos-engine-manager --test python_rd_agent --test python_llmquant --test python_trading_agents --test python_vibe_adapter --test python_strategy_lab` | 0 | [原始日志](attempt-01/manager-engines.log) |
| runtime-signal | `cargo test --locked --offline -p quantos-runtime --lib signal_proposal::` | 0 | [原始日志](attempt-01/runtime-signal.log) |
| runtime-contract | `cargo test --locked --offline -p quantos-runtime --test signal_proposal_contracts` | 0 | [原始日志](attempt-01/runtime-contract.log) |
| runtime-lineage | `cargo test --locked --offline -p quantos-runtime --test signal_proposal_orchestration r04_consumes_r03_artifact_with_bound_provenance_and_rejects_invalid_references` | 0 | [原始日志](attempt-01/runtime-lineage.log) |
| runtime-research | `cargo test --locked --offline -p quantos-runtime --test research_orchestration` | 0 | [原始日志](attempt-01/runtime-research.log) |
| python-contract | `engines/.venv/bin/python -m pytest engines/tests/test_rd_agent_contract.py engines/tests/test_rd_agent_development.py engines/tests/test_llmquant_contract.py engines/tests/test_llmquant_development.py engines/tests/test_trading_agents_contract.py engines/tests/test_trading_agents_development.py -v --junitxml=docs/audit/evidence/core-r1-local-20261026/attempt-01/native-python.xml` | 0 | [原始日志](attempt-01/python-contract.log) |
| python-adapter | `engines/.venv/bin/python -m pytest -p test_vibe_adapter_skeleton engines/tests/test_vibe_adapter_contract.py engines/tests/test_vibe_adapter_skeleton.py engines/tests/test_vibe_adapter_absorption.py engines/tests/test_vibe_adapter_research_artifact.py -vv --junitxml=docs/audit/evidence/core-r1-local-20261026/attempt-01/adapter-python.xml` | 0 | [原始日志](attempt-01/python-adapter.log) |
| host-build | `cargo test --locked --offline -p bff-gateway --lib --no-run --message-format=json` | 0 | [原始日志](attempt-01/host-build.log) |
| gate-tests | `node --test scripts/core-r1-review.test.mjs scripts/development-execution.test.mjs` | 0 | [原始日志](attempt-01/gate-tests.log) |
| lint | `pnpm exec eslint scripts/core-r1-review.mjs scripts/core-r1-review.test.mjs tests/e2e/fixtures/u01-reference.ts tests/e2e/r1-integration.spec.ts playwright.r1.config.ts` | 0 | [原始日志](attempt-01/lint.log) |
| rust-format | `cargo fmt --check -p quantos-engine-manager -p quantos-runtime -p bff-gateway` | 0 | [原始日志](attempt-01/rust-format.log) |
| plans | `node scripts/check-development-plans.mjs` | 0 | [原始日志](attempt-01/plans.log) |
| r1-browser | `pnpm exec playwright test --config playwright.r1.config.ts --project chromium --output docs/audit/evidence/core-r1-local-20261026/attempt-01/r1-browser --reporter=list,json` | 0 | [原始日志](attempt-01/r1-browser.log) |
| u01-browser | `pnpm exec playwright test --config playwright.u01.config.ts --project chromium --output docs/audit/evidence/core-r1-local-20261026/attempt-01/u01-browser --reporter=list,json` | 0 | [原始日志](attempt-01/u01-browser.log) |
| integration-refusal | `node scripts/development-execution.mjs --integration CORE-GATE:R1` | 1 | [原始日志](attempt-01/integration-refusal.log) |
| next-development | `node scripts/development-execution.mjs --development CORE:S04` | 0 | [原始日志](attempt-01/next-development.log) |

两个Manager本地持久重建的补充精确命令、源码与日志hash见[supplement](supplement-01/executions.json)，不属于目标数据库或整条研究业务重启验收。
