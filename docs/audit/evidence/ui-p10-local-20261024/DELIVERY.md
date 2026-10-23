# FE:UI-P10 交付报告

Approval 与 RiskDecision 详情高保真页面已在 QuantOS main 实现并完成限定本机功能验证。未使用生产凭据、推送或部署。

基线 `916a8545a471f92cf37b4790e896c9eef1d28e36`；实现 `a4df79dd3674241ebfcad0e8ddf7f056e80f5c7a`；最终源码 **eb1bb3822e31aaec7cd218198dce0dc4348a279a**。后续证据封存提交不冒充新已构建候选。全量变更见 changed-files.txt，全部证据hash见 delivery-manifest.json。

## 变更文件与最终行为

- `apps/terminal/app/approvals/{workspace.tsx,workspace.css,p10-components.tsx}`：参照P10设计的目录/详情分栏、RiskDecisionCard、当前核查、15条规则、政策阈值、保守组合影响、职责分离、Proposal/Release、论证/反方观点、证据链时间线、固定审批栏；三个明确决定按钮、复核勾选、二次确认/MFA。状态/严重性/搜索/到期排序、当前加载统计、空/加载/未知/失败/过期/失权及明暗/手机布局。手机规则表具备命名region、Tab焦点与ArrowRight横滚；手机操作栏回文档流。
- `apps/terminal/src/approvals/p10-presentation.ts`、`runtime.ts`：严格review作用域/账户/mode/correlation/Proposal/15规则和判定一致性；不可签发/owner验签字段验证、原决定与当前核查分开、8秒当前窗口，确认前/验证后重读并比较完整稳定来源，源变须重审。保留UI504原键原body恢复、失权清理和无乐观更新；新增MFA/再认证/提交阶段提示、C10有界分页和隔离拒绝。成功200才更新本次已加载列表并清除旧上下文，防止把原risk快照当当前。
- `bff/openapi/quantos-bff.v1.yaml` 与6个同源生成文件（SDK类型/Zod、JSONSchema、operations/MSW、provider input policy）：1.16.0新增可选 `includeReviewContext="true"|"false"` 查询、Approval.reviewContext、5个审阅子schema；默认/false及POST原形状保持。使用enum false与既有生成器兼容，未扩大通用生成器/查询解析器。
- `services/bff-gateway/src/execution.rs`、`execution/approval_review.rs`：在实际Trade申请保存原RiskGuard preview签名决定/context，GET由owner验签且不注册/签发决策；当前preview独立重算。只读投影源权益、gross/symbol保守上界、规则/阈值与venue，金额保留服务端Decimal字符串；无private source_ref/command_key/签名密钥输出。
- `services/bff-gateway/src/lib.rs`：reference审批身份具备approval.evidence.read；仅getEvidenceChain允许已授权Approval correlation，绑定tenant/workspace/account/mode/role/capability；其他链404、全局审计搜索与导出仍403。此reference能力不等于真实IdP或生产授权。
- `services/bff-gateway/src/execution/tests.rs`：新增3项，覆盖原决定/签名/默认响应不变、当前财务变更拒绝、实际scoped C10正反路径、知道correlation仍不得跨tenant/workspace/account/mode/role/capability读取；执行宿主合计27项。
- `apps/terminal/tests/ui-p10{,-provider-consumer}.test.ts`：20项策略/运行时与1项真实C01/C07/C08/C10消费者；UI504、Trade/Release消费者、恢复、持续权限、导航/SDK/请求schema等直接回归共131项。
- `tests/e2e/{ui-p10.spec.ts,fixtures/ui-p10-reference.ts}`、`playwright{,.ui-p10}.config.ts`：17项Chromium，实际reference BFF与显式合成负面探针分开，回环TLS/cookie/CORS桥接，外网拦截；网络仅摘要不记录MFA明文。4组axe、8张原始布局截图。
- `scripts/ui-p10-review{,.test}.mjs`、执行计划、操作规程与本证据目录：冻结源码/参考图/构建/二进制/命令日志/hash、边界否定探针与下一任务移交；`.gitattributes`仅对首轮原始error-context与原始空白日志做精确豁免，保留原件字节。

## 测试命令与结果

入口：`node scripts/ui-p10-review.mjs --run docs/audit/evidence/ui-p10-local-20261024/attempt-02`。17组命令按预期退出，精确argv/起止时间/exit/logHash见 attempt-02/executions.json。webEnvironment白名单、pnpm10.20.0、locked/offline Cargo，仅本机reference回环服务，无DATABASE_URL或生产凭据。

