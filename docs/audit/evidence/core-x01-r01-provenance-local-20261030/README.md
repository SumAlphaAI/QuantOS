# CORE:X01 R01 认证产物到估值/风险快照的来源绑定

当前工作项 L4-R01-VALUATION-PROVENANCE-01，main 基线 f494a59fdcca25063abdb2156cb6afc02f5ec240。冻结源码 **837cf7a1ce1038e193df8a44e3bd67246f4a8151**；成功执行 **attempt-02**。源码冻结与证据封存分开提交，历史结果不改绑。

**当前功能工程 Gate：PASS_CURRENT_AUTHENTICATED_R01_MARK_PROVENANCE_RISK_SNAPSHOT_IO。** 功能实现 IMPLEMENTED_PENDING_ACCEPTANCE；完整 Gate **NOT_READY_GAPS_OPEN** / stage NOT_ASSESSED / formalAccepted=false / runtimeAdmission=DENIED / M5 PREPARED_NOT_READY。19 gaps、8 规划义务继续 OPEN，159 规范阶段及原200 venue/50授权旅程/4目标演练分母不变；fullBooksReady/dayCloseAllowed/executionAuthority=false。

## 变更与当前业务事实

批准 Policy 独立于 R01 签名产物，钉住 scope、provider/dataset、Trading 用途、批准文档 hash/版本、symbol/精度、期限和 signer。真实仓库 R01 规范化与 F03 snapshot/lineage/artifact 经签名、质量、许可和时间重算后派生 mark，绑定原 raw valuation input 和不可变账本风险快照，再进入 X02 signed facts、新 Subject、原 Command 和共同 C10。publisher fence 覆盖 IO 前复核、native 预留/fsync/IO；撤销或不健康的已认证 head 持久追加，冷恢复拒绝旧授权/健康来源回退。来源坏失、过期或篡改不能退回参考 mark 或缓存。API1.32.0 /160 operations /179 schemas、PRE-04 1083字段行、client/Zod/MSW/input-policy与 Terminal 同步。

成功场景有2次实际 loopback 协议 IO（已有BTC及新ETH），新风险仍绑定同一不可变 Proposal、独立双审批/MFA/C11/kill；原4条 OPEN 未关闭。实际 fixture 进程的 UNKNOWN 场景保留原 generation0、来源证明、签名与原 claims，1已知入账/1隔离/7 OPEN；不生成新估值快照，不补发、自动关闭或放宽限额。UNKNOWN早返回保留原sourceVersions/snapshotCount计数。

账户资金/状态仍 OWNER_AUTHENTICATED_REFERENCE_INPUT_NOT_REAL_MARKET。mark trust 为 AUTHENTICATED_R01_F03_TRADING_ARTIFACT_OWNER_PINNED_NOT_LIVE_VENUE；owned fixture批准和临时证书不证明真实市场许可、资金或执行权限。

## 测试与机器证据

运行：

`node scripts/core-x01-r01-provenance.mjs --run --attempt=attempt-02`

只读复核：

`node docs/audit/evidence/core-x01-r01-provenance-local-20261030/verify.mjs`

当前冻结候选：**22项具名检查全部符合预期**；Rust **148通过**（组合7、直接影响回归51、portfolio24、market15、storage2、native49），另1项原R01 release性能 ignored，保持 **NOT_RUN**；17个消费者/合约文件 **243通过**；Gate/执行边界 **90通过、0跳过**。类型、生成、计划、库存、fmt、Clippy、ESLint、no-submit、秘密扫描与canary均通过。integration/release入口为预期拒绝，不能解释为联调或发布通过。

