# UI-403 I7 Performance、归因与周期报表交付

日期2026-10-24（Asia/Shanghai）。基线`0f1d41af2306b519b82ef86be76fbdcbfa3a4783`；冻结源码`d3e1a5a8adcab8e1d4d78c73fc1bf31cbd352d8d`。在main直接开发，仅修改QuantOS；无生产凭据、推送、部署或外部发布。源码提交d3e1a5a8，证据另行提交。

## 结果与实现

工程Gate **PASS_UI403_PERFORMANCE_FUNCTION**，development_status=IMPLEMENTED_PENDING_ACCEPTANCE；正式INTEGRATION/NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED。159项stage_gate不提升，完整I7/G4/FEP-4未放行；下一可执行原任务FE:UI-P21。

交付`/performance`与`/performance/reports/:reportId`、共享Shell授权导航和精确静态报告路由。当前C01账户及Shadow/execution.operate下，展示USD/simple收益、比率、回撤、费用、标的归因、实际/请求覆盖、账本/估值版本和precision。所有财务值保留十进制字符串，源加法核对使用BigInt与18位舍入容差，不自行制造财务事实。

同一冻结end的C14 summary/series/attribution比对，接续逐点C15 Run及actual snapshot sourceHash/捕获时间，再读Run与summary；不显示跨版本组合。未对账、覆盖不足、估值超过60秒、C15差异/过期等一律醒目PROVISIONAL，不混入确认总计。

周/月/季/年rolling/calendar或自定义范围生成固定版本报告，202仅queued；明确读取状态/文档后才能下载。未知结果只按原body/key/requestId/CSRF恢复，首次已知拒绝与恢复拒绝分开处理，429冷却，权限/模式/环境/到期失效清屏。固定报告版本与预览来源发生变化时提示重审；不偷偷把服务器报告版本改写成预览版本。

下载仅精确BFF同源路径、短时UUID ticket，禁止redirect/外部地址/过期/superseded；有界4MiB/10秒，核对原始字节SHA-256、长度、fatal UTF-8/schema及全部冻结元数据后触发JSON下载，不重新序列化金额。ticket不入页面/偏好/原始日志。本会话最多25报告引用，不冒充服务端报告目录或跨重启恢复。

## 命令与结果

生成入口：`node scripts/ui403-review.mjs --run docs/audit/evidence/ui403-local-20261024/attempt-01`。复核：`node scripts/ui403-review.mjs --verify`。runner使用固定pnpm10.20.0及白名单公开环境；实际reference服务/Chromium仅回环网络，未传DATABASE_URL或服务角色密钥。

|命令/范围|结果|
|---|---|
|pnpm exec vitest run apps/terminal/tests/ui403.test.ts apps/terminal/tests/ui403-provider-consumer.test.ts apps/terminal/tests/performance-provider-consumer.test.ts apps/terminal/tests/ui506.test.ts|66/66 PASS|
|cargo test --locked --offline -p bff-gateway --lib performance::tests::|10/10 PASS|
|node --test scripts/ui403-review.test.mjs scripts/terminal-static-routes.test.mjs scripts/development-execution.test.mjs|58/58 PASS|
|pnpm --filter @sumalpha/terminal typecheck|PASS|
|pnpm exec eslint（当前源码/测试/门禁）|PASS|
|pnpm --filter @sumalpha/terminal build|PASS，client secret scan通过|
|pnpm exec playwright test --config=playwright.ui403.config.ts --project=chromium --workers=1 --retries=0|8/8 PASS|
|node scripts/check-development-plans.mjs|PASS；159项NOT_ASSESSED|
|node scripts/development-execution.mjs --integration FE:UI-403|预期exit1/STAGE_NOT_READY|
|node scripts/development-execution.mjs --development FE:UI-P21|允许开发|

完整12项命令/时间/退出码/日志hash见[executions.json](./evidence/ui403-local-20261024/attempt-01/executions.json)；1621项输入/33项当前产物及304项历史hash见[receipt.json](./evidence/ui403-local-20261024/receipt.json)。C14是当前功能直接依赖，因此仅执行对应10项Rust与consumer；没有递归重跑全上游、全仓或数据库campaign。

## 可视核对与风险

已人工查看最终attempt-01深色1440、浅色390截图：筛选、Shadow、PROVISIONAL、覆盖不足、金额/币种/口径与版本可见，窄屏采用堆叠与内部表格横向滚动；这是UI403功能界面，不是UI-P21参考稿高保真或完整视觉签署。四次axe零violations；4项color-contrast incomplete对应11/19/11/19节点出现（共60次，不能当独立缺陷计数），人工读屏/native200%未验收。

当前服务只提供USD/simple/UTC/Shadow、标的归因和JSON报告；TWR/MWR、其他币种/策略/venue拆分、已实现拆分、额外格式/语言/订阅未开放。报告原provisional标识固定在生成时，不能当作当前已确认账本；当前页面另行根据C15和时效降为暂定。

preflight-01的类型/import/lint诊断及测试Request body记录失败原样保留；preflight-02原65项非冻结预检不重新绑定，最终新导航检查已计入66项。304个UI506/P22历史文件原字节未变，ORIGINAL_SCOPE_ONLY；FEP5原C09 Paper→C15 Shadow及C15→C16联调义务不因本功能关闭。

真实IdP/Cookie/CORS、Supabase事务/RLS/审计持久化、真实外部估值/现金流、跨进程/重启恢复、同SHA远程CI、目标托管、Firefox/WebKit、读屏/native200%、跨OS、性能容量长稳、完整I7/G4/FEP-4及RELEASE均NOT_RUN。未将本机reference/合成输入或生成报告当作生产收益/真实资金验收。

## 变更文件（22项代码/测试/规程/计划）

- `apps/terminal/app/performance/page.tsx`
- `apps/terminal/app/performance/workspace.css`
- `apps/terminal/app/performance/workspace.tsx`
- `apps/terminal/public/terminal-route-map.json`
- `apps/terminal/src/command/presentation.ts`
- `apps/terminal/src/performance/gateway.ts`
- `apps/terminal/src/performance/policy.ts`
- `apps/terminal/src/performance/runtime.ts`
- `apps/terminal/tests/fixtures/scenarios/performance.ts`
- `apps/terminal/tests/ui403-provider-consumer.test.ts`
- `apps/terminal/tests/ui403.test.ts`
- `docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md`
- `docs/operations/ui403-performance-reports.md`
- `package.json`
- `playwright.config.ts`
- `playwright.ui403.config.ts`
- `scripts/terminal-static-routes.mjs`
- `scripts/terminal-static-routes.test.mjs`
- `scripts/ui403-review.mjs`
- `scripts/ui403-review.test.mjs`
- `tests/e2e/fixtures/ui403-reference.ts`
- `tests/e2e/ui403.spec.ts`

另增加本报告及 `docs/audit/evidence/ui403-local-20261024/` 完整证据包。下一任务FE:UI-P21：Performance高保真页面与报告交互。
