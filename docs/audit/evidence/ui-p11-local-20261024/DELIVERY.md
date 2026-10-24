# FE:UI-P11 交付报告

Orders与Execution Detail高保真页面已在QuantOS main实现并完成限定本机功能验证。未使用生产凭据、推送或部署。

基线 `f27dca6d951e118263f8f231b8ee190f3138b423`；实现 `609a6e9cefd0ee672a33ce69eb4a554977319912`；最终已构建/测试源码 **ad49394ea9b691646fc7c791413e618e8f19ba8a**。后续仅证据封存提交，不冒充新的已构建候选。全部变更见changed-files.txt，证据hash见delivery-manifest.json。

## 变更文件与最终行为

- `apps/terminal/app/orders/workspace.tsx`、`workspace.css`：P11左目录/右详情、分类/搜索/标的/24小时筛选/真实分页、已加载统计、深链/关闭/重开、实际连续状态时间线、摘要/剩余/进度、Fills/执行事件表、Command摘要/关联对象/C10链/C15提示、明确202受理与未知结果恢复、撤单二次确认、明暗桌面/平板/手机。长表命名滚动区可Tab聚焦/ArrowRight横滚，截图等待原生横滚稳定。旧approvalId Command入口折叠保留并由浏览器实际验证。
- `apps/terminal/src/orders/p11-presentation.ts`：loaded-only过滤/分类/排序、状态呈现、精确Decimal剩余量与0–10000显示基点；仅基点转Number，不把金融数值转浮点。C15页面schema/范围/时间/上限校验，订单只按完整精确引用匹配，不按substring/correlation猜对账。
- `apps/terminal/src/orders/runtime.ts`：复用C09事实/幂等/恢复机制；事实确认后更新已加载对应行；新增deselect，未知结果不可隐藏关闭；C10按当前Order实际correlation/当前audit:read授权分页，每页100/最多2000，去重/游标/correlation/retention校验；换单/事实变化/错误/关闭/到期清理链。C15只读GET runs，当前scope+exact order ref，去重/循环/最多1000，前后重读Order防止读取期间变化；显示整批差异/provisional/到期，不能当本单Clean或改账。资源403不伪装全局会话撤销，401清理访问；关联读取错误保留订单事实但停止新撤单，续传重新核查。
- `apps/terminal/tests/ui-p11.test.ts`：14项呈现/partial终态/精确金额/范围/链/游标/拒绝/未知恢复测试。`ui-p11-provider-consumer.test.ts`实际C09提交/撤单丢响应恢复、C10链、C15 Paper拒绝；`ui-p11-c15-consumer.test.ts`实际Shadow C15只读schema与无匹配、不改账。直接回归UI505策略、P20真实消费者、C01，共63项。
- `tests/e2e/ui-p11.spec.ts`、`fixtures/ui-p11-reference.ts`及`playwright.ui-p11.config.ts`/基础config隔离：14 Chromium，真实reference BFF和回环TLS/cookie/CORS身份替身；14网络日志，业务写仅C09撤单/兼容提交，前置独立MFA审批/订单创建为显式控制夹具，外网拦截，body/key/response仅hash。部分成交/拒绝/空洞/越权探针明确SYNTHETIC，不声称实际venue事实。
- `scripts/ui-p11-review.mjs`及门禁负面测试：源码/参考图/命令/日志/hash/binary/build/browser/axe/布局输入绑定；拒绝篡改、跳过/重试/失败及formal/生产/递归依赖晋级。执行计划、`docs/operations/ui-p11-orders-execution.md`和本证据目录同步。OpenAPI1.16.0、后端/核心未改。

## 测试命令与结果

入口：`node scripts/ui-p11-review.mjs --run docs/audit/evidence/ui-p11-local-20261024/attempt-02`。16组精确argv、起止/exit/signal/log hash见attempt-02/executions.json。webEnvironment白名单、pnpm10.20.0、locked/offline Cargo，仅本机reference，不加载DATABASE_URL或生产凭据。