| 命令 | 结果 |
| --- | --- |
| `node scripts/development-execution.mjs --development FE:UI-P10` | 当前开发允许 |
| `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | PASS，binary.json记录源码与hash |
| `pnpm exec vitest run ...`（12个精确文件见executions.json） | 131/131，无pending/失败 |
| `cargo test --locked --offline -p bff-gateway --lib execution::tests::` | 27/27 |
| `cargo test --locked --offline -p bff-gateway --lib strategy::tests::` | 24/24 |
| `cargo test --locked --offline -p bff-gateway --test audit_export_provider evidence_chain_preserves_causation_order_and_hides_missing_resources` | 1/1 |
| 同上，过滤 `audit_snapshot_replay_has_no_duplicates_and_cursor_expiry_fails_closed` | 1/1 |
| `pnpm exec node scripts/check-bff-generated.mjs` | PASS |
| `rustfmt --check --edition 2024 ...` | PASS，当前4个Rust文件 |
| `pnpm --filter @sumalpha/terminal typecheck` | PASS |
| `pnpm exec eslint ...` | PASS，当前变更与直接测试文件 |
| `node --test scripts/ui-p10-review.test.mjs scripts/terminal-static-routes.test.mjs scripts/serve-static.test.mjs` | 22/22 |
| `pnpm --filter @sumalpha/terminal build` | PASS，静态导出/client-secrets通过，buildId=terminal-eb1bb3822e31aaec7cd218198dce0dc4348a279a |
| `pnpm exec playwright test --config=playwright.ui-p10.config.ts --project=chromium --workers=1 --retries=0 ...` | 17/17，无重试/跳过/不稳定；4axe零violations |
| `node scripts/check-development-plans.mjs` | PASS |
| `node scripts/development-execution.mjs --integration FE:UI-P10` | 预期exit1，仍拒绝阶段晋级 |
| `node scripts/development-execution.mjs --development FE:UI-505` | 下一原任务开发允许 |
| `node scripts/ui-p10-review.mjs --verify` | PASS，见verification.log |

回归范围只围绕本页C08读取/决定、C10 scoped链与分页、持续C01权限、共享执行/策略消费者及SDK生成校验；未递归重验上游、运行全仓/覆盖率/数据库campaign或无关三轮构建。

## Gate、设计适配与未决风险

工程Gate **PASS_P10_HIGH_FIDELITY_FUNCTION**。计划development_status=IMPLEMENTED_PENDING_ACCEPTANCE；正式stage_gate=INTEGRATION/NOT_ASSESSED，formalAccepted=false，runtimeAdmission=DENIED。confirmation-draft.md为PENDING，不代用户批准。

设计结构已落地；来源内容按真实模型适配：实际15条规则而非图中5条；无真实人员显示名、typed证据来源/时间/正文或委派策略，不伪造参考图演示数据。严重性为前端呈现映射deny→Critical、approval_required→Warning、allow→Info，不新增风险政策。统计仅已加载子集。signatureVerifiedByOwner是服务端完整性结果，非浏览器验签或可签发授权。当前RiskDecision preview的issuable=false；过去决定到期仍只读，操作需新当前核查与未过期Approval，最终交易核验仍在服务端。

组合影响保留现有f64源/固定quote边界与X02保守增加gross算法，Decimal仅作为投影字符串，未把该来源改造宣称为全系统精确货币核算；权益不是可用现金，负权益如实显示为风险拒绝。generic UUID证据不猜测Artifact外链；C10不授权额外全局审计、导出或交易。

未决：4条color-contrast incomplete扫描组共84节点（22非文本图标/箭头、62横滚后部分遮挡的表格文字），保留为人工待核；不归入PASS。手机横滚键盘已验证，全部对比度/人工读屏/原生200%缩放/实机触控/跨OS/Firefox/WebKit仍NOT_RUN。详见VISUAL-REVIEW.md。

真实IdP/MFA/生产cookie/CORS、目标Supabase/RLS/事务与跨进程持久恢复、真实risk/portfolio/venue与typed证据内容、远程同SHA CI、性能/容量/长稳、完整I5联调与发布均NOT_RUN。固定reference MFA码只用于本机合成场景；没有生产授权。

## 原始失败保留

development/保留：不存在Hash schema导致生成FAIL、const false与既有Zod生成不一致导致类型FAIL、prefer-const lint、无效UUID夹具8FAIL、共享checks别名导致1FAIL及源快照。原130/130开发PASS不是最终131项源码绑定结果。

首轮a4df79dd：131单元、26执行+24策略及2项C10、构建等通过；Chromium16/17，手机横滚区缺少键盘焦点被axe拒绝。原截图/错误上下文、两次axe结果和raw命令日志均封存attempt-01-result.json并标记ORIGINAL_SCOPE_ONLY。之后新增scope负面测试确实发现未显式绑定tenant的缺口（2PASS/1FAIL），修复后3/3通过；原失败与修复前helper快照在development/scope-original.json。最终新候选attempt-02另行执行，不改绑旧PASS、不重写旧失败。

下一可执行任务：**FE:UI-505：Command 提交、Order/Fill 时间线、撤单请求**；当前仅开发准入允许，不授权生产交易或发布。
