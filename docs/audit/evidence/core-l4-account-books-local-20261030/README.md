# CORE-GATE:L4 独立账户 books 后当前组合评估

冻结源码 **baa1efdbd13641957b18cbe3483900955f86afb6**，基线 933aa90ab9d3d81aad36f8900d7ace932b12e5a3；**1511** 个具名输入，摘要 sha256:a9fb9edb6e1ee762a5a047d679135604de5e1ddd99f231dd2246e16a21b99c57。**38** 个原始文件的哈希见 [result.json](result.json)。封存提交只追加原始证据及本报告，不把结果改绑到后续 HEAD。

工程 Gate **PASS_L4_ACCOUNT_BOOKS_CURRENT_COMPOSITION_AND_GAP_ASSESSMENT**；当前结果 **PASS_CURRENT_ACCOUNT_BOOKS_COMPOSITION_ASSESSMENT_ONLY**，DEVELOPMENT 评估 **COMPLETED_CURRENT_SCOPE**。完整 Gate **NOT_READY_GAPS_OPEN** / stage **NOT_ASSESSED** / formalAccepted=false / runtimeAdmission=DENIED / M5 PREPARED_NOT_READY；19gap/8义务 OPEN，159规范阶段和原200venue/50授权旅程/四类目标演练及其他原目标分母不变。正式[评估文稿](review-draft.md)待用户确认，approval=null、selfApproved=false。

## 当前同源观察

- [成功、独立账单与公共控制](attempt-01/accepted.json)：当前原生 BTC Fill/X01→明确参考估值→新签名 X02 决定/不可变 ETH Proposal/新 Subject 独立双 MFA→公共 C11 off 拒绝、version2 允许真实本机 mTLS Command→第二笔 X01 入账。独立参考账单明确 BTC1/ETH1/USDT7999.98/费用0.02，未从 X01/native 金额生成另一侧。三类财务差异经公共 Alert/C10 留存，显式修正只恢复声明范围匹配，三条 OPEN 保留。跨全局/账户 kill、C11到4、冷恢复和显式独立解除到当前generation4，原generation0/Command/签名/claims/账本/请求C10不变。新签名账单version4使用明确新来源期限，不续期旧账单。
- [UNKNOWN 与独立解除](attempt-01/unknown.json)：另一个 owner 域的当前 ETH 已经在第二次 zone IO 提交，BFF 回复前死亡，只 GET 恢复 UNKNOWN。独立账单即使声称成交，仍1笔已知入账/1隔离/3OPEN、无可用估值。C11到4、账户 kill到1、冷恢复和显式独立解除到2，原generation0/签名/Proposal及snapshot claims保留，不补发或自动关闭。两个域不能拼成同一个账户成功旅程。
- 当前公共 Alert 的账户 finding 不虚构 Command(binding=null)。财务消费、C11与kill共同 C10 的 payload hash、来源/report/ledger/book引用均按实际读取断言；原请求审计不改写。原Proposal经当前generation4新风险/新零审批Subject/两次MFA后仍409 STATE_CONFLICT，无第三次IO。ack/unack仍403，不自动关闭。

## 确认的剩余接续缺口

**booksRiskAdmission=NOT_JOINED_REMAINS_OPEN**。账单仍有三类差异、三条 OPEN 时，当前 X02 仅凭新的有效 X01 估值仍可形成 ApprovalRequired；本轮仅观察这次新评估，未继续审批或执行。原始 decidedAt 经机器核验位于差异账单仍有效、尚未修正的区间，不是把修正后的风险评估挪作反例。后续控制与重复Proposal拒绝在账单显式修正之后验证。当前只读账户核对不是风险准入授权，完整Gate/交易准入继续拒绝。

下一可执行任务 **CORE:X02 DEVELOPMENT / L4-BOOKS-RISK-ADMISSION-01**：把当前 books scope/source/hash/version、固定覆盖和原期限及未决财务义务，接到显式新风险、新Subject和IO前复核；缺失/过期/分叉/不完整/差异/UNKNOWN/未审查义务应明确拒绝，不继承旧审批、不复用旧预算、不放宽限额，不补发或自动关闭。属于既有 L4-CURRENT-SOURCE-01/L4-LEDGER-01，不新增/缩减分母。下一 DEVELOPMENT [允许](attempt-01/next-development.log)，不授予目标/生产准入。

## 当前检查结果

