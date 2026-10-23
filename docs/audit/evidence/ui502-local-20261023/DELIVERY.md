# FE:UI-502 交付报告

任务：I4 Proposal 与风险评估。仅修改QuantOS，在main开发并生成本地提交；未使用生产凭据、推送或部署。

基线 `3d2eee0ff1be7f9e3c4a988a7e86d42b442f25a0`；实现提交 `d87af3486feba1496951bd8c5a74279314f81806`；最终源码冻结 `e497121f1e79cff5de508b03513d70933d080e23`。证据封存提交只保存文稿/结果，不冒充构建源码。完整清单见changed-files.txt。

## 变更文件与行为

- `apps/terminal/app/proposals/{page.tsx,workspace.tsx,workspace.css}`：授权列表/详情、服务端筛选分页、严格深链、Signal/论证/反方观点/证据引用/有效期、风险上下文预览、显式评估/原意图恢复、安全错误/审计关联；加载/空/失败/拒绝/过期/离线状态及永久executable=false声明。
- `apps/terminal/src/proposals/{policy.ts,runtime.ts}`：只用生成C01/C07和辅助C13只读预检；严格schema/Decimal/范围/版本/SSE密集序列与新鲜度；临提交重读后比较源与contextHash；If-Match/CSRF/幂等；202回执与真实Proposal状态分离。未知结果锁定原body/version/key，不自动重发，过期连原POST重试也禁止；关闭/撤权清除。最多100回执保留全部版本锁，容量满拒绝新评估。
- `apps/terminal/public/terminal-route-map.json`、`scripts/terminal-static-routes{,.test}.mjs`：只新增合法UUID Proposal资源映射，保留既有资源族直接回归，无泛化SPA回退。
- `apps/terminal/tests/ui502{,-provider-consumer}.test.ts`、`tests/e2e/{ui502.spec.ts,fixtures/ui502-reference.ts}`、`playwright{,.ui502}.config.ts`：52项当前功能单元、1项实际reference消费者、15项实际BFF桥接浏览器成功/拒绝/恢复；负面探针和固定测试MFA/合成身份/CORS替代单独标注，拦截外部网络。
- `scripts/ui502-review{,.test}.mjs`：冻结输入/SHA、命令/预期退出、二进制/静态构建/网络/截图哈希，拒绝日志篡改、重试或范围提升；输入hash清单不代表递归执行上游验收。
- 前端开发执行计划及`docs/operations/ui502-proposal-risk-evaluation.md`：同步IMPLEMENTED_PENDING_ACCEPTANCE、功能边界、数据缺口、恢复语义、验证命令和UI-P09交接；本目录保留历史FAIL与原范围PASS。

## 命令与结果

入口：`node scripts/ui502-review.mjs --run docs/audit/evidence/ui502-local-20261023/attempt-02`，12组命令按预期退出，原始命令/起止时间/退出码/日志哈希见attempt-02/executions.json。使用项目webEnvironment固定pnpm 10.20.0及白名单非生产环境，Cargo locked/offline；仅启动临时回环reference服务，无目标数据库。

| 命令 | 结果 |
| --- | --- |
| `node scripts/development-execution.mjs --development FE:UI-502` | 允许当前功能开发 |
| `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | PASS |
| `pnpm exec vitest run apps/terminal/tests/ui502.test.ts apps/terminal/tests/ui502-provider-consumer.test.ts apps/terminal/tests/execution-provider-consumer.test.ts apps/terminal/tests/execution-recovery.test.ts apps/terminal/tests/g1-route-access.test.ts packages/domain-ui/tests/ui101.test.ts apps/terminal/tests/ui-p02-presentation.test.ts --reporter=json --outputFile=docs/audit/evidence/ui502-local-20261023/attempt-02/unit.json` | 121/121；52+1当前功能/消费者，68项直接执行恢复/权限/导航回归 |
| `cargo test --locked --offline -p bff-gateway --lib execution::tests::` | 20/20 |
| `pnpm --filter @sumalpha/terminal typecheck` | PASS |
| `pnpm exec eslint <变更范围>` | PASS；完整参数见executions.json |
| `node --test scripts/ui502-review.test.mjs scripts/terminal-static-routes.test.mjs scripts/serve-static.test.mjs` | 21/21 |
| `pnpm --filter @sumalpha/terminal build` | PASS；静态导出、client-secrets检查通过，buildId绑定完整源码SHA |
| `pnpm exec playwright test --config=playwright.ui502.config.ts --project=chromium --workers=1 --retries=0 --reporter=list,json --output=docs/audit/evidence/ui502-local-20261023/attempt-02/browser` | 15/15；零重试/跳过；4组基本视觉/axe零违规 |
| `node scripts/check-development-plans.mjs` | PASS |
| `node scripts/development-execution.mjs --integration FE:UI-502` | 预期拒绝，exit 1，未伪记PASS/READY |
| `node scripts/development-execution.mjs --development FE:UI-P09` | 允许下一原任务 |
| `node scripts/ui502-review.mjs --verify` | PASS；121/20/15与原始输入/日志/产物哈希一致 |

只选当前功能和直接受影响的执行、C01权限、导航/路由路径；未递归执行全部上游、全仓覆盖率或数据库campaign。首次消费者测试重复读取已消费Request body导致断言FAIL，修为clone后重跑；源码d87af348首轮全部PASS后发现容量淘汰可丢失旧版本锁，改为容量满拒绝新写，新增100版本/第101版本边界测试并在新源码重新验收。原件/原版本/失败均保留，ORIGINAL_SCOPE_ONLY不改绑。

## Gate与未决风险

工程有界Gate：**PASS_UI502_REFERENCE_FUNCTION**。计划开发状态IMPLEMENTED_PENDING_ACCEPTANCE；INTEGRATION/NOT_ASSESSED、formalAccepted=false、runtimeAdmission=DENIED；不构成正式ACCEPTED或目标/生产验收。

C07只返回通用证据UUID，没有类型化C10内容或RiskDecision结果；不猜测Artifact/Approval链接，不以generic jobId映射Approval，不把202accepted或预检verdict当作风险已通过。C13仅用于获得真实contextHash；数据名义值币种未提供则明确未知。C01 execution.operate不等于Proposal发起人，所有权由真实BFF逐次判定。

reference BFF进程、合成cookie身份与回环TLS/CORS桥接不证明真实IdP/cookie/CORS、目标Supabase/RLS/事务、R04/X02持久链、真实组合/行情/风险源或长期SSE。未知意图/回执只驻当前内存，离线/撤权/隐藏/关闭时清除，跨进程持久恢复仍NOT_RUN。真实目标、Firefox/WebKit/跨OS、人工读屏/native200%、远程同SHA CI、性能容量长稳、完整I4/RELEASE及P09高保真/C10内容增强均NOT_RUN。

Axe 4个规则组、24个节点incomplete：桌面2组各10个共享非文本导航图标；移动2组各2个横向滚动表格遮挡节点；没有将incomplete记为通过。截图人工复核仅覆盖本次基本明暗1440/390布局，详见VISUAL-REVIEW.md。

下一可执行任务：**FE:UI-P09：Proposal列表与详情高保真页面（C07/C10）**。未执行推送、部署或外部发布。
