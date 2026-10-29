# CORE:X05 DEVELOPMENT / L4-INDEPENDENT-BOOKS-01

冻结源码 **e12e95f2c5b7dbe793fd93f03ce4e7c828665d4c**；基线 8d929c70388f31aa24d4b830eeb20d191c958048。**1880** 个具名输入，摘要 sha256:0c4bf6e46e79f7b5574a7a03a2423675f9ff99d9abccf0b59e14c05e85ac67d3；**37** 个封存原始文件的哈希见 [result.json](result.json)。封存提交仅追加证据与本报告，不改绑冻结源码为后续 HEAD。

工程 Gate **PASS_INDEPENDENT_ACCOUNT_BOOKS_SCOPE_VERSION_FRESHNESS_FINANCIAL_RECONCILIATION**，结果 **PASS_CURRENT_ACCOUNT_BOOKS_FUNCTION_ONLY**。功能 **IMPLEMENTED_PENDING_ACCEPTANCE**；完整 Gate **NOT_READY_GAPS_OPEN** / stage **NOT_ASSESSED** / formalAccepted=false / runtimeAdmission=DENIED / M5 PREPARED_NOT_READY。19gap/8义务全部 OPEN、159规范阶段和原200venue/50授权旅程/目标演练等分母不变。正式[确认文稿](review-draft.md)待用户审阅，approval=null、selfApproved=false。

## 当前实现与实际证据

- 独立账户账单与协议 journal 分域签名，校验原账户/来源/公钥、连续版本/previous hash、固定覆盖集合、区间与30秒原期限。独立侧测试余额按场景手工编写，未读取 X01 财务/native回报生成另一侧。
- [accepted.json](attempt-01/accepted.json)：实际 BTC 原生入账后，先验证缺少账户输入/已接受期初来源；注册 X01 期初后，独立账单核对 BTC1/ETH0/USDT8999.99/费用0.01。新版本注入仓位/现金/费用三类差异，经公共 Alert/C10 消费；修正和冷恢复只恢复声明范围匹配，四条原 OPEN 保留。签名跨域、symlink不可用，同版本分叉/错账户拒绝；原期限过后拒绝，最终六条 OPEN。原 Command/账本/native预留及 generation 不变，实际 protocolCalls=1。
- [unknown.json](attempt-01/unknown.json)：当前 ETH Command 在第二次独立 mTLS zone 实际提交后 BFF 死亡，只 GET 恢复 UNKNOWN；独立账单即使声称两次成交，仍1笔已知入账、1命令隔离、3OPEN，原 generation0/Command/claims 不变，无第三次 IO/补发/自动关闭。
- [write.json](attempt-01/write.json)：实际 OS 权限拒绝写入，503且原 checkpoint 不变；冷恢复只见原 version1，显式再提供 version2 后才发布。此案例无 venue IO。
- 公共 optional accountBooks 与原协议 comparisonStatus 分开；只读 GET 额外 query/body 拒绝。API1.28.0 / 150操作 / 165schema，生成 client/schema及 PRE-04 当前盘点一致，历史回执不改绑。账户级财务差异 binding=null，不虚构 Command 关联，现有 Terminal Alert 消费者接受 OPEN 审计链接。

## 测试结果

**20项检查达到预期**。Rust：X05模型 **21/21**、X01估值 **17/17**、账户进程 **3/3**、原L4直接回归 **2/2**；消费者/契约 **55/55**，Node门禁/阶段拒绝 **68/68**，无失败/跳过。两个 process 命令分别过滤19/20项，未执行者不计 PASS；未递归上游/全仓/F05F07 campaign，UI未改、浏览器 NOT_RUN。

每项实际命令、开始/结束时间、exitCode、日志 hash 见 [executions.json](attempt-01/executions.json)。受限执行文件采用 Cargo 实际发出的路径，二进制 hash 见 [binaries.json](attempt-01/binaries.json)。白名单环境不载入目标凭据。泄漏扫描覆盖本任务64个当前文件，未审阅泄漏0，实际负向 canary 拒绝1；不等于目标安全验收。

## 失败历史、风险和下一任务

[诊断记录](preflight/observations.json)保留四次未冻结失败：fixture错租户/工作区、动态读取时间误入不可变控制比较、原第二次 trace 未消费、公共 GET 忽略额外参数。前三项修复测试，第四项修复实际读边界。修复后诊断3/3不作为冻结验收；索引只记录实际摘要，未伪造完整 raw transcript，原失败输出保留在会话工具记录。冻结 attempt-01 实际全通过。历史 L4 包按原 SHA/hash 引用，未运行旧 Gate 或改绑历史 PASS。