**16项检查达到预期**：两个当前实际组合 **2/2**，Node门禁/阶段拒绝 **83/83**，构建/Clippy/fmt/ESLint、计划/生成/PRE-04/no-submit通过；INTEGRATION/RELEASE按预期拒绝。其余22个process案例过滤，未执行者不计PASS；未递归全部上游、全仓/F05F07 campaign。实际命令、时间、退出码及日志摘要见 [executions.json](attempt-01/executions.json)，Cargo发出的实际二进制路径/hash见 [binaries.json](attempt-01/binaries.json)。

20条关键 runtime 字节绑定及所有相关 runtime 路径相对基线空差异检查通过。最新 X05 原SHA e12e95f2 的1880输入/37文件仅按原Git blob/hash引用；历史3个process/55消费者及原L04浏览器属于 ORIGINAL_SCOPE_ONLY，不运行变化后的旧Gate或改绑。当前UI/契约未改，浏览器和完整消费者重验 NOT_RUN，不冒充当前执行。

泄漏扫描覆盖本任务46个当前文件，未审阅泄漏0；实际负向canary拒绝1，工具hash已记录，不代表目标安全验收。[preflight](preflight-index.json)保留两次实际组合诊断及原始日志：首次2/2，补充控制C10后2/2；均非冻结验收。ESLint首次缺少structuredClone全局声明的失败摘要保留于 [check-observations.json](preflight/check-observations.json)，修正后通过；原输出在会话工具记录，不伪造完整raw日志。冻结attempt-01全部达到预期。

## 风险与未执行项

仍为独立 owner 参考账单及参考资金/mark，限定空持仓起点、BTCUSDT/ETHUSDT、USDT现金/费用、显式无外部流/负债/在途订单的区间。fullBooksReady/dayCloseAllowed/executionAuthority仍false。真实账户资产全集/金融/资金/市场/R01/Research/R04/IdP、Supabase/Vault/RLS、实际testnet/多账户跨主机/外部单调锚、异步成交/非报价币费用/FX/外部流/负债/在途预算、通知投递确认与显式审查关闭、10交易日/20目标差异/15分钟定位、目标安全容量长稳/同SHA CI/发布及人工无障碍仍未验收。单主机MAC/锁/fsync不抵抗有权整体回滚目录和密钥的操作者。

未使用生产凭据，无推送、部署或外部发布。复核：`node docs/audit/evidence/core-l4-account-books-local-20261030/verify.mjs` 或 `pnpm check:core-l4:local`。

## Commands and results

| Check | Command | Expected result |
| --- | --- | --- |
| development | `node scripts/development-execution.mjs --development CORE-GATE:L4` | [PASS](attempt-01/development.log) |
| assessment | `node scripts/core-l4-account-books-review.mjs --audit` | [PASS](attempt-01/assessment.log) |
| build | `cargo build --locked --offline -p bff-gateway -p execution-gateway --message-format=json` | [PASS](attempt-01/build.log) |
| composition | `cargo test --locked --offline -p bff-gateway --test core_l04 account_books_gate:: -- --nocapture` | [PASS](attempt-01/composition.log) |
| gate-tests | `node --test scripts/core-l4-account-books-assessment.test.mjs scripts/development-execution.test.mjs` | [PASS](attempt-01/gate-tests.log) |
| plans | `node scripts/check-development-plans.mjs` | [PASS](attempt-01/plans.log) |
| generated | `node scripts/check-bff-generated.mjs` | [PASS](attempt-01/generated.log) |
| inventory | `node scripts/pre04-inventory.mjs` | [PASS](attempt-01/inventory.log) |
| no-submit | `python3 scripts/check-x05-no-submit.py` | [PASS](attempt-01/no-submit.log) |
| format | `cargo fmt -p bff-gateway -- --check` | [PASS](attempt-01/format.log) |
| clippy | `cargo clippy --locked --offline -p bff-gateway --all-targets --no-deps -- -D warnings` | [PASS](attempt-01/clippy.log) |
| lint | `pnpm exec eslint scripts/core-l4-account-books-assessment.mjs scripts/core-l4-account-books-review.mjs scripts/core-l4-account-books-assessment.test.mjs` | [PASS](attempt-01/lint.log) |
| integration-refusal | `node scripts/development-execution.mjs --integration CORE-GATE:L4` | [REFUSED AS EXPECTED (exit 1)](attempt-01/integration-refusal.log) |
| release-refusal | `node scripts/development-execution.mjs --release CORE-GATE:L4` | [REFUSED AS EXPECTED (exit 1)](attempt-01/release-refusal.log) |
| next-development | `node scripts/development-execution.mjs --development CORE:X02` | [PASS](attempt-01/next-development.log) |
| secret-scan | `node scripts/core-l4-account-books-review.mjs --scan docs/audit/evidence/core-l4-account-books-local-20261030/attempt-01` | [PASS](attempt-01/secret-scan.log) |

