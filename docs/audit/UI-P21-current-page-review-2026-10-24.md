# UI-P21 I7 Performance 高保真页面与报告交互交付

日期2026-10-24（Asia/Shanghai）。基线 `c050373516b39035bb50ff4b538c5ec7291c05e5`；初始工程 `38b76a71b10d510659e25e497a25026e34ee7d1d`；最终冻结源码 `3b0eea66cf9be180dfb90db6d81d4c3740ddd913`。main直接开发，仅修改QuantOS；未使用生产凭据，未推送、部署或外部发布。证据另行本地提交。

## 结果与状态

工程 Gate **PASS_UI_P21_CURRENT_PAGE**，development_status=IMPLEMENTED_PENDING_ACCEPTANCE；用户确认待定。INTEGRATION/NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED；159项stage_gate不提升，完整I7/G4/FEP-4及发布未放行。下一原检查点 **FRONTEND-GATE:G4** 可开始有界功能组合与缺口评估，不能据此声称正式INTEGRATION准入。

## 交付与设计映射

依据 `design/P21-Performance-and-Reports-High-Fidelity-v1.png` 的共享Shell/确认条/筛选、五组指标、左分析右报表结构，实现 `/performance` 和 `/performance/reports/:reportId`。

- 指标：源P&L、simple收益率、源最大回撤/费用；精确十进制金额，长百分比可见省略并提供完整title/原始比率，已实现/未实现缺少拆分则显示—及原因。
- 图表：净值/累计权益差切换，源时间轴、指针/原生滑块键盘选点与精确快照/对账地址；provisional虚线+点+文本，数据缺口不连线、不补造序列。仅相对坐标转Number，金额/权益差BigInt十进制运算。
- 周期区域：源没有现金流调整周期收益率，明确展示“相邻快照权益变化 USD，含现金流，非周期收益率”；回撤读取源值，不补造恢复日期。标的归因、账本残差说明和可切换原始序列表完整保留版本/精度。
- 报表：右侧当前已应用期间/账户/口径/账本/估值版本，草稿更改须先读取；202仅queued，显式状态/文档读取，任务展开/聚焦/规范引用恢复、固定内容、到期/superseded拒绝、短时同源授权原字节下载。
- 报告与预览版本差异从当前两份数据推导，打开另一报告及刷新预览都更新。固定报告指标只描述生成时状态，不能写成当前来源已核对；针对性测试先红后绿记录保留。
- 保存视图仅白名单 `{metric,showTable}`，不保存账户、期间、金额、报告、ticket、CSRF、幂等键或权限；存储拒绝提示后继续使用。深浅主题、宽屏双栏与窄屏堆叠/键盘内部横滚沿用共享token。

参考稿超出现有API的TWR/MWR、基准/可比期间、已实现拆分/其他归因/周期现金流调整收益率、PDF/CSV、语言/订阅等明确不可用；实际仅Shadow/USD/simple/UTC/JSON。未篡改C14/C15契约或后端。未知请求原键恢复、429冷却、失权/离线/到期清屏和4MiB/10秒/hash/大小/fatal UTF8/固定元数据下载校验保持UI403边界。

## 测试命令与结果

最终执行：`node scripts/ui-p21-review.mjs --run docs/audit/evidence/ui-p21-local-20261024/attempt-02`。只读复核：`node scripts/ui-p21-review.mjs --verify`。

|命令与范围|最终结果|
|---|---|
|pnpm exec vitest run apps/terminal/tests/ui-p21.test.tsx apps/terminal/tests/ui403.test.ts apps/terminal/tests/ui403-provider-consumer.test.ts apps/terminal/tests/performance-provider-consumer.test.ts|55/55 PASS（20新页面、33当前财务/恢复、2实际provider consumer）|
|node --test scripts/ui-p21-review.test.mjs scripts/terminal-static-routes.test.mjs scripts/development-execution.test.mjs|60/60 PASS|
|pnpm --filter @sumalpha/terminal typecheck|PASS|
|pnpm exec eslint（当前页面/呈现/runtime/测试/门禁/配置）|PASS|
|cargo build --locked --offline -p bff-gateway --bin bff-gateway|PASS，仅reference功能服务构建|
|pnpm --filter @sumalpha/terminal build|PASS，client secret scan通过|
|pnpm exec playwright test --config=playwright.ui-p21.config.ts --project=chromium --workers=1 --retries=0|6/6 PASS|
|pnpm exec playwright test --config=playwright.ui403.config.ts --project=chromium --workers=1 --retries=0|8/8 PASS，直接成功/拒绝/恢复回归|
|node scripts/check-development-plans.mjs|PASS；159项NOT_ASSESSED|
|node scripts/development-execution.mjs --development FE:UI-P21|允许当前功能开发|
|node scripts/development-execution.mjs --integration FE:UI-P21|预期exit1/STAGE_NOT_READY|
|node scripts/development-execution.mjs --development FRONTEND-GATE:G4|允许有界功能组合/缺口评估，不授予INTEGRATION|

完整12项命令/退出码/时间/log hash见 [executions.json](./evidence/ui-p21-local-20261024/attempt-02/executions.json)。1631项输入、56项当前产物、64项历史文件hash及设计参考hash见 [receipt.json](./evidence/ui-p21-local-20261024/receipt.json)。

