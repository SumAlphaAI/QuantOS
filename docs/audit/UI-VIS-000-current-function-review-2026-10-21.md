# FE:UI-VIS-000 / I1 当前功能复核（2026-10-21）

当前功能实现及限定组件组合 **PASS**，INTEGRATION **NOT_ASSESSED**，新完整稿PENDING。最终工程源 `45f3a307f22b4281203e8bfb314c02181402e92e`，244项输入，摘要 `sha256:4272bd363423b52b34aaa104af20e81a105b8f7120751570ba2dd11adb5fe3d2`。只在main本地开发/提交，未使用生产凭据，未连接数据库，未推送或部署。

[完整确认稿](./evidence/ui-vis-000-local-20261021/confirmation-draft.md) · [机器回执](./evidence/ui-vis-000-local-20261021/receipt.json) · [命令/日志](./evidence/ui-vis-000-local-20261021/function-attempt-03/executions.json) · [完整变更文件](./evidence/ui-vis-000-local-20261021/changed-files.json)。

## 确认、直接前提与范围

保存项目用户本次原始答复及不可变UI-103稿/范围摘要，使用标准validateUserConfirmation核验。见[用户确认](./evidence/ui-103-confirmation-20261021/user-confirmation.json)、[确认原件核验](./evidence/ui-vis-000-local-20261021/ui103-confirmed-reference.json)。UI-103原receipt仍保留原PENDING事实，本会话确认由独立记录承载；人工读屏/原生200%保持NOT_RUN、阶段仍NOT_ASSESSED，不改写为READY。

UI-VIS-000的15直接前提：UI-103、12个BFF、PROVIDER:ALL和G0。按原source/receipt commit与摘要核验，[逐项引用](./evidence/ui-vis-000-local-20261021/direct-prerequisites.json)均为原范围reference-only，不重授新HEAD上游READY。未递归执行API/Rust/DB或全仓。C01/C16/C17只是共用视觉消费边界，不虚构真实BFF集成。

旧audit/gate共55243路径无改写，见[保护证明](./evidence/ui-vis-000-local-20261021/historical-preservation.json)。原UI-103/G0/ALL稿、回执、失败和确认保持原版本。

## 变更文件与行为

| 文件 | 作用 |
|---|---|
| packages/ui/src/components/Workspace.tsx | TerminalFrame插槽、键盘跳转、唯一关联ID；WorkspacePanel/Grid/Field/Chart；图表原始表可键盘展开，拒绝空/NaN/Infinity，极端有限值规范化避免SVG NaN |
| packages/ui/src/workspace.css、tokens/workspace.ts、theme/ThemeProvider.tsx、styles.css、index.ts | 抽取壳/导航/顶栏/状态条及面板样式；集中非状态强调/12px chrome、16px品牌/20px图标，正文/表格/标题沿用14/13/24px；自适应行高与窄屏换行 |
| packages/domain-ui/src/TerminalChrome.tsx、index.ts、package.json | 共用Header/Navigation，调用方传入已过滤路由；工作区只读、模式标识显式，未知模式不显示Live许可；不加载身份/账户/密钥 |
| apps/terminal/app/command/ui101-command-center.tsx、app/settings/_components/ui104-settings-workspace.tsx、app/globals.css | 两个实际消费者复用同一Frame/Header/Navigation，移除重复chrome/面板基础定义；保留页面守卫、受控回调、通知、离线与MFA动作，不升级mocked状态 |
| packages/domain-ui/src/workspace.stories.tsx、packages/ui/tests/workspace.test.tsx、packages/domain-ui/tests/chrome.test.tsx | 8种工作区故事；P02/P20组件组合仅视觉fixture，非真实trade页面或交易API；状态/字段/图表/导航语义回归 |
| scripts/ui-vis-000-{review.mjs,review.test.mjs,browser.mjs}、scripts/lib/ui-visual-server.mjs | 限定执行、逐输入Git/摘要绑定、准确命令/退出码/日志/产物核验、拒绝伪造阶段；独立随机loopback、禁止外部请求 |
| scripts/ui103-confirmed-reference.mjs、package.json、.github/workflows/frontend-baseline.yml | UI-103确认后原件核验替代对新功能输入重跑旧Gate；新视觉CI分离原范围工程参考与阶段准入；未执行远端CI |
| tests/e2e/visual-baselines.json、3张chromium-darwin PNG | 只迁移当前平台Command/Security/Browser1440基线；旧原件保存在本轮migration/before，不伪造其他平台 |
| 计划、本报告、docs/adr/20261021-ui-vis-000-shared-workspace.md、evidence目录 | 状态同步、设计约束、确认原文、失败trace、当前证据及新待确认稿 |

设计采用P02 v1与P20 v3的层次/几何，颜色优先PRE-02冻结语义，不声称与演示图片逐像素一致。新增品牌强调色不是健康/allow色；tokens.json、18条安全文案及全部状态文字保留字节/内容一致，专项反证已覆盖。

