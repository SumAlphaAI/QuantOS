# UI-P03 当前页面审查与验收证据

结论：`PASS_UI_P03_CURRENT_PAGE`，最终工程 `9d8de103a61531588ebc4888af87b0d2ec6be89d`，562输入、54产物、10条命令。仅本机当前页面范围通过；计划 `IMPLEMENTED_PENDING_ACCEPTANCE`，完整确认稿 `PENDING`，不代项目用户批准。只在main本地提交，无生产凭据、推送或部署。

交付 `/research` 与 `/research/new`：按P03设计的Terminal外壳、左侧Research列表/当前页统计/筛选/服务端分页、右侧发起研究面板/快照摘要/能力选择/预算deadline核对/不含交易指令的范围勾选；双主题、响应式、键盘步骤、关闭确认与焦点恢复。复用UI-201原runtime/policy/gateway、C01/C03/C04及幂等/撤权/恢复，不修改后端、契约或原用途校验。新增勾选不授予业务权限。

参见[规程](../operations/ui-p03-research-workbench.md)、[工程回执](./evidence/ui-p03-local-20261023/receipt.json)、[范围](./evidence/ui-p03-local-20261023/scope.json)、[完整确认稿](./evidence/ui-p03-local-20261023/confirmation-draft.md)、[视觉核对](./evidence/ui-p03-local-20261023/visual-review.json)、[实际执行](./evidence/ui-p03-local-20261023/attempt-05/executions.json)、[保留失败/预检说明](./evidence/ui-p03-local-20261023/README.md)、[完整变更清单](./evidence/ui-p03-local-20261023/changed-files.txt)。

通过：78单测（19项presentation＋59项UI201直接runtime/校验）、11个Chromium、52门禁/路由、类型/lint/build与87文件客户端扫描。同一冻结源码完成两主题×两路由×1672/1024/390共12图比对，阈值仍0.005，14张未遮罩截图保留；12次axe零violations。随机ID不影响固定列宽，快照时间窗固定两行；截图工具显式按main/panel几何边界定位，在axe后恢复截图现场，并保存三阶段坐标。Codex核对设计图及桌面/小屏画面；独立人工评审、读屏、原生200%缩放、跨OS均NOT_RUN。

当前每次axe仍有1条color-contrast incomplete，共12条扫描记录（含重复控件），涉及非文本图标/滚动裁剪节点背景无法自动判定。完整原报告、节点、源SHA与摘要保留；不声称对比度全面通过，不把12次扫描解释为12个独立缺陷。原P05的6项图标、UI-201的2项表头incomplete继续原SHA留存，不关闭或重绑定。

| 实际命令 | 结果 |
| --- | --- |
| `node scripts/development-execution.mjs --development FE:UI-P03` | 通过（exit 0） |
| `pnpm exec vitest run apps/terminal/tests/ui-p03-presentation.test.ts apps/terminal/tests/ui201.test.ts --reporter=verbose --reporter=json --outputFile=docs/audit/evidence/ui-p03-local-20261023/attempt-05/unit.json` | 通过（exit 0） |
| `pnpm --filter @sumalpha/terminal typecheck` | 通过（exit 0） |
| `pnpm exec eslint apps/terminal/app/research apps/terminal/src/research/presentation.ts apps/terminal/tests/ui-p03-presentation.test.ts scripts/ui-p03-review.mjs scripts/ui-p03-review.test.mjs playwright.ui-p03.config.ts playwright.config.ts tests/e2e/ui-p03.spec.ts tests/e2e/fixtures/ui-p03-reference.ts` | 通过（exit 0） |
| `pnpm --filter @sumalpha/terminal build` | 通过（exit 0） |
| `pnpm exec playwright test --config=playwright.ui-p03.config.ts --project=chromium --workers=1 --retries=0 --reporter=list,json --output=docs/audit/evidence/ui-p03-local-20261023/attempt-05/browser` | 通过（exit 0） |
| `node --test scripts/ui-p03-review.test.mjs scripts/terminal-static-routes.test.mjs` | 通过（exit 0） |
| `node scripts/check-development-plans.mjs` | 通过（exit 0） |
| `node scripts/development-execution.mjs --integration FE:UI-P03` | 预期拒绝 STAGE_NOT_READY（exit 1） |
| `node scripts/development-execution.mjs --development FE:UI-202` | 通过（exit 0） |

设计取舍均基于接口事实：C03未返回任务问题标题，列表显示引用；未提供的进度、引擎健康、许可批准、全局数量、通知未读、C02行情新鲜度/风险不合成。实际costUnits缺省显示“成本未返回”，预算不冒充成本。工作区/账户只显示C01实际引用。附件扫描/模板保存和UI-202详情/SSE/取消未冒充可用功能，链接只到既有快照/审计页面。右侧内容可滚动，移动端提交动作已验证可达。

变更文件组：

- `apps/terminal/app/research/workspace.tsx`、`workspace.css`；新增 `src/research/presentation.ts`、`tests/ui-p03-presentation.test.ts`。
- `tests/e2e/ui-p03.spec.ts`、`fixtures/ui-p03-reference.ts`、12张本任务截图基线；`playwright.ui-p03.config.ts`及默认测试排除登记，避免日常测试隐式启动reference。
- `scripts/ui-p03-review.mjs`、`ui-p03-review.test.mjs`、本报告、规程、前端计划和证据目录；精确 `.gitattributes` 仅保护生成失败上下文字节。

复用边界：原UI-201工程e3776999、文稿/证据89da61ee与确认840c90d2的541输入/44产物/122单测/24Rust/8Chromium/52门禁只按原范围引用。245 Rust输入及runtime/policy/gateway原字节不变，原reference二进制e3776999直接复用，不构建、不重跑Rust或上游全链。G1辅助项不是开发前置。

候选历史：a99c57fc/attempt-01浏览器9/11；93fa8bc8/attempt-02为10/11；418e3fdc/attempt-03已通过的原回执保存在prior-418e3fdc，仍绑定原SHA；ec3f7797/attempt-04为10/11，随后只修复截图定位工具。最终仅用9d8de103/attempt-05的同候选通过回执，不拼接旧候选结果。原浅色按钮实际对比度违规、modal焦点、随机引用列宽/时窗换行与截图定位问题均保留失败证据，不改写历史或放宽阈值。对偏移未证明的根因不作确定归因。

风险：reference身份cookie/CORS loopback与自签TLS替代，Firefox环境阻塞、WebKit附件拦截接收阻塞及全部历史NOT_RUN保留。真实IdP/MFA/Cookie/CORS、数据库/Storage、外部provider/实际研究引擎、生产host、远程同SHA CI、性能/长稳与发布仍NOT_RUN。结果未知body/key只在内存，离开后先查列表；原deadline或快照失效则拒绝重发，恢复不重放。许可标签、原读取通过和本页勾选均不授予业务用途。

Gate：全部159阶段门禁与基线840c90d2比较保持NOT_ASSESSED；UI-P03 INTEGRATION 预期拒绝STAGE_NOT_READY，G1/FEP-1 NOT_READY_GAPS_OPEN，formalAccepted=false、runtimeAdmission=DENIED、currentHeadAcceptance=NOT_CLAIMED。人工确认PENDING，后续文档HEAD不冒充已验收工程。下一原任务 **I2 UI-202：Research详情、SSE流、取消与恢复**，可继续开发，无G1辅助项前置。

本地工程提交：a99c57fc（页面）、93fa8bc8（列宽）、418e3fdc（时间窗/定位）、ec3f7797（窄列排版）、9d8de103（最终受测工程，截图定位与坐标证据）。本报告与证据由后续独立本地提交封存。
