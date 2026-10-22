# UI-P01 当前页面功能实现与验收证据（2026-10-22）

当前页面工程及客户端契约组合 **PASS（限定范围）**。计划记 `IMPLEMENTED_PENDING_ACCEPTANCE`；INTEGRATION `NOT_ASSESSED`，用户确认 `PENDING`；`formalAccepted=false`，`runtimeAdmission=DENIED`。Firefox `BLOCKED_ENVIRONMENT`，不声称完整跨浏览器通过。

冻结工程源码 `5f7aec514f20f1dacbc9d7e6f5580186d3aeca2d`，输入1001项，摘要 `sha256:17a0faa963b4503712c214f307d38600511df4e7930d54ac94161d9b9a4b80cd`；当前工程文件与该快照一致。后续文档/证据提交不改绑运行结果到新HEAD。源代码始终在main，未推送、未部署、未使用生产凭据。

## 功能与变更文件

依据[执行计划UI-P01](../SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md#task-ui-p01)及[设计稿](../../design/P01-Identity-Access-Recovery-High-Fidelity-v1.png)，交付 `/login`、`/mfa`、`/access-request`、`/unauthorized`、`/offline`；复用UI-102与C01，不改BFF契约。

- 登录：组织OIDC+PKCE入口、离线拒绝、同步防重复；站内安全返回排除认证/恢复循环。
- MFA：六格键盘/粘贴/系统填充、失败清码和焦点恢复、401安全登录、429真实期限禁用；结果未知要求重新登录核查。
- 申请：市场/Research-Paper-Shadow/用途/明确隐私同意/honeypot；保留输入、202关联ID与仅受理语义；并发单发，断网/卸载取消等待；超时、5xx、畸形响应和网络失败保留未知，核查后明确手动重提。
- 无权与恢复：账户/资源存在性隐藏、复制失败可手动复制、帮助/隐私/安全说明可展开、网络恢复只重新验证，不重放旧意图。
- 视觉：深浅主题、原生表单语义、SVG状态图标、390px及CSS zoom重排；未把设计中的示例ID或固定锁定时长当业务事实。

30项工程/测试/文档/基线文件，另加本轮证据和`.gitattributes`中5个原始失败上下文文件的精确空白例外。完整逐文件清单见[changed-source-files.json](./evidence/ui-p01-local-20261022/changed-source-files.json)。

| 分组 | 主要路径 |
|---|---|
| 页面与共享UI | `apps/terminal/app/{login,mfa,access-request,unauthorized,offline}/page.tsx`、`app/_components/{auth-surface,auth-icon,use-identity-action}.tsx/ts`、`app/globals.css` |
| 生命周期与安全返回 | `apps/terminal/src/identity/action.ts`、`apps/terminal/src/auth/flow.ts` |
| 测试与视觉基线 | `apps/terminal/tests/ui-p01-action.test.ts`、`tests/e2e/ui-p01.spec.ts`、`tests/e2e/ui102-auth.spec.ts`、10张`ui-p01.spec.ts-snapshots/*.png` |
| 校验工具 | `scripts/ui-p01-review.mjs`、`scripts/ui-p01-review.test.mjs`、`scripts/ui-p01-browser-environment.mjs` |
| 规程与计划 | [运行规程](../operations/ui-p01-current-function.md)、本报告、执行计划UI-P01状态 |

## 实际执行

最终批次[function-attempt-03](./evidence/ui-p01-local-20261022/function-attempt-03/executions.json)，11入口exit0，其中Firefox入口只采集环境失败诊断。102单元/组合、54 Node门禁/边界、26当前功能（Chromium/WebKit各13）、18 Chromium认证回归、2视觉用例/10张双主题比较均通过；单次Terminal静态构建、types、lint、client-secret扫描和计划结构校验通过。全部浏览器检查`retries=0`、视觉`update-snapshots=none`，没有跳过或flaky计为通过。

| 入口 | 原始命令 | 结果 |
|---|---|---|
| `unit` | `pnpm exec vitest run apps/terminal/tests/ui-p01-action.test.ts apps/terminal/tests/auth-poc.test.ts apps/terminal/tests/auth-bff.test.ts apps/terminal/tests/ui102-callback-lifecycle.test.ts apps/terminal/tests/deep-link-auth.test.ts apps/terminal/tests/ui101-runtime.test.ts apps/terminal/tests/ui104-settings.test.ts` | exit 0 |
| `types` | `pnpm --filter @sumalpha/api-client --filter @sumalpha/terminal typecheck` | exit 0 |
| `lint` | `pnpm --filter @sumalpha/terminal lint` | exit 0 |
| `test-lint` | `pnpm exec eslint tests/e2e/ui-p01.spec.ts tests/e2e/ui102-auth.spec.ts scripts/ui-p01-review.mjs scripts/ui-p01-review.test.mjs scripts/ui-p01-browser-environment.mjs` | exit 0 |
| `negative` | `node --test scripts/ui-p01-review.test.mjs scripts/frontend-import-boundary.test.mjs` | exit 0 |
| `build` | `pnpm --filter @sumalpha/terminal build` | exit 0 |
| `firefox-diagnostic` | `node scripts/ui-p01-browser-environment.mjs docs/audit/evidence/ui-p01-local-20261022/function-attempt-03/firefox-environment.json` | 诊断完成：Firefox启动失败，不是功能PASS |
| `browser` | `pnpm exec playwright test tests/e2e/ui-p01.spec.ts --grep-invert visual baselines --project=chromium --project=webkit --workers=1 --retries=0 --update-snapshots=none --reporter=list,json --output=docs/audit/evidence/ui-p01-local-20261022/function-attempt-03/browser/results` | exit 0 |
| `regression` | `pnpm exec playwright test tests/e2e/ui102-auth.spec.ts tests/e2e/ui102-current.spec.ts tests/e2e/auth-callback.spec.ts --grep-invert 视觉基线|visual baselines --project=chromium --workers=1 --retries=0 --update-snapshots=none --reporter=list,json --output=docs/audit/evidence/ui-p01-local-20261022/function-attempt-03/regression/results` | exit 0 |
| `visual` | `pnpm exec playwright test tests/e2e/ui-p01.spec.ts --grep visual baselines --project=chromium --workers=1 --retries=0 --update-snapshots=none --reporter=list,json --output=docs/audit/evidence/ui-p01-local-20261022/function-attempt-03/visual/results` | exit 0 |
| `plans` | `node scripts/check-development-plans.mjs` | exit 0 |

20组axe扫描违规0、incomplete 40项（{"aria-prohibited-attr": 20, "color-contrast": 20}）；原件保留，不代替人工审阅。保留各浏览器390px/CSS zoom=2附件。新Chromium/Darwin基线先初始化，再对冻结版本作禁止更新比较；旧UI-102原基线和原确认保持。

[机器回执](./evidence/ui-p01-local-20261022/receipt.json)含1001输入sha256、源码SHA、实际命令/时间/退出/日志哈希、77项原始附件哈希；复核入口 `node scripts/ui-p01-review.mjs --verify`。16项直接依赖只引用其原计划需求，未递归复验或将历史READY重新授予本轮候选。

## 失败、中断和修复

[完整历史](./evidence/ui-p01-local-20261022/attempt-history.json)保留：preflight-01监听EPERM；preflight-02的Next全局alert定位5失败及trace；preflight-03初始化15项通过；f6447506第一次冻结批次13项Chromium通过、Firefox启动1失败/1中断、24未执行，浏览器退出130；be2459d6批次11入口exit0但汇总器错误拒绝ESLint空输出；修复增加正负回归后，在5f7aec51新批次完整重验本轮限定集合。未改写原失败或把未执行项当PASS。

[独立Firefox诊断](./evidence/ui-p01-local-20261022/function-attempt-03/firefox-environment.json)10秒启动超时，伴随` sandbox_extension_issue_file_to_process`和`RenderCompositorSWGL`错误；空白浏览器也复现。WebKit可启动并完成当前功能检查。Firefox功能验证仍为环境阻塞。

## 未决风险与Gate

- 申请C01无幂等键，客户端单发不等于服务器恰好一次。取消/超时可能已受理；未知提示仅内存，刷新/新标签页仍须先核查；服务端最终权限/审计为准。
- 本轮界面对应设计稿简体中文；英文完整文案需后续完善。Firefox启动环境需修复并补验，跨操作系统视觉仍NOT_RUN。
- 真实IdP/MFA、持久BFF/目标数据库、人工读屏、原生200%缩放、同SHA远程CI、性能/长稳及RELEASE均NOT_RUN。
- 页面工程/客户端契约组合PASS；完整业务INTEGRATION NOT_ASSESSED；确认PENDING；RELEASE NOT_RUN；不扩大为生产或正式ACCEPTED。

[完整待确认稿](./evidence/ui-p01-local-20261022/confirmation-draft.md)覆盖Product/Frontend/BFF/QA/Security/Risk，待项目用户按既有规程确认；不要求多方回执。工程提交：`f6447506`（页面）、`be2459d6`（环境分账）、`5f7aec51`（汇总器修复与冻结候选）。下一可执行任务：**I1 FE:UI-P02，P02 Command Center高保真页面**，依其任务范围开展功能与直接回归。

暂存检查最初发现5份Playwright原始error-context.md中的源码行号空白，见[原始检查日志](./evidence/ui-p01-local-20261022/staging-whitespace-before.log)。按仓库既有不可变证据规则，仅为这5个精确路径增加`.gitattributes -whitespace`，未改写失败原件；最终暂存检查通过。
