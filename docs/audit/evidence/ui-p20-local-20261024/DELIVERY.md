# FE:UI-P20 交付报告

Trade Ticket高保真页面已在QuantOS main实现并通过限定本机功能验证。仅修改QuantOS，未使用生产凭据、推送或部署。

基线 `81b1b61d527b57a4bba97b19f3f5475b0d8d29aa`；实现 `50d66e39fbf92e4cfd69f76f480304974beeca19`；最终源码 **cb6965f002b1550e8d16eea81c00225bd1309eb1**。后续证据封存提交不冒充新已构建候选。全量变更changed-files.txt，证据hash见delivery-manifest.json。

## 变更文件与最终行为

- `apps/terminal/app/trade/workspace.tsx`、`workspace.css`：参照P20 v3布局的范围栏、四阶段、三栏订单意图/执行上下文/交易前检查、关联Signal/Release/原始证据与折叠hash、订单摘要、风险和Command二次确认、审批只读状态/独立审批入口、未知结果恢复及独立202/真实Order回执；明暗主题、1440三栏/768两栏/390单栏。长真实UUID和来源说明带来纵向滚动，摘要留在文档流；不宣称像素等同演示图。
- `apps/terminal/src/trade/p20-presentation.ts`：canonical大写服务端标的+可选唯一Proposal UUID路由；拒绝模式/账户/commandRef/数量等URL注入；真实源缺口、未知报价和保守状态映射。
- `apps/terminal/src/trade/p20-runtime.ts`：组合既有Ticket、Proposal和Orders owner；全流程互斥及未知写入锁定。风险申请须三步意图审阅，确认时重拉所有源并与Proposal/preflight绑定；C08授权分页/去重/游标边界、correlation/originator/objectRef唯一匹配审批，不把202 jobId当Approval。pending/rejected/request_info/expired不可提交；command_ready/批准且短时ref有效才进入确认，submitted只读。提交前再次比较原始意图完整内容/对象版本（状态与correlation允许服务端阶段变化），变化拒绝而不采用新内容静默下单；已读取源后锁定选择，换建议/venue需清空新开。
- Command仍只POST服务端commandRef及幂等键/CSRF/Request-ID；风险申请只POSTcontextHash及对象If-Match。客户端不签名、不乐观生成订单/成交。202分开展示；Order由授权correlation+approval溯源查询匹配，不推断通用jobId。现有C09 owner读取实际事实，跳转Order页面查看成交/撤单。
- `apps/terminal/src/trade/runtime.ts`及`tests/ui503.test.ts`：直接受影响的预检流增加EOF UTF8最终校验、未结束帧拒绝和permission_revoked立即失权，新增损坏流/撤权负面测试。既有Ticket owner仍仅非执行intent，不把availableCash=null变为浏览器资金准入。
- `apps/terminal/tests/ui-p20.test.ts`、`ui-p20-provider-consumer.test.ts`：13项路由/缺口/关闭拒绝策略及1项实际C01/C07-C09/C12/C13组合；实际独立MFA审批，风险/Command两次commit后丢响应原键恢复、未知阻断新流程、Command body仅ref、终态与内存清除；显式SYNTHETIC源变更探针同时改变Proposal GET/SSE内容/版本，提交前拒绝且零Command POST。直接回归UI503/502/505策略与消费者、C01，合计151项。
- `apps/terminal/public/terminal-route-map.json`、`scripts/terminal-static-routes.mjs`及测试：只映射已声明`/trade/:symbol`到trade.html，服务端标的须2–40大写字母数字，拒绝编码斜线/任意fallback/路径注入。旧`/trade?proposalId=UUID`仍支持，资源读取独立授权。
- `tests/e2e/ui-p20.spec.ts`、`fixtures/ui-p20-reference.ts`、`playwright.ui-p20.config.ts`及基础config隔离：11Chromium、回环真实reference进程与明确TLS/cookie/CORS替身；正向实际响应与标记SYNTHETIC过期/健康/冲突/429等探针分开；业务写限定C07风险请求/C09提交，独立审批/MFA仅控制夹具，外网拦截，网络只存body/key/response hash。
- `scripts/ui-p20-review.mjs`及负面测试：绑定源码/参考图/输入/精确命令/exit/log hash/binary/build/网络/axe/截图；拒绝篡改、跳过/失败/重试及formal/生产/递归上游晋级。执行计划及`docs/operations/ui-p20-trade-ticket.md`同步。OpenAPI1.16.0与后端接口不变。

## 测试命令与结果

入口：`node scripts/ui-p20-review.mjs --run docs/audit/evidence/ui-p20-local-20261024/attempt-02`。14组精确命令、起止/exit/log hash见attempt-02/executions.json。webEnvironment白名单、pnpm10.20.0、locked/offline Cargo，仅本机reference网络，不加载DATABASE_URL或生产凭据。

