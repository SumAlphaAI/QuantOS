# CORE-GATE:L4 DEVELOPMENT：账户与 R01 双来源当前组合评估

main基线2ead32de186d85e443856453572efc002d24a2f8；冻结源码 **96b2e3b68d769ccd58199539e7211fb76fe14bf2**，当前具名成功执行 **attempt-01**。本轮只增测试、评估、门禁与文档；38关键运行时/Terminal/API文件逐字节绑定最新X01，API1.33.0/160 operations/180 schemas、PRE-04 1100字段行不改。测试helper只改可见性。

工程Gate **PASS_L4_ACCOUNT_AND_R01_DUAL_SOURCE_CURRENT_COMPOSITION_AND_GAP_ASSESSMENT**；DEVELOPMENT评估COMPLETED_CURRENT_SCOPE。完整Gate **NOT_READY_GAPS_OPEN** / stage NOT_ASSESSED / formalAccepted=false / runtimeAdmission=DENIED / M5 PREPARED_NOT_READY；19gaps/8规划义务OPEN、159规范阶段及200venue/50授权旅程/4目标演练原分母与风险限额不变，fullBooksReady/dayCloseAllowed/executionAuthority=false。

## 当前业务事实

- 独立批准账户Opening/status与R01/F03 mark由不同用途、证书和公钥分别认证，绑定相同精确raw输入、原Opening、当前账本和风险Snapshot。原3财务+1来源OPEN，来源健康三人审查单独仍签名Deny，另行独立财务审查后才接新风险/同一Proposal新Subject/独立订单双MFA。C11关闭拒绝且claims不变，version2后实际loopback mTLS/native ETH IO，X01两笔已知入账与独立BTC1/ETH1/cash7999.98/fees0.02 books匹配，原4 OPEN/C10保留。
- 原命令跨公共全局/账户kill、独立解除、C11到4与冷恢复，原generation0/两个来源证明/两域授权/签名/claims不变。当前generation4重新两域审查及连续账户/R01产物均version2，原Opening hash/USDT10000不改，原BTC/ETH各1100 mark下集中度签名Deny，无新Subject；原请求再次执行拒绝，无第三IO/预留，不调价/限额以强求ApprovalRequired。
- 另一独立fixture实际双来源ETH提交后BFF死亡；独立books声称成交仍只查询UNKNOWN。公共控制到2/C11到4和冷恢复后，1已知入账/1隔离/7 OPEN（原4+3 UNKNOWN相关）、原generation0/账户与market证明/两域授权/签名/claims保持，两个新审查入口拒绝，无可用估值，不补发或自动关闭。
- 新发现cash-only首次入口缺口：一个独立新fixture从未成交，0已知入账/0隔离/无持仓、generation0；独立账户Opening10000/basis/status与独立签名books有效。R01空ticks产物构建拒绝；有效且质量通过的BTC tick又无对应持仓，公共valuation503、合法UUID幂等键的risk-review503/无Subject，冷恢复仍503。没有native claim/订单/IO，不用参考seed或假mark/持仓启动。

空仓场景X05顶层协议观察MATCHED_OBSERVATIONS只说明无执行增量，账户核对层为LOCAL_OPENING_BASIS_UNAVAILABLE、comparisonReady=false/basisHash=null。1条ACCOUNT_BOOKS_BASIS_UNAVAILABLE OPEN冷恢复保留；领域coverage函数分类blocked1/financial0/sourceHealth0，两种审查不可用。不能把协议MATCHED当财务匹配，也不能把basis OPEN归为STALE或自动关闭。API可省略可选coverage字段，本评估保存领域函数实际分类结果。

3项具名进程场景中，成功和UNKNOWN各有2次实际loopback协议IO；cash-only为**执行过的拒绝场景、protocol IO=0，未计成功交易**。全新fixture使用独立临时目录/owner状态/证书，逻辑UUID沿用测试值；没有读取、清空、重置已知/UNKNOWN场景的4/7 OPEN或账本，不能据此重置实际账户。

旧“账户来源桥接未实现”只保留原SHA事实，当前owned桥接已实现并组合验证；签名/批准证据不证明真实venue资金、live许可、账户全集或运行权限。整体sourceTrust仍owner参考边界，accountProvenance单独说明认证产物范围。

## 测试、命令与证据

运行 `node scripts/core-l4-dual-source.mjs --run --attempt=attempt-01`；只读 `node docs/audit/evidence/core-l4-dual-source-local-20261030/verify.mjs`。

**16项具名检查全部符合预期，3条当前组合通过，133项Gate/执行边界测试通过、0跳过。** 构建/Clippy/fmt/ESLint、计划/生成/清单/no-submit、秘密扫描及随机canary通过；INTEGRATION/RELEASE为预期拒绝，不是联调/发布通过。运行时/UI不改，不递归重跑上游、全仓或F05/F07；旧X01149Rust/277消费者/115Gate不改绑本轮，浏览器/人工无障碍NOT_RUN。