仍仅 owner 独立参考账单及已接受参考期初权威，覆盖空持仓起点、BTCUSDT/ETHUSDT、USDT现金/累计费用，无外部流/负债/在途订单的明确区间。fullBooksReady/dayCloseAllowed/executionAuthority 始终 false。真实账户完整资产集合/余额/资金/市场来源、IdP/DB/Vault/testnet、异步回报/非报价币费用/FX/外部流/负债/在途预算、跨主机与外部单调锚、通知投递确认/审查关闭、10交易日/20目标差异/15分钟定位、安全容量长稳/同SHA CI/发布、人工无障碍均未验收。文件 MAC/锁/fsync 不抵抗有权整体回滚目录和密钥的操作者。未使用生产凭据，未 push/部署/外部发布。

下一可执行任务：**CORE-GATE:L4 DEVELOPMENT**，评估独立账户账单加入后的当前组合和剩余缺口，继续保留 UNKNOWN/原 generation/OPEN，无补发或自动关闭；[下一任务检查](attempt-01/next-development.log)已确认允许。

复核：`node docs/audit/evidence/core-x05-account-books-local-20261030/verify.mjs` 或 `pnpm check:core-x05-account-books:local`。

## Commands and results

| Check | Command | Expected result |
| --- | --- | --- |
| development | `node scripts/development-execution.mjs --development CORE:X05` | [PASS](attempt-01/development.log) |
| model | `cargo test --locked --offline -p quantos-reconcile --test current_join` | [PASS](attempt-01/model.log) |
| valuation | `cargo test --locked --offline -p quantos-portfolio --test native_valuation` | [PASS](attempt-01/valuation.log) |
| build | `cargo build --locked --offline -p bff-gateway -p execution-gateway --message-format=json` | [PASS](attempt-01/build.log) |
| composition | `cargo test --locked --offline -p bff-gateway --test core_l04 account_books:: -- --nocapture` | [PASS](attempt-01/composition.log) |
| current-regression | `cargo test --locked --offline -p bff-gateway --test core_l04 current_gate:: -- --nocapture` | [PASS](attempt-01/current-regression.log) |
| consumer | `pnpm exec vitest run tests/contract/core-x05-reconciliation.test.ts tests/contract/core-x06-alerts.test.ts apps/terminal/tests/core-x05-reconciliation.test.ts apps/terminal/tests/core-x06-alerts.test.ts` | [PASS](attempt-01/consumer.log) |
| types | `pnpm --filter @sumalpha/terminal typecheck` | [PASS](attempt-01/types.log) |
| gate-tests | `node --test scripts/core-x05-account-books-review.test.mjs scripts/development-execution.test.mjs` | [PASS](attempt-01/gate-tests.log) |
| plans | `node scripts/check-development-plans.mjs` | [PASS](attempt-01/plans.log) |
| generated | `node scripts/check-bff-generated.mjs` | [PASS](attempt-01/generated.log) |
| inventory | `node scripts/pre04-inventory.mjs` | [PASS](attempt-01/inventory.log) |
| no-submit | `python3 scripts/check-x05-no-submit.py` | [PASS](attempt-01/no-submit.log) |
| format | `cargo fmt -p quantos-reconcile -p quantos-portfolio -p bff-gateway -- --check` | [PASS](attempt-01/format.log) |
| clippy | `cargo clippy --locked --offline -p quantos-reconcile -p quantos-portfolio -p bff-gateway --all-targets --no-deps -- -D warnings` | [PASS](attempt-01/clippy.log) |
| lint | `pnpm exec eslint scripts/core-x05-account-books-review.mjs scripts/core-x05-account-books-review.test.mjs` | [PASS](attempt-01/lint.log) |
| integration-refusal | `node scripts/development-execution.mjs --integration CORE:X05` | [REFUSED AS EXPECTED (exit 1)](attempt-01/integration-refusal.log) |
| release-refusal | `node scripts/development-execution.mjs --release CORE:X05` | [REFUSED AS EXPECTED (exit 1)](attempt-01/release-refusal.log) |
| next-development | `node scripts/development-execution.mjs --development CORE-GATE:L4` | [PASS](attempt-01/next-development.log) |
| secret-scan | `node scripts/core-x05-account-books-review.mjs --scan docs/audit/evidence/core-x05-account-books-local-20261030/attempt-01` | [PASS](attempt-01/secret-scan.log) |

## Changed files

39 files in source commit; later sealing only updates this README and appends result.json / attempt-01. Full evidence file hashes are in result.json.files.

