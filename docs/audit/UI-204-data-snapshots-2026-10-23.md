# UI-204 DataSnapshot 当前功能报告（2026-10-23）

当前功能门禁 **PASS_UI204_CURRENT_FUNCTION**。工程候选 `54ab042b14b973cbe4e37dfcefdfafa351cc893d`，524个输入、33个产物、12条命令；人工确认 **PENDING**，计划 `IMPLEMENTED_PENDING_ACCEPTANCE`。这只覆盖当前功能及明示本机reference范围。159个阶段Gate均NOT_ASSESSED，G1/FEP-1仍NOT_READY_GAPS_OPEN，正式/运行/发布不准入。

## 交付与变更

- `apps/terminal/app/data-snapshots/`：目录、详情、质量/ID过滤、排序与服务端不透明分页，空态、错误、加载、规范/兼容路由、桌面/小屏布局。
- `apps/terminal/src/data-snapshots/`：快照政策与授权runtime。verified以外全部阻断；服务端qualityBlocked必须明确false，许可与双时钟/窗口有效，达到截止点即拒绝。用途检查重新读取最新详情，仍不授予业务用途。
- `apps/terminal/src/research/gateway.ts`：C04 list/detail显式no-store；复用原生成客户端与严格响应schema。
- `apps/terminal/app/command/ui101-command-center.tsx`：按snapshot.read增加目录入口。
- `services/bff-gateway/src/lib.rs` / `research_tests.rs`：修正C01 current reference身份未声明其既有C04读取能力的差异，其他主体无新增能力且仍拒绝读取；live授权未改。只改2项Rust输入，复用其余243项并重建本轮二进制。
- `apps/terminal/public/terminal-route-map.json`、`scripts/terminal-static-routes.*`：有界UUID资源映射新增data-snapshots，audit/export回归通过，不提供任意SPA回退。
- 新增直接单测、Chromium配置/fixture/spec、`scripts/ui204-review.*`，同步[执行计划](../SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md#task-ui-204)及[功能规程](../operations/ui204-data-snapshots.md)。

## 实测结果

23项Rust（受影响research::tests，含3项同名live模块离线检查）、110项前端（55项UI-204、8项C04 gateway、19项Command presentation、28项授权监控回归）、50项门禁/资源路由、6项Chromium全部通过。类型、lint、终端构建与客户端80文件扫描通过。只覆盖当前变更直接影响；没有递归执行G1或全仓、数据库campaign。

| 命令 | 退出码与结果 |
| --- | --- |
| `cargo test --locked --offline -p bff-gateway --lib research::tests -- --nocapture` | 0，通过 |
| `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | 0，通过 |
| `node scripts/development-execution.mjs --development FE:UI-204` | 0，通过 |
| `pnpm exec vitest run apps/terminal/tests/data-snapshot.test.ts apps/terminal/tests/research-gateway.test.ts apps/terminal/tests/ui-p02-presentation.test.ts apps/terminal/tests/g1-route-access.test.ts --reporter=verbose --reporter=json --outputFile=docs/audit/evidence/ui204-local-20261023/attempt-02/unit.json` | 0，通过 |
| `pnpm --filter @sumalpha/terminal typecheck` | 0，通过 |
| `pnpm exec eslint apps/terminal/src/data-snapshots apps/terminal/app/data-snapshots apps/terminal/tests/data-snapshot.test.ts apps/terminal/src/research/gateway.ts apps/terminal/app/command/ui101-command-center.tsx scripts/terminal-static-routes.mjs scripts/terminal-static-routes.test.mjs scripts/ui204-review.mjs scripts/ui204-review.test.mjs playwright.ui204.config.ts playwright.config.ts tests/e2e/ui204.spec.ts tests/e2e/fixtures/ui204-reference.ts` | 0，通过 |
| `pnpm --filter @sumalpha/terminal build` | 0，通过 |
| `pnpm exec playwright test --config=playwright.ui204.config.ts --project=chromium --workers=1 --retries=0 --reporter=list,json --output=docs/audit/evidence/ui204-local-20261023/attempt-02/browser` | 0，通过 |
| `node --test scripts/ui204-review.test.mjs scripts/terminal-static-routes.test.mjs` | 0，通过 |
| `node scripts/check-development-plans.mjs` | 0，通过 |
| `node scripts/development-execution.mjs --integration FE:UI-204` | 1，预期拒绝 STAGE_NOT_READY |
| `node scripts/development-execution.mjs --development FE:UI-P05` | 0，通过 |

`node scripts/ui204-review.mjs --verify` 只读校验同候选输入、命令、产物、旧范围引用与边界。所有命令时间、环境范围、日志摘要见[实际执行](./evidence/ui204-local-20261023/attempt-02/executions.json)，产物摘要见[工程回执](./evidence/ui204-local-20261023/receipt.json)。

Chromium验证实际C04读取/分页/过滤、最新用途复核、规范与查询路由、failed/license_missing阻断、离线清除与显式恢复、能力收窄不发送C04、歧义引用无请求、慢身份无提前数据、小屏空态，以及合成degraded/expired/503拒绝和恢复。六项零重试；全部业务网络请求为GET。两张[浏览器截图](./evidence/ui204-local-20261023/attempt-02/browser)已人工查看；不宣称P05高保真视觉验收、axe/人工读屏或原生缩放通过。

## 版本及失败保留

原a7706db4功能首轮5/6浏览器通过后停止，没有PASS回执。reference还生成随机UUID快照，测试错误假设固定ID总在排序首位；改用实际返回ID核对分页，固定失败快照通过服务端ID过滤验证。54ab042b仅改测试及诊断；最终12命令和33产物完整绑定该候选，不混用旧通过。此前no-store缺失、错误预期码、Rust编译错误、0测试误过滤、select可访问名称、Next announcer定位冲突及超时均见[原始诊断说明](./evidence/ui204-local-20261023/preflight-notes.md)，日志/附件不删改。

旧UI-P12工程8f1f3763、工具6bb2d19a、确认65b6b9b5，旧UI-507及G1 ledger只保留原范围。旧二进制不改绑为当前二进制通过；当前重新构建，摘要见[binary.json](./evidence/ui204-local-20261023/attempt-02/binary.json)。

## 未决边界与Gate

reference身份为EXPLICIT_REFERENCE_COOKIE_BRIDGE，CORS为LOOPBACK_PROXY_SUBSTITUTION。Firefox为BLOCKED_ENVIRONMENT，WebKit附件接收为BLOCKED_ENVIRONMENT_TEST_INTERCEPTION。能力收窄、503、degraded/expired与慢响应注入逐条标记；不把合成条件记成目标环境测试。

全部历史NOT_RUN原值保留；真实IdP/MFA、真实Cookie/CORS、目标数据库/持久化权限、生产托管rewrite、后续策略/交易提交、读屏/原生200%缩放、跨OS/设备、同SHA远程CI、性能/长稳与发布仍未验证。本轮axe未执行。许可标签/内容哈希只展示服务端事实，不替代用途许可或独立签名验签。sources不捏造完整血缘图。

`核对策略用途/核对交易用途`只做条件核对，需要对应能力并重取最新详情，不创建策略或订单；后续模块必须再次执行服务端用途/资源授权。下一步不为补齐这些联调/发布义务而阻断无关开发。

[完整确认稿](./evidence/ui204-local-20261023/confirmation-draft.md)待项目用户确认。本轮不提升G1/FEP-1联调或发布状态，无生产凭据、推送、部署。下一原任务为 **I2 UI-P05：P05-Data-Snapshot-Catalog-and-Detail-High-Fidelity-v1.png**，开发入口已允许，无G1辅助项前置。
