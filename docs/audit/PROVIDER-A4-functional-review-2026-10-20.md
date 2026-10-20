# PROVIDER:A4 当前功能汇总复核（2026-10-20）

冻结源码 **1297bc3bdc511195820ea000da064fdd8e16f088**，1053项输入、16/16组当前功能/直接影响检查及7/7个实际入口通过。仅 **A4_SCOPE_LOCAL DEVELOPMENT READY**；完整业务INTEGRATION、RELEASE均NOT_RUN，formalAccepted=false、runtimeAdmission=DENIED，本轮汇总人工确认PENDING。两计划与机器策略已同步；全图仅本检查点1 READY，其余158 NOT_ASSESSED。

修复共享分页的两项当前功能缺陷：Execution和Strategy的后继游标原先以翻页时刻重新计算期限，现继承最初冻结快照的五分钟deadline；执行域原先仅在写入时清理过期游标，达到2000上限后只读用户无法自行恢复，现每次分页读取先清理过期缓存。新增两项真实服务组合回归，分别验证混合/策略独立路径的到期前成功与到期后拒绝、缓存满429与无写入过期恢复。受控时钟只证明期限与恢复语义，不作为容量/性能验收。

沿用当前32操作的生成client与同实例consumer，并在本冻结源码重新运行执行域20项、策略域12项API探针。OpenAPI1.12.0共132操作/110schema与六类生成产物一致；A4边界由固定C05–C09/C13归属、schema/错误和兼容性检查约束，去除旧1.9.0硬编码。当前Gate接入最新FE006/004原回执、实际原确认及本轮预检，仍按原源码/输入/日志/产物/入口hash验证；没有重跑组件或全部上游Gate，也不把组件历史READY改绑当前HEAD。

| 原确认对象 | 原源码 / 技术回执提交 | 本轮处置 |
|---|---|---|
| FE:BFF-FE-006 | aad08dd5 / 2404a7df | 原确认CONFIRMED，当前独立Gate NOT_ASSESSED |
| FE:BFF-FE-004 | 20d65a86 / 787f8230 | 本会话原稿确认CONFIRMED，当前独立Gate NOT_ASSESSED |
| PROVIDER:A3 | 4580bac1 / 93d66ad4 | 原确认CONFIRMED，当前独立Gate NOT_ASSESSED |

FE004用户原话及17项验证见[确认记录](evidence/bff-fe-004-confirmation-20261020/summary.md)，本地提交98f07d50。A4源码/范围/预检冻结提交1297bc3b。两项预检入口退出2如实保留，含义为旧当前Gate不再准入；未计作PASS。新候选只使用function-attempt-01的完整结果。

| 当前验证 | 结果 |
|---|---|
| Rust | 76通过：组合8、Strategy19、Execution20、A2 providers29 |
| Node | 196通过：原确认63、Gate57、policy/CI76 |
| consumer/契约 | 55通过 / 11文件，含同一provider组合与保存恢复 |
| HTTP / Chromium | 2153条当前记录、32操作逐项成功/401/403/schema；两个1000重试campaign、两个基本Chromium通过 |
| 生成与静态 | generated、build、types、lint、Clippy、plans通过 |
| 覆盖率 | 两helper逐文件行与关键分支均100%；实际计数见review-results.json |
| 入口 | development、CI、FE006/004/A3原确认、前置metadata、plans，共7/7通过 |
| 历史保护 | 54,090份原audit/gate文件逐字节保持；原失败与中断不改写 |

下列均为实际命令，完整参数、时间、退出码、日志hash见[逐组结果](evidence/provider-a4-local-20261020/review-results.json)。{attempt}均已替换为独立本轮目录；不执行全仓或三轮独立构建。

