# CORE:X06 / L4-FINANCIAL-OBLIGATION-REVIEW-01

2026-10-30：当前功能工程 Gate **PASS_CURRENT_INDEPENDENT_APPEND_ONLY_FINANCIAL_REVIEW_RISK_RECHECK_C10**，机器结果 **PASS_CURRENT_FINANCIAL_REVIEW_FUNCTION_ONLY**。代码、合同、测试、规程与两份计划已同步；只代表 owned reference 功能及本机受控组合。完整 L4 **NOT_READY_GAPS_OPEN** / stage **NOT_ASSESSED** / formalAccepted=false / runtimeAdmission=DENIED / M5 PREPARED_NOT_READY，19 gap / 8 义务仍 OPEN，159 阶段与原目标分母不变。

源码冻结 **2b369ff0bea0fb391c4fcf9aa12e8536155ef70a**，基线 6816ee8299a48fdd27de8ceaedea782852145336。本轮确有 runtime 改动；之后的证据封存提交只保存结果与本摘要，不把通过改绑为封存提交源码。[result.json](result.json) 绑定 **2040 个输入、85 个原始文件和21项具名执行**，inputDigest `9d3d3777200fda18183d8a05d03cfdda9398f215b5c7e52430e758cb41713471`；实际二进制 hash 见 [binaries.json](attempt-01/binaries.json)。源代码 Git blob、输入、原始执行日志/hash、审查记录链、证明消费摘要和结果分别可复核。

## 实现与边界

- 新增 X06 append-only financial review journal。Operator 显式发起、不同 actor/user 的 Approver 复核、另一 Owner 再授权，各自本会话 MFA；一次 ack、一次复核或账单匹配没有解除阻塞的权限。Owner/Approver 可显式追加 retain_block，前面的历史授权记录保留。
- 所有动作绑定服务端当前 raw books、完整历史 OPEN 集合、scope/source/hash/version/ledger/覆盖/原期限和 kill generation，CAS 与 proof 消费同一认证事务提交，生成共同 C10。还钉住三方注册会话 revision 与原窗口；重登记/撤销不能复活旧授权。
- 只接受当前核对已匹配、零 UNKNOWN 的三类已修正账户财务差异，最多128条；协议、UNKNOWN、其他来源义务仍不可审查绕过。原 OPEN 状态、count/hash、Alert 与原 generation/Command/签名/claims 不改写。
- 有效审查成为 optional financialReview，供显式新 X02 风险、新 Subject 和 IO 前精确复核引用。原15项风险规则/额度不变，仍须独立订单双审批；来源/generation/义务变化、显式撤销或到期恢复阻塞。新风险并不继承旧审批，也不授权重复 Proposal/snapshot。
- P23 新增显式审查、历史和原请求手动恢复；风险页校验 financialReview/原义务/generation/期限及 Subject/Command 一致。API1.30.0 / 155操作 / 172schema、C16 catalog、生成客户端/输入策略及 PRE-04 1002字段同步。Paper/Shadow ack 与 Assisted 只读 Alert 限制保持。

## 冻结命令与结果

总入口 `node scripts/core-x06-financial-review.mjs --run`（包入口 `pnpm assess:core-x06-financial:local`）执行 **21/21符合预期，451.778秒**。完整命令、时刻、exit、signal及日志 hash 见 [executions.json](attempt-01/executions.json)。采用白名单环境，无私有 dotenv、生产凭据、实际数据库或外部服务。

