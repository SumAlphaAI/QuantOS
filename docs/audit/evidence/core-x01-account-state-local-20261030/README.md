# CORE:X01 独立批准的账户期初资金/basis和状态来源绑定

当前工作项L4-ACCOUNT-STATE-PROVENANCE-01，main基线56c315ebba2c447727e90e9aaa6133f4df329d9b；冻结源码 **5da60187684f60861f3f0409034fd50bf366a267**，具名成功执行 **attempt-01**。源码冻结与证据封存分别提交，历史不改绑。

**工程Gate：PASS_CURRENT_INDEPENDENT_ACCOUNT_OPENING_STATUS_PROVENANCE_RISK_SUBJECT_IO**，功能IMPLEMENTED_PENDING_ACCEPTANCE。完整Gate **NOT_READY_GAPS_OPEN** / stage NOT_ASSESSED / formalAccepted=false / runtimeAdmission=DENIED / M5 PREPARED_NOT_READY；19gaps/8义务保持OPEN，159规范阶段与原200venue/50旅程/4目标演练分母及风险限额不变，fullBooksReady/dayCloseAllowed/executionAuthority=false。

## 当前实现与业务证据

独立owner MAC批准的账户Policy钉住scope/用途/provider/dataset/批准文档hash/版本/公钥与原Opening。独立Observation记录原USDT10000、原basis/origin/PnL与状态/覆盖时间，不从mark、Fill价格或修正books推导资金。专用域签名账户产物与另一份R01/F03产物分别认证、共同绑定精确raw输入；完整Inputs/Snapshot、新X02 signed facts/Subject/Command及共同C10携带两个来源。账户证书及实际公钥与market/observer分离，换证同钥也拒绝；原现金/PnL/basis不允许重基准。

当前Policy/观察head连续追加，撤销、不健康或停用后不可冷恢复回退旧授权/健康/active产物，删文件或开关不能回退裸owner输入/缓存。publisher与当前风险/公共审批、native预留/fsync/IO使用同一fence；等待IO时提交撤销，旧审批不消耗新claim或发出IO。证书/Policy、原观察/状态/覆盖、R01/F03、raw估值和UTC日终均受原半开截止约束，读取/恢复不刷新时间。

- 已知成功：已有BTC与新ETH共2次实际loopback协议IO，独立订单双MFA/两域审查/公共C11 version2后执行，X01两笔入账与独立BTC1/ETH1/cash7999.98/fees0.02 books匹配；4 OPEN保留。跨公共全局/账户kill、独立解除、C11到4和冷恢复，原generation0、两个证明、签名/claims不变，无再次执行。
- 签名suspended状态无可用风险快照，拒绝新风险和旧active重放；坏签名、market签名者、raw现金替换、client自带证明、撤销、缺源、不健康head、回退和冷checkpoint篡改均拒绝。
- 实际已认证账户/R01 ETH请求丢响应后UNKNOWN：1已知入账/1隔离/7 OPEN（原4+3 UNKNOWN相关）、原generation0与两个原证明/签名/claims保持；冷恢复、公共kill/解除和C11不补发/自动关闭。两个审查入口409，无可用估值快照，只返回原历史计数。

公开sourceTrust仍为OWNER_AUTHENTICATED_REFERENCE_INPUT_NOT_REAL_MARKET，区分总体owned范围与实际目标。账户trust为AUTHENTICATED_OWNER_APPROVED_ACCOUNT_OPENING_STATUS_ARTIFACT_NOT_VENUE_FUNDS，有别于原裸参考输入；不会把fixture批准/签名、mark权限或账户记录声明提升为真实venue资金、金融许可或执行权限。API1.33.0 /160 operations /180 schemas和PRE-04 1100字段行、同源生成client/Zod/MSW/input-policy及Terminal一致；页面核对两个来源/风险/Subject/Command和原期限，显示账户来源与非venue资金边界，旧命令仍可查询。

## 命令、结果与封存

