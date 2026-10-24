# FEP-8 前端范围收口与 M5 准备证据

冻结候选：`b75103a936d35a28c39fb07b6a93d73e2caf6110`。attempt-01当前矩阵通过。工程Gate **PASS_FEP8_FRONTEND_SCOPE_REVIEW_PREPARATION**；FEP-8 development_status=PARTIAL，FEP-8/G8 **NOT_READY_GAPS_OPEN**，M5 **PREPARED_NOT_READY**，159阶段保持NOT_ASSESSED，formalAccepted=false、runtimeAdmission=DENIED。closes_core对L03/L04的映射保留，完整关闭不声明。

仅QuantOS/main，无生产凭据、数据库或实际testnet连接，不推送、部署或发布。技术准备材料不构成正式确认或运行授权。

## 变更与入口

必要修复：C08审批Intent捕获原CSRF，MFA/reauth与decision恢复使用冻结token，并在异步步骤及发送前核查；轮换或缺失时拒绝并触发失权处理。不会以新CSRF重放旧证明。正常原key/body/版本恢复维持；不新建Assisted Live入口。

- [完整变更文件](./changed-files.json)：1个runtime修复、3个测试/夹具、2个评估脚本、计划、范围/M5材料、规程及本轮证据。
- [结果](./result.json)、[回执](./receipt.json)、[逐条命令](./attempt-01/executions.json)、[复核输出](./verify.log)。
- [M5技术准备稿](../../../operations/fep8-m5-review-preparation.md)、[六维机器材料](../../../execution/fep8-m5-review-package.json)、[19项缺口](../../../execution/fep8-scope-assessment.json)、[规程](../../../operations/fep8-function-closure.md)。
- [范围核查](./attempt-01/scope-audit.log)、[Paper只读](./attempt-01/reads/paper.json)、[Shadow只读](./attempt-01/reads/shadow.json)、[当前Paper HTTP恢复](./attempt-01/direct-http/paper-recovery.json)、[当前截图/axe](./visual-review.json)。

## 当前命令与结果

| 命令/检查 | 当前结果 |
| --- | --- |
| `node scripts/fep8-function-review.mjs --run docs/audit/evidence/fep8-function-local-20261024/attempt-01` | 全部13条限定命令符合预期 |
| `node scripts/fep8-function-review.mjs --audit` | 19依赖、L03/L04原映射、六维技术材料及19项原未决核查通过 |
| `pnpm exec vitest run … --reporter=json …` | 8个限定文件92 passed，0 failed/pending；含16项新增硬化、2条真实GET-only核查、5条实际HTTP直接回归及69项直接模型/策略回归 |
| `pnpm --filter @sumalpha/terminal typecheck` | PASS |
| 定向 `pnpm exec eslint …` | runtime、3个新测试/夹具及2个脚本PASS |
| `node --test scripts/fep8-function-review.test.mjs scripts/development-execution.test.mjs` | 75 passed，0 failed/skipped |
| `pnpm --filter @sumalpha/terminal build` | PASS；当前buildId绑定b75103a9；client secret scan 181 files PASS；public testnet flag=off |
| `pnpm exec playwright test --config=playwright.frontend-g8.config.ts --project=chromium --workers=1 --retries=0 …` | 当前候选7 passed，0 failed/skipped/flaky/retry；使用现有G8/FEP5用例作本次P10/P11直接功能回归 |
| `node scripts/check-development-plans.mjs` | PASS；159阶段、前置和closes_core不提升/不删减 |
| `node scripts/development-execution.mjs --integration FE:FEP-8` / `--integration FRONTEND-GATE:G8` / `--integration CORE:L03` | 各exit 1、allowed=false，预期拒绝 |
| `node scripts/development-execution.mjs --development CORE:L03` | exit 0、allowed=true |
| `node scripts/fep8-function-review.mjs --verify` | PASS，源码、输入、日志、构建、历史哈希与技术准备范围成立 |

