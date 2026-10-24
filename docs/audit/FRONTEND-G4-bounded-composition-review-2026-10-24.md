# FRONTEND-GATE:G4 / I7 有界功能组合与缺口评估

日期2026-10-24（Asia/Shanghai）。基线 `5372b8ccb254943255121232d0446f0cb3b088c1`；应用冻结候选 `546840670a9f5968a68a5254d5b0acd09535d47e`；独立证据工具修复 `3507c03a9c4b7242e90965729b6a0cce6b56c7b6`。仅QuantOS/main，本地提交；没有生产凭据、数据库连接、推送、部署或外部发布。

## Gate与计划状态

工程 **PASS_G4_OWNED_LOCAL_COMPOSITION**；正式G4 **NOT_READY_GAPS_OPEN**。review_status=IN_REVIEW，stage_gate=INTEGRATION/NOT_ASSESSED，formalAccepted=false、runtimeAdmission=DENIED。159项stage_gate与全部原规范依赖不变，FE:FEP-4开发状态未关闭。G4有界评估完成不等于完整I7或正式阶段通过；下一原任务 **FE:FEP-4：前端范围收口与里程碑缺口评估**。

当前计划记录、规程和两个已修复发现G4-STREAM-01/G4-C09-SCOPE-01已同步，developmentPrerequisite=false。原UI402-MARKER-SOURCE-01与P19-C10-EXPORT-01保持原义务、原历史证据/确认不改绑。不将辅助整改或旧NOT_ASSESSED作为无关功能开发前置。

## 必要修复

- QuoteFeed对EOF执行fatal UTF8 flush，拒绝残帧/截断编码；保留最后确认快照和游标，disconnected/error502。相同或新序号不能回退asOf，occurredAt不能在未来。
- Quote与Candle流绑定license文本、source、approval/version和snapshot，不允许许可变化静默拼接。没有把来源标签当独立License验签。
- 实际Shadow下C09 scoped403曾清空仍有效的C12。现在只在重新读取C01 session/context且完整authority未变、期限和market.read仍有效时保留C12，清除全部标记并标unavailable；401、C01变化/核查失败、C12 401/403、权限撤销仍清屏。不扩大C09权限，不将Shadow映射为Paper。
- P19的OHLCV/缺口/标记SVG title合成单一字符串，消除当前SSR数组警告，保留精确标签；没有重做布局或改绑旧视觉验收。

## 实际组合与边界

6项新浏览器用例均使用单个、不中途替换的实际本机reference BFF。identity Cookie/TLS/CORS是显式loopback替代，数据是owned synthetic reference；不代表真实外部provider或目标持久环境。

|链路|当前结果|
|---|---|
|C12目录→coinbase/spot详情→P19|实际URL/元数据维度一致；有限流EOF为disconnected，保留确认行情；实际C09 Shadow403后C01再核查，标记不可用，不擦掉行情|
|P19→Performance→C14/C15→报告→下载→Audit|同账户Shadow，C14/C15 runtime严格来源检查，PROVISIONAL可见；202只queued、显式succeeded、原字节下载，C10对应auditRef恰好1个节点|
|自选/报告提交后丢响应→原请求恢复|实际BFF已提交，仅运输丢弃；原key/body/If-Match/回执hash一致，实际自选Audit单节点；C14原生专项另验证单job/审计幂等|
|C15 rerun→刷新预览→固定报告|实际accepted，同源确定性重跑未改变账本hash；新requested range与报告冻结范围不同，原报告内容不变。没有声称产生新估值或新收益事实|
|局部拒绝、Viewer、无效路由、离线/恢复|真实Viewer/C09拒绝；无效参数不派发；浏览器显式offline清屏及显式重新读取。401/身份撤销的针对性负向为明确消费者输入|
|错误许可帧|实际返回与浏览器交付分别hash；交付破坏不能覆盖确认元数据，明确不是BFF原输出|
|6项直接回归|P18实际详情/逐venue403隔离/断流续传；P19实际Shell/503保留与换维度清空/Viewer及离线恢复|

C12报价没有与C14/C15共用的估值snapshot绑定，本轮不造“行情价→账户收益”因果join。所有财务报告仍以C15为来源。

## 测试命令与结果

初始执行 `node scripts/frontend-g4-review.mjs --run docs/audit/evidence/frontend-g4-local-20261024/attempt-01` 的15项命令均符合预期。其后收集器把P18的p18.json误按ui401.json计数，packet verify发生FAIL（3≠6），不是业务检查失败。原日志、失败摘要和全部命令不修改。

