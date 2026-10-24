# UI-P22 高保真功能交付

冻结源码 **8c0286fa0a6ea6e2a5e55a5514c7ad6d024b8a10**，基线 `f52c2fa325ba2c5a741057c177851267a1e56a7c`。布局实现提交0201e8ae；移动端单元格/金额列与绘制证据增强提交8c0286fa。最终attempt-02，限定工程Gate **PASS_P22_HIGH_FIDELITY_FUNCTION**。仅QuantOS/main、本地提交，未使用生产凭据、未推送或部署。

参照P22设计交付全局SUMALPHA框架/Orders下对账导航、面包屑/标题动作/Runbook、Provisional告警、账户/UTC日/Run/来源上下文、四项摘要、BreakGrid分类/类型/Order-Fill搜索与右侧差异详情、原始Expected/Actual对比、来源对象/检测时间线/correlation、Funds Ledger、运行事实/来源证据栏和受控重跑。1440并排、768/390堆叠，明暗主题、原始金额可横滚读取。摘要明确当前返回项，独立展示report breakCount，不虚构matched/缺失总量或历史增幅。调查说明保存、导出等无契约的动作明确禁用。

UI506运行时、C15owner、C09/C10/C15契约1.16.0未改。金额/JSON词面精度、账户/模式/来源、C01授权撤销、有效期/8秒核查deadline、有限SSE/GET比对、CAS/幂等/原请求恢复继续有效。202只受理，不关闭差异；未知锁定新写/换Run，失权清理敏感事实与恢复意图。Order/Fill源字符串不转换成UUID；Performance精确Run/实际账本hash、C16 exception/domain/scope和C10correlation/审计根绑定保持。

最终验证 **72项前端/实际消费者**、**25项Node**、**14项Chromium**（零重试/跳过/失败）通过。类型、lint、生成契约、离线BFF binary、terminal build/client secret检查、计划结构通过。**6组axe零violations**；**6组color-contrast incomplete/236节点**待人工完整复核，原因：nonBmp 62、横滚/遮挡 158、短文本 16，不算自动PASS。实际功能/布局截图包括12张明暗三尺寸主视图/账本视图、4张平板手机金额列，加1张显式合成closed状态及1张独立移动单元格图；合计18张。

直接回归范围是新展示策略及其依赖的UI506事实/幂等恢复、真实本机C15/C14/C10消费者和C01撤销；后端/运行时无修改，不递归重跑Rust owner、所有上游、全仓、coverage或数据库campaign，也没有连接数据库。语义/布局/精度是当前任务，不把截图工具补充扩大成数据库验收。

