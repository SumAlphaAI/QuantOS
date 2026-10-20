# PROVIDER:A5 当前功能汇总复核（2026-10-20）

冻结源码 **5fb5b6aa52fbfb604e009d1e818826114ead155a**，1169输入、17/17当前功能与直接相关检查、8/8实际入口PASS。**A5_SCOPE_LOCAL DEVELOPMENT READY**，本次确认PENDING；formalAccepted=false、runtimeAdmission=DENIED，完整INTEGRATION/RELEASE NOT_RUN。两计划与机器门禁已同步，全图仅A5 1 READY/158 NOT_ASSESSED。

本轮更新A5聚合工具为009/008/010/A4的最新原完整稿、原确认和原技术回执，新增当前源码上的组合验证，未发现需进一步修改产品行为的缺陷。OpenAPI边界允许兼容1.x且minor>=12，仍精确核对58操作归属、六类生成物与请求/响应。门禁强制两项新组合测试，伪造重算log hash后遗漏断言仍拒绝。没有递归执行四前置Gate、全仓或三轮独立构建。

同一Shadow provider验证：账本与冻结财务版本不被治理、告警ack或独立observer修复重写；C15 rerun后仍provisional，已有break保持open。report/rerun/governance并发使用同一UUID而各有独立回执和一个F05根；三个生成consumer丢回复后原键恢复服务端事实，撤销成员后已有report/rerun恢复、ticket和两个stream以当前身份拒绝。账本只读，无浏览器改账或关闭差异权限。

两项新增组合测试：时间推进301秒并只更新X06/F09 owner观察，health恢复healthy，旧治理cursor与旧alert stream仍409、旧report ticket仍410；新ticket返回同一冻结文稿，原键report返回同一回执、ledger items不变。共享治理host不确定后，三个域、冻结report/download以及旧幂等恢复均503，F05根数量不增加。这是有效期和quarantine语义验证，不是容量/性能或持久恢复验收。

用户本轮确认C11/C16原稿，原话和17项确认测试保存在[记录](evidence/bff-fe-010-confirmation-20261020/summary.md)，绑定3152db47/4ed64603和1146原输入。四直接前置只验证原Git blob、输入/规范、日志/产物和实际入口hash及原用户确认：FE:BFF-FE-009 007040fd/1e1ca813；FE:BFF-FE-008 b20efc30/5f82e72a；FE:BFF-FE-010 3152db47/4ed64603；PROVIDER:A4 1297bc3b/4085bdef。全部referenceOnly/NOT_REVALIDATED、currentReady NOT_CLAIMED；共享工具变动后BFF010当前独立Gate撤回NOT_ASSESSED，原确认CONFIRMED及原稿/回执字节不变，历史10月18日A5确认也不改绑。

| 当前验证 | 结果 |
|---|---|
| Rust | 84通过：组合7、C15 18、C14 10、C11/C16 20、Auth/audit 29 |
| Node | 218通过：原确认/流程85、Gate 57、policy/CI 76 |
| consumer/契约 | 49通过/10文件；真实生成客户端与同host混合恢复/撤权 |
| HTTP / Chromium | 58API、637条当前HTTP；三个域成功401403/schema、三个100次原键重试、三次基本Chromium |
| 覆盖率 | 三helper合计行68/68、关键分支101/101；逐文件关键分支100% |
| 必要构建/静态 | generated、build、typecheck、lint、Clippy、plans通过 |
| 实际入口 | development、CI disposition、C15/C14/C11-C16/A4原确认、前置metadata、plans共8/8通过；CI disposition为本机执行 |
| 历史保护 | 54,386份原audit/gate逐字节保持，失败/中断不改写 |

全部实际命令、起止/exit/signal/timeout/log hash见[结果](evidence/provider-a5-local-20261020/review-results.json)。仅function-attempt-02完整回执用于当前准入。

