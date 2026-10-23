# UI-401 Market Catalog、Watchlist、VenueQuote 功能交付

任务：前端执行计划 I4 UI-401 / C12。分支 main；无 push、部署、外部发布、生产凭据或数据库操作。

最终功能候选：`0d019762d5f6f2fd2d97cfadb0d3660e0118ec65`。主实现提交 `98e6851be5d066f6d69db1f2153710b3e5b7ff6b`；最终候选补齐市场目录 region 语义，并拒绝将 aria-prohibited-attr incomplete 视为可忽略项。最后的证据提交只保存回执/报告和原始失败，不把证据保存后的 HEAD 改绑为已验收候选。

工程 Gate：**PASS_UI401_REFERENCE_FUNCTION**，只覆盖本机真实模块组合、生成 consumer 和合成 reference 输入。development_status=`IMPLEMENTED_PENDING_ACCEPTANCE`；INTEGRATION stage_gate=`NOT_ASSESSED`；formalAccepted=false；runtimeAdmission=DENIED。没有自行授予正式用户验收或依赖 READY。下一原任务 **FE:UI-P18**。

## 已交付功能与变更文件

- `/markets` 页面：`apps/terminal/app/markets/{page.tsx,workspace.tsx,workspace.css}`。全局 Terminal 壳、市场筛选/搜索/自选、逐行报价/来源/许可/质量/capability、陈旧/空/错误/只读/冲突/未知结果状态；深浅主题、宽窄布局、键盘原生控件。
- `apps/terminal/src/markets/{policy.ts,runtime.ts}`：生成 C01/C12 契约，精确 instrument/venue/product 绑定与原始金额字符串，权限/期限/失效清屏，CAS/幂等/CSRF/重入锁/429冷却、原意图恢复、显式冲突处理、不可见自选引用的显式移除。未执行下单/部署接口。
- `packages/domain-ui/src/ui101.ts`：把实际 C01 `market.read` 映射到 Markets 导航；不发明写权限。直接回归既有 shell/P02 presentation。
- `services/bff-gateway/src/{lib.rs,market.rs,market_tests.rs}`：仅 reference 的 C01 market capabilities、viewer只读路径与自选隔离；不改变 live 认证、许可、存储或交易。
- `apps/terminal/tests/ui401{,-provider-consumer}.test.ts`，`tests/e2e/{ui401.spec.ts,fixtures/ui401-reference.ts}`，`playwright{,.ui401}.config.ts`：新增实际页面成功/拒绝/恢复、原内容/版本/键重试、view-only、离线清屏、输入维度拒绝和明暗/宽窄检查。标准浏览器配置排除需要专用 reference fixture 的新 spec。
- `scripts/ui401-review{,.test}.mjs`：冻结输入、记录实际命令/日志/产物、校验网络副作用范围/来源、拒绝伪造阶段/跳过或重试浏览器/日志漂移；有界命令矩阵不递归上游。
- `docs/operations/ui401-market-workspace.md`、前端执行计划 UI-401 条目同步实现状态与边界。`.gitattributes` 仅为四个不可变失败 error-context 及原始空白诊断设置精确路径例外，保留字节不重写。

逐文件清单（包括所有证据）：[changed-files.txt](./evidence/ui401-local-20261023/changed-files.txt)。[回执](./evidence/ui401-local-20261023/receipt.json)、[汇总](./evidence/ui401-local-20261023/result.json)、[原始失败与边界](./evidence/ui401-local-20261023/README.md)。

## 冻结候选实际检查

完整重放命令：`node scripts/ui401-review.mjs --run docs/audit/evidence/ui401-local-20261023/attempt-NN`（必须新目录；需允许 loopback 服务/Chromium）；仅复核：`node scripts/ui401-review.mjs --verify`。

| 命令 / 检查 | 实际结果 |
| --- | --- |
| `node scripts/development-execution.mjs --development FE:UI-401` | allowed=true；依赖仅原范围参考 |
| `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | PASS，记录 binary SHA-256 |
| `pnpm exec vitest run` UI401、实际C12 consumer、MarketSeriesRecovery、route-access、domain UI101、P02 presentation（精确7文件见 executions.json） | 108/108，0 pending/failed |
| `cargo test --locked --offline -p bff-gateway --lib market::tests::` | 18/18，0 ignored |
| `cargo test --locked --offline -p bff-gateway --lib session` | 12/12，0 ignored；不是目标IdP验收 |
| `pnpm --filter @sumalpha/terminal typecheck` | PASS |
| `pnpm exec eslint` 受影响页面/policy/runtime/nav/test/gate/config | PASS |
| `node --test scripts/ui401-review.test.mjs` | 5/5 负向Gate测试 |
| `rustfmt --check --edition 2024` 受影响Rust文件 | PASS |
| `pnpm --filter @sumalpha/terminal build` | PASS；实际导出 markets.html；client-secret scan通过 |
| `pnpm exec playwright test --config=playwright.ui401.config.ts --project=chromium --workers=1 --retries=0` | 9/9，0 skipped/flaky，实际reference网络记录 |
| axe / screenshots | dark/light × 1440/390，4扫描/4截图，0 violation；4条color-contrast incomplete（图标nonBmp，14节点），保留人工核查 |
| `node scripts/check-development-plans.mjs` | PASS，159项stage_gate均未提升 |
| `node scripts/development-execution.mjs --integration FE:UI-401` | **预期拒绝 exit 1** / STAGE_NOT_READY，不是INTEGRATION通过 |
| `node scripts/development-execution.mjs --development FE:UI-P18` | allowed=true |
| `node scripts/ui401-review.mjs --verify` | PASS；复核最终输入/命令/日志/产物摘要 |

## 失败保留与未决风险

- preflight-01：sandbox loopback EPERM，浏览器未运行；最早consumer进程受相同限制后中断(exit130)，不计PASS。初次typecheck发现props/nullability错误已修复，未冻结开发测试仅作过程记录。
- preflight-02：71/71单测/consumer，Chromium 5/9通过、4失败（含1 timeout）；修复Venue显式label和main内alert断言。原始日志/截图保持。
- attempt-01：绑定98e6851b，原工程检查通过但复核发现aria-prohibited-attr incomplete，已修复；原回执完整保留，未改绑。最终独立attempt-02绑定0d019762，9/9与全部有界检查重新执行。
- 真实IdP/Cookie/CORS、Supabase RLS/事务/持久化、外部行情/许可与持久恢复、生产托管、Firefox/WebKit/跨OS、人工读屏/native200%、同SHA远程CI、性能容量长稳、完整I4联调及发布全部 **NOT_RUN**。四条图标自动对比度incomplete保留，未声称完整无障碍验收。
- 目录按精确instrument顺序查询报价，当前max256；大目录性能未验证。报价是显式刷新快照，超过两秒标陈旧；candles/实时行情与P18高保真在后续任务。恢复键仅内存，退出提示后清除；跨页/崩溃恢复未授予。

UI-401当前功能没有已知未修复的阻塞缺陷。上述联调/发布义务不提升为本任务通过；继续执行UI-P18，保留本候选证据及未执行项。
