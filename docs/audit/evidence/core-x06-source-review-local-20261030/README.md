# CORE:X06 来源健康义务独立审查：冻结本地证据

任务 `L4-SOURCE-OBLIGATION-REVIEW-01`，main 源码提交 **101d940ae4835a64d811e707b3c5c2a476108df2**。

当前结果 **PASS_CURRENT_SOURCE_REVIEW_FUNCTION_ONLY**；工程 Gate **PASS_CURRENT_INDEPENDENT_APPEND_ONLY_SOURCE_HEALTH_REVIEW_RISK_RECHECK_C10**。21 项具名执行满足各自预期（联调和发布拒绝项预期 exit 1），2034 个源码输入 / 68 个原始文件已按 Git blob、SHA256、实际命令和业务数据独立核对。result.json 的 sourceCommit 仅绑定上述源码，后续证据封存提交不改绑结果。

## 已执行

| 命令 / 检查 | 结果 |
| --- | --- |
| `cargo test --locked --offline -p quantos-execution --test core_x02_source --test core_l04` | 36 + 13 PASS |
| `cargo test --locked --offline -p quantos-reconcile --test current_join --test financial_review` | 22 + 14 PASS |
| `cargo test --locked --offline -p bff-gateway --lib financial_review` | 1 PASS |
| `cargo test --locked --offline -p bff-gateway --test core_l04 source_review -- --nocapture --test-threads=2` | 8 PASS |
| `cargo test --locked --offline -p bff-gateway --test core_l04 -- --skip source_review --test-threads=2` | 原 40 项直接回归 PASS |
| `pnpm exec vitest run …`（15 个具名文件见 executions.json） | 218 PASS |
| `node --test scripts/core-x06-source-review.test.mjs scripts/development-execution.test.mjs` | 93 PASS，0 skipped |
| terminal typecheck、定向 ESLint、Cargo fmt / clippy -D warnings、二进制构建 | PASS |
| 开发入口 / 下一 L4 开发入口、159 阶段计划、生成物、PRE-04、X05 no-submit | PASS |
| CORE:X06 integration / release 入口 | 如期拒绝 STAGE_NOT_READY / USE_FROZEN_RELEASE_ACCEPTANCE_GATE |
| Gitleaks 8.28.0 当前任务与证据 + 随机负例 | 101 文件无泄漏，1 个实际 canary 如期拒绝 |

Rust 合计 **134 项**。完整参数、时间、退出码、无 signal/error 和原始日志 hash 见 [executions.json](./attempt-01/executions.json)；精确输入与原始文件清单见 [result.json](./result.json)。全部使用白名单 fixture 环境、本机临时证书和 loopback，不加载生产凭据；未访问目标数据库、真实 venue、外部推送/部署/发布。

## 当前业务证据

- [accepted](./attempt-01/accepted.json)：可信 STALE 恢复后原 1 OPEN，三人独立来源授权→新风险→新 Subject→订单独立双审批→实际本机 ETH IO；sourceReview 绑定签名 Command，原 OPEN/C10/原 generation 0 保留；后续源变化撤回旧当前引用。
- [unavailable](./attempt-01/unavailable.json)：已建立源缺失追加 UNAVAILABLE，连续签名 v2 恢复后显式授权，原 OPEN 保留；不反推缺失值。
- [mixed](./attempt-01/mixed.json)：原 3 财务 + 1 来源全部 OPEN。来源授权仅覆盖 1，单独仍签名 Deny/无 Subject；另行独立财务授权覆盖 3 后才可新风险/新 Subject/独立订单审批/实际 IO。旧财务授权不继承，9 条追加历史保留。
- [auth](./attempt-01/auth.json)、[recovery](./attempt-01/recovery.json)：自审/跨会话 MFA 拒绝、复本 CAS 只有一次成功，已提交后丢响应冷恢复仅原回执，篡改 503；共同 C10 和消费 proof 与 journal 一致。
- [revocation](./attempt-01/revocation.json)、[freshness](./attempt-01/freshness.json)：retain-block、来源版本、generation 与原截止变化拒绝旧 Subject/动作，无新预留或 IO。
- [unknown](./attempt-01/unknown.json)：携带有效来源授权的命令真实提交后 BFF 死亡，公共 kill/解除及冷恢复保持 UNKNOWN、原 generation 0/授权/签名/claims，1 已知入账 / 1 隔离、原 1 来源加 3 未知相关 OPEN，不补发或自动关闭。

## 范围与未决