运行 `node scripts/core-x01-account-state.mjs --run --attempt=attempt-01`；只读复核 `node docs/audit/evidence/core-x01-account-state-local-20261030/verify.mjs`。

**20项具名检查全部符合预期。Rust149通过（账户6/R01产物7/原估值17/原生执行49/新公共组合9/直接影响回归61）；19个消费者/合约文件277通过；Gate/执行边界115通过、0跳过。** 类型、构建、fmt/Clippy/ESLint、计划、生成/清单、no-submit、秘密扫描及随机canary均通过；INTEGRATION/RELEASE为预期拒绝，不是联调/发布通过。原R01发布性能ignored只保留原范围NOT_RUN，本轮未重跑该发布性能项。

[result.json](./result.json) 绑定 **2069输入 / 74原始及说明文件**、Git blob/hash、实际可执行文件与日志hash。八份当前业务数据为 [accepted](./attempt-01/accepted.json)、[revocation](./attempt-01/revocation.json)、[refusals](./attempt-01/refusals.json)、[health](./attempt-01/health.json)、[status](./attempt-01/status.json)、[unknown](./attempt-01/unknown.json)、[fence](./attempt-01/fence.json)、[tamper](./attempt-01/tamper.json)。独立verifier重算两份签名、公钥分离、批准/scope/Opening/raw输入/Snapshot hash及风险/Subject/Command/C10/claims/OPEN绑定，拒绝空/漏执行、历史改绑和资金信任提升。

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| development | `node scripts/development-execution.mjs --development CORE:X01` | PASS |
| domain | `cargo test --locked --offline -p quantos-portfolio --test account_provenance --test native_valuation --test market_provenance` | PASS |
| native-domain | `cargo test --locked --offline -p quantos-execution --test core_x02_source --test core_l04` | PASS |
| build | `cargo build --locked --offline -p bff-gateway -p execution-gateway --message-format=json` | PASS |
| composition | `cargo test --locked --offline -p bff-gateway --test core_l04 account_state:: -- --nocapture --test-threads=2` | PASS |
| direct-impact | `cargo test --locked --offline -p bff-gateway --test core_l04 -- --skip account_state:: --test-threads=2` | PASS |
| consumer | `pnpm exec vitest run apps/terminal/tests/r01-provenance.test.ts tests/contract/r01-valuation-provenance.test.ts apps/terminal/tests/account-state-provenance.test.ts tests/contract/account-state-provenance.test.ts apps/terminal/tests/financial-review.test.ts apps/terminal/tests/source-review.test.ts apps/terminal/tests/core-x06-alerts.test.ts apps/terminal/tests/ui-p23.test.ts tests/contract/financial-review.test.ts tests/contract/source-review.test.ts tests/contract/source-review-binding.test.ts apps/terminal/tests/current-native-review.test.ts apps/terminal/tests/current-native-execution.test.ts tests/contract/books-risk-admission.test.ts tests/contract/current-risk-approval.test.ts tests/contract/native-risk-review.test.ts tests/contract/current-native-execution.test.ts tests/contract/core-x05-reconciliation.test.ts tests/contract/core-x06-alerts.test.ts` | PASS |
| types | `pnpm --filter @sumalpha/terminal typecheck` | PASS |
| gate-tests | `node --test scripts/core-x01-account-state.test.mjs scripts/development-execution.test.mjs` | PASS |
| plans | `node scripts/check-development-plans.mjs` | PASS |
| generated | `node scripts/check-bff-generated.mjs` | PASS |
| inventory | `node scripts/pre04-inventory.mjs` | PASS |
| no-submit | `python3 scripts/check-x05-no-submit.py` | PASS |
| format | `cargo fmt -p quantos-market -p quantos-storage -p quantos-portfolio -p quantos-execution -p bff-gateway -- --check` | PASS |
| clippy | `cargo clippy --locked --offline -p quantos-market -p quantos-storage -p quantos-portfolio -p quantos-risk -p quantos-execution -p bff-gateway --all-targets --no-deps -- -D warnings` | PASS |
| lint | `pnpm exec eslint scripts/core-x01-account-state.mjs scripts/core-x01-account-state.test.mjs apps/terminal/src/assisted/risk-review.ts apps/terminal/src/assisted/runtime.ts apps/terminal/src/assisted/risk-review-panel.tsx apps/terminal/tests/account-state-provenance.test.ts tests/contract/account-state-provenance.test.ts` | PASS |
| integration-refusal | `node scripts/development-execution.mjs --integration CORE:X01` | PASS：预期拒绝 exit 1 |
| release-refusal | `node scripts/development-execution.mjs --release CORE:X01` | PASS：预期拒绝 exit 1 |
| next-development | `node scripts/development-execution.mjs --development CORE-GATE:L4` | PASS |
| secret-scan | `node scripts/core-x01-account-state.mjs --scan docs/audit/evidence/core-x01-account-state-local-20261030/attempt-01` | PASS |

