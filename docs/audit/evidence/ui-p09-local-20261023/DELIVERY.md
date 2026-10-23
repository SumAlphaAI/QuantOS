# FE:UI-P09 交付报告

I4 Proposal列表与详情高保真页面。仅修改QuantOS，在main开发并生成本地提交；未使用生产凭据、推送或部署。

基线 `5fbe12dde0ef96f2e0a784d9760e4bbe6c95f710`，实现提交 `b6ed39d3410fbf3fcc2f90977aefad1cc2522812`；最终源码冻结 `261f5cbf1430064f0e5f1edf630b4ce0b2abb446`。证据封存提交仅保存文稿/结果，不把证据提交冒充已构建源码。全量变更见changed-files.txt。

## 变更文件与行为

- `apps/terminal/app/proposals/{workspace.tsx,workspace.css,p09-components.tsx}`：按P09设计实现主从布局、列表分类/当前载入搜索/发布筛选/期限排序/状态与倒计时、详情摘要/Signal/论证/全部反方观点/风险上下文/不可变引用/证据引用/真实链时间线/失效说明。明暗、桌面/平板/移动、详情焦点/历史/关闭、固定executable=false、复制反馈；加载/空/失败/拒绝/过期/离线和未知结果恢复。
- `apps/terminal/src/proposals/p09-presentation.ts`：本地呈现不推断全局总数/风险严重性/评估许可；保留Decimal精度；C10严格schema/关联/页大小/序号与去重/时间/保留期校验，不跟随任意route。
- `apps/terminal/src/proposals/runtime.ts`：C10显式读取当前Proposal实际correlationId，单独audit:read，重验C01与Proposal、100节点/页与20页/2000节点上限、cursor拒绝循环、保留期清除可见事实、错误/迟到响应/关闭清理及429冷却。复用UI502评估/期限/版本/原意图恢复/100回执容量保护，不构造命令或风险通过事实。
- `apps/terminal/tests/ui-p09{,-provider-consumer}.test.ts`：27项新呈现/C10单元和1项真实C07/C10消费者组合；读取前实际404、评估受理后真实链、原键恢复/权限/版本拒绝。原UI502与执行/权限/导航测试作为直接影响回归。
- `tests/e2e/{ui-p09.spec.ts,fixtures/ui-p09-reference.ts}`、`playwright{,.ui-p09}.config.ts`：21个Chromium场景、12组截图/axe/geometry；真实reference字节、合成身份/CORS与明确负面探针分开，拦截外部网络。
- `scripts/ui-p09-review{,.test}.mjs`：冻结源码/设计稿与功能输入、精确命令/退出码/日志、二进制/静态构建/网络/截图hash；拒绝篡改/跳过/重试/阶段或生产声明提升。广泛输入hash清单不代表递归执行上游验收。
- 前端开发执行计划、`docs/operations/ui-p09-proposals.md`及本证据目录：同步IMPLEMENTED_PENDING_ACCEPTANCE、交接FE:UI-503、缺失源字段、验证边界、原始失败与最终验收证据。静态资源映射沿用已存在的合法UUID家族，没有新增泛化fallback。`.gitattributes`仅对首轮两个不可变Playwright诊断与其空白诊断日志豁免空白检查。

## 测试命令与结果

`node scripts/ui-p09-review.mjs --run docs/audit/evidence/ui-p09-local-20261023/attempt-02`执行14组命令；精确参数、起止时间、退出码与日志hash在attempt-02/executions.json。使用项目webEnvironment白名单非生产环境与固定pnpm10.20.0，Cargo locked/offline；临时回环reference服务，无目标数据库。