| 检查 | 命令 | 结果 |
|---|---|---|
| contract | `node scripts/check-provider-a4-boundary.mjs` | PASS |
| generated | `node scripts/check-bff-generated.mjs` | PASS |
| aggregate | `cargo test --locked --offline -p bff-gateway --lib a4_tests:: -- --test-threads=1` | PASS |
| strategy | `cargo test --locked --offline -p bff-gateway --lib strategy::tests:: -- --test-threads=1` | PASS |
| execution | `cargo test --locked --offline -p bff-gateway --lib execution::tests:: -- --test-threads=1` | PASS |
| a2-boundary | `cargo test --locked --offline -p bff-gateway --test auth_settings_provider --test audit_export_provider` | PASS |
| build | `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | PASS |
| http | `node scripts/test-provider-a4-http.mjs docs/audit/evidence/provider-a4-local-20261020/function-attempt-01/aggregate-http.json` | PASS |
| consumers | `pnpm exec vitest run apps/terminal/tests/a4-aggregate-consumer.test.ts apps/terminal/tests/strategy-provider-consumer.test.ts apps/terminal/tests/strategy-recovery.test.ts apps/terminal/tests/execution-provider-consumer.test.ts apps/terminal/tests/execution-recovery.test.ts packages/api-client/tests/bff-response.test.ts packages/api-client/tests/bff-transport.test.ts packages/api-client/tests/sse-poc.test.ts tests/contract --coverage --coverage.provider=v8 --coverage.include=apps/terminal/src/strategy/gateway.ts --coverage.include=apps/terminal/src/execution/gateway.ts --coverage.reporter=json-summary --coverage.reportsDirectory=docs/audit/evidence/provider-a4-local-20261020/function-attempt-01/consumer-coverage` | PASS |
| types | `pnpm --filter @sumalpha/api-client --filter @sumalpha/terminal typecheck` | PASS |
| lint | `pnpm --filter @sumalpha/api-client --filter @sumalpha/terminal lint` | PASS |
| clippy | `cargo clippy --locked --offline -p bff-gateway --lib -- -D warnings` | PASS |
| confirmation | `node --test scripts/bff-fe-004-confirmation-20261020.test.mjs scripts/bff-fe-006-confirmation-20261019.test.mjs scripts/provider-a3-confirmation.test.mjs scripts/user-acceptance-confirmation.test.mjs` | PASS |
| gate-tests | `node --test scripts/provider-a4-functional-gate.test.mjs` | PASS |
| plan-policy | `node --test scripts/development-plan-order-negative.mjs scripts/ci-stage-disposition.test.mjs` | PASS |
| plans | `node scripts/check-development-plans.mjs` | PASS |

Gate负向用例故意使用不存在的源码对象，原日志中的 `git cat-file` 拒绝诊断属于 fail-closed 预期，57项断言均通过。文档收尾后 `pnpm check:provider-a4:development`、计划检查、三处Rust格式及 `git diff --check` 再核对均退出0，见 `final-checks.json`；未重跑功能或上游闭包。

HTTP状态分布：`{"200": 57, "201": 2, "202": 2009, "204": 2, "401": 34, "403": 35, "404": 2, "409": 9, "422": 3}`。202只表示受理；Order/Fill与Backtest事实由实际journal消费确认，Strategy批准不签发TradeCommand。单次proof跨域拒绝、原键恢复、并发唯一审计根、当前风险/kill/stale拒绝、Shadow无dispatch、host隔离503、最小权限与撤权旧游标拒绝均在当前作用范围回归。分页修改也覆盖Strategy列表/Release和执行分页共用实现，现有各域回归一起运行；没有扩大为全依赖验收。

未决风险：真实Supabase/Auth/MFA/RLS/Storage、跨进程/跨实例持久事务恢复、真实feed/用途许可/密钥与OS隔离、真实部署worker和完整P06-P11/P20页面业务链均NOT_RUN。两个宿主仍为独立可信合成输入的进程内租约，页面Release批准不证明已安装到执行账户。S02/X01 f64、固定USD与非零异币费用拒绝边界保留。G3/G5、目标安全/容量/性能/长稳/部署、同SHA hosted CI及正式发布保留独立验收，目标矩阵专用自动化NOT_IMPLEMENTED。本轮未连接数据库、未创建本地DB、未使用生产凭据、未push或部署。

证据：[manifest](evidence/provider-a4-local-20261020/manifest.json)、[26项控制](evidence/provider-a4-local-20261020/control-matrix.json)、[完整确认稿](evidence/provider-a4-local-20261020/confirmation-draft.md)、[准确变更文件](evidence/provider-a4-local-20261020/changed-files.json)、[历史保护](evidence/provider-a4-local-20261020/history-preservation.json)、[证据索引](evidence/provider-a4-local-20261020/evidence-index.json)。下一可执行：**FE:BFF-FE-009 / A5：Reconciliation与账本API当前功能复核**，继续按实际影响选回归，不递归全部上游。