完整命令参数与逐项测试名称见executions.json和unit.json。新增硬化模型验证原请求恢复、未知后/途中CSRF轮换、8类C01变化、精确proof到期、非JSON401/403、close以及条件入口交集。模型失权回调close模拟实际页面monitor接线；effect计数与证明字段只是显式模型，不代表后端F06、双审批签名或数据库。到期未知仍unknown，禁止重放但不宣称已拒绝/撤销。

## 当前真实组合与原范围

新GET-only Paper/Shadow各18个实际本机HTTP请求，读取3个现有flag、独立Operator/Approver角色、订单capabilities/审批/订单空列表和C10 Reader边界。Paper执行入口只对应mock，venueSubmit=false；Shadow执行API403。无新业务写入/新mutation审计链，不通过注入assisted身份制造后端正向。

另5条真实HTTP直接回归覆盖当前runtime下Paper风险/MFA/独立审批、审批/Command/撤单三类丢失回执原请求恢复/C10、未知flag422、Shadow拒绝，以及strategy_release类型的C08路径。浏览器7项是本次重建后的新执行，sourceCommit为b75103a9；用例/夹具文件名保留G8/FEP5不代表复用旧PASS。当前Audit axe为0 violations、1项color-contrast incomplete/13节点；历史P14/G7/G8等incomplete不关闭。没有完整视觉/兼容或人工可访问性验收。

Rust/BFF源码未变，二进制复用原G8：binarySourceCommit=2d0eefc0e2749b9b17732fb07b755c702ae8dc0f、SHA256=4154f9fdcceb29a529171523ac9870dc395cd3568df4b4c57dc9b0c547e52dd9；fixtureSourceCommit绑定本次候选并由原有源码校验。未重跑Cargo/原生测试。原G8的81前端/HTTP、35原生（50组/100个hash entry、200个ScenarioDrivenTransport场景）、87门禁/路由、7 Chromium与构建只作ORIGINAL_SCOPE_ONLY；不是当前b75103a9原生或强签名证明。2574个历史文件、原失败与incomplete/NOT_RUN按原字节保护，不改绑。

## M5结论与未决

六维材料覆盖Product、Frontend、BFF、QA、Security、Risk，结论PREPARED_NOT_READY；没有正式验收确认文稿、用户批准或多角色回执。19项依赖和L03/L04完整复审独立；19项原缺口全部保留：G4/FEP4、G6/FEP6、P14、G7/FEP7及G8的server flag、实际P10/P11 Assisted入口、C09→L01同源连接、双审批F06/HTTP→C10恢复等均未关闭。

实际testnet为NOT_RUN_USER_FORBIDS_CONNECTION；真实IdP/Cookie/CORS、Supabase/RLS/事务/Storage/持久化审计、跨进程重启、外部venue、远程同SHA CI、Firefox/WebKit/跨OS、手工读屏/原生200%、完整视觉、性能/容量/长稳及RELEASE均NOT_RUN。不能据本材料把原生MFA前缀/hash当成F06认证或生产签名，不能把Paper/mock拼成真实testnet订单。

## 原始失败与重现

preflight-01：原C08实现的两个CSRF回归失败（显式模型），修复后当前矩阵通过，原日志不删除/不计PASS。preflight-02：新测试夹具prefer-const静态错误，已修正，非产品缺陷，失败仍保留。

```sh
node scripts/fep8-function-review.mjs --verify
# 重跑需冻结源码并使用全新attempt，禁止覆盖原失败和未执行记录。
node scripts/fep8-function-review.mjs --run docs/audit/evidence/fep8-function-local-20261024/attempt-NN
```

下一原任务：CORE:L03，本机双审批/MFA/条件入口功能组合与缺口整改；不授权实际testnet、实盘、部署或发布。CORE:L04完整复审、CORE-GATE:L4与RELEASE仍独立，不因本次前端收口自动放行。
