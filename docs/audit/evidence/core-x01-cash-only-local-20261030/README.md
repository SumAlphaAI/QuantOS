# CORE:X01 DEVELOPMENT / L4-CASH-ONLY-VALUATION-01 当前功能证据

**PASS_CURRENT_AUTHENTICATED_CASH_ONLY_VALUATION_AND_RISK_SOURCE_ONLY**。冻结源码 `3c85c7d1c83f9ca88a365d7103ce9c050932fe2d`，main，基线 `86e8c0de5d089adf03b063a7d8ba9fc4d65b0680`。当前结果见[result.json](./result.json)、[20项命令/原始日志与退出码](./attempt-01/executions.json)、[完整变更文件清单](./attempt-01/changed-files.json)。本摘要不包含在自身源码/原始文件 hash 闭包中，避免自引用；证据封存提交不改绑源码结果。

## 实现与实际执行

- 当前真实无持仓 ledger、独立批准账户 Opening/status 专用签名形成 account-only Snapshot，现金/权益10000、gross/net/unrealized0、原PnL-5、generation0。无参考 seed、合成持仓、假 mark、R01 flag/policy/artifact或订单IO，marketProvenance缺省。实际账户/估值/风险模块绑定同一原 Proposal 后签名 Deny，无 Subject。原1条 BASIS_UNAVAILABLE OPEN仍 blocked，financial/sourceHealth均0，两域不可审查；独立books账户层虽恢复MATCHED也不关闭原OPEN。冷恢复相同幂等键返回原决定，原ledger/claims不变，protocolCalls=0是具名拒绝场景，不计成功交易。见[cash.json](./attempt-01/cash.json)。
- 坏签名、缺产物、改raw cash、当前撤销、冷恢复旧head均拒绝，不回退缓存；暖/冷过期查询保留原截止和历史Snapshot，不续期。见[refusal](./attempt-01/refusal.json)、[expiry](./attempt-01/expiry.json)。过期测试按实际原Snapshot截止等待，不延长风险限额。
- 领域验证 cash→held→flat→held，持仓须当前认证R01，平仓现金10199.98/realized194.98包含真实模型账本两笔费用，原Opening10000不重基准；R01原heads保持，撤销和旧产物再入持仓拒绝。UNKNOWN即使账面零持仓也不能形成可用Snapshot或追加现金来源。
- 当前双来源实际成功链仍2次loopback mTLS/native IO、2笔已知入账、原4 OPEN；公共kill/C11/冷恢复后原generation0及两份证明/claims保留，当前generation4原限额下集中度Deny，无第三IO。见[dual-accepted](./attempt-01/dual-accepted.json)。另一域实际ETH丢响应仍1已知/1隔离/7 OPEN，原generation0/账户与R01证明保留，两域审查均拒绝，无可用估值或补发。见[dual-unknown](./attempt-01/dual-unknown.json)。
- C10重复读取/冷恢复幂等回放现在只重建同一风险事件的内存投影，eventId唯一、payload hash原值不变；持久journal保留，并正常追加每次审计查询的audit.search_accessed事实。
- API1.34.0 /160 operations /180 schemas、PRE-04 1100字段行、6份生成物与Terminal一致。Terminal明确认证账户无持仓、不含市场权限，校验零positions/exposure/PnL、cash=equity、独立账户期限及前后绑定；冷Command保留原来源绑定。

30个代码/测试/计划文件包括portfolio估值/领域测试、BFF账户/估值/C10、cash_only公共测试与既有dual测试调整、Terminal风险/执行/展示及模型测试、OpenAPI/生成物/PRE-04、两份开发计划、机器范围、规程、runner/Gate测试与package入口。45个预检/支持文件随源码提交；全部路径见[清单](./attempt-01/changed-files.json)。旧cash-only拒绝测试被当前功能用例接续，其原SHA/历史包和失败事实仍在，未删除历史证据。

## 命令、数量与原始范围

在仓库根目录：

```sh
node scripts/core-x01-cash-only.mjs --run --attempt=attempt-01
node docs/audit/evidence/core-x01-cash-only-local-20261030/verify.mjs
node docs/audit/evidence/core-x01-cash-only-local-20261030/attempt-01/verify-consumer-fixtures.mjs
```

