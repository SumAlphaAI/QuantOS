# UI-P02 当前页面功能报告（2026-10-22）

`/command` 已实现P02高保真布局与C02事实展示，页面工程、客户端契约和受控本机组合通过；状态为 `COMPLETED`（仅原完整稿当前功能范围）。项目用户已在本会话确认，确认门禁见[记录](./evidence/ui-p02-confirmation-20261022/README.md)；原稿及原receipt保留PENDING历史字节，独立closure-proof记录本次CONFIRMED。INTEGRATION NOT_ASSESSED，formalAccepted=false，runtimeAdmission=DENIED。未推送、部署或使用生产凭据。

冻结工程 `a2132f51276d6fb802ec0094ab40fba3052fc860`，1311项输入，`sha256:be750de6b01800f7ea5f8b6c674edf2bc55ba651f507b2b21125a498a08fb748`。原始记录见[机器回执](./evidence/ui-p02-local-20261022/receipt.json)、[输入](./evidence/ui-p02-local-20261022/function-attempt-01/inputs.json)、[实际执行](./evidence/ui-p02-local-20261022/function-attempt-01/executions.json)、[完整确认稿](./evidence/ui-p02-local-20261022/confirmation-draft.md)、[历史](./evidence/ui-p02-local-20261022/attempt-history.json)。后续文档/证据提交不改绑为新HEAD通过；16项直接前提仅冻结原需求引用，无递归复验或新READY授予。

## 变更与结果

Command页面消费真实C02形状数据；卡片、待办、活动、逐源健康与导航按实际权限和来源状态裁剪。移除2/18/4/通知3等页面兜底，未知保留—、真实0保持0；Actor、审计correlation ID、延迟和可用率没有契约事实时不推断。深浅主题、1440/1024/390、CSS zoom=2、键盘筛选/列表展开、折叠/紧凑布局与重置可用。布局仅存两个布尔值，不保存业务事实或身份信息。

顺序校验session/context/summary及最早有效期；校验账户、mode、来源集合、partial、来源时间/哈希、Ready来源TTL、订单mode和kind/id精确匹配的站内资源路径。源陈旧、畸形、过期或跨作用域时拒绝；刷新与断网恢复重新验证权限，不自动重放写意图。HTTP只读快照明确未订阅实时流，风险写入和研究/策略创建保留原边界，后续模块目标页须独立鉴权。原UI101守卫及共享Chrome使用者做直接回归。

Rust本机组合使用现有reference BFF进程与种子来源，浏览器通过测试身份/CORS桥接，原响应体保持不变。4种身份验证当前/owner成功、viewer拒绝、无效session回登录；只发生GET。该组合不能代替真实IdP、真实浏览器Cookie/CORS或目标数据库。详细边界见[运行规程](../operations/ui-p02-current-function.md)。

## 测试命令与原始结果

入口：`node scripts/ui-p02-review.mjs --run docs/audit/evidence/ui-p02-local-20261022/function-attempt-01`；复核：`node scripts/ui-p02-review.mjs --verify`。使用仓库固定pnpm 10.20.0，非mock构建显式 `NEXT_PUBLIC_QUANTOS_ENV=local-integrated NEXT_PUBLIC_QUANTOS_MOCK_ENABLED=false`；mock构建仅用于原页面直接回归。环境变量由公开配置白名单过滤，无数据库测试、依赖链campaign或全仓覆盖率运行。

