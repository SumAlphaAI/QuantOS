# FE:BFF-FE-004 / A4 当前功能交付（2026-10-19）

**BFF004_SCOPE_LOCAL / DEVELOPMENT READY**。冻结源码 `20d65a86efaebccb60abf7cfc896b6a6edd77033`，1032项输入、18/18检查组和5/5本机实际入口PASS。功能实现PASS，完整业务联调/发布NOT_RUN；本任务人工确认PENDING，formalAccepted=false、runtimeAdmission=DENIED。仅修改QuantOS，未使用生产凭据、连接目标数据库、推送、部署或外部发布。

本次核对仓库已有12项C05实现，完成当前候选功能修复与独立验收，没有把原实现重复声称为新增。修复：

1. 原重复送审会重写已有审批的requester、requestedAt、correlationId，导致首次送审事实和timeline不一致；现仅首次创建记录，不同幂等键/不同写入人仍得到同一审批ID，原事实和timeline保持。
2. 原DraftBuffer.saved直接替换本地编辑，迟到回复可能丢失请求发出后的新编辑，也没有拒绝版本回退。现captureSave绑定提交版本/编辑修订；saved验证后继版本及策略对象，仅在没有后续编辑时清理本地副本。迟到回复保留新编辑（包括回退成旧内容的显式编辑），旧响应/旧冲突头不得回退版本。真实generated consumer已使用捕获的提交修订。
3. 旧BFF004契约检查固定1.9.0，误拒绝后续兼容新增；现允许1.x且至少1.9，仍严格验证C05十二项归属/请求/响应、六生成产物和兼容性。当前1.12.0共132操作/110schema，本任务仅对12项授予功能结论。

新manifest与证据位于20261019目录，原20261018 manifest、确认稿、失败/中断及所有原验收保持原字节。两份计划及机器策略同步当前manifest；只发布FE004的阶段READY，其余节点不重授。

用户已在本会话确认FE006的20261019完整稿：[原话/范围账本](./evidence/bff-fe-006-confirmation-20261019/user-confirmation.json)，确认提交e6b00af4；17项确认负向及实际确认门禁CONFIRMED。仅绑定aad08dd5及2404a7df，不改原稿/技术回执。第一版新确认测试退出1的日志保留，改用SHA256内容等值校验后17/17通过；不将原失败虚构为已证实OOM或PASS。FE006当前独立stage保持NOT_ASSESSED。

| 当前验证 | 结果 |
|---|---|
| Rust当前功能/直接回归 | 104 PASS：Strategy19、FE006执行20、S04服务6、A2认证/审计29、Research/Artifact24、共享A4审批6 |
| Node确认/门禁/计划 | 184 PASS：确认59、门禁49、计划/CI负向76 |
| generated consumer/契约 | 54 PASS /10文件 |
| HTTP/schema/权限 |12 API/1068条，每项成功/401/403；1000次同键重试 |
| 基本Chromium |PASS，仅API cookie/草稿冲突/Release投影；全页面NOT_RUN |
| Strategy consumer覆盖 |行19/19、分支46/46、函数18/18，100% |
| 编译/types/lint/clippy/生成 |PASS |
| 本机实际入口 |development、CI阶段处置、FE006原确认、直接前置引用、plans；5/5 PASS |

精确命令、范围理由、时间、退出/信号/超时和日志hash见[manifest](./evidence/bff-fe-004-local-20261019/manifest.json)及[实际逐组执行](./evidence/bff-fe-004-local-20261019/function-attempt-01/execution-results.json)。本机CI阶段处置不是hosted CI通过。

