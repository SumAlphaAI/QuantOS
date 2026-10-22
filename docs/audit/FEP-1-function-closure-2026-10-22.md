# I1 FEP-1 功能收口与调度纠偏（2026-10-22）

**PASS_FEP1_FUNCTION_CLOSURE**；执行候选 `08aa95f9b14692a93b78f36a7c6910d816ffec92`、291项冻结输入；FEP-1原范围功能收口COMPLETED，下一原任务 **I2 UI-507功能开发**。这不是G1/FEP-1联调或发布READY：159项stage_gate保持NOT_ASSESSED，G1 review_status仍CHANGES_REQUESTED，formalAccepted=false、runtimeAdmission=DENIED。

本轮落实[用户原始指令](./evidence/fep1-function-local-20261022/task-request.json)，依据[原计划](../SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md)、[AGENTS.md](../../AGENTS.md)与[分阶段规程](../operations/phased-testing.md)。[工程回执](./evidence/fep1-function-local-20261022/receipt.json)、[范围矩阵](./evidence/fep1-function-local-20261022/functional-scope-matrix.json)、[执行处置](./evidence/fep1-function-local-20261022/execution-disposition.json)、[复用索引](./evidence/fep1-function-local-20261022/evidence-reuse.json)、[保留边界](./evidence/fep1-function-local-20261022/retained-boundaries.json)。

## 纠偏与实际门禁

原G1-DL/REC/DEP等是检查发现、整改或辅助记录，未列入原正式任务图。前几轮把“下一G1-DEP-01”等串成FEP-1必经序列的执行建议被本轮覆盖。旧原稿、原始用户确认、报告、hash和失败原件均不改；新增当前调度账本为8项记录标明分类/处置，developmentPrerequisite=false。未取消真实功能缺陷，未授未验证状态。

代码入口 `scripts/development-execution.mjs` 读取实际机器策略与调度账本。DEVELOPMENT不要求依赖READY、历史签署或环境缺口清零；已登记且未修复的当前功能缺陷仍拒绝受影响节点。实际FEP-1和UI-507开发判定均allowed=true，26/原依赖只作referenceOnly/NOT_CLAIMED。INTEGRATION独立要求既有阶段与依赖READY，当前FEP-1调用实际exit1/STAGE_NOT_READY；RELEASE始终要求另走冻结验收入口。原依赖图/阶段READY规则与159节点未更改，不用“改成READY”实现继续开发。

入口已注册package.json：`pnpm check:development-execution FE:FEP-1`、`pnpm assess:fep1:function <新attempt目录>`、`pnpm check:fep1:function`、`pnpm check:fep1:integration`。FEP-1收口不产生新的人工确认前置或新的独立整改主任务。规程见[FEP-1功能收口](../operations/fep1-function-closure.md)。

## 原范围执行结果与复用

逐项核对官网首期七页、P01身份/申请/恢复、P02 Command、P15三分区、P17浏览器、App Shell/路由、主题/i18n基础和全局状态。现有产品源码与38569928完全一致；根package.json只新增执行脚本，依赖/运行时元数据不变。本轮没有新增业务代码缺陷，也没有以缺口登记替代实际功能核对。

复用9份原范围receipt、8份既有确认，核验各自原Git源码输入、执行日志与附件hash；不执行其原功能命令、不要求26项依赖重新READY。原DL/REC成功、拒绝、未知结果、撤权、202/CAS/429、审计/恢复和4743字节附件均保持原SHA与端口替代边界。P15原确认仍PENDING，不自动代用户批准。

原UI103共享组件及官网generated消费者相对其旧证据已有局部变化，因此当前只补对应直接测试：官网内容/匿名申请消费者、壳授权导航与mode、主题token/中英文安全文案基础、frame、七态/认证守卫。两应用typecheck通过。旧响应式截图、浏览器、构建和Lighthouse只作原范围参考，不声称这些检查已在当前SHA重跑。首发完整页面中英文覆盖未由本轮验收；当前i18n声明限已实现基础能力，完整发布覆盖仍待验证。

| 原范围 | 本轮处置 |
|---|---|
| 官网首期七页、内容合规与匿名申请 | 当前直接检查＋原范围复用 |
| P01身份、申请与恢复安全路由 | 产品未变，复用原范围验证 |
| P02 Command授权、模式与失效 | 当前直接检查＋原范围复用 |
| P15资料/通知/安全设置 | 产品未变，复用原范围验证 |
| P17浏览器历史与真实下载 | 产品未变，复用原范围验证 |
| App Shell与路由导航 | 当前直接检查＋原范围复用 |
| 主题与i18n基础 | 当前直接检查＋原范围复用 |
| 全局状态与风险拒绝 | 当前直接检查＋原范围复用 |
| 功能执行与验收门禁分离 | 当前直接检查＋原范围复用 |

