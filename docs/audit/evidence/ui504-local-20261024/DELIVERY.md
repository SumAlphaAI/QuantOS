# FE:UI-504 交付报告

I5 Approval、MFA、职责分离功能已完成并以真实本机 reference BFF 验证。仅 QuantOS main 修改与本地提交；未使用生产凭据、推送或部署。

基线 `e1594962ed6fa6ec6b41c08b9ad640cc3f575c16`；实现提交 `c19a92f700778866a298319a73a1455e82d6ad4e`；最终源码 `12798275ff861b0dcd86ad444c27b7aca8f83476`。后续封存提交仅保存证据与交付文稿，不是新的已构建候选。完整变更见 changed-files.txt。

## 文件与行为

- `apps/terminal/app/approvals/{page.tsx,workspace.tsx,workspace.css}`：授权列表、UUID深链详情、发起人/审批人/版本/期限与状态、真实业务对象引用、明确自批拒绝、决定/原因、危险操作二次确认和MFA、服务端回执、未知结果显式恢复；明暗/响应式及加载/空/错误/失权清理。
- `apps/terminal/src/approvals/{policy.ts,runtime.ts}`：C01双读与持续route-access、C08每页50/总1000有界cursor、确认前及MFA/再认证后重读、精确对象绑定、If-Match/幂等/CSRF/Request-ID、同步busy防双击、429冷却、不采用乐观更新、未知结果原键原body恢复、过期停止恢复。MFA码不进入运行时草稿、恢复请求和存储；成功版本最多100项不淘汰防重放。关闭/失权清除全部敏感状态。
- `services/bff-gateway/src/strategy.rs`、`strategy/tests.rs`：C08 Release分支返回实际决定，拒绝/需要更多信息强制原因并记录时间线；request_info按现有Trade语义终结为rejected，无授权/部署。新宿主测试覆盖缺原因422、两种拒绝决定、记录与原键恢复；24项C05/C08直接宿主回归通过。
- `services/bff-gateway/src/execution/tests.rs`：新增财务余量/venue健康变化后批准409/RISK_DENIED，确认审批仍pending、无command和下游调用；24项执行宿主回归通过。
- `apps/terminal/tests/ui504{,-provider-consumer}.test.ts`：26项当前策略/运行时和2项实际消费者，包括独立Trade审批/提交后丢包原键恢复、strategy_release实际request_info与无Command；配套权限/执行恢复/已有Trade及Release消费者/SDK响应/导航回归共99项。
- `tests/e2e/{ui504.spec.ts,fixtures/ui504-reference.ts}`、`playwright{,.ui504}.config.ts`：15项Chromium真实reference场景，实际MFA/拒绝/自批/过期/当前Kill风险拒绝/失权/丢包恢复与合成409/429探针，拦截外部网络；每个请求只保留body/key/response摘要。固定123456仅reference MFA测试控制，不是生产因素。
- `apps/terminal/public/terminal-route-map.json`、`scripts/terminal-static-routes{,.test}.mjs`：仅增加精确approvals UUID映射，未开放泛化SPA回退。
- `scripts/ui504-review{,.test}.mjs`、执行计划、操作规程、本证据目录与`.gitattributes`：源码/二进制/构建/命令/日志/网络/截图hash、边界拒绝与人工待确认稿；2个首轮error-context及空白检查日志精确豁免，原始字节未改写。

## 命令与结果

入口：`node scripts/ui504-review.mjs --run docs/audit/evidence/ui504-local-20261024/attempt-02`。15组命令按预期退出，具体参数/起止时间/exit/logHash见 attempt-02/executions.json。环境为webEnvironment白名单（固定pnpm10.20.0）与locked/offline Cargo；无DATABASE_URL/生产环境输入。

