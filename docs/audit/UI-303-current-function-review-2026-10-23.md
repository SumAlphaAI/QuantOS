# UI-303 当前功能审阅（2026-10-23）

限定工程Gate：**PASS_UI303_REFERENCE_FUNCTION**。应用/测试/工具候选 `c1774a744ecc9d4fc90559c9f26f47e44ef91951`，最终 `attempt-01`。源码、binary、Terminal构建、运行时reference fixture和所有当前验证同一完整SHA。确认PENDING；功能实现与完整联调/发布分别记账。

## 变更与行为

- 新增 `/releases`、`/releases/:releaseId`；在成功回测报告显式创建不可变Release。创建前读取同版本草稿、真实回测/报告Artifact、参数和研究证据；显示后再核对输入，版本变化或泄漏阻断；不自动创建，不发送自定targets。金额保持字符串。
- C05补充服务端真实draftObjectVersion/backtestRunId/backtestReportHash/evidenceRefs及C08 approvalRef，内容hash/参数/回测/数据/证据展示完整。不可变字段和allowedTargets后续不准漂移，有效期只收窄；没有Release编辑接口。
- 审批申请带If-Match内容版本、CSRF/幂等键；202只受理，GET C05/C08核实状态、对象、类型与有效期，策略审批不能携带TradeCommand授权。时间线actor/time/correlation均服务端事实并链接UI507 Audit Explorer。
- 只读身份不能创建/申请。未知创建与未知申请原键/原意图显式恢复，重试C01失败仍保留键；明确拒绝不自动重试，429冷却；离开/失权清内存，恢复只读不重放。
- 目标选项仅后端allowedTargets，批准且未过期/事实完整才可选当前支持Paper/Shadow；空、重复、缺失、assisted_live、未批准、过期或错误均阻断。选择仅本页内存，不执行部署或交易。审批决策产品UI属于后续任务；本页不会自批。
- 修改文件完整清单见[changed-files.json](./evidence/ui303-local-20261023/changed-files.json)。原UI302确认原文/摘要与全部证据绑定已保存，提交`9229702d`，仅接受3f7f37cd/c61e1dc1/e42cdd84，旧文稿与receipt保持原字节。

## 当前功能验证

125项前端/真实consumer（UI303 35、UI302 34、UI301 34、恢复4、P06 17、真实C05/C08生成consumer 1）；20项门禁/路由；21项C05/C08；11项Chromium（UI302 5直接回归、UI303 6）。类型/lint/format、Rust与Terminal构建/client-secret、计划验证通过。4次axe扫描0 violations、0 incomplete；原UI302 12、P06 18、先前UI301回归12及原UI301 8分别保留，不当作去重缺陷或历史闭环。

| 检查 | 实际命令 | 结果 |
| --- | --- | --- |
| development | `node scripts/development-execution.mjs --development FE:UI-303` | exit 0，通过 |
| binary | `cargo build --locked --offline -p bff-gateway --bin bff-gateway` | exit 0，通过 |
| unit-consumer | `pnpm exec vitest run apps/terminal/tests/ui303.test.ts apps/terminal/tests/ui302.test.ts apps/terminal/tests/ui301.test.ts apps/terminal/tests/strategy-recovery.test.ts apps/terminal/tests/ui-p06-presentation.test.ts apps/terminal/tests/strategy-provider-consumer.test.ts --reporter=json --outputFile=docs/audit/evidence/ui303-local-20261023/attempt-01/unit.json` | exit 0，通过 |
| types | `pnpm --filter @sumalpha/terminal typecheck` | exit 0，通过 |
| lint | `pnpm exec eslint apps/terminal/app/releases apps/terminal/app/backtests apps/terminal/app/strategies/workspace.tsx apps/terminal/src/strategy apps/terminal/tests/ui303.test.ts apps/terminal/tests/strategy-provider-consumer.test.ts tests/e2e/ui303.spec.ts tests/e2e/ui302.spec.ts tests/e2e/fixtures/ui301-reference.ts playwright.config.ts playwright.ui303.config.ts scripts/ui303-review.mjs scripts/ui303-review.test.mjs scripts/ui302-confirmed-reference.mjs scripts/ui302-confirmed-reference.test.mjs scripts/terminal-static-routes.mjs scripts/terminal-static-routes.test.mjs` | exit 0，通过 |
| gate-routes | `node --test scripts/ui303-review.test.mjs scripts/ui302-confirmed-reference.test.mjs scripts/terminal-static-routes.test.mjs scripts/serve-static.test.mjs` | exit 0，通过 |
| format | `rustfmt --check --edition 2024 services/bff-gateway/src/strategy.rs` | exit 0，通过 |
| c05-c08 | `cargo test --locked --offline -p bff-gateway --lib strategy::tests::` | exit 0，通过 |
| terminal-build | `pnpm --filter @sumalpha/terminal build` | exit 0，通过 |
| browser | `pnpm exec playwright test --config=playwright.ui303.config.ts --project=chromium --workers=1 --retries=0 --reporter=list,json --output=docs/audit/evidence/ui303-local-20261023/attempt-01/browser` | exit 0，通过 |
| plans | `node scripts/check-development-plans.mjs` | exit 0，通过 |
| integration-refusal | `node scripts/development-execution.mjs --integration FE:UI-303` | exit 1，预期拒绝完整联调 |
| next-development | `node scripts/development-execution.mjs --development FE:UI-P07` | exit 0，通过 |