仅测试当前页面、财务runtime及直接UI403消费者/浏览器影响；不递归全链，不重跑无影响数据库或全仓campaign。常规场景使用实际本机C01/C14/C15 reference，identity/Cookie和CORS为显式loopback替代；dense/gap/负归因场景单列显式合成消费者，不能当作真实provider/真实现金流验收。runner白名单公开环境，不传DATABASE_URL/服务角色密钥。

## 可视复核与证据保留

最终8组dark/light × 1672/1440/1024/390概览、2组窄屏图表、固定报告和显式dense输入共12张页面截图；UI403直接回归另4张。已人工查看最终窄屏浅色图表、深色固定报告、深色dense图，以及预检概览/窄屏布局；报告状态、完整版本、暂定标识与源缺口清晰可识别。宽屏采用设计稿双栏关系，内容较长在main内部滚动；窄屏采用堆叠，图表/原始表格允许键盘横向滚动，不以viewport模拟代替native200%。

本页8次axe与直接回归4次均零violations。当前页面8条color-contrast incomplete扫描记录的节点出现数为31/31/27/14，深浅各一组（206次）；直接回归4条记录为31/14，深浅各一组（90次）。合计12条扫描记录、296节点出现，不能作为296个独立缺陷或人工验收通过。此前generic aria-label、链接非颜色区分、窄屏滚动键盘缺陷均已修复。

preflight-01保留初次SSR缺React导入诊断摘录、3/6浏览器失败（点数假设/链接样式/合成字段）；preflight-02保留5/6浏览器及窄屏axe失败；preflight-03原6/6仅未冻结工作树结果。预检02部分文件名dark未强制主题，可能实际浅色，原图不修改；最终显式媒体主题。preflight-04保留最后两项缺陷测试51通过/2失败和修复后53通过。

初始38b76a71的attempt-01虽通过53单元/14浏览器，后续审阅发现冻结状态文案/版本提示缺陷，**只保留原范围**，原receipt/result为 `original-attempt-01-*`。最终3b0eea66使用全新attempt-02，不拼接或改绑原PASS。原UI403证据64项原字节不变，ORIGINAL_SCOPE_ONLY；FEP5原组合义务与UI402/P19已知缺源不在本次关闭。

部分最终截图：[深色1672概览](./evidence/ui-p21-local-20261024/attempt-02/browser/ui-p21-P21-source-only-dar-692cf-art-table-scrolling-and-axe-chromium/p21-dark-1672.png)、[浅色390图表](./evidence/ui-p21-local-20261024/attempt-02/browser/ui-p21-P21-source-only-dar-692cf-art-table-scrolling-and-axe-chromium/p21-chart-light-390.png)、[固定报告](./evidence/ui-p21-local-20261024/attempt-02/browser/ui-p21-P21-draft-apply-que-f5f28-onical-refresh-are-explicit-chromium/p21-report-succeeded-dark-1440.png)。

## 风险与待验收

当前服务能力只有Shadow/USD/simple/UTC及JSON；缺少设计稿部分真实数据/格式。这些控件不可用，不是已完成后端能力。账户报表目录、跨重启未知意图恢复没有API/持久实现；列表仅本会话最多25引用。完整视觉/浏览器矩阵、人工读屏/native200%、跨OS仍NOT_RUN。

真实IdP/Cookie/CORS、Supabase/RLS/事务/持久审计、外部估值/真实现金流、跨实例/进程恢复、远程同SHA CI、Firefox/WebKit、目标托管、性能/容量/长稳、完整I7/G4/FEP-4/RELEASE均NOT_RUN。功能页面完成不代替正式签署或生产收益/资金正确性验收。

待确认范围：最终源码3b0eea66及对应attempt-02的当前本机页面/直接功能范围；若用户后续确认，应保存原始答复及当前摘要，仍不提升未执行的INTEGRATION/RELEASE和运行准入。

## 变更文件（16项代码/测试/计划/规程）

- `apps/terminal/app/performance/p21-components.tsx`
- `apps/terminal/app/performance/workspace.css`
- `apps/terminal/app/performance/workspace.tsx`
- `apps/terminal/src/performance/p21-presentation.ts`
- `apps/terminal/src/performance/runtime.ts`
- `apps/terminal/tests/ui-p21.test.tsx`
- `apps/terminal/tests/ui403.test.ts`
- `docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md`
- `docs/operations/ui-p21-performance-workbench.md`
- `package.json`
- `playwright.config.ts`
- `playwright.ui-p21.config.ts`
- `scripts/ui-p21-review.mjs`
- `scripts/ui-p21-review.test.mjs`
- `tests/e2e/fixtures/p21-series.ts`
- `tests/e2e/ui-p21.spec.ts`

另增加本报告及 `docs/audit/evidence/ui-p21-local-20261024/` 证据包。源码提交38b76a71、修复后冻结3b0eea66，证据单独本地提交。下一任务FRONTEND-GATE:G4：FEP-4有界真实模块组合、权限/错误/恢复/审计与缺口评估，保持正式联调门禁原状态。