| 检查 | 精确命令 | exit |
|---|---|---|
| `development` | `node scripts/development-execution.mjs --development FE:UI-P22` | 0 (PASS) |
| `binary` | `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | 0 (PASS) |
| `unit-consumer` | `pnpm exec vitest run apps/terminal/tests/ui-p22.test.ts apps/terminal/tests/ui506.test.ts apps/terminal/tests/ui506-provider-consumer.test.ts apps/terminal/tests/g1-route-access.test.ts --reporter=json --outputFile=docs/audit/evidence/ui-p22-local-20261024/attempt-02/unit.json` | 0 (PASS) |
| `generated` | `pnpm exec node scripts/check-bff-generated.mjs` | 0 (PASS) |
| `types` | `pnpm --filter @sumalpha/terminal typecheck` | 0 (PASS) |
| `lint` | `pnpm exec eslint apps/terminal/app/reconciliation apps/terminal/src/reconciliation apps/terminal/tests/ui-p22.test.ts tests/e2e/ui-p22.spec.ts tests/e2e/fixtures/ui-p22-reference.ts playwright.config.ts playwright.ui-p22.config.ts scripts/ui-p22-review.mjs scripts/ui-p22-review.test.mjs scripts/terminal-static-routes.mjs scripts/terminal-static-routes.test.mjs` | 0 (PASS) |
| `gate-tests` | `node --test scripts/ui-p22-review.test.mjs scripts/terminal-static-routes.test.mjs scripts/serve-static.test.mjs` | 0 (PASS) |
| `terminal-build` | `pnpm --filter @sumalpha/terminal build` | 0 (PASS) |
| `browser` | `pnpm exec playwright test --config=playwright.ui-p22.config.ts --project=chromium --workers=1 --retries=0 --reporter=list,json --output=docs/audit/evidence/ui-p22-local-20261024/attempt-02/browser` | 0 (PASS) |
| `plans` | `node scripts/check-development-plans.mjs` | 0 (PASS) |
| `integration-refusal` | `node scripts/development-execution.mjs --integration FE:UI-P22` | 1 (预期拒绝) |
| `next-development` | `node scripts/development-execution.mjs --development FE:UI-402` | 0 (PASS) |

执行入口：`node scripts/ui-p22-review.mjs --run docs/audit/evidence/ui-p22-local-20261024/attempt-02`（该目录已封存，重跑须另建新attempt）；复核`node scripts/ui-p22-review.mjs --verify`。receipt.json绑定sourceCommit/设计图hash/所有输入Git blob、精确argv/时间/exit/原日志hash、binary/build与浏览器网络/截图hash；result.json摘要，p22-layout.json有区域位置、字段边界、两表尺寸与滚动后单元格坐标/颜色、可见金额内容。浏览器仅GET与C15 rerun POST，明确控制logout；代理身份/TLS/cookie/CORS为回环替身，网络只记录请求/回包hash，不输出凭据。

首轮源码0201e8ae/attempt-01的72/25/13通过是原测试范围。人工发现连续viewport切换后的手机账本截图空白后，没有将其作为最终高保真通过；原receipt/result已逐字节另存attempt-01-*-original.json，attempt-01全部输入/日志/artifact hash和旧Git blob复核保留。单独手机以及axe前后诊断正常；增加绘制等待、滚动后单元格几何断言、原始金额列横滚截图后，候选8c0286fa/attempt-02重新构建/执行。截图机制未作为跨浏览器问题独立确诊。原开发lint、select标签超时和Runbook hidden失败及诊断均ORIGINAL_SCOPE_ONLY，不改写原日志或历史UI506证据。

计划 **IMPLEMENTED_PENDING_ACCEPTANCE**；正式 **INTEGRATION / NOT_ASSESSED**，formalAccepted=false、runtimeAdmission=DENIED。INTEGRATION exit1是预期拒绝；I6/G5/FEP-5均未自动通过。待确认稿PENDING，不代用户批准。FE:UI-402仅当前功能开发准入允许。

未决：参考图Paper由真实Shadow上下文代替；matched/缺失总量、venue/资产/严重度/健康、独立delta/容差、回报正文和处置动作历史无源，明确显示未提供。调查说明/差异导出未提供API，控件禁用。实际C09–C15同scope/ID阳性join、C15–C16匹配reconciliation告警阳性join缺源NOT_RUN；closed/acknowledged/大Decimal浏览器样例是显式SYNTHETIC，不能当真实venue或关闭证明。真实IdP/cookie-CORS、Supabase/RLS/事务/Storage、真实venue账本、持久/跨会话恢复、远程同SHA CI、性能容量长稳、完整I6/发布NOT_RUN；读屏/原生200%缩放/其他浏览器/跨OS/真实触控未验证。

全量变更changed-files.txt；repository-scope.json说明main/基线/历史证据保留；delivery-manifest.json对本目录除自身外全部文件封存hash。下一可执行开发任务 **FE:UI-402：OHLCV/K线、指标、订单/成交标记**。

原始Playwright错误上下文/page-state含尾随空格及tab；首次暂存diff-check exit2保留于whitespace-original.log，仅为这些精确raw路径与原日志新增.gitattributes例外，不改证据字节或放宽源码检查。