| 当前命令/检查 | 结果 |
| --- | --- |
| `cargo test --locked --offline -p quantos-execution --test core_x02_source --test core_l04` | 34 + 13 PASS：签名风险、原规则/限额/窗口及当前来源/审批/恢复 |
| `cargo test --locked --offline -p quantos-reconcile --test current_join --test financial_review` | 22 + 10 PASS：对账投影、完整义务/独立用户/角色/期限/篡改/追加历史 |
| `cargo test --locked --offline -p bff-gateway --lib financial_review` | 1 PASS：注册会话 revision 变化/撤销后不能复活审查；286无关项 filtered |
| `cargo build --locked --offline -p bff-gateway -p execution-gateway --message-format=json` | PASS；使用实际 Cargo 产物，两个二进制 hash 封存 |
| `cargo test --locked --offline -p bff-gateway --test core_l04 financial_review -- --nocapture --test-threads=2` | 6 PASS / 31 filtered；当前本机实际进程 |
| `cargo test --locked --offline -p bff-gateway --test core_l04 -- --skip financial_review --test-threads=2` | 31 PASS / 6 filtered；共用审批/持久化/IO/kill/C11/恢复路径的直接回归 |
| `pnpm exec vitest run` + executions.json 的12个具名文件 | 176 PASS / 12文件；包含财务审查、风险与命令、Alert/P23模型、当前合同 |
| `node --test scripts/core-x06-financial-review.test.mjs scripts/development-execution.test.mjs` | 85 PASS / 0 fail / 0 skipped |
| Terminal typecheck、两份计划、generated、PRE-04、X05 no-submit、五 crate fmt/clippy、当前文件 ESLint | 全部 PASS；no-submit 新覆盖纯 financial_review 模块 |
| `node scripts/development-execution.mjs --integration CORE:X06` | 预期 exit1 / STAGE_NOT_READY；未授予集成通过 |
| `node scripts/development-execution.mjs --release CORE:X06` | 预期 exit1 / USE_FROZEN_RELEASE_ACCEPTANCE_GATE；未授予发布通过 |
| 当前 X06 DEVELOPMENT、下一 CORE-GATE:L4 DEVELOPMENT | 允许当前开发，不等于运行准入 |
| gitleaks 8.28.0 当前改动/证据扫描 + 随机实际 canary | 128文件，0未审查finding；反例实际拒绝1，未使用生产秘密 |
| `node docs/audit/evidence/core-x06-financial-review-local-20261030/verify.mjs` | PASS_CURRENT_FINANCIAL_REVIEW_FUNCTION_ONLY；只读复核，未重跑历史链 |

共117项Rust测试（含37项BFF进程场景）、176项消费者/合同与85项门禁测试。六项新BFF测试覆盖九个独立owner参考场景域，不换算成原50授权旅程、200venue或目标演练分母；没有全仓/上游递归、三轮构建、数据库写入或F05/F07 campaign。

直接回归日志的受控 Unavailable 来自既有失败注入；该命令实际 exit0、31/31通过，不把注入输出另记为生产错误或忽略未通过测试。

## 当前具名证据

1. [accepted.json](attempt-01/accepted.json)：当前三类差异修正后仍3 OPEN；三名独立actor/user的 request/endorse/authorize、proof消费摘要和完整记录 hash 链 → 显式新签名风险/新Subject/独立订单审批 → 实际第二次ETH IO。Command绑定原 financialReview/generation0，原seed事实不变。独立新账单匹配两笔成交后，旧审查不再适用但原3 OPEN仍保留；冷恢复不改原Command，重复提交拒绝。C10三事件同源。
2. [auth.json](attempt-01/auth.json)：自审、跨会话MFA、重复proof/原key不同body拒绝；两个副本竞争同一 revision/proof 只有一个成功。原key/body/If-Match回执恢复相同，journal仍三条，不重新授权。
3. [revocation.json](attempt-01/revocation.json)：已完成当前订单审批后，显式retain_block或独立来源换版，旧Subject的IO均409，claims不增；显式新风险重新Deny，原OPEN为3，历史不删。两域均只有原seed IO。
4. [recovery.json](attempt-01/recovery.json)：审查/证明消费已fsync、HTTP回执未返回时杀死BFF；冷恢复原授权回执，只有三条记录。篡改已认证外层存储中的内层记录，校验503，未生成额外IO。
5. [unknown.json](attempt-01/unknown.json)：实际当前ETH IO丢回复，独立账单声称成交；仍UNKNOWN、原books/generation0/签名/claims、1已知入账/1隔离/3 OPEN。当前不可审查，发起409，冷读取不补发或关闭。
6. [freshness.json](attempt-01/freshness.json)：未完成case在来源换版、公共kill generation变化或原2秒期限到达后续审均409；原case/generation0历史保留，无法换绑新来源或延长原期限。

这些是临时证书、参考身份/资金/mark、单主机受限进程证明。成功参考流由Operator发起；当前配置仅一名Owner，Owner自己发起仍需另一Owner，不能自批。实际金融/身份和目标权限不由参考角色推导。

## 失败、历史与未决风险

[preflight-index.json](preflight-index.json) 保存48个未冻结诊断文件及hash，范围 UNFROZEN_DIAGNOSTICS_NOT_CURRENT_ACCEPTANCE。诊断GITHUB_SHA来自原基线，仅满足参考Git格式检查，不能充当当前源码验收。

原失败保留：首轮0/4（新接口合同归属误入通用写入门禁，修正为C16所属BFF-FE-010并保留独立领域授权）；第二轮1/4（三项测试重复读取已消费seed trace，改为验证无新增IO）；之后6/6通过。初次编译依赖、类型收窄、消费者重复变量、lint/clippy提示与修复见 [observations.json](preflight/observations.json) 和原日志，不擦除失败或伪造缺失的原始日志。当前冻结结果独立于这些诊断。

