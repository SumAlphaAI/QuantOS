# G7 本机全业务链组合评估证据

当前冻结源码：`abc4c1707a25a5dc6fd0e04f73ba7e41fd62e691`。当前完整命令矩阵为 attempt-02；receipt.json 绑定源码输入、二进制、静态构建、HTTP 哈希、执行日志及2334个历史证据文件。仅 QuantOS/main；未使用生产凭据、数据库、外部行情或 venue，不推送、部署或发布。

工程 Gate **PASS_G7_OWNED_LOCAL_SEGMENT_COMPOSITION**；G7 **NOT_READY_GAPS_OPEN**、review_status=IN_REVIEW，Beta候选NOT_READY。159项阶段Gate保持NOT_ASSESSED，formalAccepted=false、runtimeAdmission=DENIED，FE:FEP-7未关闭。G4/FEP-4、G6/FEP-6、P14原未决完整保留。

## 变更与证据入口

- [完整变更清单](./changed-files.json)：源码测试、浏览器夹具/配置、评估工具、文档/计划及所有本轮证据文件；产品运行代码未变。
- [结果](./result.json)、[回执](./receipt.json)、[逐条命令](./attempt-02/executions.json)、[复核输出](./verify.log)。
- [组合规程](../../../operations/frontend-g7-bounded-composition.md)、[15项未决清单](../../../execution/frontend-g7-assessment.json)。
- [Paper真实传输](./attempt-02/flows/paper.json)、[Shadow真实传输](./attempt-02/flows/shadow.json)：单进程、来源独立、Owner签名审查启用、权限拒绝与独立审计回链；Paper 9个、Shadow 8个审计回执。

## 当前执行结果

| 命令/检查 | 结果 |
| --- | --- |
| `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | PASS，记录当前二进制SHA256 |
| `cargo test --locked --offline -p bff-gateway --lib g3_research_tests:: -- --nocapture` | 2 passed，含20条真实owned Worker/UDS/注册/策略/审批因果链 |
| `cargo test --locked --offline -p bff-gateway --lib execution::tests::` | 28 passed |
| `cargo test --locked --offline -p bff-gateway --lib operations::tests::` | 22 passed |
| `pnpm exec vitest run …`（10个限定文件，见executions.json） | 35 passed |
| `pnpm --filter @sumalpha/terminal typecheck` / 定向ESLint | PASS |
| `node --test scripts/frontend-g7-review.test.mjs scripts/development-execution.test.mjs scripts/terminal-static-routes.test.mjs` | 78 passed |
| `pnpm --filter @sumalpha/terminal build` | PASS；Client secret scan 181 files PASS |
| `pnpm exec playwright test --config=playwright.frontend-g7.config.ts --project=chromium --workers=1 --retries=0 …` | 18 passed，0 skipped/flaky/retry；含2条新模式旅程、FEP5 5项、G4 6项、G6 5项 |
| `node scripts/check-development-plans.mjs` | PASS；159阶段不提升，既有followups不变 |
| `node scripts/development-execution.mjs --integration FRONTEND-GATE:G7` / `--integration FE:FEP-7` | 各exit 1，allowed=false，正确拒绝 |
| `node scripts/development-execution.mjs --development FE:FEP-7` | exit 0，allowed=true |

当前两个Audit axe扫描均0 violations，各1项color-contrast incomplete/13节点，总26节点；详见[当前视觉复核](./visual-review.json)。截图仅代表本次旅程，非完整高保真视觉验收。手工读屏、原生200%缩放未执行；历史P14 incomplete不关闭。

## 全链与基线边界

C01身份/MFA；C02 Command聚合；C03研究申请取消/流恢复；C04快照/Artifact；C05策略/回测/不可变Release；C06 Paper Portfolio/Risk及Kill拒绝回归；C07–C09/C13风险、审批、Preflight、Command/Order；C10审计；C11运维治理；C12行情/K线；C14/C15收益/对账；C16告警；C17设置/浏览器投影，本次按实际支持范围组合。Shadow C05/C06按reference模式拒绝，不能作为正向验证。C17仅只读投影，不是完整Settings变更/真实OS权限测试。其余页面细节沿各自原范围证据，不声称全部页面当前候选完整验收。

研究HTTP队列→Worker、C05 Release激活→同源Proposal、Paper Fill→Shadow账本、C15异常→匹配C16、Shadow C06正向来源仍未贯通。G4/FEP-4、G6/FEP-6、P14缺口见机器清单。所有G7依赖只索引原范围；原生owned Worker正向不替代HTTP队列接续。通知仅应用内有限SSE。

baselineReferences保留12组原receipt和精确sourceCommit，均ORIGINAL_SCOPE_ONLY；包括G1/G2历史兼容阻塞、G3及R03、G4/FEP4、FEP5、G6/FEP6及P19/P21/P14。未作数值性能/容量/长稳基线测量，构建时长不充当性能基线。真实IdP/Cookie/CORS、Supabase/RLS/事务/持久化审计、跨进程恢复、外部源、同SHA远程CI、Firefox/WebKit/跨OS、完整视觉及RELEASE-GATE:BETA均NOT_RUN。

## 原始记录与重现

- preflight-01：Proposal字段、Shadow C05正向预期和desktop配置错误，保留失败。
- preflight-02：Admin标题错误，保留失败页面；2个unit通过只属预检。
- preflight-03：C02初始化治理后的Engine能力未启用、Shadow C06错误正向预期，保留失败；修正测试配置并保留模式拒绝。
- attempt-01 / superseded-01：源码498266b0282603c9760fd33128c0a159099490c9原范围通过，原始回执/结果/复核输出保留；不重绑abc4c170候选。

```sh
node scripts/frontend-g7-review.mjs --verify
# 重跑需先冻结源码并使用全新目录；不得覆盖已有attempt。
node scripts/frontend-g7-review.mjs --run docs/audit/evidence/frontend-g7-local-20261024/attempt-NN
```

下一原任务：FE:FEP-7，开展前端硬化/范围收口及Beta缺口评估，继续保留上述未决；不提前提升Beta或发布准入。
