# FE:UI-104 / I1 当前功能复核

当前功能工程验证 PASS（限定 DEVELOPMENT READY）；本机真实 Rust reference 组合与受控浏览器边界通过。INTEGRATION NOT_ASSESSED，确认 PENDING，formalAccepted=false，runtimeAdmission=DENIED。未使用生产凭据，未推送/部署，未执行无关全闭包复验。

工程源码 `ab50c36dc34778b6c9a88ec2bb3ecf2ede504294`，508项输入，摘要 `sha256:78f0aebef2ce48fae2a87462f33620d9e3870d0b374890800c58ae6785ea3056`。最终证据为[回执](./evidence/ui-104-local-20261021/receipt.json)和[原始执行](./evidence/ui-104-local-20261021/function-attempt-04/executions.json)；后续文档提交不改绑该工程SHA。依据最新AGENTS.md及开发计划UI-104/C17直接范围。[完整确认稿](./evidence/ui-104-local-20261021/confirmation-draft.md)等待项目用户确认。

## 直接前提与范围

15项直接前提：UI-101、BFF-FE-000–011、PROVIDER:ALL、G0，只核验原始工程/确认原件及摘要，不递归重跑；见[直接前提](./evidence/ui-104-local-20261021/direct-prerequisites.json)。UI-101本次用户答复已保存在[独立确认记录](./evidence/ui-101-confirmation-20261021/user-confirmation.json)，绑定4423badb工程与d78cc56c原稿包，人工读屏/原生200%仍NOT_RUN。55,530条既有audit/gate路径Git blob未变化，见[历史保护](./evidence/ui-104-local-20261021/historical-integrity.json)。

## 实现与修复

- 四条/settings入口先验证C01会话、context、到期/MFA、actor/tenant/workspace/account/mode、settings.read，再按分区读取。SSR不泄露fixture，非mock缺配置拒绝；只读profile不受无关下载权限阻断；移除假工作区/admin/实时同步、Active和固定安全数量。
- 保存实际调用C17生成client，显式白名单过滤顶层与通知rule字段，CSRF/If-Match/稳定幂等键生效。200更新基线；错误/超时保留草稿、键和版本；409明确读取最新版本后再次保存。离线恢复、重读失败只读保留草稿；scope变化拒绝合并；取消、过期与卸载阻止旧读发布。
- 撤销会话/设备/因素实际提交六位MFA code→security_change challenge→短时reauth→DELETE。保护当前会话/设备及最后因素；每步复核权限、在线和视口。202只标记受理，资源保留至重新读取，不以本地数组删除宣称真实完成；失败对话框保留并清码。
- 通知只在明确手势及策略/default权限允许时请求；拒绝降级且不重复请求。下载不在历史中持有lease，点击后获取并校验同源HTTPS、对象/路径/有效期；clipboard成功才提示复制，否则显示安全路径手工复制。未实现新增Passkey/恢复代码由组织IdP处理。
- 修复重复C01读取、窄屏通知矩阵溢出及checkbox点击/焦点；设置分区导航有独立名称。四页axe违规0，每页color-contrast incomplete 7节点如实保留。

## 测试命令与结果

总入口：`node scripts/ui-104-review.mjs --run docs/audit/evidence/ui-104-local-20261021/function-attempt-04`，12组均exit0。69项单测/组合（含实际loopback Rust reference 2项）、16项Node门禁负向、mock浏览器13项、非mock浏览器17项，0失败/跳过/flaky；视觉精确初始化1例、同构建禁止更新比较1例。原始参数/耗时/日志摘要见回执，不拼接失败轮次。