工具提交仅修改recorder及其测试两个文件，修复为P18/P19各3份回执。执行：

`node scripts/frontend-g4-review.mjs --recover docs/audit/evidence/frontend-g4-local-20261024/attempt-01 docs/audit/evidence/frontend-g4-local-20261024/tooling-repair-01`

该入口严格拒绝任何产品/计划变化，只重跑工具lint与19项负向测试，并以tooling.sourceCommit独立绑定。应用仍是54684067，原构建与业务命令不冒充3507c03a执行；没有重跑完整功能链。当前复核：`node scripts/frontend-g4-review.mjs --verify`。

|实际命令|结果|
|---|---|
|`node scripts/development-execution.mjs --development FRONTEND-GATE:G4`|PASS / exit0|
|`cargo build --locked --offline -p bff-gateway --bin bff-gateway`|PASS / exit0|
|`pnpm exec vitest run apps/terminal/tests/frontend-g4.test.ts apps/terminal/tests/ui401.test.ts apps/terminal/tests/ui-p18.test.ts apps/terminal/tests/ui-p19.test.tsx apps/terminal/tests/ui402.test.ts apps/terminal/tests/ui-p21.test.tsx apps/terminal/tests/ui403.test.ts apps/terminal/tests/ui401-provider-consumer.test.ts apps/terminal/tests/ui402-provider-consumer.test.ts apps/terminal/tests/ui403-provider-consumer.test.ts apps/terminal/tests/performance-provider-consumer.test.ts apps/terminal/tests/g1-route-access.test.ts packages/api-client/tests/market-recovery.test.ts --reporter=json --outputFile=docs/audit/evidence/frontend-g4-local-20261024/attempt-01/unit.json`|234/234 PASS|
|`cargo test --locked --offline -p bff-gateway --lib market::tests::`|18/18 PASS|
|`cargo test --locked --offline -p bff-gateway --lib performance::tests::`|10/10 PASS|
|`pnpm --filter @sumalpha/terminal typecheck`|PASS / exit0|
|`pnpm exec eslint apps/terminal/app/markets/chart/p19-components.tsx apps/terminal/src/markets/quote-feed.ts apps/terminal/src/markets/chart-runtime.ts apps/terminal/src/markets/chart-policy.ts apps/terminal/tests/frontend-g4.test.ts apps/terminal/tests/ui402.test.ts tests/e2e/frontend-g4.spec.ts tests/e2e/fixtures/frontend-g4-reference.ts playwright.config.ts playwright.frontend-g4.config.ts playwright.frontend-g4-impact.config.ts scripts/frontend-g4-review.mjs scripts/frontend-g4-review.test.mjs`|PASS / exit0|
|`node --test scripts/frontend-g4-review.test.mjs scripts/terminal-static-routes.test.mjs scripts/development-execution.test.mjs`|62/62 PASS|
|`pnpm --filter @sumalpha/terminal build`|PASS / exit0|
|`pnpm exec playwright test --config=playwright.frontend-g4.config.ts --project=chromium --workers=1 --retries=0 --reporter=list,json --output=docs/audit/evidence/frontend-g4-local-20261024/attempt-01/browser`|6/6 PASS|
|`pnpm exec playwright test --config=playwright.frontend-g4-impact.config.ts --project=chromium --workers=1 --retries=0 --reporter=list,json --output=docs/audit/evidence/frontend-g4-local-20261024/attempt-01/direct-impact`|6/6 PASS|
|`node scripts/check-development-plans.mjs`|PASS / exit0|
|`node scripts/development-execution.mjs --integration FRONTEND-GATE:G4`|预期exit1 / STAGE_NOT_READY|
|`node scripts/development-execution.mjs --integration FE:FEP-4`|预期exit1 / STAGE_NOT_READY|
|`node scripts/development-execution.mjs --development FE:FEP-4`|允许FE:FEP-4有界开发|

完整退出码/时间/日志hash见 [executions.json](./evidence/frontend-g4-local-20261024/attempt-01/executions.json)。1643项应用输入、45项当前产物、897项历史文件hash和工具单独绑定见 [receipt.json](./evidence/frontend-g4-local-20261024/receipt.json)。234项由9个G4新增负向、4个真实provider consumer，以及P18/P19/P21/UI401/UI402/UI403、路由监控与行情恢复直接回归构成；不是全仓或全部上游复验。

