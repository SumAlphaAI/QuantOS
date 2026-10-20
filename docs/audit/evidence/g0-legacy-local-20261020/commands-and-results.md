# G0 legacy 当前功能命令与结果

冻结源码 `4fdc67b41b1cf30215ca96a0ac2fe97d6729dc83`，1652个输入。入口：`node scripts/record-g0-legacy-functional.mjs docs/audit/evidence/g0-legacy-local-20261020/function-attempt-02`。16组全部通过；Node 323（177负向/59新门禁/87计划CI）；consumer177 PASS、3 SKIPPED、23文件；29项原拥有域场景与6项adapter用例包含其中；Web/mock OIDC11例；API client和Terminal各一次构建。

| 组 | 实际命令 | 结果 | 原始日志 |
|---|---|---|---|
| types | `pnpm --filter @sumalpha/api-client --filter @sumalpha/domain-ui --filter @sumalpha/terminal --filter @sumalpha/website typecheck` | PASS / 0 | [log](./function-attempt-02/logs/types.log) |
| lint | `pnpm --filter @sumalpha/api-client --filter @sumalpha/domain-ui --filter @sumalpha/terminal --filter @sumalpha/website lint` | PASS / 0 | [log](./function-attempt-02/logs/lint.log) |
| api-build | `pnpm --filter @sumalpha/api-client build` | PASS / 0 | [log](./function-attempt-02/logs/api-build.log) |
| removal | `node scripts/legacy-backend-boundary.mjs --artifacts` | PASS / 0 | [log](./function-attempt-02/logs/removal.log) |
| generated | `node scripts/check-bff-generated.mjs` | PASS / 0 | [log](./function-attempt-02/logs/generated.log) |
| consumers | `pnpm exec vitest run apps/terminal/tests/u01-scenarios.test.ts apps/terminal/tests/s04-scenarios.test.ts apps/terminal/tests/x06-scenarios.test.ts apps/terminal/tests/l03-scenarios.test.ts apps/terminal/tests/generated-scenario-adapters.test.ts apps/terminal/tests/auth-poc.test.ts packages/api-client/tests packages/domain-ui/tests tests/contract` | PASS / 0 | [log](./function-attempt-02/logs/consumers.log) |
| negative | `node --test scripts/legacy-backend-boundary.test.mjs scripts/frontend-import-boundary.test.mjs scripts/g0-current-functional-gate.test.mjs scripts/g0-development.test.mjs scripts/user-acceptance-confirmation.test.mjs` | PASS / 0 | [log](./function-attempt-02/logs/negative.log) |
| web-poc | `node scripts/a1-web-poc.mjs` | PASS / 0 | [log](./function-attempt-02/logs/web-poc.log) |
| original-g0 | `node scripts/g0-confirmation-20261020.mjs` | PASS / 0 | [log](./function-attempt-02/logs/original-g0.log) |
| original-all | `node scripts/provider-all-confirmation-20261020.mjs` | PASS / 0 | [log](./function-attempt-02/logs/original-all.log) |
| gate-tests | `node --test scripts/g0-legacy-functional-gate.test.mjs` | PASS / 0 | [log](./function-attempt-02/logs/gate-tests.log) |
| plan-policy | `node --test scripts/development-plan-order-negative.mjs scripts/ci-stage-disposition.test.mjs` | PASS / 0 | [log](./function-attempt-02/logs/plan-policy.log) |
| records | `node scripts/check-g0-records.mjs` | PASS / 0 | [log](./function-attempt-02/logs/records.log) |
| minimum | `node scripts/check-bff-fe-000.mjs` | PASS / 0 | [log](./function-attempt-02/logs/minimum.log) |
| pre01 | `node scripts/check-pre01.mjs` | PASS / 0 | [log](./function-attempt-02/logs/pre01.log) |
| plans | `node scripts/check-development-plans.mjs` | PASS / 0 | [log](./function-attempt-02/logs/plans.log) |

| 实际入口 | 命令 | 实际/预期exit | 处置 | 日志 |
|---|---|---|---|---|
| g0-engineering | `node scripts/g0-development.mjs --engineering` | 0 / 0 | PASS | [log](./function-attempt-02/entrypoints/g0-engineering.log) |
| g0-ready | `node scripts/g0-development.mjs --ready` | 1 / 1 | EXPECTED_REFUSAL | [log](./function-attempt-02/entrypoints/g0-ready.log) |
| all-engineering | `node scripts/provider-all-development.mjs --engineering` | 0 / 0 | PASS | [log](./function-attempt-02/entrypoints/all-engineering.log) |
| all-ready | `node scripts/provider-all-development.mjs --ready` | 2 / 2 | EXPECTED_REFUSAL | [log](./function-attempt-02/entrypoints/all-ready.log) |
| g0-ci | `node scripts/ci-stage-disposition.mjs FRONTEND-GATE:G0` | 0 / 0 | PASS | [log](./function-attempt-02/entrypoints/g0-ci.log) |
| all-ci | `node scripts/ci-stage-disposition.mjs PROVIDER:ALL` | 0 / 0 | PASS | [log](./function-attempt-02/entrypoints/all-ci.log) |
| all-confirmation | `node scripts/provider-all-confirmation-20261020.mjs` | 0 / 0 | PASS | [log](./function-attempt-02/entrypoints/all-confirmation.log) |
| plans | `node scripts/check-development-plans.mjs` | 0 / 0 | PASS | [log](./function-attempt-02/entrypoints/plans.log) |

两个严格READY出口均因G0_CURRENT_SCOPE_CONFIRMATION_PENDING预期拒绝，不能记作READY。三个skip为domain-ui TP03/TP04/TP05测试中依赖QUANTOS_TP03_UI_PROBE/TP04_UI_PROBE/TP05_UI_PROBE的外部Engine响应桥，不在legacy移除直接回归范围；未启用、不记PASS。基础UI取消用例实际通过。完整平台视觉、Proto/原生服务/134 API重跑不执行，历史原范围引用不改绑；真实目标环境NOT_RUN。

首轮1833d223在removal编译产物检查真实FAIL，TypeScript保留注释触发过严正则；实际JS为注释及空export。改为AST仅允许空导出，增加注释/运行时/缺产物拒绝例后在上述新候选完整独立执行16组。[失败原件](./function-attempt-01/failure.json)与全部开发期失败日志保留，不拼接首轮局部PASS。
