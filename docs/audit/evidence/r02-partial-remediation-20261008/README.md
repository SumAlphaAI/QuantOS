# R02 PARTIAL 续修证据索引

2026-10-08。当前报告：[续修与阶段调整](../../R02-partial-remediation-2026-10-08.md)。本目录所有 target 均只连接配置 Supabase，不启动行情，不重建数据库。工程结果不等于阶段 READY/正式 ACCEPTED；记录的文件hash界定本轮源码，候选同SHA远程CI归发布阶段。

## 最终有效执行

- `coverage-attempt03/receipt.json`：clean profile→instrumented retained chain→`--no-clean`目标边界与汇总，三步均0退出，PASS_SCOPED_TARGET。
- `coverage-attempt03/chain/receipt.json` 与 `chain-result.json`：32条实际R01 market事实、真实Storage上传/读回、快照/当前规则→两个Research/Python能力、持久Signal拒绝、四个来源/四个wire篡改负向、两个reader授权拒绝；明确旧窗口source age/Degraded。最终actor inactive、Engine stopped，所有本轮研究证据对象和metadata保留。没有修改复跑前已有规则。
- `coverage-attempt03/boundaries/receipt.json`：原生PG、成员权限与跨租户/原子审计、恢复意图/实际Storage，actor inactive/本轮owned对象absent/temporaryFaultTriggers=0/metadata保留。releasePerformance=NOT_RUN_RELEASE_STAGE。
- `coverage-attempt03/boundaries/coverage.json` / `coverage-summary.json`：排除tests，六个生产文件逐个line≥90%、region≥85%，没有降阈值。`execution-results.json`记录生产文件与当前字节一致。
- `component-check-final.log`：storage21/runtime12/strategy16、14结构/8覆盖/12批准scope/6阶段policy测试；6个编译成功后的行为mutation全部检测。
- `workspace-check-final.log`：整个workspace all-targets检查通过，包含BFF/Runtime等服务，确认新增ABI编译兼容；这是编译，不是部署验收。
- `clippy-final.log`、`fmt-final.log`：三crate all-targets `-D warnings`、fmt。
- `engine-integration-attempt01.log`：2 Research+3 Signal真实Python Engine回归；新数据库target在该命令未opt-in时输出NOT_RUN，不作为PG验收。
- `plan-check-final.log`、`plan-negative-final.log`：联合计划检查及38负向。
- `stage-disposition-final.json`、`stage-policy-tests-final.log`：C25/C26部署归Beta，admitted=false、formalAccepted=false；未以COMPLETED/NOT_ASSESSED冒充准入。
- `admission-attempt01.log` / `release-attempt01.log`：独立严格入口对当前缺依赖准入、未配置Beta发布状态预期拒绝；这是OPEN/DEFERRED的证据，不是执行失败被隐藏。
- `retained-market-readback.json`、`retained-source-policy-attempt01.json`：原两标的保留事实/有效批准的只读预检。scope不自动续期或扩展用途。

## 失败、恢复及历史保留

- `chain-attempt01/receipt.json`：实际链通过，但cleanup错误列名，整体FAIL，保留不改。`chain-attempt01-retirement-recovery.json`单独确认该run唯一actor停用；本轮首次创建的研究规则曾实际收紧并恢复，`chain-result.json.currentRules=PASS_OWNED_RULE_CHANGE`，不把它冒充后续同SHA正式验收。
- `compile-chain-attempt01/02.log`：测试fixture质量finding类型的编译失败保留；attempt03通过。其他compile日志属于开发过程，不是数据库回执。
- `coverage-attempt01/02`、`coverage-report-recovery-attempt01.json`和missing-lines日志：覆盖失败保留。首轮执行期间源码演进、后续第二段自动清除第一段采样导致消费者路径缺失；最终采用稳定源码、显式no-clean合并并由源码hash guard核验。原实际目标功能PASS不改成完整coverage PASS。

`execution-results.json`为当前处置机器台账。`checksums.json`对本目录除自身外的文件给出sha256；本轮新report/plan/source清单存于`final-source-inventory.json`。这些是内容绑定的工程证据，不构成用户签字、部署、商业许可、代表性性能或远程CI通过。
