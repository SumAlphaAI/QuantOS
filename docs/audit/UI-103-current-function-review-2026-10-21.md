# FE:UI-103 / I1 当前功能复核（2026-10-21）

当前工程与限定组件组合验证 PASS；**INTEGRATION NOT_ASSESSED**，新完整稿 PENDING。工程证据源 `804f52d1e5a2202449b05a75ca8a464a65a15eff`，233输入，摘要 `sha256:09830e77af6513ba1fbb80e22c78ce3a3a7dff35fea56fd53ac1bdf65851b2d5`。汇总器修复源 `c5d16d00`，只变更汇总器及其测试，补27项回归，原组件源码/15组执行不改绑到新HEAD。无推送、部署、外部业务连接或生产凭据。

[完整确认稿](./evidence/ui-103-local-20261021/confirmation-draft.md) · [机器回执](./evidence/ui-103-local-20261021/receipt.json) · [命令/日志/摘要](./evidence/ui-103-local-20261021/function-attempt-01/executions.json) · [233项输入](./evidence/ui-103-local-20261021/function-attempt-01/inputs.json) · [完整变更文件](./evidence/ui-103-local-20261021/changed-files.json)。

## 直接前提与版本

17个直接前提逐项记录原receipt/source commit、SHA256及覆盖归属。[预检](./evidence/ui-103-local-20261021/preflight/prerequisites.json)在改代码前实际验证确认后的G0/ALL；[逐项引用](./evidence/ui-103-local-20261021/preflight/direct-references.json)覆盖PRE02/03/06的原P0、BFF000–011和G0/ALL原件。它们是reference-only/NOT_REVALIDATED，不授予新源码上游READY。旧G0/ALL仍绑定4fdc67b4；当前计划的G0/ALL stage_gate已恢复NOT_ASSESSED，原确认/回执、19子项台账及历史正式字段未改写。55,142个既有audit/gate文件路径无修改，见[保护核验](./evidence/ui-103-local-20261021/historical-preservation.json)。不递归执行API、Rust、数据库或全闭包。

## 修复与变更文件

| 变更文件 | 原因与结果 |
|---|---|
| packages/ui/src/components/DataGrid/DataGrid.tsx | 数据替换/服务器导航重置并夹紧虚拟窗口；两侧固定列按实测宽度累积；唯一标题ID、可聚焦滚动区域、虚拟行数/行号及caption；本地化内置状态与操作；保留外部URL参数 |
| packages/ui/src/components/DangerConfirmDialog/{DangerConfirmDialog.tsx,confirmation-policy.ts} | 空配置拒绝、精确短语/MFA格式；同步提交锁、防重复及pending退出拒绝；失败提示脱敏、MFA清空后可重试；Portal随主题/语言切换 |
| packages/ui/src/components/{EvidenceTimeline/EvidenceTimeline.tsx,StateBadge/StateBadge.tsx} | 唯一标题关联、双语证据状态/详情；显式客户端边界 |
| packages/ui/src/{i18n/en.json,i18n/zh-CN.json,index.ts,styles.css} | 新增非冻结安全文案的ui键，导出可选locale上下文；根盒模型、弹窗前景层级、证据长文本回流；显示列菜单不被裁切，小屏取消重叠固定带 |
| packages/domain-ui/src/indicators.tsx | 指标遵从全局语言，英文使用冻结状态标签；显式locale优先；未知/原型风险枚举阻断、未知连接退为离线 |
| packages/domain-ui/src/ui103.stories.tsx | 可运行的真实组件组合/本地callback场景：长短数据、URL/列/排序/页、主题语言、MFA/成功/拒绝/pending |
| packages/ui/tests/ui103-interactions.test.tsx、packages/domain-ui/tests/indicators.test.tsx、tests/e2e/command.spec.ts | 行为回归和直接消费者英文可访问名称同步；保留既有断言 |
| scripts/ui-103-{functional-review.mjs,functional-review.test.mjs,browser-probe.mjs}、package.json、.github/workflows/frontend-baseline.yml | 限定执行、原件/SHA/命令/日志/产物验证、错误阶段晋级反证、独立loopback浏览器；新增本地/CI检查入口，未执行远程CI |
| 开发计划、本报告、docs/operations/ui-103-current-function.md、本任务evidence目录 | 计划/分阶段状态、原始失败、截图、确认稿及可复查回执 |

## 实际命令与结果

执行器：`node scripts/ui-103-functional-review.mjs --run docs/audit/evidence/ui-103-local-20261021/function-attempt-01`。下列15组均实际exit0；最初执行器最终汇总exit1，故不能把原调用整体写为PASS。汇总器修复后通过`--complete-attempt`读取未改写的原件完成回执；没有再次执行构建/浏览器或上游。

