# FE:UI-505 交付报告

Command提交、Order/Fill事实时间线与撤单请求已在QuantOS main实现并通过限定本机验证。未使用生产凭据、推送或部署。

基线 `9ef62d37a3784855a2253ae1db114c434a09546e`；最终已构建/测试源码 **fd79185ff224b03fc5af385433e99458368292dc**。后续证据封存提交不声称为新构建候选。全部变更见changed-files.txt，全部证据hash见delivery-manifest.json。

## 变更文件与行为

- `apps/terminal/app/orders/page.tsx`、`workspace.tsx`、`workspace.css`：Command引用审阅/明确短语确认、独立202受理回执、授权订单列表与分页、订单详情/Fill表/事实时间线、续传和完整重读、撤单确认、未知结果原键恢复、空/加载/错误/过期/失权状态、明暗主题与手机布局。引用可截断显示于选择框，完整审阅从服务端读取；订单链接下划线不单靠颜色。
- `apps/terminal/src/orders/policy.ts`：UUID路由仅接受资源/approval引用；精确Decimal字符串校验、账户/mode/时间/数量/Fill一致性；append-only成交、不可变Order身份、终态不回退；dense sequence/租约/事件ID/关联ID、冲突重放/空洞/权限撤销拒绝。策略单元中的partial-fill数据属于合成负面/状态夹具，实际PaperKernel成交另由Rust宿主验证。
- `apps/terminal/src/orders/runtime.ts`：C01双读、当前能力与服务端源重验；5秒有界请求、2MiB日志/262144帧/1000事件上限、最终UTF8校验、8秒事实核查窗口。新提交只发服务端commandRef；同访问内存的原body/key恢复，未知结果锁定新写入，无自动重试。每次新提交/撤单重读权限、能力与原引用/订单事实；202不乐观更新。jobId只显示，实际订单经授权correlation查询+approval溯源唯一匹配，不能匹配时只保留回执。有限SSE显式回补并与GET核对，不宣称持久实时连接。
- `services/bff-gateway/src/execution.rs`：修正Order GET stream与mutation事件使用不同日志键的问题，统一为资源路径；其他stream家族键不变。`execution/tests.rs`新增首次GET前已发生submit/cancel的完整回补、原键去重/单下游动作、afterSequence精确续传；原有27执行/风险/过期/权限/恢复/真实Fill测试一并直接回归，共28。
- `apps/terminal/tests/ui505.test.ts`、`ui505-provider-consumer.test.ts`：18策略/运行时测试、1实际C01/C07/C08/C09消费者，含独立前置审批、提交/撤单commit后丢响应、原键恢复、dense历史、终态及内存清除；直接回归execution consumer/recovery、C01和SDK响应，共55项。
- `apps/terminal/public/terminal-route-map.json`、`scripts/terminal-static-routes.mjs`及测试：orders精确UUID详情映射真实静态文档，拒绝任意fallback/后缀/注入。
- `tests/e2e/ui505.spec.ts`、`fixtures/ui505-reference.ts`、`playwright.ui505.config.ts`、基础config隔离：8条Chromium、回环reference子进程、显式cookie/CORS/TLS替身、外网拦截；实际响应与标记SYNTHETIC探针分开；网络仅body/key/response hash，前置审批控制与页面C09写区分。
- `scripts/ui505-review.mjs`及负面测试：冻结源码/输入、精确argv/exit/日志/hash/构建/binary/网络/axe与边界复核；禁止formal/生产/递归依赖晋级，拒绝跳过/失败/篡改证据。执行计划和 `docs/operations/ui505-command-orders.md` 同步。OpenAPI1.16.0未改动。
- 本证据目录和精确原始空白保留规则：保存失败、原范围PASS与修复过程，证据封存不改旧结果。

## 测试命令与结果

入口：`node scripts/ui505-review.mjs --run docs/audit/evidence/ui505-local-20261024/attempt-05`。14组精确命令、起止/退出码/日志hash见attempt-05/executions.json。webEnvironment白名单、pnpm10.20.0、locked/offline Cargo；不加载DATABASE_URL或生产凭据。