## 历史、风险与下一任务

[preflight索引](./preflight-index.json) 与[诊断说明](./preflight/diagnostic-notes.json)保留首次8失败的trace一次性读取错误、修正后8通过、独立Observation和换证同钥后9通过、编译/类型/领域/消费者/门禁与静态诊断。全部为UNFROZEN_DIAGNOSTICS_NOT_CURRENT_ACCEPTANCE；sourceCommit只是旧基线上下文，不把改动绑定旧SHA。当前正式结果不覆盖历史失败。最新L4源码6d3eac6f23f3dc9bdadf023afef521df6135ee6e的1950输入/46原始文件只按Git blob/hash和ORIGINAL_SCOPE_ONLY核验；旧X01/L4及其FAIL/ignored/NOT_RUN不改绑。

当前仅owned原basis、USDT、受控当前R01持仓估值模式。真实资金/账户状态/账户全集/live来源/Research/R04、IdP/MFA/Supabase/Vault/RLS/outbox/跨主机/外部单调锚、轮换/多账户源、异步成交/FX/非报价币费用/外部流/负债/在途预算/日切、通知/源关闭、目标安全容量长稳/同SHA CI/发布及浏览器人工无障碍仍未验收或NOT_RUN。64Policy/64artifact及私有单机MAC/证书pin是有界owned恢复，不是无限历史或分布式保证。原限额、UNKNOWN义务、原generation和OPEN不放宽。只有[待确认文稿](./review-draft.md)，未自行批准；无生产凭据、真实provider连接、远端推送、部署或外部发布。

下一 **CORE-GATE:L4 DEVELOPMENT**：评估独立账户Opening/状态证明与R01 mark、两域审查、X02/X04/X01/X05/X06和公共kill/C11组合及剩余缺口，保留集中度等正确风险拒绝。

见[规程](../../../operations/core-x01-account-state.md)、[范围](../../../execution/core-x01-account-state-scope.json)。

## 本任务代码、测试、合约、文档与计划变更（38，另本目录证据）

