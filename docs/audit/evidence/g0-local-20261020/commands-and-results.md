# G0 当前功能命令与结果

冻结源码 `e443495217797c8fe8428620f5177efcf876cf69`；1601 个输入；16 组全部 exit0。Node 346（负向157、确认34、新门禁68、计划CI87）；consumer 117/12文件；Chromium Web/mock OIDC 11例；单次 Terminal build。types/lint/生成/最小契约/Proto/Linux 基线检查通过。静态 JS 预算不是性能验收。

| 组 | 命令 | 结果 | 原始日志 |
|---|---|---|---|
| ledger | `node scripts/g0-current-ledger.mjs` | PASS / 0 | [log](./function-attempt-01/logs/ledger.log) |
| records | `node scripts/check-g0-records.mjs` | PASS / 0 | [log](./function-attempt-01/logs/records.log) |
| minimum | `node scripts/check-bff-fe-000.mjs` | PASS / 0 | [log](./function-attempt-01/logs/minimum.log) |
| pre01 | `node scripts/check-pre01.mjs` | PASS / 0 | [log](./function-attempt-01/logs/pre01.log) |
| generated | `node scripts/check-bff-generated.mjs` | PASS / 0 | [log](./function-attempt-01/logs/generated.log) |
| proto | `node scripts/a1-proto-boundary.mjs` | PASS / 0 | [log](./function-attempt-01/logs/proto.log) |
| negative | `node --test scripts/tests/check-pre01.test.mjs scripts/frontend-import-boundary.test.mjs scripts/g0-development.test.mjs scripts/bff-fe-000-gate-negative.mjs scripts/bff-remediation-negative.mjs scripts/tests/check-proto-config.test.mjs scripts/tests/check-json-schemas.test.mjs` | PASS / 0 | [log](./function-attempt-01/logs/negative.log) |
| consumers | `pnpm exec vitest run apps/terminal/tests/auth-poc.test.ts packages/api-client/tests tests/contract` | PASS / 0 | [log](./function-attempt-01/logs/consumers.log) |
| types | `pnpm --filter @sumalpha/api-client --filter @sumalpha/terminal --filter @sumalpha/website typecheck` | PASS / 0 | [log](./function-attempt-01/logs/types.log) |
| lint | `pnpm --filter @sumalpha/api-client --filter @sumalpha/terminal --filter @sumalpha/website lint` | PASS / 0 | [log](./function-attempt-01/logs/lint.log) |
| web-poc | `node scripts/a1-web-poc.mjs` | PASS / 0 | [log](./function-attempt-01/logs/web-poc.log) |
| linux-baselines | `node scripts/check-visual-baselines.mjs --platform linux` | PASS / 0 | [log](./function-attempt-01/logs/linux-baselines.log) |
| confirmation | `node --test scripts/provider-all-confirmation-20261020.test.mjs scripts/user-acceptance-confirmation.test.mjs` | PASS / 0 | [log](./function-attempt-01/logs/confirmation.log) |
| gate-tests | `node --test scripts/g0-current-functional-gate.test.mjs` | PASS / 0 | [log](./function-attempt-01/logs/gate-tests.log) |
| plan-policy | `node --test scripts/development-plan-order-negative.mjs scripts/ci-stage-disposition.test.mjs` | PASS / 0 | [log](./function-attempt-01/logs/plan-policy.log) |
| plans | `node scripts/check-development-plans.mjs` | PASS / 0 | [log](./function-attempt-01/logs/plans.log) |

| 实际入口 | 命令 | 实际/预期exit | 处置 | 原始日志 |
|---|---|---|---|---|
| g0-engineering | `node scripts/g0-development.mjs --engineering` | 0 / 0 | PASS | [log](./function-attempt-01/entrypoints/g0-engineering.log) |
| g0-ready | `node scripts/g0-development.mjs --ready` | 1 / 1 | EXPECTED_REFUSAL | [log](./function-attempt-01/entrypoints/g0-ready.log) |
| all-engineering | `node scripts/provider-all-development.mjs --engineering` | 0 / 0 | PASS | [log](./function-attempt-01/entrypoints/all-engineering.log) |
| all-ready | `node scripts/provider-all-development.mjs --ready` | 2 / 2 | EXPECTED_REFUSAL | [log](./function-attempt-01/entrypoints/all-ready.log) |
| g0-ci | `node scripts/ci-stage-disposition.mjs FRONTEND-GATE:G0` | 0 / 0 | PASS | [log](./function-attempt-01/entrypoints/g0-ci.log) |
| all-ci | `node scripts/ci-stage-disposition.mjs PROVIDER:ALL` | 0 / 0 | PASS | [log](./function-attempt-01/entrypoints/all-ci.log) |
| all-confirmation | `node scripts/provider-all-confirmation-20261020.mjs` | 0 / 0 | PASS | [log](./function-attempt-01/entrypoints/all-confirmation.log) |
| plans | `node scripts/check-development-plans.mjs` | 0 / 0 | PASS | [log](./function-attempt-01/entrypoints/plans.log) |

工程/CI/原ALL确认/计划通过；两个严格READY拒绝均按实际阻塞原因校验。EXPECTED_REFUSAL不代表READY。Proto离线4步骤，baseline46492dea；remote codegen/full F03 NOT_RUN。原134操作/240 Rust/3015 HTTP只保留原源码引用，本轮没有执行，不计入本轮测试。开发期两项夹具失败原日志见[preflight](./preflight/policy-negative-development-failure.log)，修复后重新执行冻结候选全部16组。