| 命令 | 结果 |
| --- | --- |
| `node scripts/development-execution.mjs --development FE:UI-504` | 当前开发允许 |
| `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | PASS；binary.json绑定源码/hash |
| `pnpm exec vitest run ...`（精确9个文件见executions.json） | 99/99，零pending/fail |
| `cargo test --locked --offline -p bff-gateway --lib execution::tests::` | 24/24 |
| `cargo test --locked --offline -p bff-gateway --lib strategy::tests::` | 24/24 |
| `pnpm exec node scripts/check-bff-generated.mjs` | PASS；契约未修改 |
| `rustfmt --check --edition 2024 ...` | PASS（当前3个Rust文件） |
| `pnpm --filter @sumalpha/terminal typecheck` | PASS |
| `pnpm exec eslint ...` | PASS，限定变更范围 |
| `node --test scripts/ui504-review.test.mjs scripts/terminal-static-routes.test.mjs scripts/serve-static.test.mjs` | 22/22 |
| `pnpm --filter @sumalpha/terminal build` | PASS，静态导出及client-secrets检查；buildId=terminal-12798275ff861b0dcd86ad444c27b7aca8f83476 |
| `pnpm exec playwright test --config=playwright.ui504.config.ts --project=chromium --workers=1 --retries=0 ...` | 15/15，零重试/跳过/不稳定；4组axe零violations |
| `node scripts/check-development-plans.mjs` | PASS |
| `node scripts/development-execution.mjs --integration FE:UI-504` | 预期exit1，拒绝阶段晋级 |
| `node scripts/development-execution.mjs --development FE:UI-P10` | 允许下一原任务 |
| `node scripts/ui504-review.mjs --verify` | PASS，详见verification.log |

范围依据：仅当前Approval功能、C08 Trade/Release服务端分支、C01失权、直接执行/策略消费者及静态路由回归；没有全仓/递归依赖/三轮独立构建/数据库campaign或覆盖率campaign。

## Gate 与未决风险

工程Gate **PASS_UI504_APPROVAL_FUNCTION**；development_status **IMPLEMENTED_PENDING_ACCEPTANCE**；正式 stage_gate **INTEGRATION/NOT_ASSESSED**，formalAccepted=false、runtimeAdmission=DENIED。待确认稿 confirmation-draft.md 未由Codex代用户批准。

- 实际reference模块组合，合成身份/数据和明确回环TLS/cookie/CORS替身。真实IdP/因素/生产cookie/CORS、目标Supabase/RLS/事务/持久恢复、真实risk/portfolio/额度来源、同SHA远程CI、跨OS/浏览器、性能/容量/长稳、完整I5联调和发布均NOT_RUN。
- C08未提供完整RiskDecision；Trade未提供kind/objectRef，均不推断。完整风险详情/高保真留给UI-P10；批准和commandRef不能当交易/订单/成交。跨访问持久恢复NOT_RUN，离开或失权后只读核对，不新造恢复请求。
- 内置reference Approver注销入口返回403：首轮失败已保留，最终真实注销清理使用current发起人只读身份；不宣称真实Approver IdP撤销已验收。连续C01监控/任意撤销帧的前端清理由直接单元测试验证。
- axe 2条color-contrast incomplete扫描组/14个非文本导航图标节点保留，未算PASS；人工读屏/原生200%缩放NOT_RUN。桌面/手机基本布局复核见VISUAL-REVIEW.md；不声称UI-P10高保真完成。

## 历史证据

development原始60项59PASS/1FAIL（429通用兜底覆盖明确2秒冷却）及源快照；98/99实际Release消费者FAIL（错误假定响应correlation不变）、optional字段类型FAIL和门禁占位常量lint FAIL均保留。对应修复后专项复验记录亦保留，但不代替最终候选。

attempt-01冻结c19a92f7：99单元、24+24宿主及构建通过，Chromium13/15失败（自批提示泛化；误用不支持的Approver注销）。全部原始输入/命令/报告/页面/截图/hash封存在attempt-01-result.json，标记ORIGINAL_SCOPE_ONLY；后用新源码attempt-02，旧结果未改绑。

下一可执行任务：**FE:UI-P10：Approval 列表与 RiskDecision 详情高保真页面**。开发准入已记录；UI-505 Command/Order提交保持后续独立任务。
