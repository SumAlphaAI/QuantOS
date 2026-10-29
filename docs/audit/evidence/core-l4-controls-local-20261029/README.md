# CORE-GATE:L4 DEVELOPMENT / 公共 kill 与 C11 后当前组合

冻结源码 `e6a13a6197777e99d294ee818b786bc4de484c12`；输入摘要 `sha256:12715fdb7cc7d55ac8f30d6a0a4404beb3a6d46f3a8375227990d4a204bf65ec`；实际执行 `attempt-03`。当前 R04/X02→公共Subject/两人reference MFA→实际L02 mTLS/native X04→X01→独立签名协议观察X05→公共OPEN Alert/P23/共同C10，与公共kill和固定执行域C11的租约/版本/历史接续。version0仅bounded owner reference import，非公共MFA或目标准入。

工程Gate `PASS_L4_CURRENT_COMPOSITION_WITH_PUBLIC_KILL_C11_AND_GAPS`；开发评估 COMPLETED_CURRENT_SCOPE。19项命令达到预期退出，Rust41（authority31/process10）、消费者128、契约38、Node100、Chromium7通过，当前attempt无自动重试/跳过/flaky；axe五次扫描violation0/incomplete2。构建、Clippy/fmt/lint、计划与X05纯域无submit检查通过；integration/release检查按预期拒绝，不算阶段通过。

同一实际accepted Command/Fill/sourceHash/ledger/report/OPEN Alert与请求审计，经过C11 off/on、全局/账户停止、再次off/on及重启保持；显式kill generation到2，C11 version到4，原审批/Command generation0不改签。另同一真实zone commit后调用方死亡的UNKNOWN，经过公共账户kill/C11 off/on与重启：原签名事实不变、当前kill generation1/native stop保持，入账0/隔离1/OPEN Alert2/原协议调用1，不补发、不自动关闭。跨来源拼接/零执行/篡改账本报告或审计/重置代次/自动解除或关闭均由负向测试拒绝。

真实HTTP取消读取与原事务检查点完成、真实OS journal写失败、认证commit后/native ack前进程死亡、12并发同键、原请求恢复、实际租约到期、撤权/回退/fork/损坏拒绝及独立显式kill解除直接回归；C11不能越过target ceiling或删除永久/手动停止，也不刷新原proof/session/审批/Command期限。完整books/估值与新风险决定缺失时继续拒绝新交易。

完整Gate `NOT_READY_GAPS_OPEN`、stage `NOT_ASSESSED`、formalAccepted=false、runtimeAdmission=DENIED、M5 PREPARED_NOT_READY；19gap/8义务OPEN，159规范阶段与原量化分母不变。参考身份/owned协议/临时mTLS/认证fsync文件+OS锁仅单机；真实IdP/目标DB/Vault/RLS/venue/testnet、多账户跨主机/外部单调锚点、完整财务与独立books/异步成交/异币费用、外部通知/确认/明确审查关闭、目标安全时延容量长稳/同SHA CI/发布、完整浏览器/人工无障碍仍NOT_RUN或未接续。无生产凭据、推送或外部发布。

[结果](./result.json) · [原始命令/输入/日志哈希](./receipt.json) · [源码变更](./changed-files.json) · [封存清单](./manifest.json) · [机器评估](../../../execution/core-l4-controls-assessment-20261029.json) · [规程](../../../operations/core-l4-controls-assessment-20261029.md) · [移交](./handoff.json) · [缺口](./remaining-gaps.json) · [19项逐项评估](./gap-assessment.md) · [待确认文稿](./review-draft.md) · [发布未执行](./release-checklist.json) · [历史完整性](./history-integrity.json)。

14份历史来源按原SHA/source blob/manifest/hash完整性检查，保持ORIGINAL_SCOPE_ONLY，不改绑当前准入；旧公共kill/C11拒绝仍属原范围。预检41文件为UNFROZEN_DIAGNOSTIC_ONLY；原gates-01的1/92 FAIL由评估器误写403引起，实际当前已完成命令新键重投返回409且无IO，修复后92/92；原日志/诊断/首次3进程unused参数警告原样保存。冻结首轮0b6aede8/attempt-01实际进程8/9，因为预占/释放/再绑定端口竞态EADDRINUSE失败；后续14项NOT_RUN。原失败按[索引](./failed-attempt-index.json)保留。修复为BFF直接绑定端口0/readiness报告已持有listener地址，fixture不自动重试；[修复诊断](./repair-index.json)只属UNFROZEN_PORT_ZERO_REPAIR_ONLY，第二冻结53f296e1/attempt-02浏览器6/7，导航取消有状态subjects读取后，可信source时钟先于未提交检查点，后续context重载422；原失败及剩余4项NOT_RUN按[第二失败索引](./browser-failed-attempt-index.json)保留。[取消修复诊断](./browser-repair-index.json)保留无保护逻辑真实断连422反例、修复后断连/原双人审批旅程通过。仅durable profile将同一次原handler/checkpoint保存独立完成；不重试、不补发、不放宽单调性/期限，无durable的profile保持原生命周期。当前新冻结attempt独立验证。只做当前组合与直接影响检查，不递归上游Gate/全仓/数据库campaign。