| 检查 | 命令 | 结果 |
|---|---|---|
| contract | `node scripts/check-provider-a5-boundary.mjs` | PASS |
| generated | `node scripts/check-bff-generated.mjs` | PASS |
| aggregate | `cargo test --locked --offline -p bff-gateway --lib a5_tests:: -- --test-threads=1` | PASS |
| reconciliation | `cargo test --locked --offline -p bff-gateway --lib reconciliation::tests:: -- --test-threads=1` | PASS |
| performance | `cargo test --locked --offline -p bff-gateway --lib performance::tests:: -- --test-threads=1` | PASS |
| operations | `cargo test --locked --offline -p bff-gateway --lib operations::tests:: -- --test-threads=1` | PASS |
| a2-boundary | `cargo test --locked --offline -p bff-gateway --test auth_settings_provider --test audit_export_provider` | PASS |
| build | `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | PASS |
| http | `node scripts/test-provider-a5-http.mjs docs/audit/evidence/provider-a5-local-20261020/function-attempt-02/aggregate-http.json` | PASS |
| consumers | `pnpm exec vitest run apps/terminal/tests/a5-aggregate-consumer.test.ts apps/terminal/tests/reconciliation-provider-consumer.test.ts apps/terminal/tests/performance-provider-consumer.test.ts apps/terminal/tests/operations-provider-consumer.test.ts packages/api-client/tests/bff-response.test.ts packages/api-client/tests/bff-transport.test.ts packages/api-client/tests/sse-poc.test.ts tests/contract --coverage --coverage.provider=v8 --coverage.include=apps/terminal/src/reconciliation/gateway.ts --coverage.include=apps/terminal/src/performance/gateway.ts --coverage.include=apps/terminal/src/operations/gateway.ts --coverage.reporter=json-summary --coverage.reportsDirectory=docs/audit/evidence/provider-a5-local-20261020/function-attempt-02/consumer-coverage` | PASS |
| types | `pnpm --filter @sumalpha/api-client --filter @sumalpha/terminal typecheck` | PASS |
| lint | `pnpm --filter @sumalpha/api-client --filter @sumalpha/terminal lint` | PASS |
| clippy | `cargo clippy --locked --offline -p bff-gateway --lib -- -D warnings` | PASS |
| confirmation | `node --test scripts/bff-fe-009-confirmation-20261020.test.mjs scripts/bff-fe-008-confirmation-20261020.test.mjs scripts/bff-fe-010-confirmation-20261020.test.mjs scripts/provider-a4-confirmation-20261020.test.mjs scripts/user-acceptance-confirmation.test.mjs` | PASS |
| gate-tests | `node --test scripts/provider-a5-functional-gate.test.mjs` | PASS |
| plan-policy | `node --test scripts/development-plan-order-negative.mjs scripts/ci-stage-disposition.test.mjs` | PASS |
| plans | `node scripts/check-development-plans.mjs` | PASS |

HTTP分布：`{"200": 266, "201": 7, "202": 203, "204": 2, "401": 62, "403": 63, "404": 7, "409": 19, "422": 8}`。三个独立子HTTP执行使用当前58操作及其脚本，逐项校验child源码、bytes、command/exit/time和合并records；子任务旧READY没有用作当前执行结果。同provider业务组合由原生和生成consumer独立验证，三个HTTP host不声称同一运行实例或完整业务联调。26个本次限定控制点见control-matrix.json。

保留失败：[预检清单](evidence/provider-a5-local-20261020/preflight/inventory-attempt-01.json)因git非ASCII路径引用而失败，改用NUL目录清单；[新组合测试首版](evidence/provider-a5-local-20261020/preflight/aggregate-test-attempt-01.json)错误假设种子有多条告警，实际nextCursor=null，改用真实多行governance roles分页后通过。它们不是产品功能失败或当前准入PASS。[正式首轮](evidence/provider-a5-local-20261020/function-attempt-01/disposition.json)8组PASS，HTTP因沙箱禁止127.0.0.1监听EPERM而FAIL，后8组NOT_RUN，未发布READY；保留原日志/结果，不拼接。第二轮同一冻结源码在获授权的本机回环环境独立完成17组和8入口，完整进程退出0后才整理文档。

文档收尾后，使用仓库的credential-stripped/offline环境及缓存pnpm10.20.0执行 `pnpm check:provider-a5:development`、`node scripts/check-development-plans.mjs`、`rustfmt --check --edition 2024 services/bff-gateway/src/a5_tests.rs`、`git diff --check`，四项退出0，见[收尾检查](evidence/provider-a5-local-20261020/final-checks.json)。仅核对当前准入、计划与格式，不扩大功能或上游复验。此前系统pnpm包装器尝试npm registry查询后失败，未执行到功能Gate；[失败命令](evidence/provider-a5-local-20261020/final-unpinned-checks.json)与[原输出](evidence/provider-a5-local-20261020/final-unpinned-development.log)保留，不改为PASS。

未决风险与移交：单账户Paper/Shadow owner注入进程租约，typed治理不写回Supabase/F06；capability仅已验签审核metadata，不安装/发布Engine，Runbook仅inspect。X01固定USD/simple/f64与coverage/provisional上游边界保留，C15与X06/F09独立来源，不声称真实告警自动关闭差异。实际Supabase/Auth/MFA/RLS/私有Storage、F05/outbox持久原子性、治理持久化、跨实例/重启恢复、真实feed/observer/Engine、完整P02/P13/P14/P21/P22/P23 UI/G4/G5/G6/FEP业务链、安全/性能/容量/长稳/部署/同SHA hosted CI和正式发布全部NOT_RUN，目标专用自动化NOT_IMPLEMENTED；runtime DENIED。 资源/回执/cursor/stream上限1000与事件10000仍保留。本轮未使用生产凭据，未连接目标库或建立本地PostgreSQL/Supabase，无venue submit、push、部署或外部发布。

证据：[manifest](evidence/provider-a5-local-20261020/manifest.json)、[完整确认稿](evidence/provider-a5-local-20261020/confirmation-draft.md)、[控制矩阵](evidence/provider-a5-local-20261020/control-matrix.json)、[变更文件](evidence/provider-a5-local-20261020/changed-files.json)、[索引](evidence/provider-a5-local-20261020/evidence-index.json)。下一可执行任务：项目用户确认本稿后 **FE:BFF-FE-002 / A6：Command Center聚合API当前功能复核**，按其直接影响选回归，不扩展上游全闭包。
