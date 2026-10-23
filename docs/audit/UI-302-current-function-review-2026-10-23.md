# UI-302 当前功能审阅（2026-10-23）

UI-302静态检查、回测队列与报告限定工程Gate：**PASS_UI302_REFERENCE_FUNCTION**。应用候选 `3f7f37cd1acb20f97962fd9fefcac212eb021eed`；工具修复 `c61e1dc1e94d05888688bb9e264eb1705290bf81`；确认PENDING。main本地开发，仅QuantOS修改，无生产凭据、数据库、推送或发布。

## 变更与功能

- Lab接入实际C05静态检查与回测创建。保存head、资源、版本哈希与snapshot绑定；普通202不显示通过；编辑后失效。未知写入显式重试原幂等键；C01预检失败仍保留未知意图。
- 本会话回测队列最多25项，读取已有UUID报告；C05无全局列表/取消端点，页面明确范围，刷新只读。
- `/backtests/:runId`报告、指标原字符串、固定clock/cost/slippage/environment/input/report hash、泄漏与Release拒绝；GET事实+有界SSE gap恢复、重复撤权、帧/事件/idle/retry边界。Release创建UI-303与高保真UI-P07待后续。
- C05 provider添加server-owned静态检查资源绑定、executionInputs.costModel及Artifact同源返回；核心生产计算算法未改变（只加费用/滑点哈希专项测试）。
- 路由白名单、测试、规程、计划和机器核验器同步。完整文件表见[changed-files.json](./evidence/ui302-local-20261023/changed-files.json)。UI-P06确认提交0dd09474保存用户原文及摘要，绑定f2854052/0d998c4e，未修改原稿和旧证据。

## 验证

89前端（UI302 34、UI301 34、恢复4、P06 17）；19门禁/路由；20C05；3核心专项（100泄漏/前视拒绝样例、候选/时钟/报告哈希绑定、费用/滑点environment hash绑定）；11Chromium；14axe扫描零violations，12条incomplete扫描记录保留。原P06 18、先前UI301回归12及原UI301 8分别保留，未去重为缺陷数。必要types/lint/format、一次Rust与Terminal构建、client-secret检查通过。