功能 IMPLEMENTED_PENDING_ACCEPTANCE；完整 Gate **NOT_READY_GAPS_OPEN** / stage **NOT_ASSESSED** / formalAccepted=false / runtimeAdmission=DENIED / M5 PREPARED_NOT_READY。19 gaps、8 规划义务 OPEN，159 规范阶段和原 200 venue / 50 授权旅程 / 4 目标演练分母不变。fullBooksReady/dayCloseAllowed/executionAuthority=false。

owned 独立参考 source 不是 venue 账户全集；单主机认证文件不是 Supabase/Vault/分布式恢复。真实市场/资金/R01/Research/R04/IdP/MFA/目标数据库/RLS/跨主机/外部单调锚、通知及源关闭、目标安全容量长稳/同 SHA CI/发布、当前人工浏览器/无障碍均 NOT_RUN。[规程](../../../operations/core-x06-source-review.md)、[范围](../../../execution/core-x06-source-review-scope.json)、[待确认文稿](./review-draft.md)分别记录工程、阶段和人工确认，不自行批准。

## 重放与历史

`node docs/audit/evidence/core-x06-source-review-local-20261030/verify.mjs` 只读验证；`node scripts/core-x06-source-review.mjs --run --attempt=attempt-02` 需从相同或另行冻结的真实源码输入开始，禁止覆盖 attempt-01。验证器先核对全部具名执行/计数、SHA、原始 journal/MFA/C10、风险/Subject/Command/OPEN，再发布 PASS。

preflight 全部为 UNFROZEN_DIAGNOSTICS_NOT_CURRENT_ACCEPTANCE；[诊断说明](./preflight/diagnostic-notes.json)和原失败/过早读取/静态错误保留，不能当作当前候选通过。最新旧 L4 的 cb5a4eb206f81ef6238036db5793650b40d37638 / 1921 输入 / 43 原始文件仅 ORIGINAL_SCOPE_ONLY，未改绑历史结果。

## 变更文件

源码提交 70 文件（其中当前包诊断/文稿/索引 33 文件）；以下为代码、合约、测试和计划/规程文件，包内原始文件另见 result.files 和 preflight-index.json。

- `apps/terminal/src/alerts/financial-review-panel.tsx`
- `apps/terminal/src/alerts/financial-review.ts`
- `apps/terminal/src/assisted/risk-review.ts`
- `apps/terminal/tests/source-review.test.ts`
- `bff/openapi/quantos-bff.v1.yaml`
- `bff/page-operation-catalog.yaml`
- `crates/quantos-execution/tests/support/books_risk_cases.rs`
- `crates/quantos-execution/tests/support/native_refresh_cases.rs`
- `crates/quantos-portfolio/src/books_risk.rs`
- `crates/quantos-reconcile/src/current.rs`
- `crates/quantos-reconcile/src/financial_review.rs`
- `crates/quantos-reconcile/tests/financial_review.rs`
- `crates/quantos-risk/src/guard/native.rs`
- `docs/SumAlpha-QuantOS-Development-Plan.md`
- `docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md`
- `docs/execution/PRE-04-contract-ledger.md`
- `docs/execution/PRE-04-field-dictionary.md`
- `docs/execution/PRE-04-inventory-baseline.json`
- `docs/execution/PRE-04-openapi-gap-list.md`
- `docs/execution/core-x06-source-review-scope.json`
- `docs/operations/core-x06-financial-review.md`
- `docs/operations/core-x06-source-review.md`
- `packages/api-client/src/bff-gen/quantos-bff.ts`
- `packages/api-client/src/bff-gen/quantos-bff.zod.ts`
- `scripts/core-x06-source-review.mjs`
- `scripts/core-x06-source-review.test.mjs`
- `services/bff-gateway/src/assisted.rs`
- `services/bff-gateway/src/assisted/financial_review.rs`
- `services/bff-gateway/src/generated-input-policy.json`
- `services/bff-gateway/tests/core_l04.rs`
- `services/bff-gateway/tests/support/financial_review_gate.rs`
- `services/bff-gateway/tests/support/source_review.rs`
- `tests/contract/generated/quantos-bff.components.schema.json`
- `tests/contract/generated/quantos-bff.msw.ts`
- `tests/contract/generated/quantos-bff.operations.json`
- `tests/contract/source-review-binding.test.ts`
- `tests/contract/source-review.test.ts`

本包另含 README.md、review-draft.md、verify.mjs、preflight-index.json 与完整 preflight，封存加入 attempt-01/ 与 result.json。六类生成文件均来自 OpenAPI 1.31.0（160 operations / 178 schemas），PRE-04 1066 字段行。

下一可执行任务：**CORE-GATE:L4 DEVELOPMENT**，评估来源健康与财务独立审查加入后的当前组合与剩余缺口。
