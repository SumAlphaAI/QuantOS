# UI-P18 Markets Overview / Instrument Detail 功能交付

依据前端执行计划 I4 UI-P18、P18 v2参考与C12/C16。分支main，仅修改QuantOS；无生产凭据、数据库、push、部署或外部发布。

最终源码候选：`6c9749a28e9a15e717f0ff25e9c6fac593ec32e8`。主实现提交 `068068980494a3617eed4b530d4768fd1cdbf424`，第二提交修复中屏详情伸展及手机详情聚焦/滚动；最终证据提交只保存报告与原始回执，不将保存证据后的HEAD改绑为新候选通过。

工程Gate：**PASS_P18_REFERENCE_FUNCTION**。development_status=`IMPLEMENTED_PENDING_ACCEPTANCE`；INTEGRATION stage_gate=`NOT_ASSESSED`；formalAccepted=false；runtimeAdmission=DENIED。下一原任务 **FE:UI-501（Portfolio 与 Risk）**。

## 实现与变更文件

| 文件/模块 | 交付内容 |
| --- | --- |
| `apps/terminal/app/markets/workspace.tsx`、`workspace.css`、新增`p18-components.tsx` | 参考图三栏结构、自选/最近访问/筛选/列布局、MarketGrid、Venue报价比较、规范化标的详情、血缘/许可与C16偏好、明暗主题与1672/1024/390适配；手机导航聚焦真实详情 |
| `apps/terminal/src/markets/runtime.ts` | 保留UI401默认整批拒绝；P18显式partialQuotes，逐来源拒绝/错误行仅保留最小元数据，其他来源继续可读；全局401/撤销清屏 |
| 新增`p18-presentation.ts` | 严格symbol/venue/product路由与参数拒绝，白名单界面偏好，筛选/最近、自选视图，精确BigInt十进制spread展示 |
| 新增`quote-feed.ts` | 单instrument的C12报价流；完整快照绑定维度/来源/许可版本/snapshot，去重、不倒退、不接受同序号改价，切换立即隔离旧feed；EOF冻结、显式续接原cursor、权限终态清除、帧/idle有界 |
| 新增`alert-preferences.ts` | C16仅修改market域，保留其他域/级别；If-Match/CSRF/幂等、CAS冲突后基于最新其他域审阅、结果未知重试原意图、429冷却、身份/期限约束 |
| `apps/terminal/public/terminal-route-map.json`、`scripts/terminal-static-routes{,.test}.mjs` | 实际静态服务解析`/markets/BTC%2FUSDT`；非法/双重编码、额外路径、畸形query不进入业务读取 |
| 新增`apps/terminal/tests/ui-p18{,-alerts,-provider-consumer}.test.ts`、`fixtures/scenarios/market.ts` | 功能/拒绝/恢复、报价隔离、实际C12/C16/R01消费者、Viewer403与另一获授权Owner偏好隔离 |
| 新增`tests/e2e/ui-p18.spec.ts`、`fixtures/ui-p18-reference.ts`、`playwright.ui-p18.config.ts`；调整`playwright.config.ts` | 16个实际页面场景；记录quote stream精确query与C12/C16副作用范围；专用fixture不混入默认浏览器运行 |
| 新增`scripts/ui-p18-review{,.test}.mjs` | 冻结1474项源码输入及参考PNG hash；命令/日志/退出码、Rust与Terminal产物、网络范围、浏览器/截图/axe/三栏几何验真；拒绝阶段夸大、跳过/重试、伪造命令和日志漂移 |
| `docs/operations/ui-p18-markets.md`、前端执行计划UI-P18条目、当前报告/证据 | 同步实现状态、契约适配、剩余范围与下一任务；历史UI401和失败不改绑 |
| `.gitattributes` | 只对四份不可变预检error-context及原始空白诊断设置精确路径例外；不改写原字节 |

完整逐文件清单：[changed-files.txt](./evidence/ui-p18-local-20261023/changed-files.txt)。

## 最终候选实际检查

运行：`node scripts/ui-p18-review.mjs --run docs/audit/evidence/ui-p18-local-20261023/attempt-02`。复核：`node scripts/ui-p18-review.mjs --verify`。完整精确命令/环境边界、时间和原始退出码见[executions.json](./evidence/ui-p18-local-20261023/attempt-02/executions.json)。