| 命令 | 结果 |
| --- | --- |
| `node scripts/development-execution.mjs --development FE:UI-P20` | 当前功能开发允许 |
| `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | PASS，binary源码/hash记录 |
| `pnpm exec vitest run apps/terminal/tests/ui-p20.test.ts apps/terminal/tests/ui-p20-provider-consumer.test.ts apps/terminal/tests/ui503.test.ts apps/terminal/tests/ui503-provider-consumer.test.ts apps/terminal/tests/ui502.test.ts apps/terminal/tests/ui505.test.ts apps/terminal/tests/g1-route-access.test.ts --reporter=json --outputFile=.../unit.json` | 151/151，无pending/失败 |
| `cargo test --locked --offline -p bff-gateway --lib execution::tests::` | 28/28 |
| `pnpm exec node scripts/check-bff-generated.mjs` | PASS，契约未漂移 |
| `rustfmt --check --edition 2024 services/bff-gateway/src/execution.rs services/bff-gateway/src/execution/tests.rs` | PASS；后端未改 |
| `pnpm --filter @sumalpha/terminal typecheck` | PASS |
| `pnpm exec eslint ...`（当前文件精确清单见executions.json） | PASS |
| `node --test scripts/ui-p20-review.test.mjs scripts/terminal-static-routes.test.mjs scripts/serve-static.test.mjs` | 24/24 |
| `pnpm --filter @sumalpha/terminal build` | PASS，static trade.html与client-secrets通过；buildId=terminal-cb6965f002b1550e8d16eea81c00225bd1309eb1 |
| `pnpm exec playwright test --config=playwright.ui-p20.config.ts --project=chromium --workers=1 --retries=0 --reporter=list,json --output=.../browser` | 11/11，无重试/跳过/flaky，6axe零violations/12截图 |
| `node scripts/check-development-plans.mjs` | PASS |
| `node scripts/development-execution.mjs --integration FE:UI-P20` | 预期exit1/allowed=false，仍拒绝晋级 |
| `node scripts/development-execution.mjs --development FE:UI-P11` | 下一原任务开发允许 |
| `node scripts/ui-p20-review.mjs --verify` | PASS，verification.log |

范围仅P20组合与直接C07/C09/C12/C13、C01/路由影响，不递归重验依赖、不跑全仓/覆盖率/数据库campaign。旧UI503只读页面回执只保留原范围，本轮页面浏览器使用新的P20 profile，不将旧结果改绑为当前页面通过。

## Gate、设计适配与未决风险

限定工程Gate **PASS_P20_HIGH_FIDELITY_FUNCTION**。计划development_status=IMPLEMENTED_PENDING_ACCEPTANCE；正式INTEGRATION/NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。confirmation-draft.md=PENDING，没有代用户批准。

参考图：`design/P20-Trade-Ticket-Controlled-Order-Entry-High-Fidelity-v3.png`，sha256:9179f9aef29c391ceacc738e4a264f6b78f99d4c49938572c7edafce229ef298。构图/信息区/流程与危险操作落地；当前契约只接受已有服务端Proposal意图，未伪造自由下单接口。图中Buy/Sell、数量/限价编辑、快捷比例/TIF/reduce-only不是已实现的后端能力；页面明确只读/不支持，变更需新服务端Proposal。只提供顶层报价，无演示五档/数量；手续费/滑点/null现金/仓位影响/独立Kill状态保留未知。Equity不等于cash，参考venue不等于OWNED_PAPER执行venue；意图限价不被当前行情覆盖。

审批由独立审批页和服务端执行职责分离/MFA；本页不模拟审批人，也不申请仅审批人可读的reviewContext。风险预检不是可签发RiskDecision，C08批准/服务端签发和C09当前风险重验才可能推进。copy intent只复制当前有效的非执行内存草稿，不持久化或授交易权限。

预检/报价陈旧如实提示；确认风险时重新核查，不能靠陈旧审阅直接申请。原键恢复只在本访问内存，风险申请恢复受UI502现有有效期/上下文约束，过期拒绝；跨会话/目标持久恢复仍NOT_RUN。现有f64/固定quote源边界未在本任务改造成全系统精确货币核算。

4组axe color-contrast incomplete共40个nonBmp装饰导航图标待核，不计通过。人工读屏、原生200%缩放、跨OS/真机触控/Firefox/WebKit未验证。真实IdP/MFA/cookie/CORS、目标Supabase/RLS/持久事务与恢复、真实risk/portfolio/venue、远程同SHA CI、性能/容量/长稳、完整I5与发布均NOT_RUN。UI-P11订单详情高保真仍另行实现。

## 原始失败与本地提交

开发unit-01为149PASS/1FAIL：服务端批准已消费后Proposal.status实际为command_ready，初版matcher遗漏；原日志/JSON/workflow-status-original.txt保留，修正后consumer-02与151项开发检查通过，均ORIGINAL_SCOPE_ONLY，不是最终源码验收。

首轮50d66e39的151/28/24/11、6axe零violation与12截图通过，原receipt/result保留attempt-01-*-original.json。人工复核发现方向div的ARIA label产生6组incomplete；同时审阅跨阶段源码补上原意图完整比对和源选择锁定；旧owner快照intent-binding-original.txt与新内容变化负面探针保留。最终cb6965f0用新候选attempt-02执行，不改绑原PASS、不覆盖失败，历史其他任务证据不变。

源码提交50d66e39（页面与组合）、cb6965f0（跨阶段内容绑定/来源锁定/ARIA）。后续仅证据封存，无推送部署。

下一可执行任务：**FE:UI-P11：Orders与Execution Detail高保真页面**。当前仅开发准入允许。
