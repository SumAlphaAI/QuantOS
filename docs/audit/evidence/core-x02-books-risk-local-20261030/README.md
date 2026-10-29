# CORE:X02 / L4-BOOKS-RISK-ADMISSION-01

2026-10-30：代码、测试、规程及两份计划已同步；当前功能工程 Gate **PASS_CURRENT_BOOKS_BOUND_RISK_SUBJECT_AND_IO_RECHECK**，机器结果 **PASS_CURRENT_BOOKS_RISK_FUNCTION_ONLY**。仅代表 owner 参考当前功能和本机受控进程证据。完整 L4 **NOT_READY_GAPS_OPEN** / stage **NOT_ASSESSED** / formalAccepted=false / runtimeAdmission=DENIED / M5 PREPARED_NOT_READY，19 gap / 8 义务仍 OPEN，159 阶段及原目标分母不变。

源码冻结提交 **fbfed8c4dc7d3bc4613db69ded05bdf2afda824f**，基线 547a36ba4a015b56e6d047c1758a6d1853ad6c6a。本轮确有 runtime 改动；后续证据封存提交只保存结果和本摘要，不改绑源码通过。[result.json](result.json) 绑定 **2005 输入、63 原始文件、20 项具名执行**，inputDigest `3aaef1b39154cee052ebfafce67bc91fdd548fe1b55f51ddb5ec3c6e9543a886`。实际服务二进制 hash 见 [binaries.json](attempt-01/binaries.json)。复核验证当前输入、原 Git blob、原始日志/hash、具名执行和签名账单，不用零执行或历史 READY 代替本轮通过。

## 交付行为

- X05 认证当前账户 scope、独立来源/hash/version、basis、覆盖、原期限、ledger/report 与所有 OPEN count/hash 投影到 BooksRiskInput，进入 X02 签名 facts、新 Subject 与 Command。浏览器不提供账单或财务放行权，HTTP 仍只传 snapshotHash/expectedGeneration。
- 保留原 15 规则及限额，追加 account_books；缺失、过期、不匹配、UNKNOWN 或 OPEN 拒绝，形成可评估输入时返回签名 Deny/无 Subject。不可认证源或不可用估值在请求层拒绝。合格时才形成新独立 Subject，审批不继承，来源换版即使余额相同也需重新评估。
- open/MFA 前后和 IO 前检查相同当前上下文、原期限及所有来源绑定；稳定发布者锁覆盖实际预留/fsync/IO。等待锁后重新采样时钟，不能用请求开始时间延长原有效期。原 Proposal/snapshot 一次性 claims、C11/kill 和原 generation 保持。
- 匹配恢复不关闭原 OPEN；UNKNOWN 仍仅 GET 恢复并保留原 books/签名/claims，不补发、不重新预留、不推断已成交。已知财务来源/持久 anchor 的旧空账本入口不可通过删源/冷恢复回退。
- Terminal 展示账户核对原因、版本、OPEN 和原期限，验证 Subject/Command 的 books 一致。API 1.29.0、150 操作/167 schema、生成客户端/输入策略/PRE-04 948 字段同步。

## 冻结测试命令与结果

总入口 `node scripts/core-x02-books-risk-review.mjs --run`：20/20 符合预期，343.644 秒；完整命令、时刻、exit、日志 hash 见 [executions.json](attempt-01/executions.json)。运行采用白名单环境，不加载私有 dotenv、生产凭据或实际数据库。

| 命令/检查 | 本轮结果 |
| --- | --- |
| `cargo test --locked --offline -p quantos-execution --test core_x02_source --test core_l04` | 32 + 13 PASS；签名/原规则/期限/来源与拒绝/审批及恢复 |
| `cargo test --locked --offline -p quantos-reconcile --test current_join` | 22 PASS；当前投影、OPEN 不关闭与冷恢复 |
| `cargo build --locked --offline -p bff-gateway -p execution-gateway --message-format=json` | PASS；使用实际输出可执行文件，两个二进制 hash 封存 |
| `cargo test --locked --offline -p bff-gateway --test core_l04 books_risk -- --nocapture --test-threads=2` | 7 PASS / 24 filtered；实际本机进程，具名结果如下 |
| `cargo test --locked --offline -p bff-gateway --test core_l04 -- --skip books_risk --test-threads=2` | 24 PASS / 7 filtered；共用审批/IO/恢复入口改变的直接回归，不递归上游 |
| `pnpm exec vitest run` + executions.json 内列出的 8 个文件 | 8 文件 / 103 PASS；Terminal 模型及契约 |
| `node --test scripts/core-x02-books-risk-review.test.mjs scripts/development-execution.test.mjs` | 89 PASS / 0 fail / 0 skipped |
| Terminal typecheck、两份计划、generated、PRE-04、X05 no-submit、五 crate fmt/clippy、当前文件 ESLint | 全部 PASS |
| `node scripts/development-execution.mjs --integration CORE:X02` | 预期 exit 1 / STAGE_NOT_READY，未授予集成通过 |
| `node scripts/development-execution.mjs --release CORE:X02` | 预期 exit 1 / USE_FROZEN_RELEASE_ACCEPTANCE_GATE，未授予发布通过 |
| X02 DEVELOPMENT / 下一 X06 DEVELOPMENT 入口 | 两者允许当前开发，不等于运行时准入 |
| 当前改动/证据 gitleaks 8.28.0 + 实际随机 canary | 108 文件，0 未审查 finding；反例实际拒绝 1，不接触生产秘密 |
| `node docs/audit/evidence/core-x02-books-risk-local-20261030/verify.mjs` | PASS_CURRENT_BOOKS_RISK_FUNCTION_ONLY；只读复核，不重新执行历史链 |

