# FEP-5 交付记录

最终源码：`654326559622c5c20653fbf3de1a13637666bcbe`；验证 attempt-03。本地 main 开发，无生产凭据、数据库连接、推送、部署或外部发布。

实现：交易 correlation/对象类型/Command 引用及 C01 权限快照绑定；同版本 Proposal 流不允许换链；小屏风险/签署/交易提交/撤单与恢复入口关闭，异步写入前再次核查；unknown 原 key/body 恢复，小屏不再误报过期。后端源码及契约未改。完整变更见 changed-files.txt；11 个产品文件见 repository-scope.json。

当前通过：216 unit/actual-BFF-consumer（含 13 新绑定/移动端模型、5 实际组合），28 execution、18 reconciliation、2 OMS、33 Chromium、99 gate/route/policy。generated、typecheck、eslint、Terminal build、client-secret scan、plan checks 通过。10 次 axe 扫描 violations=0，8 次 color-contrast incomplete 保留；不宣称人工关闭或全量可访问性通过。

七类结果见 seven-outcomes.json。Paper 风险→独立 MFA/reauth→Approval→Command→Order/撤单→当前 Audit 完整链；HTTP 原请求额外重放 1,000 次只对应同一订单。reference Fill=0，部分成交仅实际 OMS 直接测试验证。Shadow rerun→不可改账本→同 Run/sourceHash Performance→Audit 独立通过，不拼接为 Paper 来源。

工程 Gate：`PASS_FEP5_FRONTEND_FUNCTION_CLOSURE` / `COMPLETED_FRONTEND_SCOPE`；计划 FEP-5 development_status=COMPLETED 仅该范围。正式 stage_gate=NOT_ASSESSED，G5/FEP-5=NOT_READY_GAPS_OPEN，formalAccepted=false，runtimeAdmission=DENIED。FEP5/G5/I5 INTEGRATION exit1/STAGE_NOT_READY 是预期拒绝；未批准正式验收。

未决：C09 Paper→C15 Shadow 同源正向接续、C15→C16 对账告警真实源正向接续 NOT_RUN_INTEGRATION，已加入 followups，均非 UI-402 开发前置。真实 IdP/cookie/CORS、Supabase/RLS/事务/Storage、真实 venue/成交、跨会话持久恢复、同 SHA 远程 CI、≤5 分钟重建 SLA、性能/容量/长稳、其他浏览器/读屏/原生缩放/发布均 NOT_RUN。

历史：31 项直接依赖、14 个页面包仅 ORIGINAL_SCOPE_ONLY。原历史证据未修改；attempt-01 验证器失败、attempt-02 旧范围 PASS 与全部开发失败逐字保留，不能重绑定最终源码。attempt-02 receipt/result 原字节副本位于本目录根，详见 development/README.md。OpenSSL 3 删除导致旧测试二进制启动失败；离线重建链接本机现有库后验证，二进制 hash 单独记录。

本地提交：`2ab09e8f` 功能；`c9c4741d` 回执索引修复；`65432655` 小屏恢复提示修复/冻结候选。随后证据封存提交由 Git 记录，避免自引用 SHA。

下一可执行开发任务：`FE:UI-402`（I7 OHLCV/K线、指标、订单/成交标记），其 development 入口 exit0；不表示其 INTEGRATION 已获准。

## 实际执行命令

所有命令的完整路径、时间、退出码与日志 SHA 在 attempt-03/executions.json；失败日志不删除。