## Changed files

26 files in the source commit. Later sealing only updates this README and appends result.json / attempt-01; original source remains frozen. Full raw evidence file hashes are in result.json.files.

- [docs/SumAlpha-QuantOS-Development-Plan.md](../../../../docs/SumAlpha-QuantOS-Development-Plan.md)
- [docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md](../../../../docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md)
- [docs/audit/evidence/core-l4-account-books-local-20261030/README.md](../../../../docs/audit/evidence/core-l4-account-books-local-20261030/README.md)
- [docs/audit/evidence/core-l4-account-books-local-20261030/preflight-index.json](../../../../docs/audit/evidence/core-l4-account-books-local-20261030/preflight-index.json)
- [docs/audit/evidence/core-l4-account-books-local-20261030/preflight/accepted-02.json](../../../../docs/audit/evidence/core-l4-account-books-local-20261030/preflight/accepted-02.json)
- [docs/audit/evidence/core-l4-account-books-local-20261030/preflight/accepted.json](../../../../docs/audit/evidence/core-l4-account-books-local-20261030/preflight/accepted.json)
- [docs/audit/evidence/core-l4-account-books-local-20261030/preflight/check-observations.json](../../../../docs/audit/evidence/core-l4-account-books-local-20261030/preflight/check-observations.json)
- [docs/audit/evidence/core-l4-account-books-local-20261030/preflight/composition-01.log](../../../../docs/audit/evidence/core-l4-account-books-local-20261030/preflight/composition-01.log)
- [docs/audit/evidence/core-l4-account-books-local-20261030/preflight/composition-02.log](../../../../docs/audit/evidence/core-l4-account-books-local-20261030/preflight/composition-02.log)
- [docs/audit/evidence/core-l4-account-books-local-20261030/preflight/gate-tests.log](../../../../docs/audit/evidence/core-l4-account-books-local-20261030/preflight/gate-tests.log)
- [docs/audit/evidence/core-l4-account-books-local-20261030/preflight/run-01.json](../../../../docs/audit/evidence/core-l4-account-books-local-20261030/preflight/run-01.json)
- [docs/audit/evidence/core-l4-account-books-local-20261030/preflight/run-02.json](../../../../docs/audit/evidence/core-l4-account-books-local-20261030/preflight/run-02.json)
- [docs/audit/evidence/core-l4-account-books-local-20261030/preflight/unknown-02.json](../../../../docs/audit/evidence/core-l4-account-books-local-20261030/preflight/unknown-02.json)
- [docs/audit/evidence/core-l4-account-books-local-20261030/preflight/unknown.json](../../../../docs/audit/evidence/core-l4-account-books-local-20261030/preflight/unknown.json)
- [docs/audit/evidence/core-l4-account-books-local-20261030/review-draft.md](../../../../docs/audit/evidence/core-l4-account-books-local-20261030/review-draft.md)
- [docs/audit/evidence/core-l4-account-books-local-20261030/verify.mjs](../../../../docs/audit/evidence/core-l4-account-books-local-20261030/verify.mjs)
- [docs/execution/core-l4-account-books-assessment-20261030.json](../../../../docs/execution/core-l4-account-books-assessment-20261030.json)
- [docs/operations/core-l4-account-books-assessment-20261030.md](../../../../docs/operations/core-l4-account-books-assessment-20261030.md)
- [package.json](../../../../package.json)
- [scripts/core-l4-account-books-assessment.mjs](../../../../scripts/core-l4-account-books-assessment.mjs)
- [scripts/core-l4-account-books-assessment.test.mjs](../../../../scripts/core-l4-account-books-assessment.test.mjs)
- [scripts/core-l4-account-books-review.mjs](../../../../scripts/core-l4-account-books-review.mjs)
- [services/bff-gateway/tests/core_l04.rs](../../../../services/bff-gateway/tests/core_l04.rs)
- [services/bff-gateway/tests/support/account_books.rs](../../../../services/bff-gateway/tests/support/account_books.rs)
- [services/bff-gateway/tests/support/account_books_gate.rs](../../../../services/bff-gateway/tests/support/account_books_gate.rs)
- [services/bff-gateway/tests/support/current_gate.rs](../../../../services/bff-gateway/tests/support/current_gate.rs)