| 检查 | 完整命令 | 结果 |
|---|---|---|
| unit | `pnpm exec vitest run packages/ui/tests packages/domain-ui/tests` | exit 0 |
| danger-policy-coverage | `pnpm exec vitest run packages/ui/tests/ui103.test.tsx packages/ui/tests/ui103-interactions.test.tsx --coverage --coverage.include=packages/ui/src/components/DangerConfirmDialog/confirmation-policy.ts --coverage.reporter=json-summary --coverage.reportsDirectory=docs/audit/evidence/ui-103-local-20261021/function-attempt-01/coverage --coverage.thresholds.branches=100 --coverage.thresholds.lines=100 --coverage.thresholds.functions=100 --coverage.thresholds.statements=100` | exit 0 |
| types | `pnpm --filter @sumalpha/ui --filter @sumalpha/domain-ui --filter @sumalpha/terminal typecheck` | exit 0 |
| lint | `pnpm --filter @sumalpha/ui --filter @sumalpha/domain-ui --filter @sumalpha/terminal lint` | exit 0 |
| design | `node packages/ui/scripts/pre02-checks.mjs` | exit 0 |
| design-negative | `node --test packages/ui/scripts/pre02-gate-negative.mjs` | exit 0 |
| pre06 | `node scripts/check-pre06.mjs` | exit 0 |
| boundary | `node --test scripts/frontend-import-boundary.test.mjs scripts/ui-103-functional-review.test.mjs` | exit 0 |
| storybook-build | `pnpm --filter @sumalpha/ui build-storybook` | exit 0 |
| terminal-build | `pnpm --filter @sumalpha/terminal build` | exit 0 |
| terminal-consumer | `pnpm exec playwright test tests/e2e/command.spec.ts --grep 复用 UI-103|路由可打开|axe 无 --project=chromium --workers=1 --retries=0 --update-snapshots=none --reporter=list` | exit 0 |
| browser | `node scripts/ui-103-browser-probe.mjs docs/audit/evidence/ui-103-local-20261021/function-attempt-01/browser` | exit 0 |
| plans | `node scripts/check-development-plans.mjs` | exit 0 |
| g0-disposition | `node scripts/ci-stage-disposition.mjs FRONTEND-GATE:G0` | exit 0 |
| all-disposition | `node scripts/ci-stage-disposition.mjs PROVIDER:ALL` | exit 0 |

unit：11文件、50通过/3跳过（既有外部引擎探针，未启动引擎）；危险策略限定覆盖：另11通过，4/4分支、1/1行/函数/语句均100%。design：252对WCAG token、18安全键；design-negative27通过，boundary60通过（含本任务原23项）；工具修复后追加27通过，不能和原23简单累加成独立覆盖。

Storybook与Terminal各构建一次；Terminal静态客户端秘密扫描64文件通过，Chromium直接消费者3例通过。组件Chromium151：60故事×双主题=120次，另7次真正Portal的axe扫描，共127次，报告违规0；49次扫描保留incomplete（含color-contrast、aria-prohibited-attr），不当作人工通过。17类交互控制检查成功，10张最终截图以`view_image`逐图检查，见[截图审阅](./evidence/ui-103-local-20261021/visual-review.json)、[浏览器回执](./evidence/ui-103-local-20261021/function-attempt-01/browser/browser.json)、[axe原件](./evidence/ui-103-local-20261021/function-attempt-01/browser/axe.json)。截图为新组件捕获，不是跨平台视觉回归。

## 失败保留与恢复

- preflight首轮Node stdin缺argv[1]，导入旧CLI guard抛TypeError；设定调用身份后只读预检通过。保留摘要。
- development-01：英文状态原始枚举、双告警选择器和测试ByRoleOptions类型错误；development-02：焦点回归断言需等待Radix异步恢复；这些失败与修复后的检查分别保存。首次单测没有完整原始stdout，只保留明确标注的观察摘要，不能当原始日志。
- 浏览器首轮故事目录匹配错误及隐藏Storybook错误模板计数不当；修正探针后发现390px弹窗越界/被固定表格覆盖的真实缺陷。development-04失败截图保留；修复根盒模型、层级及小屏固定带，development-05聚焦复测PASS但completeStoryMatrix=false，不能替代最终矩阵。
- 冻结804f52d1的15组均通过后，汇总器误读混合axe/布局记录失败。原[失败记录](./evidence/ui-103-local-20261021/function-attempt-01/verification-failure.json)保留；c5d16d00工具修复另做27项回归与逐输入delta核验，见[修复证明](./evidence/ui-103-local-20261021/function-attempt-01/tool-repair/proof.json)。只准许汇总器/其测试2路径改变，拒绝运行时代码、命令或要求变化；不重绑原执行SHA。

## Gate、未决事项和下一任务

功能实现/本地组件组合PASS；UI-103计划阶段仍为INTEGRATION NOT_ASSESSED，formalAccepted=false、runtime DENIED。人工VoiceOver/NVDA读屏NOT_RUN、原生浏览器200%缩放NOT_RUN（720 CSS像素仅1440/200%等效回流PASS）；49项axe incomplete没有被自动升级。真实业务MFA/RBAC/幂等/风险权限不属于此UI组件校验。完整业务联调、目标环境、远程同SHA CI、性能/长稳、发布均NOT_RUN。新稿PENDING，确认不能代替未执行检查。

本地提交：804f52d1功能冻结；c5d16d00原件保存与汇总器修复；最终文档/证据收口提交见Git日志。当前可执行：审阅确认稿及补人工读屏/原生缩放，独立评估UI-103阶段收口。下一开发项UI-VIS-000 / I1当前功能复核；功能阶段不扩大为旧API全闭包，严格整阶段准入不提前通过。
