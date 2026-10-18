# FE:BFF-FE-003 / A3 当前功能复核（2026-10-18）

结论：`BFF003_SCOPE_LOCAL / DEVELOPMENT READY`，仅C03/C04九项当前本机API与生成consumer，26/26限定控制点PASS，当前已确认功能缺陷均已修复。完整业务联调/发布NOT_RUN，formalAccepted=false、runtimeAdmission=DENIED；本任务[完整确认稿](evidence/bff-fe-003-local-20261018/confirmation-draft.md)PENDING。

基线`013c20e84a3a6dcc552a6ad4ae1a2833ebf048ab`，冻结功能源码`aeab72a52cdd861312366abadbbf56c2fccb6784`，911个精确输入，最终[manifest](evidence/bff-fe-003-local-20261018/manifest.json)。只修改QuantOS；依据最新AGENTS.md与开发计划按影响范围验证，未执行旧40节点闭包、全仓验收或发布用三轮独立构建campaign，无历史READY拼接。

## 变更与直接边界

项目用户已明确确认PROVIDER:A2完整原稿；原始答复/时间/身份、原稿/回执摘要保存于[独立确认记录](evidence/provider-a2-confirmation-20261018/user-confirmation.json)，门禁CONFIRMED，仍绑定3f0c9bd5功能和013c20e8回执，不批准当前候选。原A2文稿和回执未改，16组原日志/HTTP产物与Git源码按原范围核对；九项直接前置均reference-only，不借上游READY。共享功能/门禁输入变化撤回A2独立READY。

已复现并修复三项reference缺陷：创建/取消返回auditRef但C10找不到事实；使用wall clock而非reference当前时钟，已过期deadline仍被接受；Artifact metadata与附件hash指向不同内容。修复在同一state锁下追加幂等单次Research Audit事实、按当前时钟计算deadline和snapshot陈旧/质量/许可阻断，并使metadata和附件使用同一canonical内容hash。后续源码复核补正整秒截断：capture/window-end采用完整时间deadline与checked overflow拒绝，覆盖等值边界、超期1ns和溢出。Artifact读审计也可定位C10。当前默认Artifact是明确标注的synthetic fixture，用于实际reference HTTP契约，不能冒充worker完成或私有对象。

新增公开生成Research gateway：九操作封装、成功schema/资源ID/statusRef绑定、附件绑定已选metadata hash、超时/取消、受限错误信息；ResearchStreamReducer在确认前校验schema/runId，拒绝错流，处理重复/乱序/gap、续传与撤权终态。canonical archived bytes继续由服务端验证，未引入另一套浏览器JSON编码。

新scoped recorder/gate取代当前开发默认旧闭包：19组精确命令/原因、冻结Git输入/真实退出/日志/HTTP绑定、原A2确认核对、事务发布及四入口失败回滚。package/Make/强制CI及两份计划/阶段policy已同步，旧target/historical入口保留原用途。核心代码为`services/bff-gateway/src/research{,_tests}.rs`、`apps/terminal/src/research/gateway.ts`及两份consumer测试；门禁为`bff-fe-003-functional-{scope,gate}.mjs`、recorder/HTTP/boundary probes和原A2确认脚本。共133个变更文件；完整[变更文件清单](evidence/bff-fe-003-local-20261018/changed-files.json)。

## 实际验证

最终仅使用`function-attempt-03`的19组正常执行，无signal/error/timeout，并通过development、CI、原A2确认及plans四个真实激活入口。

| 项目 | 结果 |
| --- | --- |
| Node | 237 PASS：契约负向78、确认48、当前gate44、计划/CI67 |
| Rust | 63 PASS：research=22, runtime=6, source-policy=2, snapshot-expiry=1, engine-policy=1, orchestration=2, a2-boundary=29 |
| consumer/契约 | 60 PASS；实际Rust HTTP丢响应同键恢复、并发重试、Audit链、metadata/附件与SSE断线/撤权 |
| 当前HTTP | 九操作全部成功，共43记录；逐操作401/403共18项，另有2项409/5项422/1项404及注销后拒绝 |
| 实际本机UDS | Runtime→Manager→确定性Python RD-Agent十次稳定hash/可定位Artifact，及取消确认；内存store/fixture范围，非持久worker或真实模型验收 |
| 生成/静态 | OpenAPI/client/schema/MSW一致，api-client/terminal types+lint与bff lib clippy PASS |
| 凭据扫描 | 三个源码提交范围及逐次staged扫描0发现；最终元数据staged扫描同样0发现 |
| 历史保全 | 52,654个原audit/gate文件SHA256一致 |

逐命令结果见[execution-results.json](evidence/bff-fe-003-local-20261018/function-attempt-03/execution-results.json)，逐项断言与适用范围见[control-matrix.json](evidence/bff-fe-003-local-20261018/control-matrix.json)。F07/F08/R02/R03/R04/R1-SERVICE只验证具体消费边界，未重新准入；A2只回归共享Audit/session两组provider和直接consumer，未重跑其完整汇总。

预修复三项测试均FAIL，修复后直接三项PASS，原日志保留。探索工具中的重复路径、ClientRequestId参数名及CANCELLED错误码期望错误已纠正，原FAIL保留；这些不是最终PASS证据。首次预复现编译耗时2m40，不能作为性能或长稳通过依据。冻结0eec7e6a的attempt-01在亚秒边界源码复核后安全停止：5组PASS，第6组source-policy为SIGTERM/INTERRUPTED，其后检查未运行。d0c8e719的attempt-02完成19组和4项入口后，收尾另发现旧research-local CI单测2项失效假设；已改为当前注册的显式scoped替换及拒绝旧五回执覆盖/回滚，并把57项隔离元数据负向单测纳入contract-negative，未运行40节点campaign。最终候选独立执行全部19组；未把旧候选或中断的PASS拼入最终回执。两轮原候选文件另逐Git blob核对保全。本轮启动采样停在_dyld_start，仅确认本机启动延迟，根因未确定。

## Gate、风险与后续

计划图仅当前任务READY1，其余NOT_ASSESSED158；九前置/A2/G2/FEP-2/PROVIDER:A3未独立准入。functionImplementation=PASS，businessIntegration/releaseAcceptance=NOT_RUN，formalAccepted=false、runtimeAdmission=DENIED。原A2确认CONFIRMED，本任务用户确认PENDING。

风险/未执行：实际PostgreSQL迁移/RLS/跨租户作用域并发、R03持久worker/lease/取消/跨进程恢复、真实Engine授权/OS隔离/外部来源、真实私有Storage、完整UI/API业务链与浏览器矩阵、部署、安全目标、性能/容量/长稳和同SHA hosted CI；工程编译/启动延迟根因未确定。保持INTEGRATION/RELEASE义务，不把本机UDS、synthetic Artifact或静态SQL核对提升为目标验收。

未使用生产凭据、未连接目标库、未启动本地数据库，未推送或外部发布。功能源码提交`aeab72a52cdd861312366abadbbf56c2fccb6784`；最终证据/计划以独立本地提交保存，最终SHA见交付答复/git log。下一可执行：`FE:BFF-FE-005 / A3：市场目录、报价与K线API当前功能复核`；本稿待项目用户审阅确认。