复核入口：`node scripts/ui303-review.mjs --verify`，退出0。[receipt](./evidence/ui303-local-20261023/receipt.json)绑定完整源码、命令、开始/结束时间、退出码、日志与全部产物SHA；[verification](./evidence/ui303-local-20261023/verification.json)给出统计摘要。每次实际执行在新attempt内，未复用或改绑历史候选PASS，不递归重跑全部依赖链。

## 真实服务组合与测试替代

C05/S04/C08为实际模块组合，所有写入只在本机reference进程fixture内。浏览器创建、申请、lost-response同键重放、head竞争拒绝、只读、离线恢复与空/404均实际验证。批准后目标展示通过另一个reference actor的fixture MFA/reauth/审批决策测试控制验证；其请求control=true，产品UI没有该决策或凭据代填逻辑。目标选项与实际后端数组逐项比较，网络证据拒绝浏览器产品发起decision、部署或交易写入。

实际1440px/390px截图已查看，固定内容、参数、研究证据、审批时间线和目标可见，自动无水平溢出；未作P07像素级高保真验收。UI507仅引用原确认范围，审计链接来源真实服务端correlation，不重验完整审计/导出链。

## 失败保留

exploratory/types01、lint01保留初始括号/空catch诊断。browser01为6通过5失败：真实报告解析丢掉draft tenant/workspace溯源字段，和Artifact原文不一致而拒绝。provider-diagnostic.json保存本机真实DTO；修复为保留scope字段，新增同scope成功/异scope拒绝回归，并让实际生成consumer核对此流程。没有放宽证据比对。browser02预检11通过仍不算冻结候选PASS；最终只使用同SHA attempt-01。详见[预检说明](./evidence/ui303-local-20261023/exploratory/README.md)。

## 风险、Gate与后续

- 前端依赖C05新增的server-owned证据扩展；缺失即拒绝，不兼容不完整旧后端成功响应。未知意图键仅页面内存，离开需先核对，不能跨刷新自动重放；审批状态在本页显式刷新读取，没有承诺Release专用推送流。
- 真实IdP/MFA/Cookie/CORS、Supabase/RLS/事务/Storage、持久恢复、托管rewrite、Firefox/WebKit、人工读屏/native200%、跨OS、远程CI、性能/容量/长稳、完整FEP-3/G3联调/发布、P07高保真全部NOT_RUN。生产凭据、推送、部署、交易及外部发布均未使用/执行。
- 计划UI303：IMPLEMENTED_PENDING_ACCEPTANCE；[六维待确认稿](./evidence/ui303-local-20261023/confirmation-draft.md)PENDING。全部159阶段节点仍NOT_ASSESSED，formalAccepted=false、runtimeAdmission=DENIED。完整INTEGRATION命令预期拒绝；用户确认也不能将NOT_RUN转为PASS。
- 下一可执行原计划任务：**UI-P07 Backtest Detail / Strategy Release 高保真交付**。
