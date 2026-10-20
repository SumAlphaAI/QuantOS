# 当前确认收口命令与结果

基线4154d760，冻结工程源码 `4fdc67b41b1cf30215ca96a0ac2fe97d6729dc83`；本轮没有修改生产代码、测试源码、契约、门禁脚本或规范工程输入。

| 命令 | 实际结果 |
|---|---|
| `node docs/audit/evidence/g0-legacy-confirmation-20261020/precheck.mjs` | PASS：1652输入/规范摘要EXACT_MATCH，原证据索引80文件哈希、原稿/不可变回执Git字节一致 |
| `python3 docs/audit/evidence/g0-legacy-confirmation-20261020/record-confirmation.py` | 实际USER_MESSAGE原文、时间、原稿SHA、范围SHA及唯一ProjectUser确认保存 |
| `pnpm finalize:g0-development` | exit0；G0与ALL DEVELOPMENT READY，8实际入口均exit0 |
| `node docs/audit/evidence/g0-legacy-confirmation-20261020/run-regression.mjs` | 176/176 PASS，0 failed/skip；确认、移除边界、原子发布、计划/CI直接回归 |
| `node docs/audit/evidence/g0-legacy-confirmation-20261020/verify-closure.mjs` | PASS：仅七类确认字段变化，工程inputs/checks/source/artifacts未改；原pending/旧日志保留 |
| `node scripts/check-development-plans.mjs` | PASS；最终2 READY / 157 NOT_ASSESSED / 0 BLOCKED，见plans.log |
| `node scripts/check-g0-records.mjs` | PASS；历史正式G0 NOT_STARTED与十项签署/逾期记录不改，见records.log |

实际入口由finalize真正执行，日志保存在原attempt内的新confirmed-entrypoints目录，原entrypoints拒绝原件未覆盖：

| 入口 | 命令 | exit | 原始日志 |
|---|---|---|---|
| g0-engineering | `node scripts/g0-development.mjs --engineering` | 0 | [log](../../../../docs/audit/evidence/g0-legacy-local-20261020/function-attempt-02/confirmed-entrypoints-5d9978fdc4df/g0-engineering.log) |
| g0-ready | `node scripts/g0-development.mjs --ready` | 0 | [log](../../../../docs/audit/evidence/g0-legacy-local-20261020/function-attempt-02/confirmed-entrypoints-5d9978fdc4df/g0-ready.log) |
| all-engineering | `node scripts/provider-all-development.mjs --engineering` | 0 | [log](../../../../docs/audit/evidence/g0-legacy-local-20261020/function-attempt-02/confirmed-entrypoints-5d9978fdc4df/all-engineering.log) |
| all-ready | `node scripts/provider-all-development.mjs --ready` | 0 | [log](../../../../docs/audit/evidence/g0-legacy-local-20261020/function-attempt-02/confirmed-entrypoints-5d9978fdc4df/all-ready.log) |
| g0-ci | `node scripts/ci-stage-disposition.mjs FRONTEND-GATE:G0` | 0 | [log](../../../../docs/audit/evidence/g0-legacy-local-20261020/function-attempt-02/confirmed-entrypoints-5d9978fdc4df/g0-ci.log) |
| all-ci | `node scripts/ci-stage-disposition.mjs PROVIDER:ALL` | 0 | [log](../../../../docs/audit/evidence/g0-legacy-local-20261020/function-attempt-02/confirmed-entrypoints-5d9978fdc4df/all-ci.log) |
| all-confirmation | `node scripts/provider-all-confirmation-20261020.mjs` | 0 | [log](../../../../docs/audit/evidence/g0-legacy-local-20261020/function-attempt-02/confirmed-entrypoints-5d9978fdc4df/all-confirmation.log) |
| plans | `node scripts/check-development-plans.mjs` | 0 | [log](../../../../docs/audit/evidence/g0-legacy-local-20261020/function-attempt-02/confirmed-entrypoints-5d9978fdc4df/plans.log) |

新source/head接受未宣称；READY只限已确认冻结功能范围，runtime DENIED、formalAccepted=false。176是本轮新执行测试；原323 Node/177consumer/3skip/11浏览器仅按原范围核验证据，不计本轮新执行。未重跑134 API、原生服务、全仓/依赖链/三次构建；数据库/外部服务/部署/发布均NOT_RUN。
