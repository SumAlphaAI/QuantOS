# G3-INTEGRATION-01：R03 worker→策略注册与跨模块因果交接复审

本轮限定本地交付完成，新稿待项目用户确认。工程 Gate **PASS_OWNED_LOCAL_R03_WORKER_CAUSAL_CLOSURE**；完整 G3 仍 **NOT_READY_REFERENCE_BOUNDARIES_AND_STAGE_OBLIGATIONS_OPEN**，CORE:S04 **NOT_READY**。159项阶段门禁保持NOT_ASSESSED，formalAccepted=false、runtimeAdmission=DENIED。此结果不改绑历史READY或NOT_RUN。

候选 `696bef717390fea9646c8d54094665f1bdc14d44`；实现 `b22596395a9451ba229bbbd0abecbf9ae2d60ea9`；测试选择器工具修复为候选提交。原确认提交 `95e43e6fca4a27486a1b585cbc692f316c484626`，仅接受原9a463495/05c427f2；已保存确认原文、摘要与529个原文件绑定，未修改原文稿/receipt。

## 代码、测试和计划变化

- `crates/quantos-runtime/src/research.rs`：带父运行/同会话/correlation/快照的策略延续；prompt从真实研究摘要和父产物hash派生，父ID参与输入hash，worker核验SDK输出/流/引用。静态检查配套产物按确定字段重构并核验准确字节hash；kernel独立保留三个产物，completion checkpoint绑定整个记录hash。
- `services/bff-gateway/src/strategy/research.rs`：普通库owner安装入口，完成状态/保留manifest/checkpoint、作用域/快照和生成代码门禁；全批校验后原子发布，拒绝重复run/trace和替换既有catalog；竞争只有一个成功。不是HTTP任意JSON导入。
- `services/bff-gateway/src/research.rs`：C04真实完成运行与原始产物投影，contentHash保持实际保留字节。`strategy.rs`、`execution.rs`：C05和共享C08审批接续前事件；不从请求头接纳correlation，读取及幂等重放不修改既有审计。
- `services/bff-gateway/src/g3_research_tests.rs`、`frontend_g3.rs`、`strategy/tests.rs`：实际R03与RD-Agent/Strategy Lab Python UDS组合、20条独立链、拒绝/竞争/恢复；测试host调用生产owner入口，不导入生成文件或直接构造StrategyInput/注册策略。
- `tests/e2e/g3-integration-01.spec.ts`、`fixtures/frontend-g3-reference.ts`、`playwright.g3-integration-01.config.ts`、`playwright.config.ts`：24条真实worker页面用例，独立配置与原20条页面回归。
- `scripts/g3-integration-01-review.mjs`及测试、G3确认校验器及测试；两份开发计划、followups与operations同步。G3-INTEGRATION-01为IMPLEMENTED_PENDING_ACCEPTANCE，G3仍IN_REVIEW，CORE:S04/FEP-3仍IMPLEMENTED_PENDING_ACCEPTANCE；未改阶段门禁或依赖范围。

完整文件清单：[changed-files.json](evidence/g3-integration-01-20261023/changed-files.json)。源码1928输入、最终命令17条、执行产物211个，实际回执见 [receipt.json](evidence/g3-integration-01-20261023/receipt.json)。

## 命令与结果

固定环境只保留PATH/HOME/TMPDIR/LANG及仓库example公开配置，使用锁定离线Cargo与pnpm10.20.0。执行入口为 `node scripts/g3-integration-01-review.mjs --run docs/audit/evidence/g3-integration-01-20261023/attempt-02`；复核入口 `node scripts/g3-integration-01-review.mjs --verify`。