| 检查 | 实际命令 | 结果 | 原始证据 |
|---|---|---|---|
| bff-build | `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | PASS | [日志](./evidence/ui-p02-local-20261022/function-attempt-01/bff-build.log) |
| unit | `pnpm exec vitest run apps/terminal/tests/ui-p02-presentation.test.ts apps/terminal/tests/ui101-source.test.ts apps/terminal/tests/ui101-runtime.test.ts apps/terminal/tests/ui101-http.test.ts apps/terminal/tests/command-provider-consumer.test.ts packages/domain-ui/tests/ui101.test.ts packages/domain-ui/tests/chrome.test.tsx packages/domain-ui/tests/indicators.test.tsx` | PASS：8文件 / 76项 | [日志](./evidence/ui-p02-local-20261022/function-attempt-01/unit.log) |
| types | `pnpm --filter @sumalpha/api-client --filter @sumalpha/domain-ui --filter @sumalpha/terminal typecheck` | PASS | [日志](./evidence/ui-p02-local-20261022/function-attempt-01/types.log) |
| lint | `pnpm --filter @sumalpha/domain-ui --filter @sumalpha/terminal lint` | PASS | [日志](./evidence/ui-p02-local-20261022/function-attempt-01/lint.log) |
| test-lint | `pnpm exec eslint tests/e2e/ui-p02.spec.ts tests/e2e/ui-p02-http.spec.ts tests/e2e/ui101-bff.spec.ts tests/e2e/fixtures/ui-p02.ts tests/e2e/fixtures/ui101.ts tests/e2e/command.spec.ts playwright.config.ts playwright.ui-p02.config.ts scripts/ui-p02-review.mjs scripts/ui-p02-review.test.mjs` | PASS | [日志](./evidence/ui-p02-local-20261022/function-attempt-01/test-lint.log) |
| negative | `node --test scripts/ui-p02-review.test.mjs scripts/frontend-import-boundary.test.mjs` | PASS：58项 | [日志](./evidence/ui-p02-local-20261022/function-attempt-01/negative.log) |
| terminal-bff | `pnpm --filter @sumalpha/terminal build` | PASS | [日志](./evidence/ui-p02-local-20261022/function-attempt-01/terminal-bff.log) |
| browser | `pnpm exec playwright test --config=playwright.ui-p02.config.ts tests/e2e/ui-p02.spec.ts --grep-invert visual baseline --project=chromium --project=webkit --workers=1 --retries=0 --update-snapshots=none --reporter=list,json --output=docs/audit/evidence/ui-p02-local-20261022/function-attempt-01/browser/results` | PASS：38项 / Chromium+WebKit | [日志](./evidence/ui-p02-local-20261022/function-attempt-01/browser.log) |
| local-http | `pnpm exec playwright test --config=playwright.ui-p02.config.ts tests/e2e/ui-p02-http.spec.ts --project=chromium --workers=1 --retries=0 --update-snapshots=none --reporter=list,json --output=docs/audit/evidence/ui-p02-local-20261022/function-attempt-01/local-http/results` | PASS：4项 / actual Rust reference + test bridge | [日志](./evidence/ui-p02-local-20261022/function-attempt-01/local-http.log) |
| regression | `pnpm exec playwright test --config=playwright.ui-p02.config.ts tests/e2e/ui101-bff.spec.ts --project=chromium --workers=1 --retries=0 --update-snapshots=none --reporter=list,json --output=docs/audit/evidence/ui-p02-local-20261022/function-attempt-01/regression/results` | PASS：14项 / Chromium | [日志](./evidence/ui-p02-local-20261022/function-attempt-01/regression.log) |
| visual | `pnpm exec playwright test --config=playwright.ui-p02.config.ts tests/e2e/ui-p02.spec.ts --grep visual baseline --project=chromium --workers=1 --retries=0 --update-snapshots=none --reporter=list,json --output=docs/audit/evidence/ui-p02-local-20261022/function-attempt-01/visual/results` | PASS：2项 / Darwin Chromium深浅图像比较 | [日志](./evidence/ui-p02-local-20261022/function-attempt-01/visual.log) |
| terminal-mock | `pnpm --filter @sumalpha/terminal build` | PASS | [日志](./evidence/ui-p02-local-20261022/function-attempt-01/terminal-mock.log) |
| mock-regression | `pnpm exec playwright test tests/e2e/command.spec.ts --project=chromium --workers=1 --retries=0 --update-snapshots=none --reporter=list,json --output=docs/audit/evidence/ui-p02-local-20261022/function-attempt-01/mock-regression/results` | PASS：7项 / 含原Command视觉比较 | [日志](./evidence/ui-p02-local-20261022/function-attempt-01/mock-regression.log) |
| firefox-diagnostic | `node scripts/ui-p01-browser-environment.mjs docs/audit/evidence/ui-p02-local-20261022/function-attempt-01/firefox-environment.json` | 诊断完成；启动失败，功能BLOCKED_ENVIRONMENT | [日志](./evidence/ui-p02-local-20261022/function-attempt-01/firefox-diagnostic.log) |
| baselines | `node scripts/check-visual-baselines.mjs` | PASS：36登记项（静态完整性） | [日志](./evidence/ui-p02-local-20261022/function-attempt-01/baselines.log) |
| plans | `node scripts/check-development-plans.mjs` | PASS：计划结构/依赖校验 | [日志](./evidence/ui-p02-local-20261022/function-attempt-01/plans.log) |

共76单元/组合、58门禁/边界、65浏览器用例；其中38为双浏览器P02功能，4为实际本机Rust组合、14为原守卫回归、2为新视觉、7为原mock回归。全部重试0、skip0、flaky0。3张像素比较为本机Darwin Chromium（P02深/浅与原mock深色）。12组P02浏览器/主题/视口axe扫描违规0，incomplete 24项：aria-prohibited-attr 12、color-contrast 12；原样保存，未推断人工通过。另有既有守卫/mock用例各自的axe附件，均按原断言执行。

视觉登记校验PASS只证明36项登记/文件hash一致。补登记P01原10图保持原字节，新增P02双主题本机基线，更新当前Command Chromium/Darwin图像；[原Command图像与登记](./evidence/ui-p02-local-20261022/legacy-visual-before/)逐字节绑定b6537135。新基线初始化不等于独立设计签署；其他浏览器/OS历史图像未重录或改绑，当前比较NOT_RUN。代表性深浅截图已由Codex查看。

## 未决风险与Gate

- Firefox独立启动10秒超时，原始[环境诊断](./evidence/ui-p02-local-20261022/function-attempt-01/firefox-environment.json)保留；功能BLOCKED_ENVIRONMENT，不计PASS。
- 真实IdP/MFA、目标BFF/数据库、真实浏览器Cookie/CORS、人工读屏、原生200%缩放、跨OS视觉、远程同SHA CI、性能/容量/长稳及RELEASE均NOT_RUN。CSS zoom=2不替代原生缩放；自动axe incomplete不替代人工读屏。
- 当前是租约内HTTP快照，非实时SSE；权限刷新/到期/网络恢复才重新核验。目标研究/策略创建及资源详情等后续页面不在此任务实现；搜索/通知契约缺失时明确禁用，完整英文文案后续完善。
- 当前功能工程PASS、客户端契约PASS、受控本机组合PASS_REFERENCE_FIXTURES_ONLY；用户已确认原稿当前功能范围，INTEGRATION NOT_ASSESSED，formalAccepted=false，runtimeAdmission=DENIED。原P01及所有既有确认/NOT_RUN保持原范围。

项目用户已确认[完整六维原稿](./evidence/ui-p02-local-20261022/confirmation-draft.md)，[原始答复](./evidence/ui-p02-confirmation-20261022/raw-user-message.txt)与范围摘要独立保存；仅绑定a2132f51工程及a9a3dbc7证据包，原稿不改写，未授予后续HEAD、联调、运行或发布准入。下一可执行开发任务 **FE:UI-P15 / I1**；不等待无关联调或发布campaign。

## 工程变更文件

- `apps/terminal/app/command/p02.css`
- `apps/terminal/app/command/ui101-command-center.tsx`
- `apps/terminal/app/command/ui101-command-route.tsx`
- `apps/terminal/src/command/fixture.ts`
- `apps/terminal/src/command/gateway.ts`
- `apps/terminal/src/command/model.ts`
- `apps/terminal/src/command/presentation.ts`
- `apps/terminal/src/command/source.ts`
- `apps/terminal/tests/ui-p02-presentation.test.ts`
- `apps/terminal/tests/ui101-source.test.ts`
- `docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md`
- `docs/audit/UI-P02-current-function-review-2026-10-22.md`
- `docs/operations/ui-p02-current-function.md`
- `packages/domain-ui/src/TerminalChrome.tsx`
- `packages/domain-ui/tests/chrome.test.tsx`
- `playwright.config.ts`
- `playwright.ui-p02.config.ts`
- `scripts/ui-p02-review.mjs`
- `scripts/ui-p02-review.test.mjs`
- `tests/e2e/command.spec.ts`
- `tests/e2e/command.spec.ts-snapshots/command-1440-dark-chromium-darwin.png`
- `tests/e2e/fixtures/ui-p02.ts`
- `tests/e2e/fixtures/ui101.ts`
- `tests/e2e/ui-p02-http.spec.ts`
- `tests/e2e/ui-p02.spec.ts`
- `tests/e2e/ui-p02.spec.ts-snapshots/p02-command-dark-chromium-darwin.png`
- `tests/e2e/ui-p02.spec.ts-snapshots/p02-command-light-chromium-darwin.png`
- `tests/e2e/ui101-bff.spec.ts`
- `tests/e2e/visual-baselines.json`

原始预检、执行日志、截图、trace、JSON、输入、回执与确认稿位于 `docs/audit/evidence/ui-p02-local-20261022/`，目录[完整hash索引](./evidence/ui-p02-local-20261022/evidence-index.json)不包含索引自身。最终文档/证据提交仅补齐报告、计划当前状态与证据；本地提交SHA以任务完成报告和Git历史为准。

原始Playwright失败上下文四个文件含工具生成的行尾空白，首次暂存检查如实保存为 `precommit-whitespace-before.log`；仅在 `.gitattributes` 对四个精确路径豁免空白检查，未修改原始证据字节。