| 命令 | 结果 |
| --- | --- |
| `node scripts/development-execution.mjs --development FE:UI-P11` | 开发允许 |
| `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | PASS，binary.json绑定源码/hash |
| `pnpm exec vitest run apps/terminal/tests/ui-p11.test.ts apps/terminal/tests/ui-p11-provider-consumer.test.ts apps/terminal/tests/ui-p11-c15-consumer.test.ts apps/terminal/tests/ui505.test.ts apps/terminal/tests/ui-p20-provider-consumer.test.ts apps/terminal/tests/g1-route-access.test.ts --reporter=json --outputFile=.../unit.json` | 63/63，无pending/失败 |
| `cargo test --locked --offline -p bff-gateway --lib execution::tests::` | 28/28 |
| `cargo test --locked --offline -p quantos-execution --lib tp07_partial_fills_accumulate_decimal_quantity_and_weighted_price_once` | 1/1，实际本机核心partial累计/均价/重复Fill不重复计入 |
| 同上过滤`tp07_rejection_reason_and_event_expiry_are_checked_projection_facts` | 1/1，实际核心拒绝/过期投影 |
| `pnpm exec node scripts/check-bff-generated.mjs` | PASS，契约未漂移 |
| `rustfmt --check --edition 2024 services/bff-gateway/src/execution.rs services/bff-gateway/src/execution/tests.rs` | PASS，后端未改 |
| `pnpm --filter @sumalpha/terminal typecheck` | PASS |
| `pnpm exec eslint ...`（当前文件精确清单见executions.json） | PASS |
| `node --test scripts/ui-p11-review.test.mjs scripts/terminal-static-routes.test.mjs scripts/serve-static.test.mjs` | 24/24 |
| `pnpm --filter @sumalpha/terminal build` | PASS，orders.html/static route/client-secrets通过；buildId=terminal-ad49394ea9b691646fc7c791413e618e8f19ba8a |
| `pnpm exec playwright test --config=playwright.ui-p11.config.ts --project=chromium --workers=1 --retries=0 --reporter=list,json --output=.../browser` | 14/14，无重试/跳过/flaky；6axe零violations/12实际布局+2合成状态截图 |
| `node scripts/check-development-plans.mjs` | PASS |
| `node scripts/development-execution.mjs --integration FE:UI-P11` | 预期exit1/allowed=false，未晋级 |
| `node scripts/development-execution.mjs --development FE:UI-506` | 下一开发任务允许 |
| `node scripts/ui-p11-review.mjs --verify` | PASS，verification.log |

范围仅P11/C09/C10/C15只读来源与直接P20/C01消费者，核心partial/reject精确单测；不递归重验上游，不跑全仓/覆盖率/数据库campaign。旧UI505页面回执只保留原范围，当前页面浏览器采用P11 profile，兼容提交有本轮实际测试。

## Gate、设计适配与未决风险

工程Gate **PASS_P11_HIGH_FIDELITY_FUNCTION**。计划IMPLEMENTED_PENDING_ACCEPTANCE；正式stage_gate INTEGRATION/NOT_ASSESSED，formalAccepted=false、runtimeAdmission=DENIED。confirmation-draft.md为PENDING，未代用户批准；I5窗口/整条联调/发布不因本任务完成自动通过。

参考图 `design/P11-Orders-and-Execution-Detail-High-Fidelity-v1.png`，sha256:6500687ab227c5810f14c3943cdfac3bbac643a64368153fe5e0b3dffde6b317。按真实字段适配：仅显示实际发生的状态，不补演示Command validated/submitted/future filled；部分成交进度不等于全成；Limit价格/币种/名义值无源不算，签名/到期/原幂等键无源不猜，venue连接/延迟/Kill不由accepted推断；未知Fill费用/venueFillID/liquidity不填假值。C10 complete只表示当前授权链返回完整，不是浏览器验签或运行准入。截图长内容在文档流中滚动，不宣称像素同图或全状态自动视觉基准认证。

C15 reference与C09的实际阳性关联仍 **NOT_RUN**：C09为Paper UUID订单，C15 owner为Shadow且owned source-record ID不同。实际Paper读取403、实际Shadow读取与无匹配已测；同scope完整ref匹配使用明确合成单测。不会借另一模式/账户/相似ref把本单标Clean或Pending next run；没有修改C15/账本/后端来绕过边界，UI506另行负责对账业务页。临时运行结果/provisional和整批breakCount不等于本单差异已完成。

浏览器partial/rejected截图为显式合成DTO展示，不冒充真实C09/venue部分成交；本机核心OMS两项真实投影测试独立记账，也不等于实际外部venue。source cash/f64/固定quote边界未在此改造成全系统财务引擎。

6组color-contrast incomplete共50节点：40 nonBmp装饰导航图标、10横滚边界部分遮挡文字。保留原始结果待人工核查，不计通过。人工读屏、原生200%缩放、跨OS/真实触控、Firefox/WebKit未运行。真实IdP/MFA/cookie/CORS、目标DB/RLS/持久事务/跨会话恢复、真实risk/venue、远程同SHA CI、容量/性能/长稳、完整I5与发布均NOT_RUN。

## 历史失败、复核与提交

开发types-01真实FAIL（TS2322，C15 nextCursor nullable），归一null后类型/lint通过，原日志保留。62项开发PASS加入实际Shadow C15读取后63PASS，均UNCOMMITTED/ORIGINAL_SCOPE_ONLY，不绑定最终候选。

首轮609a6e9c：63/28/2核心/24/14、6axe零violations通过；原receipt/result另存attempt-01-*-original.json。截图复核百分比换行及终态“可撤剩余”措辞需修订；手机事件表空白经独立布局诊断确认DOM/颜色正常，原生键盘滚动未稳时截图。development/layout-probe与layout-probe-02两个新目录分别保留，后者按实际正向稳定scrollLeft等待后截图正常；两次均在旧609构建上执行，不当新CSS/文案验收。

最终ad49394e：百分比不拆行，底栏称“剩余未成交”；新增滚动稳定及DOM几何证据，再用attempt-02冻结执行，不改绑首轮PASS。历史其他任务证据未改动，所有失败/原件hash保留。

源码提交609a6e9c（实现）、ad49394e（呈现/稳定截图）；后续仅本地证据封存，无推送部署。

下一可执行开发任务：**FE:UI-506：Reconciliation与账本差异**；I5窗口仍需独立评估，不声称INTEGRATION READY。