| 命令/检查 | 实际结果 |
| --- | --- |
| `node scripts/development-execution.mjs --development FE:UI-P18` | allowed=true；依赖只作原范围参考 |
| `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | PASS，记录binary SHA-256 |
| `pnpm exec vitest run` P18、UI401、C12消费者/恢复、route monitor、UI101/P02直接影响（精确10文件见命令记录） | **162/162**，0 pending/failed |
| `cargo test --locked --offline -p bff-gateway --lib market::tests::` | **18/18**，0 ignored |
| `cargo test --locked --offline -p bff-gateway --lib operations::tests::stream_resume_is_dense_bound_to_subscriptions_and_never_masks_gaps` | **1/1** C16订阅/流绑定专项，不是外部告警验收 |
| `node --test scripts/ui-p18-review.test.mjs scripts/terminal-static-routes.test.mjs scripts/serve-static.test.mjs` | **19/19**，含实际loopback静态宿主 |
| `pnpm --filter @sumalpha/terminal typecheck`、受影响文件`pnpm exec eslint`、既有受影响Rust格式检查 | PASS |
| `pnpm --filter @sumalpha/terminal build` | PASS，markets.html与路由map导出，client-secret scan通过 |
| `pnpm exec playwright test --config=playwright.ui-p18.config.ts --project=chromium --workers=1 --retries=0` | **16/16**，0 skipped/flaky，全部本机真实reference页面成功/拒绝/恢复 |
| overview/detail × dark/light × 1672/1024/390 | **12组**自动截图/axe/几何；1672三栏位置校验通过，无文档横向溢出；小屏表格自身可滚动 |
| axe | **0 violation / 12 incomplete**。共156节点：nonBmp图标72、滚动区文字部分遮挡导致对比度无法自动判定84；保留人工复核，不称完整无障碍通过 |
| `node scripts/check-development-plans.mjs` | PASS；159项stage_gate未提升 |
| `node scripts/development-execution.mjs --integration FE:UI-P18` | 预期拒绝exit1 / STAGE_NOT_READY；不是INTEGRATION通过 |
| `node scripts/development-execution.mjs --development FE:UI-501` | allowed=true |
| `node scripts/ui-p18-review.mjs --verify` | PASS，源码/命令/原始日志/构建产物/网络/浏览器矩阵摘要绑定最终候选 |

[最终回执](./evidence/ui-p18-local-20261023/receipt.json)、[数量汇总](./evidence/ui-p18-local-20261023/result.json)、[失败与边界](./evidence/ui-p18-local-20261023/README.md)。代理只在loopback，临时TLS/cookie注入/CORS为明确测试替代，行情为owned synthetic reference，不是生产行情或生产身份。

## 视觉复核

参考图已实际打开并绑定hash；复核其“自选—目录/比较—标的详情/偏好”关系与信息层级。12组最终自动矩阵均保存原图与几何。Codex额外逐张放大检查最终6个代表截图：overview dark1672、overview light1024、overview light390、detail dark1672、detail light1024、detail dark390；覆盖两页/三宽度/两主题，检查三栏关系、密度/换行、真实选中venue、陈旧状态、手机焦点定位、血缘与禁用边界。结果与图像摘要见[visual-review.json](./evidence/ui-p18-local-20261023/visual-review.json)。其他6张不冒充独立人工复核；人工读屏/native200%仍NOT_RUN。

中屏卡片不再被旁列拉长；手机选择标的后标题聚焦并滚动到真实详情，导航测试断言卡片y在50–100px。视觉为现有契约的高保真结构适配，不宣称像素相等或缺失指标已实现。

## 保留失败与剩余范围

- preflight-01：build通过，126/127单测/consumer，12/15浏览器；修复错误的Viewer C16 200预期、未知详情测试未等目录结束、摘要aria-label无role。原始失败不改写。
- preflight-02：实际consumer1/1、浏览器14/15；detail面包屑link-in-text-block violation已修复为下划线；保留7扫描/6截图和原始上下文。
- attempt-01：绑定06806898，全部有界检查通过但截图复核发现中屏伸展/手机定位问题；修复并新增第16项流程，旧回执完整保留，最终attempt-02重新绑定6c9749a2。
- C12没有24h涨跌/成交量/高低、tickSize和可执行交易状态；C16没有按symbol的价格/陈旧阈值规则。对应字段明确不可用，仅market域订阅接口化，不伪造数值/规则。K线与交易单留给后续工作区，按钮有原因并禁用，不创建订单或死链接。
- 真实IdP/Cookie/CORS、Supabase RLS/事务/持久化、外部市场源/许可、目标恢复/托管、Firefox/WebKit/跨OS、人工读屏/native200%、远程同SHA CI、性能/容量/长稳、完整I4/RELEASE全部 **NOT_RUN**。12条incomplete保留人工核查。目录max256的顺序报价查询未做容量验收，当前验证4个synthetic instruments。
- UI401历史证据只绑定原候选；本次重新执行直接受影响功能，不递归验收其全部上游。恢复键和recent仅内存，离页提示后清除，不声明跨页/崩溃持久恢复。有限reference报价流EOF明确disconnected，不称真实持续实时。

当前工程交付与后续接口/环境/发布义务分别记账；正式用户验收未授予。下一可执行原任务UI-501，不因本报告自动提升依赖或发布状态。
