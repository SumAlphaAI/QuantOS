# FE:UI-102 / I1 当前功能复核

工程功能与本机受控契约组合 PASS；**INTEGRATION NOT_ASSESSED，formalAccepted=false，runtimeAdmission=DENIED**。新完整确认稿PENDING。真实IdP/MFA、人工读屏、原生200%缩放、目标数据库、同SHA远程CI及RELEASE均NOT_RUN。测试不授予实际业务访问权限。

工程输入冻结在 `fd2f3e64e204c1015af302b49cbb10159475bbfe`，253项文件，摘要 `sha256:87747a1552502a6dd39476e6597002254d4d6578cb1db29389d5819f7a886be0`。当前报告及确认稿是该工程证据的后续说明，不将证据改绑后续文档提交。[机器回执](./evidence/ui-102-local-20261021/receipt.json)、[完整执行](./evidence/ui-102-local-20261021/function-attempt-02/executions.json)、[输入清单](./evidence/ui-102-local-20261021/function-attempt-02/inputs.json)。

## 代码与行为

- 回调同步一次性消费PKCE待处理数据，成功/拒绝均删除；10分钟有效期，缺失时间戳/过期/未来时间/畸形数据拒绝并重新登录。拒绝前清空旧内存身份；URL去掉code/state/error等参数，return path不接受查询串、片段、跨站或协议相对地址。
- token交换及真实模式BFF session POST各15秒deadline，无自动重试；subject、正数有效期和MFA标识验证，真实模式还要求短期token与服务端204。迟到响应不能恢复已清空的客户端身份。令牌仅用于交换HttpOnly会话，不存入Session元数据或浏览器存储。
- MFA 401清内存并返回消毒后的登录页；失败清空六位验证码，429保留schema验证后的等待时间，文案不暴露内部账户信息。验证码有效期和锁定策略由身份服务决定，不再硬编码未经证实的时长。
- 403/404不可探测文案、访问申请202仅受理、维护禁写、离线恢复须重验且不重放旧写入，均验证。离线页面去掉未实现的自动连接重试承诺。
- 新增源码/日志/浏览器矩阵/摘要验证器和负向测试，CI仅校验历史原范围或当前输入，不对新HEAD自动授予READY。[操作规程](../operations/ui-102-current-function.md)。

## 直接前提与确认

15项直接前提逐项按原提交/原字节只读核验，见[前提清单](./evidence/ui-102-local-20261021/direct-prerequisites.json)。12项BFF、G0与PROVIDER:ALL仅原范围参考；未重新执行其完整验收链，未把其历史READY绑定新输入。UI-VIS-000用户原始答复见[确认记录](./evidence/ui-vis-000-confirmation-20261021/user-confirmation.json)，绑定45f3a307工程及a7d00219原稿包；原receipt中的PENDING保留为历史状态，新独立记录确认原范围，人工读屏/原生200%仍NOT_RUN。

## 测试命令与结果

全部使用现有 `webEnvironment()` 清理凭据、固定pnpm10.20.0公共local-mock环境；浏览器CI=1，不复用已有服务器，不重试、不更新截图。

| 命令 | 结果 |
|---|---|
| `pnpm exec vitest run apps/terminal/tests/auth-poc.test.ts apps/terminal/tests/auth-bff.test.ts apps/terminal/tests/ui102-callback-lifecycle.test.ts apps/terminal/tests/deep-link-auth.test.ts apps/terminal/tests/ui101-runtime.test.ts apps/terminal/tests/ui104-settings.test.ts` | exit 0 |
| `pnpm --filter @sumalpha/api-client --filter @sumalpha/terminal typecheck` | exit 0 |
| `pnpm --filter @sumalpha/terminal lint` | exit 0 |
| `node --test scripts/ui-102-review.test.mjs` | exit 0 |
| `pnpm --filter @sumalpha/terminal build` | exit 0 |
| `pnpm exec playwright test tests/e2e/ui102-auth.spec.ts tests/e2e/auth-callback.spec.ts tests/e2e/ui102-current.spec.ts tests/e2e/command.spec.ts tests/e2e/ui104-settings.spec.ts --grep-invert 视觉基线|visual baselines --project=chromium --workers=1 --retries=0 --update-snapshots=none --reporter=list,json --output=docs/audit/evidence/ui-102-local-20261021/function-attempt-02/browser/results` | exit 0 |
| `pnpm exec playwright test tests/e2e/ui102-auth.spec.ts --grep 视觉基线 --project=chromium --workers=1 --retries=0 --update-snapshots=none --reporter=list,json --output=docs/audit/evidence/ui-102-local-20261021/function-attempt-02/visual/results` | exit 0 |
| `node scripts/check-development-plans.mjs` | exit 0 |