20项按顺序实际运行，全部符合预期：18项exit0，INTEGRATION预期exit1/STAGE_NOT_READY、RELEASE预期exit1/USE_FROZEN_RELEASE_ACCEPTANCE_GATE。源码主清单2083输入、79原始/支持文件、实际Cargo emitted binaries及SHA256绑定；75项BFF直接回归用时931.006秒。没有递归上游、全仓、F05/F07或三轮构建。

| 检查 | 当前实际结果 |
|---|---|
| portfolio账户/R01/估值领域 | 9+7+17=33 passed，0 failed/ignored |
| execution X02/L04领域 | 36+13=49 passed，0 failed/ignored |
| BFF core_l04共享估值/恢复/C10直接回归 | 75 passed，0 failed/ignored，含3条新公共场景与2条双来源组合 |
| 合计Rust | **157 passed** |
| Terminal/契约消费者 | **20文件291 passed**，受控响应模型，不授予浏览器或实际IO验收 |
| Gate/开发阶段反例 | **102 passed**，0 failed/skipped |
| build/typecheck/fmt/Clippy/ESLint | PASS |
| plans/generated/PRE-04/no-submit | PASS |
| 秘密扫描 | 当前任务diff与packet无发现；实际随机canary拒绝1次，工具8.28.0/hash绑定 |

另外在消费者执行前逐份核对10个历史JSON fixture的当前文件与上述源码Git blob/hash，主清单已含2个，补8个，去重共2091个输入。见[fixture锁定](./attempt-01/consumer-fixture-inputs.json)和独立只读[校验器](./attempt-01/verify-consumer-fixtures.mjs)；校验器还要求capture时间早于当前consumer.startedAt，且当前consumer实际exit0，实际返回PASS_CURRENT_CONSUMER_FIXTURE_INPUTS_BOUND_BEFORE_EXECUTION。这些仅为模型输入，不把其历史运行结果改绑为当前通过。补充校验器及清单纳入79原始/支持文件hash封存，两条只读命令均须通过。

[preflight-index](./preflight-index.json)保留所有未冻结失败和诊断。包括漏计费用预期、导入/编译问题、C10重复投影发现与查询访问事实比较、短初始期限被启动耗尽、模型未复制可选来源、lint与Gate反例错误；详见[原始说明](./preflight/notes.md)。未完成或未输出回执的预检不记PASS。当前冻结attempt-01无失败。历史L4 96b2e3b6的1964输入/46文件/16检查与更早X01/失败/ignored/NOT_RUN全部ORIGINAL_SCOPE_ONLY；范围JSON的inheritedGaps/obligations继承原描述，当前实现以currentScope、本次原始执行和后续L4评估为准，不闭合原义务。

## Gate、风险与下一任务

工程Gate **PASS_CURRENT_AUTHENTICATED_CASH_ONLY_VALUATION_AND_RISK_SOURCE**。DEVELOPMENT IMPLEMENTED_PENDING_ACCEPTANCE，完整L4 **NOT_READY_GAPS_OPEN** /stage NOT_ASSESSED /formalAccepted=false /runtimeAdmission=DENIED /M5 PREPARED_NOT_READY。19gaps/8规划义务仍OPEN、159阶段和原200venue/50旅程/4演练分母/风险限额不变，fullBooksReady/dayCloseAllowed/executionAuthority=false。正式确认仅[文稿准备](./review-draft.md)，未自行批准。

原BASIS_UNAVAILABLE OPEN仍blocked；无补发、自动关闭、扩大审查或放宽限额，不能用估值修复直接换取运行/审查许可。实际资金/账户状态/账户全集、live许可R01、Research/R04、IdP/MFA/Supabase PostgreSQL/Vault/RLS/outbox、跨主机/外部锚、真实venue、FX/外部流/负债/在途预算/日切、通知/源关闭、安全容量长稳同SHA CI/发布和当前浏览器人工无障碍未验收或NOT_RUN。全部使用自有fixture、临时测试身份与loopback；无生产凭据、远端推送、部署或外部发布。

下一：**CORE-GATE:L4 DEVELOPMENT**，评估cash-only与双来源当前组合及剩余缺口，尤其是原blocked basis OPEN的显式独立处置需求。本次不预授权扩大审查覆盖或关闭历史义务。