[result.json](./result.json) 绑定 2065 个输入、105 个原始/说明文件、源码 Git blob/hash、实际产物/日志 hash 与已编译可执行文件 hash。七份业务证据为 [accepted](./attempt-02/accepted.json)、[revocation](./attempt-02/revocation.json)、[refusals](./attempt-02/refusals.json)、[health](./attempt-02/health.json)、[unknown](./attempt-02/unknown.json)、[fence](./attempt-02/fence.json)、[tamper](./attempt-02/tamper.json)。只读 verifier 另重算签名、批准/F03/输入/Snapshot hash、同源风险/Subject/Command、C10/claims及OPEN保留。

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| development | `node scripts/development-execution.mjs --development CORE:X01` | PASS |
| domain | `cargo test --locked --offline -p quantos-portfolio --test market_provenance --test native_valuation` | PASS |
| market | `cargo test --locked --offline -p quantos-market --lib` | PASS |
| storage | `cargo test --locked --offline -p quantos-storage --lib provenance::` | PASS |
| native-domain | `cargo test --locked --offline -p quantos-execution --test core_x02_source --test core_l04` | PASS |
| build | `cargo build --locked --offline -p bff-gateway -p execution-gateway --message-format=json` | PASS |
| composition | `cargo test --locked --offline -p bff-gateway --test core_l04 r01_provenance:: -- --nocapture --test-threads=2` | PASS |
| direct-impact | `cargo test --locked --offline -p bff-gateway --test core_l04 -- --skip r01_provenance:: --test-threads=2` | PASS |
| consumer | `pnpm exec vitest run apps/terminal/tests/r01-provenance.test.ts tests/contract/r01-valuation-provenance.test.ts apps/terminal/tests/financial-review.test.ts apps/terminal/tests/source-review.test.ts apps/terminal/tests/core-x06-alerts.test.ts apps/terminal/tests/ui-p23.test.ts tests/contract/financial-review.test.ts tests/contract/source-review.test.ts tests/contract/source-review-binding.test.ts apps/terminal/tests/current-native-review.test.ts apps/terminal/tests/current-native-execution.test.ts tests/contract/books-risk-admission.test.ts tests/contract/current-risk-approval.test.ts tests/contract/native-risk-review.test.ts tests/contract/current-native-execution.test.ts tests/contract/core-x05-reconciliation.test.ts tests/contract/core-x06-alerts.test.ts` | PASS |
| types | `pnpm --filter @sumalpha/terminal typecheck` | PASS |
| gate-tests | `node --test scripts/core-x01-r01-provenance.test.mjs scripts/development-execution.test.mjs` | PASS |
| plans | `node scripts/check-development-plans.mjs` | PASS |
| generated | `node scripts/check-bff-generated.mjs` | PASS |
| inventory | `node scripts/pre04-inventory.mjs` | PASS |
| no-submit | `python3 scripts/check-x05-no-submit.py` | PASS |
| format | `cargo fmt -p quantos-market -p quantos-storage -p quantos-portfolio -p quantos-execution -p bff-gateway -- --check` | PASS |
| clippy | `cargo clippy --locked --offline -p quantos-market -p quantos-storage -p quantos-portfolio -p quantos-risk -p quantos-execution -p bff-gateway --all-targets --no-deps -- -D warnings` | PASS |
| lint | `pnpm exec eslint scripts/core-x01-r01-provenance.mjs scripts/core-x01-r01-provenance.test.mjs apps/terminal/src/assisted/risk-review.ts apps/terminal/src/assisted/runtime.ts apps/terminal/src/assisted/risk-review-panel.tsx apps/terminal/tests/r01-provenance.test.ts tests/contract/r01-valuation-provenance.test.ts` | PASS |
| integration-refusal | `node scripts/development-execution.mjs --integration CORE:X01` | PASS：预期拒绝 exit 1 |
| release-refusal | `node scripts/development-execution.mjs --release CORE:X01` | PASS：预期拒绝 exit 1 |
| next-development | `node scripts/development-execution.mjs --development CORE-GATE:L4` | PASS |
| secret-scan | `node scripts/core-x01-r01-provenance.mjs --scan docs/audit/evidence/core-x01-r01-provenance-local-20261030/attempt-02` | PASS |