7 项 BFF 测试包含 10 个独立 owner 参考场景域，不能换算为原 50 授权旅程或 200 venue：

1. [accepted.json](attempt-01/accepted.json)：当前合格 books → 新签名风险/新独立双审批/实际第二次 ETH IO；独立签名原文、来源证书及 Decision/Subject/Command books 一致。显式新账单核对两笔成交匹配；冷恢复不改原命令、签名/generation0/claims，重复 POST 拒绝。
2. [review.json](attempt-01/review.json)：缺源 signed Deny；v1 合格后一次审批，v2 换版第二次审批 409；同 Proposal 新 Subject 零审批，原 key 不改绑。
3. [open.json](attempt-01/open.json)：独立签名账单三类差异 signed Deny；显式 v2 修正为 MATCHED 后，原三条 OPEN 仍 signed Deny。Alert 未 ack/关闭，C10 同源，claims 不变。
4. [io-refusal.json](attempt-01/io-refusal.json)：已完成当前独立审批后，版本、签名、财务差异、账户范围四类变化在 IO 前拒绝（409/503）；各域只有原 seed IO，新当前 IO 为 0，claims 不增。
5. [unknown.json](attempt-01/unknown.json)：实际第二次 IO 暂停期间另一个发布者取不到锁；BFF 死亡后才能发布 v2。丢回复命令仅 GET 恢复 UNKNOWN，原 v1 books/generation0/claims 不变；账单声称已成交仍仅 1 已知入账/1 隔离/3 OPEN，无补发/自动关闭。
6. [legacy.json](attempt-01/legacy.json)：旧空账本入口遇已知源拒绝；删除源后冷恢复仍由持久 anchor 拒绝，0 IO。
7. [wait.json](attempt-01/wait.json)：请求实际等待发布锁跨过原 2 秒账单期限，解锁后决定时刻已过原截止，signed BOOKS_SOURCE_STALE Deny，无 Subject。

直接回归日志中的受控 Unavailable 为已有失败注入的预期输出，测试本身 24/24 通过。当前没有全仓/递归上游、三轮构建、F05/F07 campaign 或数据库写入。

## 原失败、历史与验收边界

[preflight-index.json](preflight-index.json) 保存全部未冻结诊断/hash，范围 UNFROZEN_DIAGNOSTICS_NOT_CURRENT_ACCEPTANCE。其 GITHUB_SHA 为原基线，只满足参考服务 Git 格式检查，不是当前冻结证明。初次直接回归 **27 PASS / 2 FAIL** 原日志 [direct-regression-01.log](preflight/direct-regression-01.log) 保留：一处 fixture 重复发布 version1，另一处 C11 启停计数准备不一致；修正准备后受影响 5 项通过，当前冻结两组 7+24 全部通过。较早编译配置、schema 缩进、旧规则数量、测试准备顺序及脚本解析等诊断记录见 [observations.json](preflight/observations.json)，不擦除、不改绑 PASS。

历史 L4 的 1511 输入/38 文件在原 baa1efdbd13641957b18cbe3483900955f86afb6 下原始 Git blob/hash 复核；当时“books 有差异仍 ApprovalRequired”的缺口反例保留 ORIGINAL_SCOPE_ONLY，不重跑旧 Gate 或改写历史结果。

当前功能实现完成、本机受控组合通过；计划状态 IMPLEMENTED_PENDING_ACCEPTANCE，正式确认仍 PENDING_USER_REVIEW / approval=null / selfApproved=false，见 [完整验收文稿](review-draft.md)。原历史签名/无 books Command 字段不回填；旧无 books 未执行当前 Subject 必须新评估。原未配置/未观察财务状态的空账本 reference seed 仅保留既有起步范围，不是 books-bound 当前批准或实际资金初始化。