只执行受影响C12/R01投影18项与C14/C15来源/报表10项Rust专项；不递归重跑完整X3、全仓、Supabase或F05/F07 campaign。两条正式INTEGRATION入口按预期拒绝，下一FE:FEP-4开发入口允许。

## 历史与失败保留

897个UI401/P18/UI402/P19/UI403/P21历史证据文件原字节不变，ORIGINAL_SCOPE_ONLY。8个G4直接依赖只形成当前状态/规范摘要，不重绑原PASS；CORE-GATE:X3-SERVICE及PROVIDER:ALL没有新READY。

preflight-01保留初始探针5失败/1假阳性、修正有效envelope后6失败、修复后的结果与C09拒绝旧预期失败；初次浏览器2通过4失败包含原静态构建揭示的实际C09问题。preflight-02重建后4通过2工具失败（链接箭头/缺accountId）；preflight-03六项组合通过。preflight-04保留234项单元/消费者、六项直接回归和工具诊断。计划README创建前的断链、工具nextTask/文档顺序错误也如实记录；不将它们算产品通过或重写历史。初始packet计数失败摘要在attempt-01内保留，工具修复单独计账。

## 未决风险与正式G4缺口

1. **UI402-MARKER-SOURCE-01**：实际C09仍是Paper/mock执行来源，当前Shadow请求403；尚无C12同venue/product/symbol/account/mode阳性订单成交。安全排除/不可用不是阳性联调通过，不用合成spot输入替代。
2. **P19-C10-EXPORT-01**：C10正式scope/格式缺少K线片段/图像的C12维度与许可/审计绑定；导出禁用，功能未实现。
3. 页面确认与CORE-GATE:X3-SERVICE/provider阶段义务未获新准入；G4保持NOT_READY，FEP-4不正式关闭。
4. 真实IdP/Cookie/CORS、Supabase/RLS/事务/持久审计、外部市场许可/真实现金流/成交、跨实例/跨重启持久恢复、同SHA远程CI、目标托管、性能/容量/长稳、Firefox/WebKit/跨OS、人工读屏/native200%、完整I7及RELEASE全部NOT_RUN。

本轮没有完整视觉/axe矩阵复验；旧incomplete原样保留、未声称关闭。已人工查看当前两张功能截图：Shadow图表仍显示coinbase/spot、确认来源与断流状态，Report Audit恰好1个performance.report.create事件并展示当前授权范围内链完整。该链完整只适用此报告事件，不代表全部市场/账户资金链或生产审计验收。

[Shadow图表功能截图](./evidence/frontend-g4-local-20261024/attempt-01/browser/frontend-g4-G4-same-instan-b2c4c-t-download-and-actual-Audit-chromium/g4-shadow-c12-c09-unavailable.png)；[报告Audit截图](./evidence/frontend-g4-local-20261024/attempt-01/browser/frontend-g4-G4-same-instan-b2c4c-t-download-and-actual-Audit-chromium/g4-report-audit.png)。

## 变更文件（18项代码/测试/计划/规程）

- `apps/terminal/app/markets/chart/p19-components.tsx`
- `apps/terminal/src/markets/chart-policy.ts`
- `apps/terminal/src/markets/chart-runtime.ts`
- `apps/terminal/src/markets/quote-feed.ts`
- `apps/terminal/tests/frontend-g4.test.ts`
- `apps/terminal/tests/ui402.test.ts`
- `docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md`
- `docs/execution/development-followups.json`
- `docs/operations/frontend-g4-bounded-composition.md`
- `docs/operations/ui402-candlestick-analysis.md`
- `package.json`
- `playwright.config.ts`
- `playwright.frontend-g4-impact.config.ts`
- `playwright.frontend-g4.config.ts`
- `scripts/frontend-g4-review.mjs`
- `scripts/frontend-g4-review.test.mjs`
- `tests/e2e/fixtures/frontend-g4-reference.ts`
- `tests/e2e/frontend-g4.spec.ts`

另增加本报告和 `docs/audit/evidence/frontend-g4-local-20261024/` 完整证据包，证据单独本地提交。下一可执行原任务FE:FEP-4：按当前前端范围收口并核对剩余义务，保留G4 NOT_READY，不将本次工程证据提升为正式里程碑完成。