| 命令 | 结果 |
| --- | --- |
| `node scripts/development-execution.mjs --development FE:UI-505` | 开发允许 |
| `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | PASS，binary.json绑定源码/hash |
| `pnpm exec vitest run apps/terminal/tests/ui505.test.ts apps/terminal/tests/ui505-provider-consumer.test.ts apps/terminal/tests/execution-provider-consumer.test.ts apps/terminal/tests/execution-recovery.test.ts apps/terminal/tests/g1-route-access.test.ts packages/api-client/tests/bff-response.test.ts --reporter=json --outputFile=.../unit.json` | 55/55，无pending/失败 |
| `cargo test --locked --offline -p bff-gateway --lib execution::tests::` | 28/28 |
| `pnpm exec node scripts/check-bff-generated.mjs` | PASS，契约未漂移 |
| `rustfmt --check --edition 2024 services/bff-gateway/src/execution.rs services/bff-gateway/src/execution/tests.rs` | PASS |
| `pnpm --filter @sumalpha/terminal typecheck` | PASS |
| `pnpm exec eslint ...`（精确当前文件见executions.json） | PASS |
| `node --test scripts/ui505-review.test.mjs scripts/terminal-static-routes.test.mjs scripts/serve-static.test.mjs` | 23/23 |
| `pnpm --filter @sumalpha/terminal build` | PASS；静态orders.html/client-secrets通过；buildId=terminal-fd79185ff224b03fc5af385433e99458368292dc |
| `pnpm exec playwright test --config=playwright.ui505.config.ts --project=chromium --workers=1 --retries=0 --reporter=list,json --output=.../browser` | 8/8，无重试/跳过/flaky；4axe零violations，8截图 |
| `node scripts/check-development-plans.mjs` | PASS |
| `node scripts/development-execution.mjs --integration FE:UI-505` | 预期exit1，allowed=false，未自动晋级 |
| `node scripts/development-execution.mjs --development FE:UI-P20` | 下一原任务开发允许 |
| `node scripts/ui505-review.mjs --verify` | PASS，见verification.log |

范围仅当前C09功能、受影响执行journal/去重/权限/恢复、C01连续授权、路由与生成响应检查；没有全仓/覆盖率/数据库campaign或递归上游复验。每次重新执行均对应实际修复或源码变化，旧attempt不覆盖。

## Gate与未决风险

限定工程 Gate **PASS_UI505_EXECUTION_FUNCTION**。development_status=IMPLEMENTED_PENDING_ACCEPTANCE；正式stage_gate=INTEGRATION/NOT_ASSESSED，formalAccepted=false、runtimeAdmission=DENIED；confirmation-draft.md为PENDING，未代用户确认。

实际本机reference组合使用owned合成身份/Paper数据，TLS/cookie/CORS桥接是替身；真实IdP/MFA、目标Supabase/RLS/事务、跨进程持久恢复、真实risk/portfolio/venue、同SHA远程CI、容量/性能/长稳、完整I5与发布均NOT_RUN。原键恢复只在本访问内存，跨会话应只读核对服务端事实与审计。数据源原有f64/固定quote模型未在本任务改造成全系统精确货币引擎。

2组axe color-contrast incomplete共20个nonBmp装饰导航图标节点待人工核查，不计PASS；人工读屏、原生200%缩放、真实触控/跨OS、Firefox/WebKit未运行。当前是UI505功能布局；UI-P20/UI-P11高保真仍NOT_RUN。finite SSE依赖显式续传与核对；事实超8秒禁止新撤单。

## 原始失败与范围保护

- development/：invalid venueKind夹具9PASS/8FAIL；带查询串stream匹配夹具16PASS/1FAIL；修复后54项原范围PASS。相关原始日志/摘要保留，不绑定最终候选。
- attempt-01：计划指向README尚不存在，development检查FAIL，余下NOT_RUN；补索引后同一源码新attempt。
- attempt-02 / b4905770：业务7PASS，axe链接只有颜色区别1FAIL；后续计划检查NOT_RUN，原截图/日志/axe保留。
- attempt-03 / 1416889f：自动54/28/23/8及4axe通过；截图复核手机select越界FAIL。原receipt/result与视觉发现保留ORIGINAL_SCOPE_ONLY。
- attempt-04 / ef84141c：手机控件边界修复后自动54/28/23/8通过；其后新增EOF完整性负面probe确实17PASS/1FAIL。旧runtime与测试快照、原日志/hash保留development/utf8-*，原receipt/result保留，不声称旧候选通过新用例。
- attempt-05 / fd79185ff224b03fc5af385433e99458368292dc：新增最终decoder flush，55/28/23/8、4axe通过；新输入与证据单独封存。历史其他任务证据未改动，未将旧PASS改绑。
- 封存元数据检查首次全仓git文件枚举超过Node默认输出buffer（ENOBUFS），该次后续检查NOT_RUN；改为仅证据目录枚举并增加buffer后，5轮源码绑定/原始artifact哈希/已暂存文件校验通过，见sealing-check-history.json。未改动功能输入或重跑无关测试。

## 本地提交与下一任务

源码提交：b4905770（实现）、1416889f（链接可访问性）、ef84141c（手机控件/事实截图）、fd79185f（EOF完整性）。后续仅证据封存；不推送/部署。

下一可执行任务：**FE:UI-P20：Trade Ticket高保真页面**，随后UI-P11。当前仅开发准入允许，不授权生产交易或发布。
