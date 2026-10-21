# FE:WEB-101 / I1 当前功能复核

当前功能工程PASS（限定DEVELOPMENT READY）；本机真实Rust reference消费者与受控浏览器功能验证通过。INTEGRATION NOT_ASSESSED，确认PENDING，formalAccepted=false，runtimeAdmission=DENIED。未使用生产凭据，未推送/部署，未重跑无关全闭包。

工程源码 `c9ae09bc7c0519b9aed0f5ffb38665ee05fbc693`，440项输入，摘要 `sha256:cc85ce9582033f2127638bd31ff3b4e88f12a7a13af3a1ab4ae10493c21644a6`。最终为[机器回执](./evidence/web-101-local-20261021/receipt.json)、[11组原始执行](./evidence/web-101-local-20261021/function-attempt-04/executions.json)；后续文档提交不改绑已测SHA。[完整确认稿](./evidence/web-101-local-20261021/confirmation-draft.md)待项目用户确认。

## 直接前提与边界

16项直接前提：UI-103、UI-102、BFF-FE-000–011、PROVIDER:ALL及G0；[只读核验原件](./evidence/web-101-local-20261021/direct-prerequisites.json)，不递归重跑，不授予上游新HEAD READY。UI-104本次用户确认已保存[独立原始记录](./evidence/ui-104-confirmation-20261021/user-confirmation.json)，绑定ab50c36d工程/507b3a4c原稿包；原稿与receipt均保留，人工读屏及原生200%仍NOT_RUN。55,755条既有audit/gate路径Git blob未改变，见[历史保护](./evidence/web-101-local-20261021/historical-integrity.json)。

## 实现、缺陷与修复

- 七页导航、文档搜索/空态/版本正文、合规文案、canonical/robots/sitemap及Terminal登录入口实测。官网登录说明修正BFF会话管理与桌面独立验收边界。
- C01公开申请使用生成client及运行时AuditedAsyncAccepted校验，严格202+accepted且job/correlation/audit UUID有效才显示受理。受理不等于访问权限开通；错误只展示安全映射和经校验的retryAfter/参考号，绝不显示原始message。
- 实际提交前校验trim后团队/邮箱/用途、市场与Research/Paper/Shadow、隐私同意及honeypot；只发送契约白名单。匿名credentials=omit、no-store、redirect=error，不加载私有会话或传入actor/tenant。BFF reference修复Research支持并拒绝公开assisted_live，live路径同步模式拒绝分支已编译；未执行目标DB。
- 同步锁阻止同一事件周期重复提交；待请求时锁字段，15秒期限覆盖响应体。中断/超时/畸形成功/5xx保持结果未知及草稿，禁止自动重放；先核查状态、明确解除未知锁再手动提交。接口无幂等重放保证，提示重复申请风险；不冒称网络失败就未落库。卸载/离线中止且迟到成功不发布。
- 修复官网Next构建解析workspace ESM .js→TS及api-client转译；修复长词、栅格/fieldset在390与CSS zoom2下溢出/裁剪，链路图保留独立横向滚动及键盘区域；补齐原生SVG站点图标，消除favicon404。

## 测试命令与结果

总入口：`node scripts/web-101-review.mjs --run docs/audit/evidence/web-101-local-20261021/function-attempt-04`，11组均exit0。43项单测/组合（32项申请行为、4项真实loopback HTTP和7项既有官网测试）、18项门禁负向、1项直接Rust公开申请测试、27项Chromium浏览器，0失败/跳过/flaky。Rust bin、types/lint、官网单次非mock构建、JS/CSS预算及计划校验通过。

| 组 | 实际命令 | 结果 |
|---|---|---|
| bff-build | `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | exit0 |
| provider-access | `cargo test --locked --offline -p bff-gateway --test auth_settings_provider public_access_request_validates_origin_and_body_and_writes_audit -- --exact` | exit0 |
| unit | `pnpm exec vitest run apps/website/tests` | exit0 |
| types | `pnpm --filter @sumalpha/website typecheck` | exit0 |
| lint | `pnpm --filter @sumalpha/website lint` | exit0 |
| negative | `node --test scripts/web-101-review.test.mjs` | exit0 |
| website-build | `pnpm --filter @sumalpha/website build` | exit0 |
| browser | `pnpm exec playwright test --config playwright.web101.config.ts --project=chromium --workers=1 --retries=0 --update-snapshots=none --reporter=list,json --output=docs/audit/evidence/web-101-local-20261021/function-attempt-04/browser/results` | exit0 |
| lighthouse | `node scripts/web-101-lighthouse.mjs docs/audit/evidence/web-101-local-20261021/function-attempt-04/lighthouse` | exit0 |
| budget | `node scripts/check-perf-budget.mjs apps/website/out` | exit0 |
| plans | `node scripts/check-development-plans.mjs` | exit0 |

官网无业务mock分支，本轮仅构建local-integrated/mock=false，公开BFF为本站`http://localhost:3196`受控响应；没有无关Terminal/Storybook构建。真实Rust以随机127.0.0.1 reference进程运行，Node消费者显式设置其固定受信任Origin `http://localhost:3190`，验证三模式受理、来源拒绝和公开assisted_live拒绝；另一个直接Rust用例核查审计计数。不将此记作官网Origin3196→真实BFF的CORS闭环，也不证明目标限速/DB持久性/邮件或完整组织认证。