| 检查 | 命令 | 结果 / 来源 |
| --- | --- | --- |
| development | `node scripts/development-execution.mjs --development FE:UI-302` | exit 0，通过；原attempt-01未变复用 |
| unit | `pnpm exec vitest run apps/terminal/tests/ui302.test.ts apps/terminal/tests/ui301.test.ts apps/terminal/tests/strategy-recovery.test.ts apps/terminal/tests/ui-p06-presentation.test.ts --reporter=json --outputFile=docs/audit/evidence/ui302-local-20261023/attempt-01/unit.json` | exit 0，通过；原attempt-01未变复用 |
| types | `pnpm --filter @sumalpha/terminal typecheck` | exit 0，通过；原attempt-01未变复用 |
| lint | `pnpm exec eslint apps/terminal/app/backtests apps/terminal/app/strategies apps/terminal/src/strategy apps/terminal/tests/ui302.test.ts tests/e2e/ui302.spec.ts tests/e2e/ui301.spec.ts tests/e2e/fixtures/ui301-reference.ts playwright.config.ts playwright.ui302.config.ts scripts/ui302-review.mjs scripts/ui302-review.test.mjs scripts/ui-p06-confirmed-reference.mjs scripts/ui-p06-confirmed-reference.test.mjs scripts/terminal-static-routes.mjs scripts/terminal-static-routes.test.mjs` | exit 0，通过；attempt-03实际重跑 |
| gate-routes | `node --test scripts/ui302-review.test.mjs scripts/ui-p06-confirmed-reference.test.mjs scripts/terminal-static-routes.test.mjs scripts/serve-static.test.mjs` | exit 0，通过；attempt-03实际重跑 |
| format | `rustfmt --check --edition 2024 services/bff-gateway/src/strategy.rs crates/quantos-strategy/src/backtest.rs` | exit 0，通过；原attempt-01未变复用 |
| c05 | `cargo test --locked --offline -p bff-gateway --lib strategy::tests::` | exit 0，通过；原attempt-01未变复用 |
| leakage | `cargo test --locked --offline -p quantos-strategy --lib hundred_lookahead_and_leakage_fixtures_all_fail` | exit 0，通过；原attempt-01未变复用 |
| hash-bindings | `cargo test --locked --offline -p quantos-strategy --lib s02_candidate_parameters_clock_and_report_bytes_are_bound` | exit 0，通过；原attempt-01未变复用 |
| cost-bindings | `cargo test --locked --offline -p quantos-strategy --lib ui302_cost_and_slippage_are_pinned_in_environment` | exit 0，通过；原attempt-01未变复用 |
| binary | `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | exit 0，通过；原attempt-01未变复用 |
| terminal-build | `pnpm --filter @sumalpha/terminal build` | exit 0，通过；原attempt-01未变复用 |
| browser | `pnpm exec playwright test --config=playwright.ui302.config.ts --project=chromium --workers=1 --retries=0 --reporter=list,json --output=docs/audit/evidence/ui302-local-20261023/attempt-03/browser` | exit 0，通过；attempt-03实际重跑 |
| plans | `node scripts/check-development-plans.mjs` | exit 0，通过；原attempt-01未变复用 |
| integration-refusal | `node scripts/development-execution.mjs --integration FE:UI-302` | exit 1（预期拒绝）；原attempt-01未变复用 |
| next-development | `node scripts/development-execution.mjs --development FE:UI-303` | exit 0，通过；原attempt-01未变复用 |


机器复核：`node scripts/ui302-review.mjs --verify`，退出0。原始执行时间、参数、退出码、日志与SHA见[receipt](./evidence/ui302-local-20261023/receipt.json)及[核验摘要](./evidence/ui302-local-20261023/verification.json)。

## 失败与版本绑定

exploratory保留全局pnpm wrapper registry请求失败、最初类型标注/格式诊断、沙箱loopback EPERM、首次计划缺README及9/11浏览器预检；不是候选PASS。冻结attempt-01所有16条命令按预期结束，11项浏览器通过，但读取折叠details的innerText产出空report文件，最终证据核验拒绝。attempt-02门禁工具测试lint失败，保留日志。

最终attempt-03只重跑采集/工具直接影响的lint、门禁/路由和11项浏览器。核验器验证原应用所有非工具输入未变，原命令/日志/构建保持 `3f7f37cd1acb20f97962fd9fefcac212eb021eed`，工具只改三条明确路径并绑定 `c61e1dc1e94d05888688bb9e264eb1705290bf81`。原binary和Terminal构建未重跑，也未冒充新SHA构建。实际reference fixture要求GITHUB_SHA等于当前工具checkout，因此报告candidate.source_commit为 `c61e1dc1e94d05888688bb9e264eb1705290bf81`，image_digest与原binary SHA一致；应用构建source为 `3f7f37cd1acb20f97962fd9fefcac212eb021eed`，不是同SHA发布验收。所有失败保留、未将相邻成功拼成历史READY。

已查看最终桌面/390px报告截图，固定字段/指标/泄漏说明可见，自动无水平溢出；本次是功能页面审阅，未执行P07高保真像素验收。

## 风险、Gate与下一任务

- C05暂缺全局列表/取消与静态检查结果读取端点；未知键仅在页面内存，离开清除并提示，不自动恢复写入。报告扩展字段缺失或核心版本大于JS安全整数时保守拒绝。
- 参考身份cookie及loopback TLS/CORS为显式替代；真实IdP/MFA/CORS、Supabase/RLS/事务/Storage、持久恢复、托管rewrite、Firefox/WebKit、人工读屏/native200%、跨OS、远程CI、性能/容量/长稳、完整FEP-3/G3联调和发布、P07高保真全部NOT_RUN。
- 当前功能实现：IMPLEMENTED_PENDING_ACCEPTANCE；[六维完整待确认文稿](./evidence/ui302-local-20261023/confirmation-draft.md)PENDING。所有159个阶段节点仍NOT_ASSESSED，formalAccepted=false，runtimeAdmission=DENIED；用户确认不替代NOT_RUN。UI302 INTEGRATION执行预期拒绝，UI303 DEVELOPMENT执行允许。
- 下一可执行原计划任务：**UI-303 不可变Release、审批申请与目标选择**。UI-P07待UI303后实施。不推送/发布。