| 命令 | 结果 |
| --- | --- |
| `node scripts/development-execution.mjs --development FE:UI-P09` | 允许当前功能开发 |
| `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | PASS |
| `pnpm exec vitest run apps/terminal/tests/ui-p09.test.ts apps/terminal/tests/ui-p09-provider-consumer.test.ts apps/terminal/tests/ui502.test.ts apps/terminal/tests/ui502-provider-consumer.test.ts apps/terminal/tests/execution-provider-consumer.test.ts apps/terminal/tests/execution-recovery.test.ts apps/terminal/tests/g1-route-access.test.ts packages/domain-ui/tests/ui101.test.ts apps/terminal/tests/ui-p02-presentation.test.ts --reporter=json --outputFile=docs/audit/evidence/ui-p09-local-20261023/attempt-02/unit.json` | 149/149；27新单元+1新消费者+121直接功能/权限/恢复/导航回归 |
| `cargo test --locked --offline -p bff-gateway --lib execution::tests::` | 20/20 |
| `cargo test --locked --offline -p bff-gateway --test audit_export_provider evidence_chain_preserves_causation_order_and_hides_missing_resources` | 1/1 |
| `cargo test --locked --offline -p bff-gateway --test audit_export_provider audit_snapshot_replay_has_no_duplicates_and_cursor_expiry_fails_closed` | 1/1 |
| `pnpm --filter @sumalpha/terminal typecheck` | PASS |
| `pnpm exec eslint <变更范围>` | PASS；完整范围见executions.json |
| `node --test scripts/ui-p09-review.test.mjs scripts/terminal-static-routes.test.mjs scripts/serve-static.test.mjs` | 21/21 |
| `pnpm --filter @sumalpha/terminal build` | PASS；静态导出与client-secrets检查通过，buildId绑定完整源码SHA |
| `pnpm exec playwright test --config=playwright.ui-p09.config.ts --project=chromium --workers=1 --retries=0 --reporter=list,json --output=docs/audit/evidence/ui-p09-local-20261023/attempt-02/browser` | 21/21，零重试/跳过；12视觉/axe/geometry组、零axe违规 |
| `node scripts/check-development-plans.mjs` | PASS |
| `node scripts/development-execution.mjs --integration FE:UI-P09` | 预期拒绝exit1，未伪记PASS/READY |
| `node scripts/development-execution.mjs --development FE:UI-503` | 允许下一原任务 |
| `node scripts/ui-p09-review.mjs --verify` | PASS；源码/设计/原始日志/产物hash与上述结果一致 |

当前运行覆盖新呈现/C10、实际C07/C10消费者，以及直接受到runtime/DOM变更影响的评估、恢复、C01、导航/静态路由；没有递归复验全上游、全仓覆盖率或数据库campaign。

历史失败原件保留：development最初typecheck的可选值缩窄错误与SSE夹具缺必填关联字段；attempt-01的20/21浏览器（“证据”标题未明确“证据引用”），以及该候选已通过的149单元/C07/C10/构建/12视觉结果。修正标题和桌面筛选布局后使用新候选attempt-02；历史ORIGINAL_SCOPE_ONLY，不拼接或改绑。首次暂存检查因原始Playwright诊断含尾随空白exit2，保留原始诊断和检查日志，只增加精确文件级whitespace豁免，不重写原件或扩大运行时回归。

## Gate与未决风险

有界工程Gate：**PASS_P09_REFERENCE_FUNCTION**。计划IMPLEMENTED_PENDING_ACCEPTANCE；INTEGRATION/NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED；I4窗口保持NOT_ASSESSED，不构成正式ACCEPTED或目标/生产验收。

来源未返回Proposal限价/创建时间、完整组合NAV/敞口/阈值、DataSnapshot/inputHash、类型化证据正文/标题/版本或发布许可；页面明确未提供，不用Signal时间、预检/202、generic UUID或jobId替代。C10只有当前授权范围的链，不代表全局因果、独立验签或风险通过；完整证据内容与真实源仍待后续契约/目标验收。

reference BFF进程、合成身份/cookie与回环TLS/CORS桥接不证明真实IdP/cookie/CORS、Supabase/RLS/事务、真实组合/行情/风险源、R04/X02持久链或长期SSE。未知意图/回执仅内存，离线/撤权/隐藏/失焦/关闭时清除，跨进程持久恢复NOT_RUN。真实目标、Firefox/WebKit/跨OS、人工读屏/native200%、远程同SHA CI、性能容量长稳、完整I4/RELEASE均NOT_RUN。

Axe12个incomplete规则组/120节点（112个非文本图标、8个移动表格部分遮挡）原样保留，不当作通过；12张截图逐张人工复核见VISUAL-REVIEW.md。

下一可执行原任务：**FE:UI-503：Trade Ticket preflight**。