未决风险/NOT_RUN：真实独立 venue/账户全集/资金/市场/R01/Research/R04、实际身份/MFA、Supabase/Vault/RLS、多账户跨主机和外部单调锚、异步成交/非报价费/FX/外部资金流/负债/open-order budgets、独立财务义务审查与通知/关闭、安全容量长稳/同 SHA CI/发布、当前浏览器及人工无障碍。合作发布者锁仅保护单主机且需遵守协议，不抵抗 owner 绕过锁/整体目录回滚/换钥；不得反向持锁等待估值/审批。fullBooksReady/dayCloseAllowed/executionAuthority 仍 false。UNKNOWN 和原 generation、OPEN 义务保留；没有放宽限额、生产凭据、实际 testnet、push/部署/外部发布。

下一可执行任务：**CORE:X06 DEVELOPMENT / L4-FINANCIAL-OBLIGATION-REVIEW-01**，接独立授权的当前同源财务义务审查与 append-only disposition，区分原 OPEN 事实与当前阻塞，不因 MATCHED 自动关闭/一次 ack 放行；UNKNOWN 不因外部账单被解除，不改原 generation，不补发。

## 变更文件

源码冻结提交包含 79 个变更文件。业务、测试、合同、计划、规程及门禁清单如下；本目录 preflight/hash/验收文稿/verify 及本次 attempt 原始文件逐个路径和 hash 见 result.json（63 项），证据封存还包括 result.json 和本 README。

- `apps/terminal/src/assisted/risk-review-panel.tsx`
- `apps/terminal/src/assisted/risk-review.ts`
- `apps/terminal/src/assisted/runtime.ts`
- `apps/terminal/tests/core-l03-fixture.ts`
- `apps/terminal/tests/current-native-execution.test.ts`
- `apps/terminal/tests/current-native-review.test.ts`
- `apps/terminal/tests/native-review-fixture.ts`
- `bff/openapi/quantos-bff.v1.yaml`
- `crates/quantos-execution/src/assisted_execution.rs`
- `crates/quantos-execution/src/assisted_source/native_refresh.rs`
- `crates/quantos-execution/tests/core_x02_source.rs`
- `crates/quantos-execution/tests/support/books_risk_cases.rs`
- `crates/quantos-execution/tests/support/native_refresh_cases.rs`
- `crates/quantos-portfolio/src/books_risk.rs`
- `crates/quantos-portfolio/src/lib.rs`
- `crates/quantos-reconcile/src/current.rs`
- `crates/quantos-reconcile/tests/support/account_books.rs`
- `crates/quantos-risk/src/guard/native.rs`
- `crates/quantos-risk/src/rules.rs`
- `docs/SumAlpha-QuantOS-Development-Plan.md`
- `docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md`
- `docs/execution/PRE-01-page-api-coverage-register.md`
- `docs/execution/PRE-04-contract-ledger.md`
- `docs/execution/PRE-04-field-dictionary.md`
- `docs/execution/PRE-04-inventory-baseline.json`
- `docs/execution/core-x02-books-risk-scope.json`
- `docs/operations/core-x02-books-risk-admission.md`
- `package.json`
- `packages/api-client/src/bff-gen/quantos-bff.ts`
- `packages/api-client/src/bff-gen/quantos-bff.zod.ts`
- `scripts/check-x05-no-submit.py`
- `scripts/core-x02-books-risk-review.mjs`
- `scripts/core-x02-books-risk-review.test.mjs`
- `services/bff-gateway/src/assisted.rs`
- `services/bff-gateway/src/assisted/persistence.rs`
- `services/bff-gateway/src/assisted/reconciliation.rs`
- `services/bff-gateway/src/assisted/risk_refresh.rs`
- `services/bff-gateway/src/generated-input-policy.json`
- `services/bff-gateway/tests/core_l04.rs`
- `services/bff-gateway/tests/support/account_books.rs`
- `services/bff-gateway/tests/support/account_books_gate.rs`
- `services/bff-gateway/tests/support/books_risk.rs`
- `services/bff-gateway/tests/support/books_risk_legacy.rs`
- `services/bff-gateway/tests/support/current_execution.rs`
- `services/bff-gateway/tests/support/current_gate.rs`
- `tests/contract/books-risk-admission.test.ts`
- `tests/contract/generated/quantos-bff.components.schema.json`
- `tests/contract/generated/quantos-bff.msw.ts`
- `tests/contract/generated/quantos-bff.operations.json`