## 历史失败与边界

[attempt-01/failure.json](./attempt-01/failure.json) 的冻结源码4de824f3467041d37feb387e131f182d3cca01b5保留 FAIL：直接回归50通过/1失败，UNKNOWN早返回漏填持久计数；后续检查当时NOT_RUN。修复后原失败用例单独通过，只作未冻结诊断；随后新SHA完整矩阵成功，不将旧结果改绑。所有 preflight 原失败、编译/lint/fixture修正和未冻结结果见 [diagnostic-notes](./preflight/diagnostic-notes.json) 与 [preflight-index](./preflight-index.json)，范围 UNFROZEN_DIAGNOSTICS_NOT_CURRENT_ACCEPTANCE。旧L4 999510195a763e26ed50a49121765d48eb2bef07 的1934输入/44原始文件仅 ORIGINAL_SCOPE_ONLY。

真实许可/live R01与持久部署流、资金/账户全集、Research/R04、IdP/MFA/Supabase/Vault/RLS、跨主机/外部单调锚、签名轮换/多provider、异步成交/FX/非报价币费用/外部流/负债/在途预算、通知/源关闭、目标安全容量长稳同SHA CI、发布、浏览器人工/无障碍均未验收或NOT_RUN。新增有界64 policy/64 artifact/16 ticks/262144 bytes，不宣称无限历史或实际分布式恢复。原限额与UNKNOWN/原generation/OPEN历史保留。

只修改 QuantOS；无生产凭据、真实provider连接、远端推送、部署或外部发布。正式确认未授予，见 [待确认文稿](./review-draft.md)、[范围](../../../execution/core-x01-r01-provenance-scope.json)、[规程](../../../operations/core-x01-r01-provenance.md)。

下一可执行任务：**CORE-GATE:L4 DEVELOPMENT**，评估 R01 认证 mark 加入后的当前 X02/X04/X01/X05/X06、来源/财务独立审查及公共 kill/C11 组合与剩余缺口。

## 本任务代码、测试、合约、文档与计划变更文件（44）