| 检查 | 实际命令 | 退出 / 结果 |
| --- | --- | --- |
| bff-binary | `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | 0 / PASS |
| runtime-unit | `cargo test --locked --offline -p quantos-runtime --lib research::` | 0 / PASS |
| r03-engines | `cargo test --locked --offline -p quantos-runtime --test research_orchestration` | 0 / PASS |
| bff-composition | `cargo test --locked --offline -p bff-gateway --lib -- --nocapture` | 0 / PASS |
| bff-audit-auth | `cargo test --locked --offline -p bff-gateway --test audit_export_provider --test auth_settings_provider` | 0 / PASS |
| host-binary | `cargo test --locked --offline -p bff-gateway --lib --no-run --message-format=json` | 0 / PASS |
| types | `pnpm --filter @sumalpha/terminal typecheck` | 0 / PASS |
| lint | `pnpm exec eslint scripts/g3-integration-01-review.mjs scripts/g3-integration-01-review.test.mjs scripts/frontend-g3-confirmed-reference.mjs scripts/frontend-g3-confirmed-reference.test.mjs tests/e2e/g3-integration-01.spec.ts tests/e2e/fixtures/frontend-g3-reference.ts playwright.g3-integration-01.config.ts playwright.config.ts` | 0 / PASS |
| rust-format | `rustfmt --check --edition 2024 crates/quantos-runtime/src/research.rs services/bff-gateway/src/strategy.rs services/bff-gateway/src/strategy/research.rs services/bff-gateway/src/strategy/tests.rs services/bff-gateway/src/research.rs services/bff-gateway/src/execution.rs services/bff-gateway/src/frontend_g3.rs services/bff-gateway/src/g3_research_tests.rs` | 0 / PASS |
| gates | `node --test scripts/g3-integration-01-review.test.mjs scripts/frontend-g3-confirmed-reference.test.mjs scripts/development-execution.test.mjs scripts/development-plan-order-negative.mjs` | 0 / PASS |
| terminal-build | `pnpm --filter @sumalpha/terminal build` | 0 / PASS |
| browser-worker | `pnpm exec playwright test --config=playwright.g3-integration-01.config.ts --project=chromium --workers=1 --retries=0 --reporter=list,json --output=docs/audit/evidence/g3-integration-01-20261023/attempt-02/browser-worker` | 0 / PASS |
| browser-regression | `pnpm exec playwright test --config=playwright.frontend-g3.config.ts --project=chromium --workers=1 --retries=0 --grep-invert G3  --reporter=list,json --output=docs/audit/evidence/g3-integration-01-20261023/attempt-02/browser-regression` | 0 / PASS |
| plans | `node scripts/check-development-plans.mjs` | 0 / PASS |
| g3-refusal | `node scripts/development-execution.mjs --integration FRONTEND-GATE:G3` | 1（预期拒绝） |
| s04-refusal | `node scripts/development-execution.mjs --integration CORE:S04` | 1（预期拒绝） |
| next-development | `node scripts/development-execution.mjs --development FE:UI-401` | 0 / PASS |

Rust：R03单元6、真实引擎组合6、BFF库230、审计14和身份17，共273通过；2 ignored分别是未授权Supabase目标测试及仅由浏览器显式启动的host驱动，未计为单元通过。Node78通过。Chromium24个worker用例+20个原页面回归，共44通过，重试0、跳过0；18张P07既有基线比较通过，未更新基线。36次axe无violation，**36条incomplete保留**。

20条选中UI旅程分别绑定研究/策略/静态产物canonical字节、真实manifest、运行ID/输入hash、快照、策略ID、报告hash、Release与审批。C10有研究完成→策略完成→注册→静态检查→回测→Release→审批申请→审批决定8节点，逐边核验父引用和递增序号，不只读取complete=true。24个独立host实际执行480对研究/策略worker；该启动总量不当作480条UI覆盖，模板仍只有一个。

额外独立核查：[network-verification.json](evidence/g3-integration-01-20261023/network-verification.json)校验44条网络回执、两种真实binary摘要、24个实际worker host与全部canonical产物；拒绝/过期状态明确，20路审批一成功/19拒绝。1672及390视口截图已查看；只记录可见布局检查，不替代手工屏幕阅读器/完整移动滚动矩阵。

## 保留的失败与未决

attempt-01的worker24用例通过；页面回归筛选器将`^G3 `用于Playwright完整标题，意外选中旧G3测试，缺少其旧产物输入，1失败/43未运行，后续4条命令NOT_RUN。工具修复后attempt-02独立执行全部当前矩阵，没有拼接通过。探索阶段保留引擎清单、静态检查正文、C08因果边及编译错误，详见exploration-summary。

本轮36条incomplete之外，历史逐项保留：G3当前36、G3 attempt-03 36、P07 22、UI303 0、UI302 12、P06 18、前次UI301回归12、原UI301 8；未去重、不宣称缺陷关闭。原notRun/additionalNotRun原样保存在scope和receipt；本轮本地worker通过单独记账。

本地新catalog首次批量交接已验；Research创建HTTP→持久worker队列、持续增量catalog注册、真实IdP/MFA/cookie/CORS、目标Supabase/RLS/Storage/持久事务和崩溃恢复、部署/性能/长稳/同SHA hosted CI、Firefox/WebKit/跨OS、屏幕阅读器/原生200%缩放、Storybook及正式发布均NOT_RUN。身份/TLS-CORS桥和审批控制会话仍reference替代；确定性引擎、合成行情和单momentum模板不能外推多算法/真实模型。C10局部因果图也不等于目标审计存储的密码学签署或全局闭合证明。

## Gate 与下一步

完整G3拒绝检查退出1且allowed=false/STAGE_NOT_READY；CORE:S04同样拒绝；与用户要求一致。外部环境义务保持原阶段移交，不作为无关功能开发前置。下一原计划可执行任务 **FE:UI-401**（development allowed=true）。新确认文稿：[confirmation-draft.md](evidence/g3-integration-01-20261023/confirmation-draft.md)，PENDING，不自行批准。全部提交仅在main本地，无生产凭据、远端推送或外部发布。