| 检查 | 命令 | 实际/预期 exit |
| --- | --- | --- |
| development | `node scripts/development-execution.mjs --development FE:FEP-5` | 0/0 |
| binary | `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | 0/0 |
| unit-consumer | `pnpm exec vitest run apps/terminal/tests/fep5-closure.test.ts apps/terminal/tests/fep5-provider-consumer.test.ts apps/terminal/tests/ui502.test.ts apps/terminal/tests/ui503.test.ts apps/terminal/tests/ui504.test.ts apps/terminal/tests/ui505.test.ts apps/terminal/tests/ui-p20.test.ts apps/terminal/tests/ui-p20-provider-consumer.test.ts apps/terminal/tests/ui-p10.test.ts apps/terminal/tests/ui504-provider-consumer.test.ts apps/terminal/tests/g1-route-access.test.ts --reporter=json --outputFile=docs/audit/evidence/fep5-function-local-20261024/attempt-03/unit.json` | 0/0 |
| execution-native | `cargo test --locked --offline -p bff-gateway --lib execution::tests::` | 0/0 |
| reconciliation-native | `cargo test --locked --offline -p bff-gateway --lib reconciliation::tests::` | 0/0 |
| oms-partials | `cargo test --locked --offline -p quantos-execution --lib tp07_partial_fills_accumulate_decimal_quantity_and_weighted_price_once` | 0/0 |
| oms-rejection | `cargo test --locked --offline -p quantos-execution --lib tp07_rejection_reason_and_event_expiry_are_checked_projection_facts` | 0/0 |
| generated | `pnpm exec node scripts/check-bff-generated.mjs` | 0/0 |
| types | `pnpm --filter @sumalpha/terminal typecheck` | 0/0 |
| lint | `pnpm exec eslint apps/terminal/app/approvals/workspace.tsx apps/terminal/app/orders/workspace.tsx apps/terminal/app/proposals/workspace.tsx apps/terminal/app/trade/workspace.tsx apps/terminal/src/auth/desktop-operations.ts apps/terminal/src/approvals/runtime.ts apps/terminal/src/orders/policy.ts apps/terminal/src/orders/runtime.ts apps/terminal/src/proposals/policy.ts apps/terminal/src/proposals/runtime.ts apps/terminal/src/trade/p20-runtime.ts apps/terminal/tests/fep5-closure.test.ts apps/terminal/tests/fep5-provider-consumer.test.ts apps/terminal/tests/ui502.test.ts apps/terminal/tests/ui503.test.ts apps/terminal/tests/ui504.test.ts apps/terminal/tests/ui505.test.ts apps/terminal/tests/ui-p20.test.ts apps/terminal/tests/ui-p20-provider-consumer.test.ts apps/terminal/tests/ui-p10.test.ts apps/terminal/tests/ui504-provider-consumer.test.ts apps/terminal/tests/g1-route-access.test.ts apps/terminal/tests/helpers/fep5-reference.ts tests/e2e/fep5-function.spec.ts tests/e2e/fixtures/fep5-reference.ts playwright.fep5-function.config.ts tests/e2e/ui-p10.spec.ts tests/e2e/fixtures/ui-p10-reference.ts tests/e2e/ui-p20.spec.ts tests/e2e/fixtures/ui-p20-reference.ts playwright.config.ts scripts/fep5-function-review.mjs scripts/fep5-function-review.test.mjs` | 0/0 |
| gate-tests | `node --test scripts/fep5-function-review.test.mjs scripts/development-execution.test.mjs scripts/development-plan-order-negative.mjs scripts/terminal-static-routes.test.mjs scripts/serve-static.test.mjs` | 0/0 |
| terminal-build | `pnpm --filter @sumalpha/terminal build` | 0/0 |
| browser | `pnpm exec playwright test --config=playwright.fep5-function.config.ts --project=chromium --workers=1 --retries=0 --reporter=list,json --output=docs/audit/evidence/fep5-function-local-20261024/attempt-03/browser` | 0/0 |
| plans | `node scripts/check-development-plans.mjs` | 0/0 |
| fep5-refusal | `node scripts/development-execution.mjs --integration FE:FEP-5` | 1/1 |
| g5-refusal | `node scripts/development-execution.mjs --integration FRONTEND-GATE:G5` | 1/1 |
| i5-refusal | `node scripts/development-execution.mjs --integration FRONTEND-WINDOW:I5` | 1/1 |
| next-development | `node scripts/development-execution.mjs --development FE:UI-402` | 0/0 |

复核：`node scripts/fep5-function-review.mjs --verify`。结果及 hash 封存见 result.json、delivery-manifest.json；用户确认文稿见 confirmation-draft.md，状态 PENDING。

原始 diff-check exit 2 输出保留在 whitespace-original.log；仅为 6 个原始文件及该原始日志添加精确 .gitattributes 例外，未改写日志/错误上下文原字节，未放宽源码检查。