| 检查 | 命令 | 结果 |
|---|---|---|
| contract | `node scripts/check-bff-fe-004-boundary.mjs` | PASS |
| generated | `node scripts/check-bff-generated.mjs` | PASS |
| strategy | `cargo test --locked --offline -p bff-gateway --lib strategy::tests:: -- --test-threads=1` | PASS |
| execution-direct | `cargo test --locked --offline -p bff-gateway --lib execution::tests:: -- --test-threads=1` | PASS |
| core-strategy | `cargo test --locked --offline -p quantos-strategy --test service_s04` | PASS |
| a2-boundary | `cargo test --locked --offline -p bff-gateway --test auth_settings_provider --test audit_export_provider` | PASS |
| a3-boundary | `cargo test --locked --offline -p bff-gateway --lib research -- --test-threads=1` | PASS |
| shared-approvals | `cargo test --locked --offline -p bff-gateway --lib a4_tests:: -- --test-threads=1` | PASS |
| build | `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | PASS |
| http | `node scripts/test-bff-fe-004-http.mjs docs/audit/evidence/bff-fe-004-local-20261019/function-attempt-01/reference-http.json` | PASS |
| consumers | `pnpm exec vitest run apps/terminal/tests/strategy-provider-consumer.test.ts apps/terminal/tests/strategy-recovery.test.ts apps/terminal/tests/execution-provider-consumer.test.ts apps/terminal/tests/execution-recovery.test.ts packages/api-client/tests/bff-response.test.ts packages/api-client/tests/bff-transport.test.ts packages/api-client/tests/sse-poc.test.ts tests/contract --coverage --coverage.provider=v8 --coverage.include=apps/terminal/src/strategy/gateway.ts --coverage.reporter=json-summary --coverage.reportsDirectory=docs/audit/evidence/bff-fe-004-local-20261019/function-attempt-01/consumer-coverage` | PASS |
| types | `pnpm --filter @sumalpha/api-client --filter @sumalpha/terminal typecheck` | PASS |
| lint | `pnpm --filter @sumalpha/api-client --filter @sumalpha/terminal lint` | PASS |
| clippy | `cargo clippy --locked --offline -p bff-gateway --lib -- -D warnings` | PASS |
| confirmation | `node --test scripts/bff-fe-006-confirmation.test.mjs scripts/bff-fe-006-confirmation-20261019.test.mjs scripts/provider-a3-confirmation.test.mjs scripts/user-acceptance-confirmation.test.mjs` | PASS |
| gate-tests | `node --test scripts/bff-fe-004-functional-gate.test.mjs` | PASS |
| plan-policy | `node --test scripts/development-plan-order-negative.mjs scripts/ci-stage-disposition.test.mjs` | PASS |
| plans | `node scripts/check-development-plans.mjs` | PASS |

总入口为`node scripts/record-bff-fe-004-functional.mjs docs/audit/evidence/bff-fe-004-local-20261019/function-attempt-01`，退出0；重放必须使用新attempt，不能覆盖当前证据。日常入口`pnpm check:bff-fe-004:development`严格核验当前输入。18组只含当前功能和有理由的直接回归；没有递归执行前置Gate、全仓、三轮构建或无关性能/长稳测试。首次编译与编译目录锁/可执行文件启动等待如实留在日志，不计作业务性能结果。

**未决风险**：策略/执行host仍为单进程内存租约。真实Supabase/Auth/RLS/Storage/F05持久事务、跨进程/实例崩溃恢复、可信来源/身份/许可撤权、完整P06/P07/G3及A4页面业务链、部署、安全/容量/性能/长稳、候选同SHA hosted CI与发布验收均NOT_RUN，分别归INTEGRATION/RELEASE-GATE:BETA。继承核心回测f64指标限制。rollback只记录请求，不执行部署；当前没有生产或runtime许可。

九个前置均NOT_REVALIDATED/referenceOnly，不借原READY或人工确认重授当前Gate。计划development_status保留IMPLEMENTED_PENDING_ACCEPTANCE；stage_gate只将本任务标为READY。历史文件保持结果见[保留校验](./evidence/bff-fe-004-local-20261019/history-preservation.json)。新[完整确认稿](./evidence/bff-fe-004-local-20261019/confirmation-draft.md)依[统一规程](../gate-records/user-acceptance-confirmation-workflow.md)记录PENDING，未自行批准。

变更文件见[完整清单](./evidence/bff-fe-004-local-20261019/changed-files.json)；结果见[汇总](./evidence/bff-fe-004-local-20261019/review-results.json)、[26项控制矩阵](./evidence/bff-fe-004-local-20261019/control-matrix.json)与[证据索引](./evidence/bff-fe-004-local-20261019/evidence-index.json)。本地确认提交e6b00af4、实现候选20d65a86；最终证据/计划提交另记Git HEAD，未推送。下一可执行任务：PROVIDER:A4 当前功能汇总，按受影响的Strategy/Execution共享边界验证，不把本任务READY视为完整A4、上游或发布通过。