资源预算：[原始日志](./evidence/web-101-local-20261021/function-attempt-04/budget.log)。共享首屏140.2KB、最大chunk58.5KB、CSS4.5KB；申请路由首屏193.0KB低于200KB，后续仍需注意约7KB余量。指标为本机静态产物gzip，不代替目标运行性能。

## Lighthouse与视觉

固定Lighthouse12.8.2及本机Chromium，对同一构建七页执行desktop/provided配置；[汇总](./evidence/web-101-local-20261021/lighthouse-summary.json)、逐页JSON与HTML及临时工具lock/摘要均归档。评分是本机无模拟节流的基线，无RELEASE门槛判定，不证明staging/CDN/真实移动网络性能。

| 页面 | Performance | Accessibility | Best practices | SEO |
|---|---|---|---|---|
| / | 100 | 100 | 100 | 100 |
| /product | 100 | 100 | 100 | 100 |
| /architecture-security | 100 | 100 | 100 | 100 |
| /use-cases | 100 | 100 | 100 | 100 |
| /docs | 100 | 100 | 100 | 100 |
| /access-request | 100 | 100 | 100 | 100 |
| /login | 100 | 100 | 100 | 100 |

七页dark axe零违规，color-contrast incomplete节点分别13/3/4/3/3/3/3（共32）原样保存；Lighthouse分数不消除这些人工义务。21张desktop/light/mobile截图和390/CSS zoom2重排断言保留。七张桌面已逐图查看，最终桌面PNG与已查看第三轮字节相同；最终访问申请mobile/light另行查看，见[图审记录](./evidence/web-101-local-20261021/visual-review.json)。截图采集/当前布局图审不是完整视觉设计签署；未更改历史PNG基线。

## 失败保留

- development01：首次类型错误（unknown响应）及工具bootstrap目录缺失/离线缓存失败均保留，已修复并固定工具版本。
- development02：43项中1项旧源码扫描因实现迁移到src而失败；修正扫描所有者，实际32项申请+4项HTTP行为验证未被删除。
- attempt01：构建无法解析API client ESM源码，保留FAIL。
- attempt02：26过1败，暴露首页CSS zoom溢出；开发DOM尺寸证明还存在表单min-content及文字裁剪，修复后再冻结。开发样式注入失败/原型结果保留，不用其替代正式构建；浏览器矩阵真实数量27已严格校验。
- attempt03：11组自动化通过；Lighthouse最佳实践96因favicon404，独立[CHANGES_REQUESTED](./evidence/web-101-local-20261021/review-03.json)保留。最终attempt04在新源码完成图标修复，独立执行全部当前检查和七页采集，不拼接旧PASS。

交付格式检查发现原始Lighthouse HTML第2847行空白，Git检查exit2原样登记在[记录](./evidence/web-101-local-20261021/delivery-whitespace-check.json)。保留原始HTML及其摘要，只在.gitattributes对本任务function-attempt-*/lighthouse/*.report.html添加空白豁免，不修改工程输入或原始报告。

## Gate、风险与后续

DEVELOPMENT当前功能PASS；INTEGRATION NOT_ASSESSED；人工确认PENDING；正式ACCEPTED及运行准入未授予。人工读屏、原生200%、跨浏览器/OS完整矩阵、真实目标Origin/CORS/IdP、目标DB/限速/审计持久性、邮件交付、完整业务联调、同SHA远程CI、目标性能长稳与RELEASE均未执行。公开申请无协议幂等，未知结果必须先核查；本轮客户端保护不构造不存在的服务端保证。CSS zoom不冒充原生缩放，axe incomplete不升级人工通过。

已同步开发计划的UI-104原稿确认与WEB-101当前功能状态；完整P01/P02/P15/P17与G1独立，不因基础官网通过而READY。完整变更路径见[文件清单](./evidence/web-101-local-20261021/changed-files.json)。下一可执行任务为 **FE:UI-P01 / I1 当前功能复核**。