历史X02的2005输入/63文件在原 fbfed8c4dc7d3bc4613db69ded05bdf2afda824f 的Git blob/hash范围复核，ORIGINAL_SCOPE_ONLY；原零未审查义务规则及此前Deny反例保留，不重跑旧Gate或改绑旧PASS。旧无financialReview字段的风险/签名/Command保持原序列化事实。

未决风险/NOT_RUN：真实独立venue/金融/账户全集/资金/市场/R01/Research/R04、实际IdP/MFA、Supabase/Vault/RLS、跨主机及外部单调锚、异步成交/非报价费/FX/外部资金流/负债/open-order budgets、非财务/协议/UNKNOWN义务处置、外部通知和明确源关闭、目标安全容量长稳/同SHA CI/发布、当前浏览器及人工无障碍。合作发布者锁不抵抗owner绕过协议/换钥/整体目录回滚；参考账单最多30秒不是实际处理SLA。fullBooksReady/dayCloseAllowed/executionAuthority均false；没有生产凭据、实际testnet、push/部署/外部发布、补发、自动关闭或额度放宽。

计划状态 IMPLEMENTED_PENDING_ACCEPTANCE；正式确认 PENDING_USER_REVIEW / approval=null / selfApproved=false，完整 [验收文稿](review-draft.md) 已拟定，未自行批准。下一 **CORE-GATE:L4 DEVELOPMENT**：评估独立财务审查加入后的当前组合与剩余缺口，保留原UNKNOWN/generation/OPEN历史及全部未验收义务。

提交前自动审批曾拒绝全量暂存方式；核对main基线与工作区后，已改为明确本任务文件清单暂存并完成源码提交，无未决审批阻塞。

## 变更文件

源码提交99个变更文件；业务、测试、合同、计划、规程和门禁文件如下。证据目录逐个路径/hash见result.json（85项原始文件），另含result.json与本README；后续封存提交不修改测试源码输入。

- `apps/terminal/app/alerts/workspace.tsx`
- `apps/terminal/src/alerts/financial-review-panel.tsx`
- `apps/terminal/src/alerts/financial-review.ts`
- `apps/terminal/src/assisted/risk-review-panel.tsx`
- `apps/terminal/src/assisted/risk-review.ts`
- `apps/terminal/tests/current-native-review.test.ts`
- `apps/terminal/tests/financial-review.test.ts`
- `bff/openapi/quantos-bff.v1.yaml`
- `bff/page-operation-catalog.yaml`
- `crates/quantos-execution/src/assisted.rs`
- `crates/quantos-execution/tests/support/books_risk_cases.rs`
- `crates/quantos-execution/tests/support/native_refresh_cases.rs`
- `crates/quantos-portfolio/src/books_risk.rs`
- `crates/quantos-reconcile/Cargo.toml`
- `crates/quantos-reconcile/src/current.rs`
- `crates/quantos-reconcile/src/financial_review.rs`
- `crates/quantos-reconcile/src/lib.rs`
- `crates/quantos-reconcile/tests/financial_review.rs`
- `crates/quantos-risk/src/guard/native.rs`
- `docs/SumAlpha-QuantOS-Development-Plan.md`
- `docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md`
- `docs/execution/PRE-01-page-api-coverage-register.md`
- `docs/execution/PRE-04-contract-ledger.md`
- `docs/execution/PRE-04-field-dictionary.md`
- `docs/execution/PRE-04-inventory-baseline.json`
- `docs/execution/PRE-04-openapi-gap-list.md`
- `docs/execution/core-x06-financial-review-scope.json`
- `docs/operations/core-x02-books-risk-admission.md`
- `docs/operations/core-x06-financial-review.md`
- `package.json`
- `packages/api-client/src/bff-gen/quantos-bff.ts`
- `packages/api-client/src/bff-gen/quantos-bff.zod.ts`
- `scripts/check-x05-no-submit.py`
- `scripts/core-x06-financial-review.mjs`
- `scripts/core-x06-financial-review.test.mjs`
- `services/bff-gateway/src/assisted.rs`
- `services/bff-gateway/src/assisted/financial_review.rs`
- `services/bff-gateway/src/assisted/persistence.rs`
- `services/bff-gateway/src/assisted/risk_refresh.rs`
- `services/bff-gateway/src/generated-input-policy.json`
- `services/bff-gateway/tests/core_l04.rs`
- `services/bff-gateway/tests/support/books_risk.rs`
- `services/bff-gateway/tests/support/financial_review.rs`
- `tests/contract/financial-review.test.ts`
- `tests/contract/generated/quantos-bff.components.schema.json`
- `tests/contract/generated/quantos-bff.msw.ts`
- `tests/contract/generated/quantos-bff.operations.json`
