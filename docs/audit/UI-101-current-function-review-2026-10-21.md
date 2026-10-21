# FE:UI-101 / I1 当前功能复核

当前工程与限定本机契约组合 **PASS**；**INTEGRATION NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED**。完整P02页面、真实目标BFF/IdP业务联调、人工读屏、原生200%缩放、同SHA远程CI及RELEASE未完成。本轮不申请阶段READY或实际业务访问权限，新完整确认稿PENDING。

工程源 `4423badb596862d006be1b77318a4828b002e3e0`，503项输入，摘要 `sha256:ce732daed5ce897dbca9033ea073049f7f6e91f510a2d7e4d01f9ceb90e0fb46`。[机器回执](./evidence/ui-101-local-20261021/receipt.json)、[最终原始执行](./evidence/ui-101-local-20261021/function-attempt-03/executions.json)、[输入清单](./evidence/ui-101-local-20261021/function-attempt-03/inputs.json)。报告/确认稿/后续证据提交不把已测结果改绑为新的工程输入。

## 范围与修复

| 路径 | 改动与原因 |
|---|---|
| `apps/terminal/src/command/source.ts` | 显式mock才使用演示；非mock接生成C01/session、context及C02/summary，运行时schema校验，无fixture回退 |
| `apps/terminal/src/command/runtime.ts` | 严格六步守卫；失败停止后续读取；投影加载失败转安全拒绝；401/403/404/5xx保持正确恢复目的地 |
| `apps/terminal/app/command/ui101-command-route.tsx` | 每轮独立source/AbortController；刷新立即撤下旧投影，迟到结果不能回填；会话/summary到期重新核验 |
| `apps/terminal/app/command/ui101-command-center.tsx` | 网络恢复不直接fresh，刷新不伪造本地时间；展示真实上下文/mode/freshness/risk与nullable计数；只读监控，移除假流程/假布局保存承诺；normal风险采用健康色 |
| `packages/domain-ui/src/ui101.ts` | 使用已核实的服务端ops.read/research.read导航映射；未知风险枚举拒绝writesAllowed，不扩大业务权限 |
| `packages/domain-ui/src/TerminalChrome.tsx` | research模式明确呈现；上下文短标签避免撑宽，完整ID保留在title；模式不默认回PAPER |
| `packages/domain-ui/src/indicators.tsx` | 快照连接显式Read-only snapshot，不声称已订阅实时更新；其他调用方默认语义与冻结i18n/token保持不变 |
| 测试、`playwright.ui101.config.ts` | 单步拒绝、授权短路、取消/过期/恢复、真实Rust reference组合、非mock浏览器路径及1440/390/CSS zoom无溢出 |
| `scripts/ui-101-*`、CI、操作规程与计划 | 当前输入/命令/日志/浏览器/视觉artifact绑定、16项拒绝测试、阶段不提升；[规程](../operations/ui-101-current-function.md) |

C02后端入口实际为`ops.read`；原UI fixture的`command:read`不能代替真实权限。非mock在session有效且MFA未challenged后读context，依次绑定actor/tenant/workspace、校验权限与account，再核对mode。仅research/paper/shadow；assisted_live拒绝。此前步骤未通过，summary不可达。最后验证C02账户/模式、有效期、来源集合及数据可用性；过期、畸形、未知数据状态/无数据安全阻断，stale可只读且不被网络恢复升级。401清客户端内存并到login，403/404同unauthorized，5xx维护，均不展示私有错误内容。

当前页面仅只读监控；完整P02业务卡片、交互/页面七态、实时订阅及设计验收由FE:UI-P02独立处理。`data-contract-mode=integrated`只标明生成客户端适配分支，不表示真实业务联调/阶段READY。C01只提供ID，UI不虚构工作区/账户名称；短标签title保留完整ID。只读快照来源于受权响应，到期重验；清客户端内存不等于撤销服务端会话。

## 直接前提与人工确认

15项直接前提按原提交、原字节及摘要只读核验：[清单](./evidence/ui-101-local-20261021/direct-prerequisites.json)。UI102原[完整稿](./evidence/ui-102-local-20261021/confirmation-draft.md)已收到用户确认，原始答复保存在[独立确认记录](./evidence/ui-102-confirmation-20261021/user-confirmation.json)，绑定fd2f3e64工程与50eb2f6b原稿包；原receipt的PENDING是当时原件，未修改。人工读屏/原生200%仍NOT_RUN。12项BFF、G0与PROVIDER:ALL仅原范围参考，不对本候选递归重跑、不复用历史READY授予新输入。

## 测试命令与结果

入口：`node scripts/ui-101-review.mjs --run docs/audit/evidence/ui-101-local-20261021/function-attempt-03`。所有命令从公共local-mock环境白名单启动，非mock两项仅覆盖为local-integrated/mock=false及本机4010受控边界。CI=1不复用服务器；无浏览器重试。

