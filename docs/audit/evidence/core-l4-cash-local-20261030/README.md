# CORE-GATE:L4 DEVELOPMENT：cash-only 与双来源当前组合

**PASS_CURRENT_CASH_ONLY_AND_DUAL_SOURCE_COMPOSITION_ASSESSMENT_ONLY**。冻结源码 `d58c3cb0b8c9ccb3556009edc0283b10349b7e62`，main，基线 `9b9628ce3d9ce631316eb3607148c90cd6d59719`。见[当前结果](./result.json)、[机器评估](../../../execution/core-l4-cash-assessment-20261030.json)、[规程](../../../operations/core-l4-cash-assessment-20261030.md)、[变更文件清单](./attempt-01/changed-files.json)。README不计入自身输入/原始文件hash，避免自引用；封存提交不改变源码结果范围。

## 当前执行与剩余缺口

当前6条具名公共HTTP/BFF/mTLS/native进程用例，按两个Cargo过滤器实际运行，均0 failed/ignored：

| 用例 | 当前实际结果 |
|---|---|
| 双来源已知成功/两域独立审查/控制/C11/冷恢复 | 2次实际owned协议IO、2已知入账/4 OPEN、独立books匹配；原generation0/账户与R01证明/签名/claims不变，公共控制当前4/C11到4。原1100 mark和限额下新评估仍集中度Deny，无第三IO或新预留 |
| 双来源实际丢响应UNKNOWN | 原2次IO后1已知/1隔离/7 OPEN，原generation0/证明/claims保留，当前控制2/C11到4；两域新审查拒绝，无可用估值，不补发 |
| 原basis OPEN保留的cash-only | 认证原Opening10000/status形成当前无持仓Snapshot与同一Proposal新签名Deny；无R01 flag/policy/artifact/mark/参考成交，0 claims/IO。独立books账户层恢复MATCHED，原1条BASIS_UNAVAILABLE OPEN仍blocked=1/financial=0/sourceHealth=0、两域不可审查，冷恢复同key原决定不变 |
| 独立全新、从未产生basis OPEN的cash-only对照 | 原批准basis先于首次对账、独立books MATCHED、0 OPEN、ELIGIBLE_REFERENCE_BOOKS；同一ETH Proposal仍签名concentration Deny、无Subject/claim/IO，冷恢复同key原决定不变 |
| 现金来源拒绝 | 坏签名、缺产物、改raw现金、当前撤销及冷恢复旧head均拒绝，无缓存兜底 |
| 现金原截止 | 暖/冷过期拒绝，原来源与Snapshot历史不续期 |

原始回执：[accepted](./attempt-01/accepted.json)、[unknown](./attempt-01/unknown.json)、[cash](./attempt-01/cash.json)、[clean](./attempt-01/clean.json)、[refusal](./attempt-01/refusal.json)、[expiry](./attempt-01/expiry.json)。每个fixture为独立临时authority目录/证书/账本，测试UUID沿用固定样例值，不复用、删除或重置其他场景原历史；不是实际新开户或venue资金。

新对照明确区分两项独立拒绝：原basis历史义务仍不可审查；即使从未有该OPEN，现行 `GROSS_AFTER_CONSERVATIVE_ADDITIVE` 集中度规则下首个正notional单symbol占新增gross100%，当前政策仍Deny。当前cash-only估值/风险来源桥接已实现，旧“首次入口未接入”仅原SHA事实。不能把风险Deny当来源故障，不能因books恢复自动关闭OPEN、改分母/限额、合成持仓、参考成交、多腿承诺或假mark来求ApprovalRequired。是否支持初始组合准入及中间态/原子风险须另行策略范围，本次不授权。

两个cash-only零IO场景是已执行的估值/风险拒绝，不计成功交易；双来源分别含实际协议IO，未靠禁用传输制造拒绝。共同C10、X01原读投影去重及原payload hash继续覆盖，新增访问审计照常保留。

## 命令与证据绑定

仓库根目录：

```sh
node scripts/core-l4-cash.mjs --run --attempt=attempt-01
node docs/audit/evidence/core-l4-cash-local-20261030/verify.mjs
```