[result.json](./result.json) 绑定 **1964输入 / 46原始及说明文件**、Git blob/hash、实际二进制及具名日志hash。[accepted](./attempt-01/accepted.json)、[unknown](./attempt-01/unknown.json)、[gap](./attempt-01/gap.json) 包括两个来源签名/公钥分离/批准/Opening/raw/Snapshot hash、独立签名books、两域journal/proof/C10、原Command/claims/OPEN及fresh空仓实际拒绝；verifier独立核对并拒绝零/漏执行、历史改绑、资金信任提升和basis义务改类。

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| development | `node scripts/development-execution.mjs --development CORE-GATE:L4` | PASS |
| assessment | `node scripts/core-l4-dual-source.mjs --audit` | PASS |
| build | `cargo build --locked --offline -p bff-gateway -p execution-gateway --message-format=json` | PASS |
| composition | `cargo test --locked --offline -p bff-gateway --test core_l04 dual_source_gate:: -- --nocapture --test-threads=2` | PASS |
| gate-tests | `node --test scripts/core-l4-dual-source-assessment.test.mjs scripts/development-execution.test.mjs` | PASS |
| plans | `node scripts/check-development-plans.mjs` | PASS |
| generated | `node scripts/check-bff-generated.mjs` | PASS |
| inventory | `node scripts/pre04-inventory.mjs` | PASS |
| no-submit | `python3 scripts/check-x05-no-submit.py` | PASS |
| format | `cargo fmt -p bff-gateway -- --check` | PASS |
| clippy | `cargo clippy --locked --offline -p bff-gateway --all-targets --no-deps -- -D warnings` | PASS |
| lint | `pnpm exec eslint scripts/core-l4-dual-source-assessment.mjs scripts/core-l4-dual-source.mjs scripts/core-l4-dual-source-assessment.test.mjs` | PASS |
| integration-refusal | `node scripts/development-execution.mjs --integration CORE-GATE:L4` | PASS：预期拒绝 exit 1 |
| release-refusal | `node scripts/development-execution.mjs --release CORE-GATE:L4` | PASS：预期拒绝 exit 1 |
| next-development | `node scripts/development-execution.mjs --development CORE:X01` | PASS |
| secret-scan | `node scripts/core-l4-dual-source.mjs --scan docs/audit/evidence/core-l4-dual-source-local-20261030/attempt-01` | PASS |

## 历史与未决风险

最新X01源码5da60187684f60861f3f0409034fd50bf366a267的2069输入/74原始文件按原Git blob/hash和ORIGINAL_SCOPE_ONLY核验，原149/277/115、preflight失败、发布性能ignored及其他NOT_RUN不改绑。preflight全部UNFROZEN_DIAGNOSTICS_NOT_CURRENT_ACCEPTANCE，见[索引](./preflight-index.json)、[诊断说明](./preflight/diagnostic-notes.json)：保留非法测试幂等键422、错误零告警预期、可选coverage字段假设失败，随后合法请求503、1 OPEN及真实blocked分类通过。不覆盖失败，不以诊断替代冻结结果。

cash-only来源与verified basis首次登记尚未接通。真实资金/状态/live来源/账户全集/Research/R04/IdP/MFA/Supabase/Vault/RLS/outbox/跨主机/外部单调锚、真实venue/异步成交/FX/非报价币费用/外部流/负债/在途预算/日切、通知/源关闭、目标安全容量长稳同SHA CI/发布及人工浏览器仍未验收或NOT_RUN。正式确认只有[待确认文稿](./review-draft.md)，未自行批准；无生产凭据、推送、部署或外部发布。

下一 **CORE:X01 DEVELOPMENT / L4-CASH-ONLY-VALUATION-01**：支持批准账户Opening/status的无持仓估值与当前风险来源，持仓存在时仍严格要求R01；不虚构mark/持仓/参考seed、不重基准现金/预算、不重置generation/UNKNOWN。原BASIS_UNAVAILABLE OPEN仍blocked，不扩审查范围或自动关闭以强求ApprovalRequired；来源修复后的风险仍可正确Deny，独立处置义务另评估。

见[机器评估](../../../execution/core-l4-dual-source-assessment-20261030.json)、[规程](../../../operations/core-l4-dual-source-assessment-20261030.md)。

## 变更文件（11，另本目录证据）

- [docs/SumAlpha-QuantOS-Development-Plan.md](../../../../docs/SumAlpha-QuantOS-Development-Plan.md)
- [docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md](../../../../docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md)
- [docs/execution/core-l4-dual-source-assessment-20261030.json](../../../../docs/execution/core-l4-dual-source-assessment-20261030.json)
- [docs/operations/core-l4-dual-source-assessment-20261030.md](../../../../docs/operations/core-l4-dual-source-assessment-20261030.md)
- [package.json](../../../../package.json)
- [scripts/core-l4-dual-source-assessment.mjs](../../../../scripts/core-l4-dual-source-assessment.mjs)
- [scripts/core-l4-dual-source-assessment.test.mjs](../../../../scripts/core-l4-dual-source-assessment.test.mjs)
- [scripts/core-l4-dual-source.mjs](../../../../scripts/core-l4-dual-source.mjs)
- [services/bff-gateway/tests/core_l04.rs](../../../../services/bff-gateway/tests/core_l04.rs)
- [services/bff-gateway/tests/support/account_state.rs](../../../../services/bff-gateway/tests/support/account_state.rs)
- [services/bff-gateway/tests/support/dual_source_gate.rs](../../../../services/bff-gateway/tests/support/dual_source_gate.rs)

本目录精确原始清单/hash见result.files；README为封存导航，排除候选输入与raw闭包，避免自引用，不改变冻结源码。