| 检查 | 实际命令 | 退出码 |
|---|---|---|
| development | `node scripts/development-execution.mjs --development CORE-GATE:L4` | 0 |
| assessment | `node scripts/core-l4-controls-review.mjs --audit` | 0 |
| build | `cargo build --locked --offline -p bff-gateway -p execution-gateway` | 0 |
| authority | `cargo test --locked --offline -p bff-gateway --lib assisted::` | 0 |
| public-process | `cargo test --locked --offline -p bff-gateway --test core_l04` | 0 |
| consumers | `pnpm exec vitest run apps/terminal/tests/core-l4-audit.test.ts apps/terminal/tests/core-x06-alerts.test.ts apps/terminal/tests/core-x05-reconciliation.test.ts apps/terminal/tests/c11-activation.test.ts apps/terminal/tests/core-l03-hardening.test.ts apps/terminal/tests/native-kill-control.test.ts apps/terminal/tests/ui602.test.ts apps/terminal/tests/ui-p14.test.ts --reporter=json --outputFile=docs/audit/evidence/core-l4-controls-local-20261029/attempt-03/consumers.json` | 0 |
| contracts | `pnpm exec vitest run tests/contract/core-x05-reconciliation.test.ts tests/contract/core-x06-alerts.test.ts tests/contract/c11-activation.test.ts tests/contract/native-kill-control.test.ts --reporter=json --outputFile=docs/audit/evidence/core-l4-controls-local-20261029/attempt-03/contracts.json` | 0 |
| gate-tests | `node --test --test-reporter=tap scripts/core-l4-controls-assessment.test.mjs scripts/core-l4-controls-review.test.mjs scripts/development-execution.test.mjs` | 0 |
| lint | `pnpm exec eslint scripts/core-l4-controls-assessment.mjs scripts/core-l4-controls-assessment.test.mjs scripts/core-l4-controls-review.mjs scripts/core-l4-controls-review.test.mjs playwright.l4-controls.config.ts tests/e2e/fixtures/frontend-g8-reference.ts` | 0 |
| rust-lint | `cargo clippy --locked --offline -p bff-gateway --all-targets --no-deps -- -D warnings` | 0 |
| rust-format | `cargo fmt --check -p bff-gateway` | 0 |
| plans | `node scripts/check-development-plans.mjs` | 0 |
| no-submit | `python3 scripts/check-x05-no-submit.py` | 0 |
| web-build | `pnpm --filter @sumalpha/terminal build` | 0 |
| browser | `pnpm exec playwright test --config=playwright.l4-controls.config.ts --project=chromium --workers=1 --retries=0 --reporter=list,json --output=docs/audit/evidence/core-l4-controls-local-20261029/attempt-03/browser/cases` | 0 |
| integration-refusal | `node scripts/development-execution.mjs --integration CORE-GATE:L4` | 1 |
| release-refusal | `node scripts/development-execution.mjs --release CORE-GATE:L4` | 1 |
| next-development | `node scripts/development-execution.mjs --development CORE:X01` | 0 |
| secret-scan | `node scripts/core-l4-controls-review.mjs --scan docs/audit/evidence/core-l4-controls-local-20261029/attempt-03` | 0 |

复核：`node docs/audit/evidence/core-l4-controls-local-20261029/verify.mjs`；重跑必须新建attempt目录。下一 `CORE:X01 DEVELOPMENT / L4-VALUATION-RISK-INPUT-01`：接当前不可变账本的资金/mark来源、valuation/P&L/exposure及风险输入快照；账户/来源/时效/UNKNOWN与无mark拒绝必须保留，再由X02消费显式新风险决定。属于既有L4-LEDGER-01/L4-CURRENT-SOURCE-01，不新增分母或目标授权。

自动无障碍限制：C10/P23各一项color-contrast incomplete（非文本图标及部分遮挡背景无法自动判定），共2项，见[原始节点与说明](./accessibility-limitations.json)。violation0不代表人工/完整浏览器验收；这些义务继续NOT_RUN。