68项Vitest通过：auth-poc14、auth-bff11、新回调生命周期18、deep-link3、Command守卫4、Settings18。16项Node验证器测试通过。Terminal/API client类型检查、Terminal lint、单次当前工程Terminal静态构建及64文件客户端秘密静态检查通过。浏览器31项全部通过（UI102原7+callback4+本轮7+直接Command6/Settings7），0失败/跳过/重试恢复；独立原登录Chromium/Darwin视觉比较1项通过，未改写PNG或基线manifest。

5个认证/恢复页面保存完整axe报告，violations均0，**10项incomplete保留**：每页各1项aria-prohibited-attr及color-contrast（后者共59个节点，前者共5个节点）。不能把自动扫描未完成项解释成人工可访问性通过。[实际浏览器报告](./evidence/ui-102-local-20261021/function-attempt-02/browser/report.json)、[逐图检查](./evidence/ui-102-local-20261021/visual-review.json)。实际登录/MFA/恢复3图已逐一查看，1440操作及文案可读；390px/CSS zoom=2成功不等于原生200%缩放。

只扩展到直接受影响的Command守卫及Settings recent-auth消费者，没有运行全仓测试、Rust/数据库/上游provider Gate、Storybook重建或三轮独立构建。计划结构/顺序检查通过，159项阶段仍NOT_ASSESSED，不以结构PASS替代阶段准入。

## 失败与保留

开发首轮发现计划报告链接尚未创建、输入选择器引用不存在vitest.config.ts，原错误日志保留于development-01，补齐报告并移除不存在选择器后通过。工程4f3d3769首个正式批次：单测/类型/lint/Node/构建通过，Chromium27通过4失败；新callback测试错误提示定位器同时匹配Next route announcer，四份trace/error-context/report均保留在function-attempt-01。修正为main范围后，在fd2f3e64新批次全8组exit0；未拼接失败批次为通过。两个构建分别属于真实失败批次及最终验证，非要求三轮构建。

## 未决边界与下一项

- 真实IdP端点兼容、真实BFF cookie/MFA、撤销/会话持久性与目标环境均NOT_RUN；当前mock token端点和路由拦截只能证明前端成功、拒绝与恢复。清空客户端元数据不等于撤销服务端会话，超时的服务端执行结果可能未知；须重新建立身份。
- 人工读屏/原生200%缩放及上述axe incomplete待人工/目标环境处理；跨浏览器/跨OS视觉迁移、性能/长稳、RELEASE设计签署未执行。继承UI-VIS-000既有Linux/其他浏览器基线尚未迁移的风险，当前全量远程视觉CI可能拒绝，不冒充已验证。
- 未使用生产凭据、未连数据库、未推送/部署。历史55,339个audit/gate记录路径无修改，见[保护检查](./evidence/ui-102-local-20261021/scope-preservation.json)。

本轮[完整文件清单](./evidence/ui-102-local-20261021/changed-files.json)含代码、测试、CI、操作文档、计划与原始证据。[完整确认稿](./evidence/ui-102-local-20261021/confirmation-draft.md)按项目确认规程等待唯一项目用户确认，Codex不自行批准。确认仅覆盖当前工程事实，不消除NOT_RUN或提升阶段READY。下一可执行开发项 **FE:UI-101 / I1 当前功能复核**；其当前功能与完整G1准入分别记账。
