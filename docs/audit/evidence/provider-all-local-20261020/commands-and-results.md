# PROVIDER:ALL 命令与实际结果

冻结源码 `a045f15cddf2be6abca36fff003936602ce80985`；本轮 `docs/audit/evidence/provider-all-local-20261020/function-attempt-04`。下列20组属于当前BFF/客户端及G0最小工程冻结，不递归执行上游Gate。

| 检查 | 命令 | 结果 | 原始日志 |
|---|---|---|---|
| contract | `node scripts/check-provider-all-boundary.mjs` | PASS / exit 0 | [contract](function-attempt-04/logs/contract.log) |
| generated | `node scripts/check-bff-generated.mjs` | PASS / exit 0 | [generated](function-attempt-04/logs/generated.log) |
| inventory | `node scripts/pre04-inventory.mjs` | PASS / exit 0 | [inventory](function-attempt-04/logs/inventory.log) |
| g0-minimum | `node scripts/check-bff-fe-000.mjs` | PASS / exit 0 | [g0-minimum](function-attempt-04/logs/g0-minimum.log) |
| g0-records | `node scripts/check-g0-records.mjs` | PASS / exit 0 | [g0-records](function-attempt-04/logs/g0-records.log) |
| pre01 | `node scripts/check-pre01.mjs` | PASS / exit 0 | [pre01](function-attempt-04/logs/pre01.log) |
| freeze-negative | `node --test scripts/tests/check-pre01.test.mjs scripts/frontend-import-boundary.test.mjs scripts/g0-development.test.mjs scripts/bff-fe-000-gate-negative.mjs scripts/bff-remediation-negative.mjs` | PASS / exit 0 | [freeze-negative](function-attempt-04/logs/freeze-negative.log) |
| native | `cargo test --locked --offline -p bff-gateway --lib -- --skip live::f09_live_tests --test-threads=1` | PASS / exit 0 | [native](function-attempt-04/logs/native.log) |
| identity-audit | `cargo test --locked --offline -p bff-gateway --test auth_settings_provider --test audit_export_provider` | PASS / exit 0 | [identity-audit](function-attempt-04/logs/identity-audit.log) |
| build | `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | PASS / exit 0 | [build](function-attempt-04/logs/build.log) |
| http | `node scripts/test-provider-all-http.mjs docs/audit/evidence/provider-all-local-20261020/function-attempt-04/aggregate-http.json` | PASS / exit 0 | [http](function-attempt-04/logs/http.log) |
| consumers | `pnpm exec vitest run apps/terminal/tests/provider-all-aggregate-consumer.test.ts apps/terminal/tests/a2-provider-consumer.test.ts apps/terminal/tests/audit-provider-consumer.test.ts apps/terminal/tests/research-provider-consumer.test.ts apps/terminal/tests/market-provider-consumer.test.ts apps/terminal/tests/execution-provider-consumer.test.ts apps/terminal/tests/strategy-provider-consumer.test.ts apps/terminal/tests/reconciliation-provider-consumer.test.ts apps/terminal/tests/performance-provider-consumer.test.ts apps/terminal/tests/operations-provider-consumer.test.ts apps/terminal/tests/command-provider-consumer.test.ts apps/terminal/tests/browser-platform-provider-consumer.test.ts apps/terminal/tests/a2-aggregate-consumer.test.ts apps/terminal/tests/a3-aggregate-consumer.test.ts apps/terminal/tests/a4-aggregate-consumer.test.ts apps/terminal/tests/a5-aggregate-consumer.test.ts apps/terminal/tests/a6-aggregate-consumer.test.ts apps/terminal/tests/auth-poc.test.ts packages/api-client/tests tests/contract` | PASS / exit 0 | [consumers](function-attempt-04/logs/consumers.log) |
| types | `pnpm --filter @sumalpha/api-client --filter @sumalpha/terminal typecheck` | PASS / exit 0 | [types](function-attempt-04/logs/types.log) |
| lint | `pnpm --filter @sumalpha/api-client --filter @sumalpha/terminal lint` | PASS / exit 0 | [lint](function-attempt-04/logs/lint.log) |
| clippy | `cargo clippy --locked --offline -p bff-gateway --lib -- -D warnings` | PASS / exit 0 | [clippy](function-attempt-04/logs/clippy.log) |
| web-poc | `node scripts/a1-web-poc.mjs` | PASS / exit 0 | [web-poc](function-attempt-04/logs/web-poc.log) |
| confirmation | `node --test scripts/provider-a6-confirmation-20261020.test.mjs scripts/user-acceptance-confirmation.test.mjs` | PASS / exit 0 | [confirmation](function-attempt-04/logs/confirmation.log) |
| gate-tests | `node --test scripts/provider-all-functional-gate.test.mjs` | PASS / exit 0 | [gate-tests](function-attempt-04/logs/gate-tests.log) |
| plan-policy | `node --test scripts/development-plan-order-negative.mjs scripts/ci-stage-disposition.test.mjs` | PASS / exit 0 | [plan-policy](function-attempt-04/logs/plan-policy.log) |
| plans | `node scripts/check-development-plans.mjs` | PASS / exit 0 | [plans](function-attempt-04/logs/plans.log) |

## 实际入口

| 入口 | 命令 | 实际/期望 exit | 状态 |
|---|---|---|---|
| engineering | `node scripts/provider-all-development.mjs --engineering` | 0 / 0 | PASS |
| ci | `node scripts/ci-stage-disposition.mjs PROVIDER:ALL` | 0 / 0 | PASS |
| strict-refusal | `node scripts/provider-all-development.mjs --ready` | 2 / 2 | EXPECTED_REFUSAL |
| a6-confirmation | `node scripts/provider-a6-confirmation-20261020.mjs` | 0 / 0 | PASS |
| plans | `node scripts/check-development-plans.mjs` | 0 / 0 | PASS |

严格入口exit2是G0待确认的预期拒绝，不能记作READY通过。F09真实目标数据库测试显式skip，数据库验收NOT_RUN。首轮cea64f2c在PRE01真实失败；第二轮e4616a57在HTTP来源校验失败（Research旧probe没有内嵌SHA），均保留failure/log。修复父执行来源绑定后本轮使用新源码独立运行，不拼接旧轮PASS。