- [Cargo.lock](../../../../Cargo.lock)
- [apps/terminal/src/assisted/risk-review-panel.tsx](../../../../apps/terminal/src/assisted/risk-review-panel.tsx)
- [apps/terminal/src/assisted/risk-review.ts](../../../../apps/terminal/src/assisted/risk-review.ts)
- [apps/terminal/src/assisted/runtime.ts](../../../../apps/terminal/src/assisted/runtime.ts)
- [apps/terminal/tests/r01-provenance.test.ts](../../../../apps/terminal/tests/r01-provenance.test.ts)
- [bff/openapi/quantos-bff.v1.yaml](../../../../bff/openapi/quantos-bff.v1.yaml)
- [crates/quantos-execution/src/assisted_execution.rs](../../../../crates/quantos-execution/src/assisted_execution.rs)
- [crates/quantos-execution/src/assisted_source/native_refresh.rs](../../../../crates/quantos-execution/src/assisted_source/native_refresh.rs)
- [crates/quantos-execution/tests/support/native_refresh_cases.rs](../../../../crates/quantos-execution/tests/support/native_refresh_cases.rs)
- [crates/quantos-market/src/lib.rs](../../../../crates/quantos-market/src/lib.rs)
- [crates/quantos-market/src/tests.rs](../../../../crates/quantos-market/src/tests.rs)
- [crates/quantos-portfolio/Cargo.toml](../../../../crates/quantos-portfolio/Cargo.toml)
- [crates/quantos-portfolio/src/lib.rs](../../../../crates/quantos-portfolio/src/lib.rs)
- [crates/quantos-portfolio/src/market_provenance.rs](../../../../crates/quantos-portfolio/src/market_provenance.rs)
- [crates/quantos-portfolio/src/native_valuation.rs](../../../../crates/quantos-portfolio/src/native_valuation.rs)
- [crates/quantos-portfolio/tests/market_provenance.rs](../../../../crates/quantos-portfolio/tests/market_provenance.rs)
- [crates/quantos-portfolio/tests/native_valuation.rs](../../../../crates/quantos-portfolio/tests/native_valuation.rs)
- [crates/quantos-storage/src/provenance.rs](../../../../crates/quantos-storage/src/provenance.rs)
- [docs/SumAlpha-QuantOS-Development-Plan.md](../../../../docs/SumAlpha-QuantOS-Development-Plan.md)
- [docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md](../../../../docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md)
- [docs/execution/PRE-04-contract-ledger.md](../../../../docs/execution/PRE-04-contract-ledger.md)
- [docs/execution/PRE-04-field-dictionary.md](../../../../docs/execution/PRE-04-field-dictionary.md)
- [docs/execution/PRE-04-inventory-baseline.json](../../../../docs/execution/PRE-04-inventory-baseline.json)
- [docs/execution/core-x01-r01-provenance-scope.json](../../../../docs/execution/core-x01-r01-provenance-scope.json)
- [docs/operations/core-x01-r01-provenance.md](../../../../docs/operations/core-x01-r01-provenance.md)
- [package.json](../../../../package.json)
- [packages/api-client/src/bff-gen/quantos-bff.ts](../../../../packages/api-client/src/bff-gen/quantos-bff.ts)
- [packages/api-client/src/bff-gen/quantos-bff.zod.ts](../../../../packages/api-client/src/bff-gen/quantos-bff.zod.ts)
- [scripts/core-x01-r01-provenance.mjs](../../../../scripts/core-x01-r01-provenance.mjs)
- [scripts/core-x01-r01-provenance.test.mjs](../../../../scripts/core-x01-r01-provenance.test.mjs)
- [services/bff-gateway/src/assisted.rs](../../../../services/bff-gateway/src/assisted.rs)
- [services/bff-gateway/src/assisted/market_provenance.rs](../../../../services/bff-gateway/src/assisted/market_provenance.rs)
- [services/bff-gateway/src/assisted/persistence.rs](../../../../services/bff-gateway/src/assisted/persistence.rs)
- [services/bff-gateway/src/assisted/risk_refresh.rs](../../../../services/bff-gateway/src/assisted/risk_refresh.rs)
- [services/bff-gateway/src/assisted/valuation.rs](../../../../services/bff-gateway/src/assisted/valuation.rs)
- [services/bff-gateway/src/generated-input-policy.json](../../../../services/bff-gateway/src/generated-input-policy.json)
- [services/bff-gateway/tests/core_l04.rs](../../../../services/bff-gateway/tests/core_l04.rs)
- [services/bff-gateway/tests/support/r01_provenance.rs](../../../../services/bff-gateway/tests/support/r01_provenance.rs)
- [services/bff-gateway/tests/support/source_review_gate.rs](../../../../services/bff-gateway/tests/support/source_review_gate.rs)
- [services/bff-gateway/tests/support/valuation.rs](../../../../services/bff-gateway/tests/support/valuation.rs)
- [tests/contract/generated/quantos-bff.components.schema.json](../../../../tests/contract/generated/quantos-bff.components.schema.json)
- [tests/contract/generated/quantos-bff.msw.ts](../../../../tests/contract/generated/quantos-bff.msw.ts)
- [tests/contract/generated/quantos-bff.operations.json](../../../../tests/contract/generated/quantos-bff.operations.json)
- [tests/contract/r01-valuation-provenance.test.ts](../../../../tests/contract/r01-valuation-provenance.test.ts)

本目录额外保存未冻结诊断、失败attempt、成功attempt、待确认文稿和只读verifier；精确清单/hash见 result.files。README是封存导航，排除在候选输入与raw文件闭包外，避免自引用；不改变上述冻结源码。