## 实际命令与结果

最终执行：`node scripts/ui-vis-000-review.mjs --run docs/audit/evidence/ui-vis-000-local-20261021/function-attempt-03`。

| 组 | 命令 | 结果 |
|---|---|---|
| unit | `pnpm exec vitest run packages/ui/tests packages/domain-ui/tests apps/terminal/tests/ui101-runtime.test.ts apps/terminal/tests/ui104-settings.test.ts` | exit0 |
| types | `pnpm --filter @sumalpha/ui --filter @sumalpha/domain-ui --filter @sumalpha/terminal typecheck` | exit0 |
| lint | `pnpm --filter @sumalpha/ui --filter @sumalpha/domain-ui --filter @sumalpha/terminal lint` | exit0 |
| tokens | `node packages/ui/scripts/pre02-checks.mjs` | exit0 |
| negative | `node --test packages/ui/scripts/pre02-gate-negative.mjs scripts/frontend-import-boundary.test.mjs scripts/ui-vis-000-review.test.mjs` | exit0 |
| storybook | `pnpm --filter @sumalpha/ui build-storybook` | exit0 |
| terminal | `pnpm --filter @sumalpha/terminal build` | exit0 |
| consumer | `pnpm exec playwright test tests/e2e/command.spec.ts tests/e2e/ui104-settings.spec.ts --grep-invert 视觉基线|visual baselines --project=chromium --workers=1 --retries=0 --update-snapshots=none --reporter=list` | exit0 |
| component-browser | `node scripts/ui-vis-000-browser.mjs docs/audit/evidence/ui-vis-000-local-20261021/function-attempt-03/browser` | exit0 |
| plans | `node scripts/check-development-plans.mjs` | exit0 |

15文件、78单测PASS/3既有外部引擎探针跳过；79 Node反证PASS（27设计、37边界、15本任务）；PRE02的252对WCAG token和18安全键通过。当前成功候选Storybook与Terminal各构建一次，Terminal静态客户端秘密检查PASS；无全仓、三轮构建或递归依赖验收。历史开发尝试中的构建/结果保留原适用输入。

直接Command/Settings Chromium13例通过：六步守卫首屏、组件、筛选/侧栏、小屏、设置4路由、通知降级、下载可聚焦、MFA短语/初始取消/撤销回执、CSS zoom=2、离线禁写和axe。新8故事×2主题，加Portal与768/390/720回流，共20次axe，报告违规0，19次color-contrast incomplete保留。CSS缩放/等效回流不代表人工原生200%。

[视觉迁移命令](./evidence/ui-vis-000-local-20261021/visual-baseline-migration/executions.json)：仅两个视觉测试/三张图片，先`--update-snapshots=changed`初始化新设计，再同构建`--update-snapshots=none`实际比较2/2PASS；不称旧图比较PASS。当前[视觉审阅](./evidence/ui-vis-000-local-20261021/visual-review.json)记录10张图实际像素检查；原PNG/旧manifest另存，不覆盖历史audit原件。`node scripts/check-visual-baselines.mjs`24文件完整性与`node scripts/check-pre06.mjs`静态结构通过，不是跨平台新视觉验收。

## 失败、Gate与未决风险

首轮开发lint发现Settings通知区域被遗漏，已恢复；development-02浅色PAPER背景4.41对比度失败，改为透明底后通过。function-attempt-01单测78通过后Storybook decorator导出类型TS2742失败，构建未运行；d2bf0259明确Meta类型/集中token。attempt-02直接消费者12通过/1失败：390px CSS zoom=2时页面宽409，实际trace/错误保留。45f3a307调整顶栏最小宽度、换行与壳自适应行高，attempt-03全10组通过。没有拼接不同候选的PASS。

功能/限定组件组合PASS，INTEGRATION NOT_ASSESSED，formalAccepted=false、runtime DENIED。人工读屏/原生200%仍NOT_RUN；19项incomplete不作人工通过。原UI103确认不覆盖本次新视觉范围，新稿PENDING。真实BFF/IdP/业务组合、目标环境、性能/长稳、远程同SHA CI及RELEASE设计签署NOT_RUN。

Linux及Firefox/WebKit基线仍属旧设计，尚未在对应runner迁移；完整现有视觉CI比较可能拒绝，这不被静态完整性PASS消除。没有复制本机图到其他平台，也未禁用测试/放宽0.005阈值。主页面现有业务mock、固定占位数据和部分入口联调义务继续由后续页面任务承担。

本地提交：3abc5149初始共享视觉/确认、d2bf0259类型与token修复、45f3a307缩放修复；最终文档/基线提交见Git日志。下一可执行为审阅本任务完整稿，继而FE:UI-102 / I1当前功能复核；严格整阶段准入仍须补齐未执行事项，功能阶段不扩大为上游全闭包。