- [apps/terminal/tests/core-x06-alerts.test.ts](../../../../apps/terminal/tests/core-x06-alerts.test.ts)
- [bff/openapi/quantos-bff.v1.yaml](../../../../bff/openapi/quantos-bff.v1.yaml)
- [crates/quantos-portfolio/src/native_valuation.rs](../../../../crates/quantos-portfolio/src/native_valuation.rs)
- [crates/quantos-reconcile/src/account_books.rs](../../../../crates/quantos-reconcile/src/account_books.rs)
- [crates/quantos-reconcile/src/current.rs](../../../../crates/quantos-reconcile/src/current.rs)
- [crates/quantos-reconcile/src/lib.rs](../../../../crates/quantos-reconcile/src/lib.rs)
- [crates/quantos-reconcile/tests/current_join.rs](../../../../crates/quantos-reconcile/tests/current_join.rs)
- [crates/quantos-reconcile/tests/support/account_books.rs](../../../../crates/quantos-reconcile/tests/support/account_books.rs)
- [docs/SumAlpha-QuantOS-Development-Plan.md](../../../../docs/SumAlpha-QuantOS-Development-Plan.md)
- [docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md](../../../../docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md)
- [docs/audit/evidence/core-x05-account-books-local-20261030/README.md](../../../../docs/audit/evidence/core-x05-account-books-local-20261030/README.md)
- [docs/audit/evidence/core-x05-account-books-local-20261030/preflight-index.json](../../../../docs/audit/evidence/core-x05-account-books-local-20261030/preflight-index.json)
- [docs/audit/evidence/core-x05-account-books-local-20261030/preflight/accepted.json](../../../../docs/audit/evidence/core-x05-account-books-local-20261030/preflight/accepted.json)
- [docs/audit/evidence/core-x05-account-books-local-20261030/preflight/observations.json](../../../../docs/audit/evidence/core-x05-account-books-local-20261030/preflight/observations.json)
- [docs/audit/evidence/core-x05-account-books-local-20261030/preflight/unknown.json](../../../../docs/audit/evidence/core-x05-account-books-local-20261030/preflight/unknown.json)
- [docs/audit/evidence/core-x05-account-books-local-20261030/preflight/write.json](../../../../docs/audit/evidence/core-x05-account-books-local-20261030/preflight/write.json)
- [docs/audit/evidence/core-x05-account-books-local-20261030/review-draft.md](../../../../docs/audit/evidence/core-x05-account-books-local-20261030/review-draft.md)
- [docs/audit/evidence/core-x05-account-books-local-20261030/verify.mjs](../../../../docs/audit/evidence/core-x05-account-books-local-20261030/verify.mjs)
- [docs/execution/PRE-01-page-api-coverage-register.md](../../../../docs/execution/PRE-01-page-api-coverage-register.md)
- [docs/execution/PRE-04-contract-ledger.md](../../../../docs/execution/PRE-04-contract-ledger.md)
- [docs/execution/PRE-04-field-dictionary.md](../../../../docs/execution/PRE-04-field-dictionary.md)
- [docs/execution/PRE-04-inventory-baseline.json](../../../../docs/execution/PRE-04-inventory-baseline.json)
- [docs/execution/core-x05-account-books-scope.json](../../../../docs/execution/core-x05-account-books-scope.json)
- [docs/operations/core-x05-account-books.md](../../../../docs/operations/core-x05-account-books.md)
- [package.json](../../../../package.json)
- [packages/api-client/src/bff-gen/quantos-bff.ts](../../../../packages/api-client/src/bff-gen/quantos-bff.ts)
- [packages/api-client/src/bff-gen/quantos-bff.zod.ts](../../../../packages/api-client/src/bff-gen/quantos-bff.zod.ts)
- [scripts/check-x05-no-submit.py](../../../../scripts/check-x05-no-submit.py)
- [scripts/core-x05-account-books-review.mjs](../../../../scripts/core-x05-account-books-review.mjs)
- [scripts/core-x05-account-books-review.test.mjs](../../../../scripts/core-x05-account-books-review.test.mjs)
- [services/bff-gateway/src/assisted.rs](../../../../services/bff-gateway/src/assisted.rs)
- [services/bff-gateway/src/assisted/reconciliation.rs](../../../../services/bff-gateway/src/assisted/reconciliation.rs)
- [services/bff-gateway/src/generated-input-policy.json](../../../../services/bff-gateway/src/generated-input-policy.json)
- [services/bff-gateway/tests/core_l04.rs](../../../../services/bff-gateway/tests/core_l04.rs)
- [services/bff-gateway/tests/support/account_books.rs](../../../../services/bff-gateway/tests/support/account_books.rs)
- [tests/contract/core-x05-reconciliation.test.ts](../../../../tests/contract/core-x05-reconciliation.test.ts)
- [tests/contract/generated/quantos-bff.components.schema.json](../../../../tests/contract/generated/quantos-bff.components.schema.json)
- [tests/contract/generated/quantos-bff.msw.ts](../../../../tests/contract/generated/quantos-bff.msw.ts)
- [tests/contract/generated/quantos-bff.operations.json](../../../../tests/contract/generated/quantos-bff.operations.json)
