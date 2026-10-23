# UI-P06 Strategy Catalog / Lab 当前页面审阅

设计：[P06原图](../../design/P06-Strategy-Catalog-and-Strategy-Lab-High-Fidelity-v1.png)。实现映射、限定范围及操作见[规程](../operations/ui-p06-strategy-workbench.md)，最终结果以[证据回执](evidence/ui-p06-local-20261023/receipt.json)和索引为准。

交付目录卡片/表格、当前页搜索、排序/分页；Lab三栏文件/版本、文件内容与参数编辑、研究引用、Validation与实验区域；双主题、响应式、键盘页签、可恢复保存及409差异。仅使用当前C05事实；设计中的历史版本、静态检查Passed、进度/收益、许可批准和Release不可虚构。相应控制保留可理解的不可用说明，UI-302/UI-303义务继续存在。

当前任务会保存实际命令、输入/来源SHA、退出码、日志及图片摘要；预检、视觉基线建立与冻结后的独立重放分别记账。既有UI-301限定确认在独立目录中保持原始原文、范围和原候选；P06不改绑原确认，不提升G3/FEP-3、运行或发布。

stage_gate=NOT_ASSESSED，confirmation=PENDING，formalAccepted=false，runtimeAdmission=DENIED。真实身份、目标数据库/存储、托管rewrite、Firefox/WebKit、人工读屏/native200%、跨OS、CI、性能和完整联调/发布均NOT_RUN。最终工程Gate为PASS_UI_P06_CURRENT_PAGE，限定当前页面待项目用户确认。

## 最终候选与结果

源码SHA：`f2854052e55e9df0aca2ce5b0da9993d5839d3b4`。最终attempt-01在完整冻结候选执行，无更新快照参数；589项输入、63项产物经摘要校验。原UI-301确认提交为`9995b6a8`，新页面不改绑该确认。

| 命令 / 范围 | 结果 |
| --- | --- |
| `pnpm exec vitest run apps/terminal/tests/ui-p06-presentation.test.ts apps/terminal/tests/ui301.test.ts apps/terminal/tests/strategy-recovery.test.ts` | 55/55 PASS（17项P06、38项直接回归） |
| `pnpm --filter @sumalpha/terminal typecheck`、限定eslint | PASS |
| `node --test scripts/ui-p06-review.test.mjs scripts/ui301-confirmed-reference.test.mjs scripts/terminal-static-routes.test.mjs scripts/serve-static.test.mjs` | 15/15 PASS |
| `pnpm --filter @sumalpha/terminal build` | PASS，25条静态页，client-secret扫描101文件 |
| `pnpm exec playwright test --config=playwright.ui-p06.config.ts --project=chromium --workers=1 --retries=0` | 12/12 PASS（P06六项+UI301六项），0 skipped/flaky/retry |
| 独立视觉比较 | 10/10 PASS，像素差阈值0.005；动态ID/时间/引用显式遮罩 |
| P06 axe | 18次扫描，0 violations；18条color-contrast incomplete扫描记录保留 |
| 当前UI301浏览器回归axe | 12次扫描，0 violations；12条incomplete另存；原8条不关闭、不改绑 |
| 原UI301限定确认校验 | CONFIRMED，原工程0642eaad / 原包0eac15e4 |
| `node scripts/check-development-plans.mjs` | PASS；159项stage_gate仍NOT_ASSESSED |
| UI-P06 INTEGRATION执行 | 预期exit 1拒绝；完整联调未验收 |
| UI-302 DEVELOPMENT执行 | allowed=true |
| `node scripts/ui-p06-review.mjs --verify` | PASS |

完整命令、时间、退出码与摘要见[executions.json](evidence/ui-p06-local-20261023/attempt-01/executions.json)。两个预检均不是冻结验收：01修正辅助区域命名；02保留跨文件共享hook未注册的失败，修正显式安装后最终12项一次通过。详见[预检账本](evidence/ui-p06-local-20261023/preflights.json)。

## 设计与交付范围

原图三栏、目录/文件/版本、编辑器、参数、固定输入、Validation/实验及下方队列已映射到实际契约。原图示例收益/进度、历史版本、许可批准和Passed没有被当作事实；UI-302/UI-303及未发布创建接口继续待办。当前P06 Gate不宣称ST-P06-04/05/06及完整发布故事全部通过。[逐区视觉审阅](evidence/ui-p06-local-20261023/visual-review.json)由Codex进行，独立人工/用户视觉确认NOT_RUN；Storybook提供7个状态故事，但构建NOT_RUN。

Rust源码/工具链输入245项与原候选相同，binary摘要与原0642eaad构建相同，因此本轮不重建BFF、不重跑其历史Rust测试；运行fixture输入来源为实际f2854052。没有全仓/递归依赖闭包、数据库campaign或三轮复现构建；预检构建服务当前修复，最终一轮构建服务冻结后的独立视觉回放。

## 文件与下一步

变更包括`apps/terminal/app/strategies/`、`src/strategy/presentation.ts`和必要busy通知、P06/原UI301测试与reference harness、10张快照、限定验收工具、package入口、执行计划/文档与完整证据；精确清单见[changed-files.txt](evidence/ui-p06-local-20261023/changed-files.txt)。旧UI301源码提交、证据与确认保持原版本；新前端代码按本候选单独验证。

待确认文稿见[confirmation-draft.md](evidence/ui-p06-local-20261023/confirmation-draft.md)。下一原任务：**UI-302 静态检查、回测队列与报告**。