[17项实际命令/退出码/时间/日志hash](./attempt-01/executions.json)全部符合预期：15项exit0，INTEGRATION预期exit1/STAGE_NOT_READY、RELEASE预期exit1/USE_FROZEN_RELEASE_ACCEPTANCE_GATE。1991源码/输入、56原始及支持文件、实际Cargo emitted executable/hash封存；当前13个明确历史JSON fixture路径已在源码冻结前纳入清单，不以旧结果替代当前执行。

| 检查 | 当前结果 |
|---|---|
| 双来源组合 | 2 passed，62.381秒 |
| cash-only组合 | 4 passed，41.671秒 |
| Gate/开发阶段反例 | **159 passed /0 failed/skipped** |
| 当前build/Clippy/fmt/ESLint | PASS |
| 计划/生成物/PRE-04/no-submit | PASS |
| DEVELOPMENT当前/下一入口 | ALLOWED，阶段未提升 |
| 秘密扫描 | 当前任务diff/packet无发现，实际随机canary拒绝1次，gitleaks8.28.0/hash绑定 |

[输入](./attempt-01/inputs.json)、[二进制](./attempt-01/binaries.json)、[预检hash清单](./preflight-index.json)与[预检说明](./preflight/notes.md)保留原始范围。预检6场景与159反例虽通过，仍为UNFROZEN_DIAGNOSTICS_NOT_CURRENT_ACCEPTANCE，不替代冻结attempt-01。两次编辑/探针工具错误发生于正式验收前，未生成成功回执，说明保留。当前冻结attempt-01无失败。

本次9个代码/测试/计划文件：BFF cash_only新增一个独立对照测试，3个assessment/runner/Gate脚本，机器评估JSON、规程、两份开发计划及package入口；另26个预检/支持文件随源码提交。业务运行时、Terminal、API和审查/风险规则逐字节不变，38关键文件及整个业务树与最新X01基线绑定。API1.34.0 /160 operations /180 schemas、PRE-04 1100字段行不改。因此只运行本次6场景及直接静态/门禁，不递归最新X01157Rust/291消费者/102Gate、全仓、F05/F07或三轮构建。

历史X01源码3c85c7d1主2083输入+10fixture中8补充、去重2091输入/79文件/20检查以及预检失败、原性能ignored和其他NOT_RUN，均按原Git blob/hash作为ORIGINAL_SCOPE_ONLY保留，不改绑当前PASS。前次补充fixture工具仍仅其原执行范围。

## Gate、风险与下一任务

工程Gate **PASS_L4_CASH_ONLY_AND_DUAL_SOURCE_CURRENT_COMPOSITION_AND_GAP_ASSESSMENT**，DEVELOPMENT评估COMPLETED_CURRENT_SCOPE。完整Gate **NOT_READY_GAPS_OPEN** /stage NOT_ASSESSED /formalAccepted=false /runtimeAdmission=DENIED /M5 PREPARED_NOT_READY。19gaps/8规划义务仍OPEN，159阶段、原200venue/50授权旅程/4目标演练分母与限额不变，fullBooksReady/dayCloseAllowed/executionAuthority=false。正式确认仅[文稿准备](./review-draft.md)，未自行批准。

原basis OPEN不可审查、干净空仓首单的集中度Deny、实际资金/状态/账户全集/live许可R01/Research/R04/IdP/MFA/Supabase PostgreSQL/Vault/RLS/outbox/跨主机/外部锚/真实venue/FX/外部流/负债/在途预算/日切/通知/源关闭、安全容量长稳同SHA CI/发布及当前浏览器人工无障碍仍为未决或NOT_RUN。UNKNOWN/原generation/OPEN/来源heads/claims保留，无补发、自动关闭、扩审查或放宽限额。无生产凭据、远端推送、部署或外部发布。

下一可执行：**CORE:X06 DEVELOPMENT / L4-BLOCKED-OBLIGATION-EXPLAIN-01**，绑定当前source/ledger/generation/decision/obligation hash和原截止，提供只读阻断说明，区分恢复的books、原blocked OPEN/两域不可处置和独立集中度Deny。现有原始规则/通用“未审查事项”文案缺少这种同源解释；不加审批/处置/豁免按钮，不扩审查、关闭OPEN或改策略。独立basis处置或初始组合准入须另行范围与授权。