| 组 | 实际命令 | 结果 |
|---|---|---|
| bff-build | `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | exit 0 |
| unit | `pnpm exec vitest run apps/terminal/tests/ui104-settings.test.ts apps/terminal/tests/ui104-runtime.test.ts apps/terminal/tests/ui104-http.test.ts apps/terminal/tests/browser-platform-provider-consumer.test.ts apps/terminal/tests/auth-bff.test.ts apps/terminal/tests/ui101-runtime.test.ts` | exit 0 |
| types | `pnpm --filter @sumalpha/domain-ui --filter @sumalpha/terminal typecheck` | exit 0 |
| lint | `pnpm --filter @sumalpha/domain-ui --filter @sumalpha/terminal lint` | exit 0 |
| negative | `node --test scripts/ui-104-review.test.mjs` | exit 0 |
| terminal-mock | `pnpm --filter @sumalpha/terminal build` | exit 0 |
| mock-browser | `pnpm exec playwright test tests/e2e/command.spec.ts tests/e2e/ui104-settings.spec.ts --grep-invert 视觉基线|visual baselines --project=chromium --workers=1 --retries=0 --update-snapshots=none --reporter=list,json --output=docs/audit/evidence/ui-104-local-20261021/function-attempt-04/mock-browser/results` | exit 0 |
| visual | `node scripts/ui-104-visual.mjs docs/audit/evidence/ui-104-local-20261021/function-attempt-04` | exit 0 |
| terminal-bff | `pnpm --filter @sumalpha/terminal build` | exit 0 |
| bff-browser | `pnpm exec playwright test --config playwright.ui104.config.ts --project=chromium --workers=1 --retries=0 --update-snapshots=none --reporter=list,json --output=docs/audit/evidence/ui-104-local-20261021/function-attempt-04/bff-browser/results` | exit 0 |
| baselines | `node scripts/check-visual-baselines.mjs` | exit 0 |
| plans | `node scripts/check-development-plans.mjs` | exit 0 |

两次前端构建是必要的公共local-mock与local-integrated/mock=false配置，各自buildId绑定同一工程SHA。真实Rust只绑定随机127.0.0.1 reference端口、进程内存状态；浏览器非mock BFF为受控HTTPS响应边界，未运行浏览器→真实持久BFF完整联调，未连接数据库。

## 失败保留与视觉证据

attempt01：浏览器9过8败，重复session/窄屏溢出/checkbox及定位问题保留。attempt02：16过1败，暴露通知schema passthrough未过滤元数据，已修复显式白名单及嵌套rule负向断言。attempt03：12组自动化通过，但moderate landmark违规及未绑定Active/固定数量被复核要求修改，独立[CHANGES_REQUESTED](./evidence/ui-104-local-20261021/automated-03-review.json)保留。最终attempt04来自新SHA，四页axe零违规，以上问题关闭；此前development失败日志均保留。

最终四页非mock与两张mock PNG逐图查看，见[图审记录](./evidence/ui-104-local-20261021/visual-review.json)。仅本机Chromium/Darwin两张Settings基线更新：初始化不是匹配旧图，旧PNG/catalog原字节保留在attempt01/visual-migration/before，各轮before/after均保存。其他OS/浏览器未迁移，远程完整视觉CI可能拒绝，不声称其通过。

## Gate、风险与后续

DEVELOPMENT当前功能工程PASS；INTEGRATION NOT_ASSESSED；人工确认PENDING；未授予正式ACCEPTED或运行准入。人工读屏、原生200%、真实IdP/MFA、目标数据库/撤销持久性、完整业务联调、跨平台视觉、同SHA远程CI、性能长稳与RELEASE未执行。原生权限提示使用受控Notification API验证，不代表真实OS授权。新增身份因素由IdP管理，完整P15/P17和G1独立评估。CSS zoom=2不代替原生缩放，axe incomplete不替代人工验收。

开发计划UI-101确认引用和UI-104当前功能状态已同步，阶段Gate保持NOT_ASSESSED。完整变更路径见[清单](./evidence/ui-104-local-20261021/changed-files.json)。下一可执行任务为 **FE:WEB-101 / I1 当前功能复核**，其直接前提按原范围核验；UI-P01/P02/P15/P17/G1各自仍独立。
