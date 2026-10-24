# UI-P19 I7 高保真页面交付与本机验收

日期2026-10-24（Asia/Shanghai）。基线`50ff4f015c021e13bcfd5e9ffb6070c9548c1848`；最终源码`c7d0cb0b1832a10a287a1f88b5506f963684bff6`。在main直接开发，仅修改QuantOS，未使用生产凭据、推送、部署或发布。源码提交139937bb、9942fc5b、04b91a2e、c7d0cb0b；证据另行提交。

## 当前结果

工程Gate **PASS_UI_P19_CURRENT_PAGE**，development_status=IMPLEMENTED_PENDING_ACCEPTANCE。正式stage_gate=INTEGRATION/NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED，G4/G5/FEP-4与完整I7未放行。159项stage_gate仍NOT_ASSESSED；下一可执行原任务FE:UI-403。

P19 v4三栏层级与共享Shell已实现：五维context/七周期及自定义ISO范围、K线/成交量、十字光标/缩放/键盘/表格分页联动、SMA/EMA/VWAP/RSI、独立订单/成交/缺口开关、完整元数据、选中Candle栏、安全深链/引用复制与白名单视图保存。相同维度503/504保留确认图，换维度或非法来源清屏；断流冻结与权限/到期清屏延续UI402。图表最小960px并在窄屏内部横向滚动，页面本身不横向溢出。

Trade Ticket仅预填规范标的，不带执行venue/委托价格/账户/模式/授权，不产生订单。导出C12片段/图像P1 **未实现**：C10范围以correlationIds/eventKinds为基础，不能表达C12维度/snapshot与许可审计绑定；按钮禁用并登记P19-C10-EXPORT-01。实际C09→C12阳性仍NOT_RUN，不能以合成spot标记或Paper/mock代替。

## 测试命令与实际结果

统一冻结入口：`node scripts/ui-p19-review.mjs --run docs/audit/evidence/ui-p19-local-20261024/attempt-04`；只读复核：`node scripts/ui-p19-review.mjs --verify`。runner用固定pnpm10.20.0/白名单公开环境，不传DATABASE_URL或服务角色密钥。实际网络使用reference身份桥接与loopback TLS/CORS替代。

|命令/范围|结果|
|---|---|
|pnpm exec vitest run apps/terminal/tests/ui-p19.test.tsx apps/terminal/tests/ui402.test.ts apps/terminal/tests/ui402-provider-consumer.test.ts packages/api-client/tests/market-recovery.test.ts tests/contract/ui402-contract.test.ts|70/70 PASS|
|node --test scripts/ui-p19-review.test.mjs scripts/terminal-static-routes.test.mjs scripts/development-execution.test.mjs|59/59 PASS|
|pnpm --filter @sumalpha/terminal typecheck|PASS|
|pnpm exec eslint（P19/市场源码、测试与门禁）|PASS|
|pnpm --filter @sumalpha/terminal build|PASS，client secret scan通过|
|pnpm exec playwright test --config=playwright.ui-p19.config.ts --project=chromium --workers=1 --retries=0|11/11 PASS|
|pnpm exec playwright test --config=playwright.ui402.config.ts --project=chromium --workers=1 --retries=0|7/7 PASS|
|node scripts/check-development-plans.mjs|PASS，159项NOT_ASSESSED|
|node scripts/development-execution.mjs --integration FE:UI-P19|预期exit1/STAGE_NOT_READY|
|node scripts/development-execution.mjs --development FE:UI-403|允许开发|

12项完整命令、时间、退出码、日志hash见[executions.json](./evidence/ui-p19-local-20261024/attempt-04/executions.json)。1613项输入、60项当前产物及119项历史文件hash见[receipt.json](./evidence/ui-p19-local-20261024/receipt.json)。无后端源码/契约变更，不扩大到全仓、全依赖链、数据库campaign或重复上游Rust测试。

## 视觉与范围对照

ST-P19-01–04本机功能通过；ST-P19-05保存/安全复制/仅标的handoff通过，受控导出P1留未实现。ACC-P19-S1默认、S2加载、S3真实空区间/质量不匹配、S4同维度503保留/非法来源拒绝、S5权限、S6断流/切维度、S7离线清屏/最后确认时间均有直接功能或UI402影响覆盖；不是目标环境验收。

八组P19明暗×1672/1440/1024/390截图和布局几何，1440上下分区、390图表滚动窗口与明确79根合成rich视觉另行留证。当前截图人工核对与参考适配差异见[visual-review.md](./evidence/ui-p19-local-20261024/visual-review.md)。真实reference只有有限稀疏行情，不能把原稿数值/交易标记静态填入真实页面。

P19八次axe 0 violations，仍有8项color-contrast incomplete，共200次SVG文本节点出现；UI402四次扫描另外保留4项incomplete。没有将重复出现次数写成独立缺陷，也没有声称人工无障碍全通过。用户设计确认、读屏/native200%、跨OS仍未执行。

## 保留失败与未决风险

preflight-01 SSR/lint/同名标签失败，preflight-02面包屑样式失败，attempt-01非法跟进分类失败及全部未执行项保留；attempt-02成功原receipt/results另存，但rich-dark主题标注问题经人工发现后只作ORIGINAL_SCOPE_ONLY。attempt-03原成功保留；最终候选attempt-04补齐真实reference空区间后独立验证，未改写旧日志/截图或将旧PASS改绑。

UI402历史119文件原字节不变。P1受控导出、真实来源匹配C09→C12阳性、真实IdP/Cookie/CORS、Supabase/RLS、外部行情/许可、Firefox/WebKit、目标托管、远程同SHA CI、性能容量长稳、完整I7/G4/FEP-4和RELEASE保持未实现或NOT_RUN。VWAP为HLC3日内加权近似，指标/SVG是浮点可视化；原始价格/数量维持字符串精度。

## 变更文件（18项源码/测试/计划/规程）

- `apps/terminal/app/markets/chart/p19-components.tsx`
- `apps/terminal/app/markets/chart/workspace.css`
- `apps/terminal/app/markets/chart/workspace.tsx`
- `apps/terminal/src/markets/chart-policy.ts`
- `apps/terminal/src/markets/chart-runtime.ts`
- `apps/terminal/src/markets/p19-presentation.ts`
- `apps/terminal/tests/fixtures/scenarios/p19.ts`
- `apps/terminal/tests/ui-p19.test.tsx`
- `docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md`
- `docs/execution/development-followups.json`
- `docs/operations/ui-p19-candlestick-workbench.md`
- `package.json`
- `playwright.config.ts`
- `playwright.ui-p19.config.ts`
- `scripts/ui-p19-review.mjs`
- `scripts/ui-p19-review.test.mjs`
- `tests/e2e/ui-p19.spec.ts`
- `tests/e2e/ui402.spec.ts`

另外增加本报告和 `docs/audit/evidence/ui-p19-local-20261024/` 证据目录。下一任务为I7 UI-403：Performance、归因、周期报表。