## 实际检查

8条正常命令exit0，另1条独立联调入口按预期exit1；这是拒绝成功，不能记成联调PASS。当前功能67/67，执行/阶段门禁104/104，零skip/fail。类型检查、Lint、计划检查通过。

| 检查 | 命令 | 实际结果 |
|---|---|---|
| development-start | `node scripts/development-execution.mjs --development FE:FEP-1` | exit0 |
| next-development | `node scripts/development-execution.mjs --development FE:UI-507` | exit0 |
| focused-function | `pnpm exec vitest run apps/website/tests/website-compliance.test.ts apps/website/tests/web101-access.test.ts packages/domain-ui/tests/chrome.test.tsx packages/ui/tests/ui103.test.tsx packages/ui/tests/workspace.test.tsx packages/ui/tests/state-badge.test.tsx apps/terminal/tests/ui101-runtime.test.ts --reporter=verbose --reporter=json --outputFile=docs/audit/evidence/fep1-function-local-20261022/attempt-02/unit.json` | exit0 |
| terminal-types | `pnpm --filter @sumalpha/terminal typecheck` | exit0 |
| website-types | `pnpm --filter @sumalpha/website typecheck` | exit0 |
| execution-negative | `node --test scripts/development-execution.test.mjs scripts/fep1-function-review.test.mjs scripts/development-plan-order-negative.mjs` | exit0 |
| lint | `pnpm exec eslint scripts/development-execution.mjs scripts/development-execution.test.mjs scripts/fep1-function-review.mjs scripts/fep1-function-review.test.mjs` | exit0 |
| plans | `node scripts/check-development-plans.mjs` | exit0 |
| integration-refusal | `node scripts/development-execution.mjs --integration FE:FEP-1` | exit1，预期拒绝 |

命令/时间/退出码/信号/日志hash见[executions](./evidence/fep1-function-local-20261022/attempt-02/executions.json)。67项当前测试JSON与104项Node测试日志均保留。未运行全仓、上游全闭包、Rust、浏览器、构建、Lighthouse、数据库、目标或发布campaign，不能把NOT_RUN写成PASS。预检仅复用索引与ESLint。attempt-01在42a34f5c通过67功能/103门禁；收尾发现联调入口还应显式拒绝已知缺陷，即使历史标记READY，补一条直接回归后冻结08aa95f9并执行attempt-02的同一限定检查集（67/104）。两次原回执/日志分别保留，不混绑；这未扩展到浏览器、构建、Rust或上游全链。

## 风险、阶段与下一任务

Firefox环境阻塞、WebKit拦截附件阻塞与原全部NOT_RUN/incomplete/历史失败保持。IdP/session仍本机替身，导出创建仍NODE_CONTROL_PORT；目标DB/Storage/RLS/真实身份/Cookie/CORS/MFA/持久撤销/live流、完整无替身旅程、真实MFA冷却到期、人工读屏/原生200%、完整中英文发布覆盖、设备/OS/CI/性能长稳/后台调度和RELEASE均未由本轮验收。原P15确认待办独立保留。

功能收口结果COMPLETED只属于上述原交付范围与限定验证，不等于阶段READY、上游重准入、真实运行或发布许可。G1联调结论仍NOT_READY_GAPS_OPEN，FEP-1 stage_gate仍NOT_ASSESSED。复用的旧工程未改绑新SHA；发布前仍需按适用矩阵验收。

下一主任务 **I2 UI-507：Audit Explorer 与受控导出功能开发**，按原任务范围和直接影响验证继续。G1-DEP-01不再作为前置；开发不必等待G1整体联调READY、P15补签或环境NOT_RUN清零。遇到真实已知功能/安全缺陷只阻断受影响路径，不取消后续联调/发布义务。无生产凭据、目标服务连接、推送或部署。

## 变更文件

- `docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md`
- `docs/audit/FEP-1-function-closure-2026-10-22.md`
- `docs/execution/development-followups.json`
- `docs/operations/fep1-function-closure.md`
- `docs/operations/phased-testing.md`
- `package.json`
- `scripts/development-execution.mjs`
- `scripts/development-execution.test.mjs`
- `scripts/development-testing-policy.json`
- `scripts/fep1-function-review.mjs`
- `scripts/fep1-function-review.test.mjs`

另新增本轮 `docs/audit/evidence/fep1-function-local-20261022/` 回执、日志、范围/复用矩阵、六维评阅摘要和封存索引。未修改旧已确认包、应用源码、依赖版本或锁文件。
