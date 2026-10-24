# UI-402 I7 功能交付与验收记录

日期：2026-10-24（Asia/Shanghai）。范围：前端执行计划UI-402；基线`b9d7d09a98247ef06818118ebcf99b63f759967a`，最终源码`d41aa2a31b24023470536525c72bc2530512af6b`。main直接开发；本地源码提交a725dc1c与d41aa2a3，证据另行提交。无生产凭据、远端推送、部署或外部发布。

## 交付与Gate

`/markets/:symbol/chart`接入真实C01/C12/C09消费者及市场详情入口。OHLCV、成交量、SMA/EMA、缺口和完整series元数据；切维度同步清空、取消旧请求及迟到响应隔离；断流/无效流停在最后确认时间并显式续传；权限、上下文、到期及离线清屏。原始价格/数量保留十进制字符串。

C09正式契约新增向后兼容的可选productType=spot；只有明确同账户/模式/venue/venueKind/product/symbol的订单/成交可做标记。缺产品或OWNED_PAPER/mock不推断到C12 spot。真实C09/C12来源匹配阳性尚未提供，已登记UI402-MARKER-SOURCE-01；不作为其他功能开发前置。

功能Gate **PASS_UI402_REFERENCE_FUNCTION**；development_status=IMPLEMENTED_PENDING_ACCEPTANCE。正式INTEGRATION仍STAGE_NOT_READY，stage_gate=NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED；G4/G5/FEP-4未自动放行。计划159项stage_gate保持NOT_ASSESSED。下一可执行原任务FE:UI-P19。

## 命令与结果

统一入口：`node scripts/ui402-review.mjs --run docs/audit/evidence/ui402-local-20261024/attempt-02`；复核：`node scripts/ui402-review.mjs --verify`。入口以白名单环境启动本机reference及Chromium，禁止夹带DATABASE_URL/服务角色密钥；reference身份与CORS仍是受控替代。

|命令/检查|结果|
|---|---|
|pnpm exec vitest run（8个直接功能/契约文件，完整参数见executions.json）|141/141 PASS|
|cargo test --locked --offline -p bff-gateway --lib market::tests::|18/18 PASS|
|pnpm --filter @sumalpha/terminal typecheck|PASS|
|pnpm exec eslint（市场源码、测试和本任务门禁）|PASS|
|node --test scripts/ui402-review.test.mjs scripts/terminal-static-routes.test.mjs|33/33 PASS|
|node scripts/check-bff-generated.mjs|PASS|
|node scripts/check-bff-compatibility.mjs（显式当前父候选基线）|PASS；旧历史基线88项FAIL另行保留|
|pnpm --filter @sumalpha/terminal build|PASS，包含client secret scan|
|pnpm exec playwright test --config=playwright.ui402.config.ts --project=chromium --workers=1 --retries=0|7/7 PASS|
|pnpm exec playwright test --config=playwright.ui-p18.config.ts --project=chromium --grep 'P18 actual overview routes'|1/1 PASS|
|node scripts/check-development-plans.mjs|PASS，159项NOT_ASSESSED|
|node scripts/development-execution.mjs --integration FE:UI-402|预期exit1/STAGE_NOT_READY|
|node scripts/development-execution.mjs --development FE:UI-P19|允许开发|

完整15项命令、时间、退出码、日志hash见[executions.json](./evidence/ui402-local-20261024/attempt-02/executions.json)；冻结输入/产物清单见[receipt.json](./evidence/ui402-local-20261024/receipt.json)。141项中UI402功能36项，真实consumer1项覆盖28维度组合；合成spot标记阳性不代表实际来源阳性。

## 可视核对与未决风险

Chromium明暗1440/390四截图已生成；人工查看了宽屏深色和390窄屏浅色输出，确认分区、缺口、元数据、只读提示及排除说明可见；这只是本机功能页面观察，不是UI-P19高保真、投影或人工无障碍验收。SVG在窄屏缩放，原始表/元数据提供文本读取；精细交互与高保真展示留在UI-P19。

四次axe各0 violations，但各有1项color-contrast incomplete、每项5个SVG文本节点，保留4项扫描出现记录，不能写无障碍全通过。人工读屏/native200% NOT_RUN。

真实IdP/Cookie/CORS、Supabase/RLS、外部数据/venue/许可、C09→C12来源匹配阳性、Firefox/WebKit、目标托管、同SHA远程CI、性能容量长稳、完整I7联调及RELEASE全部NOT_RUN。指标和SVG浮点近似仅用于可视化；C09标记为带读取时间的快照，不宣称实时订单流。

preflight-01/02与attempt-01失败、旧兼容性基线88项FAIL保持原记录；旧UI401/UI505/P18/G5证据只作ORIGINAL_SCOPE_ONLY，不改绑当前SHA。本任务不递归复验依赖链或执行全仓/数据库campaign。

## 源码变更文件（27）

- `apps/terminal/app/markets/chart/page.tsx`
- `apps/terminal/app/markets/chart/workspace.css`
- `apps/terminal/app/markets/chart/workspace.tsx`
- `apps/terminal/app/markets/p18-components.tsx`
- `apps/terminal/public/terminal-route-map.json`
- `apps/terminal/src/markets/chart-policy.ts`
- `apps/terminal/src/markets/chart-runtime.ts`
- `apps/terminal/tests/ui402-provider-consumer.test.ts`
- `apps/terminal/tests/ui402.test.ts`
- `bff/openapi/quantos-bff.v1.yaml`
- `docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md`
- `docs/execution/development-followups.json`
- `docs/operations/ui402-candlestick-analysis.md`
- `package.json`
- `packages/api-client/src/bff-gen/quantos-bff.ts`
- `packages/api-client/src/bff-gen/quantos-bff.zod.ts`
- `playwright.config.ts`
- `playwright.ui402.config.ts`
- `scripts/terminal-static-routes.mjs`
- `scripts/terminal-static-routes.test.mjs`
- `scripts/ui402-review.mjs`
- `scripts/ui402-review.test.mjs`
- `services/bff-gateway/src/generated-input-policy.json`
- `tests/contract/generated/quantos-bff.components.schema.json`
- `tests/contract/ui402-contract.test.ts`
- `tests/e2e/ui-p18.spec.ts`
- `tests/e2e/ui402.spec.ts`

另增加本报告与 `docs/audit/evidence/ui402-local-20261024/` 完整证据目录，README列出各轮的真实结果和边界。