| 实际命令 | 结果 |
|---|---|
| `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | exit 0 |
| `pnpm exec vitest run apps/terminal/tests/ui101-runtime.test.ts apps/terminal/tests/ui101-source.test.ts apps/terminal/tests/ui101-http.test.ts apps/terminal/tests/command-provider-consumer.test.ts packages/domain-ui/tests/ui101.test.ts packages/domain-ui/tests/chrome.test.tsx packages/domain-ui/tests/indicators.test.tsx` | exit 0 |
| `pnpm --filter @sumalpha/domain-ui --filter @sumalpha/terminal typecheck` | exit 0 |
| `pnpm --filter @sumalpha/domain-ui --filter @sumalpha/terminal lint` | exit 0 |
| `node --test scripts/ui-101-review.test.mjs` | exit 0 |
| `pnpm --filter @sumalpha/terminal build` | exit 0 |
| `pnpm exec playwright test tests/e2e/command.spec.ts tests/e2e/ui104-settings.spec.ts tests/e2e/auth-callback.spec.ts --grep-invert 视觉基线|visual baselines --project=chromium --workers=1 --retries=0 --update-snapshots=none --reporter=list,json --output=docs/audit/evidence/ui-101-local-20261021/function-attempt-03/mock-browser/results` | exit 0 |
| `node scripts/ui-101-visual.mjs docs/audit/evidence/ui-101-local-20261021/function-attempt-03` | exit 0 |
| `pnpm --filter @sumalpha/terminal build` | exit 0 |
| `pnpm exec playwright test --config playwright.ui101.config.ts --project=chromium --workers=1 --retries=0 --update-snapshots=none --reporter=list,json --output=docs/audit/evidence/ui-101-local-20261021/function-attempt-03/bff-browser/results` | exit 0 |
| `node scripts/check-visual-baselines.mjs` | exit 0 |
| `node scripts/check-development-plans.mjs` | exit 0 |

55项Vitest通过：runtime4、source21、实际Rust HTTP4、原Command consumer1、domain-ui守卫/导航15、chrome3、indicator7。Rust4例是实际本机reference进程，当前会话/Owner通过C01→context→summary，Viewer在capability停止，invalid session只请求session；不是生产认证/持久化证明。构建仅bff-gateway bin，不执行Rust全仓测试或原provider验收全闭包。

16项Node门禁负向测试通过；拒绝虚构READY/CONFIRMED、外部已执行、日志篡改、漏项/换命令、跳过/flaky矩阵。Terminal/domain-ui类型和lint通过。**两个必要前端配置**：mock与非mock分别构建，两个buildId均绑定同一完整工程SHA；并非为发布进行三轮独立clean build。每个构建包含客户端秘密静态检查。

mock Chromium17例（Command6、Settings7、OIDC callback4）通过；非mock Chromium14例全部通过，覆盖受权SHADOW/账户、null不补零、401/403/404/503、workspace/capability/mode短路、刷新后撤权、网络恢复仍stale、summary过期、session到期撤下壳、1440/390/CSS zoom=2无溢出及正常风险健康呈现。两报告均0失败、0跳过、0flaky。浏览器非mock响应由route拦截，真实Rust消费者是另一独立受控HTTP层，未拼接成浏览器→真实IdP/持久BFF完整业务验收。

Command本机Chromium/Darwin **明确初始化1次**（`--update-snapshots=all`）后，在同一mock构建 **禁止更新比较1例通过**（none）；初始化不是匹配旧图。原UI-VIS PNG/catalog按字节保存在attempt-01/visual-migration/before，后续每轮before/after与原命令/报告完整保留；最后root PNG等于最终after artifact。24项PNG/catalog完整性通过，仅Command Chromium/Darwin更新，Linux及其他浏览器图未伪造迁移，完整远程视觉矩阵可能拒绝。RELEASE设计签署NOT_RUN。

最终BFF页面axe保存完整报告：violations0，**2项incomplete**保留（aria-prohibited-attr1节点、color-contrast20节点），不等于人工读屏/对比度验收通过。[实际报告](./evidence/ui-101-local-20261021/function-attempt-03/bff-browser/report.json)、[逐图检查](./evidence/ui-101-local-20261021/visual-review.json)。Codex逐图查看最终BFF/SHADOW和mock/PAPER两张1440截图，范围内显示正常；CSS zoom=2不替代原生200%。

## 原始问题与修复批次

- development-01单测/类型/lint通过；静态对照实际C02权限发现fixture键`command:read`不适用于服务端，调整为`ops.read`并增加真实Rust组合验证。
- attempt-01 / 2e030d58：12组执行均exit0、48单测/17mock浏览器/12BFF浏览器，但图审发现完整UUID把1440视口撑为1723，独立visual-review.json明确FAIL；原机器执行PASS不等于图审完成或正式通过。
- attempt-02 / b8863044：55单测/13BFF浏览器及全12组通过，修复上下文溢出、增加小屏断言及快照连接文案；图审CHANGES_REQUESTED保留：normal风险沿用红色，changed截图策略在0.005容差内保留旧底栏图。
- attempt-03 / 4423badb：风险健康色修正、14BFF用例、精确all初始化后none比较；最终12组exit0、逐图PASS。三个批次由发现的实际缺陷分别产生，不是重复无关全闭包，也不拼接前两轮为最终通过。

## Gate、未执行义务与下一项

功能工程/限定本机契约组合PASS，**INTEGRATION NOT_ASSESSED**。真实目标BFF/IdP/MFA、目标数据库/跨租户RLS/服务端撤销持久性、浏览器真实服务组合、实时SSE页面接入、跨浏览器/OS视觉迁移、性能容量/长稳及同SHA远程CI/RELEASE均未执行或由后续责任任务收口，不标记为PASS。人工读屏/原生200%明确NOT_RUN，用户确认也不替代这些义务。

未使用生产凭据、未连接目标数据库、未推送/部署；55,396个既有audit/gate路径未修改，[保护检查](./evidence/ui-101-local-20261021/scope-preservation.json)。[完整文件清单](./evidence/ui-101-local-20261021/changed-files.json)含代码/测试/CI/计划/操作文档/原始证据与本机PNG。

[完整确认稿](./evidence/ui-101-local-20261021/confirmation-draft.md)按确认规程等待项目用户唯一确认，Codex不自行批准。下一可执行开发项 **FE:UI-104 / I1 当前功能复核**；完整P02及G1准入分别记账。