- [apps/terminal/src/assisted/risk-review-panel.tsx](../../../../apps/terminal/src/assisted/risk-review-panel.tsx)
- [apps/terminal/src/assisted/risk-review.ts](../../../../apps/terminal/src/assisted/risk-review.ts)
- [apps/terminal/src/assisted/runtime.ts](../../../../apps/terminal/src/assisted/runtime.ts)
- [apps/terminal/tests/account-state-provenance.test.ts](../../../../apps/terminal/tests/account-state-provenance.test.ts)
- [bff/openapi/quantos-bff.v1.yaml](../../../../bff/openapi/quantos-bff.v1.yaml)
- [crates/quantos-execution/src/assisted_execution.rs](../../../../crates/quantos-execution/src/assisted_execution.rs)
- [crates/quantos-execution/src/assisted_source/native_refresh.rs](../../../../crates/quantos-execution/src/assisted_source/native_refresh.rs)
- [crates/quantos-execution/tests/support/native_refresh_cases.rs](../../../../crates/quantos-execution/tests/support/native_refresh_cases.rs)
- [crates/quantos-portfolio/src/account_provenance.rs](../../../../crates/quantos-portfolio/src/account_provenance.rs)
- [crates/quantos-portfolio/src/lib.rs](../../../../crates/quantos-portfolio/src/lib.rs)
- [crates/quantos-portfolio/src/native_valuation.rs](../../../../crates/quantos-portfolio/src/native_valuation.rs)
- [crates/quantos-portfolio/tests/account_provenance.rs](../../../../crates/quantos-portfolio/tests/account_provenance.rs)
- [crates/quantos-portfolio/tests/native_valuation.rs](../../../../crates/quantos-portfolio/tests/native_valuation.rs)
- [docs/SumAlpha-QuantOS-Development-Plan.md](../../../../docs/SumAlpha-QuantOS-Development-Plan.md)
- [docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md](../../../../docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md)
- [docs/execution/PRE-04-contract-ledger.md](../../../../docs/execution/PRE-04-contract-ledger.md)
- [docs/execution/PRE-04-field-dictionary.md](../../../../docs/execution/PRE-04-field-dictionary.md)
- [docs/execution/PRE-04-inventory-baseline.json](../../../../docs/execution/PRE-04-inventory-baseline.json)
- [docs/execution/core-x01-account-state-scope.json](../../../../docs/execution/core-x01-account-state-scope.json)
- [docs/operations/core-x01-account-state.md](../../../../docs/operations/core-x01-account-state.md)
- [package.json](../../../../package.json)
- [packages/api-client/src/bff-gen/quantos-bff.ts](../../../../packages/api-client/src/bff-gen/quantos-bff.ts)
- [packages/api-client/src/bff-gen/quantos-bff.zod.ts](../../../../packages/api-client/src/bff-gen/quantos-bff.zod.ts)
- [scripts/core-x01-account-state.mjs](../../../../scripts/core-x01-account-state.mjs)
- [scripts/core-x01-account-state.test.mjs](../../../../scripts/core-x01-account-state.test.mjs)
- [services/bff-gateway/src/assisted.rs](../../../../services/bff-gateway/src/assisted.rs)
- [services/bff-gateway/src/assisted/account_provenance.rs](../../../../services/bff-gateway/src/assisted/account_provenance.rs)
- [services/bff-gateway/src/assisted/persistence.rs](../../../../services/bff-gateway/src/assisted/persistence.rs)
- [services/bff-gateway/src/assisted/valuation.rs](../../../../services/bff-gateway/src/assisted/valuation.rs)
- [services/bff-gateway/src/generated-input-policy.json](../../../../services/bff-gateway/src/generated-input-policy.json)
- [services/bff-gateway/tests/core_l04.rs](../../../../services/bff-gateway/tests/core_l04.rs)
- [services/bff-gateway/tests/support/account_state.rs](../../../../services/bff-gateway/tests/support/account_state.rs)
- [services/bff-gateway/tests/support/r01_provenance.rs](../../../../services/bff-gateway/tests/support/r01_provenance.rs)
- [services/bff-gateway/tests/support/valuation.rs](../../../../services/bff-gateway/tests/support/valuation.rs)
- [tests/contract/account-state-provenance.test.ts](../../../../tests/contract/account-state-provenance.test.ts)
- [tests/contract/generated/quantos-bff.components.schema.json](../../../../tests/contract/generated/quantos-bff.components.schema.json)
- [tests/contract/generated/quantos-bff.msw.ts](../../../../tests/contract/generated/quantos-bff.msw.ts)
- [tests/contract/generated/quantos-bff.operations.json](../../../../tests/contract/generated/quantos-bff.operations.json)

本目录精确原始文件列表/hash见result.files；README为封存导航，排除源码输入及raw文件闭包，避免自引用，不修改冻结源码。
