# BFF-FE-008 / A5：Performance 与报表 API 当前功能复核

冻结源码 **d926c246d33ee766fe02d07aa8ef68c83a059f6c**，1015输入、15组当前功能/直接影响与5个实际激活入口PASS。仅 **BFF008_SCOPE_LOCAL DEVELOPMENT READY**；全图1 READY /158 NOT_ASSESSED /0 BLOCKED。完整INTEGRATION/RELEASE=NOT_RUN，formalAccepted=false、runtimeAdmission=DENIED，本任务用户确认PENDING，见[完整确认稿](evidence/bff-fe-008-local-20261018/confirmation-draft.md)。

首先保存本次用户原始答复，确认BFF009完整原稿，绑定源码15d1fd65eb358c3363ccb75c36eca5fd3bb5784b与回执提交b973fedb87ff12b17d0a85bd508733e76881e854；见[原始确认](evidence/bff-fe-009-confirmation-20261018/user-confirmation.json)及[门禁](evidence/bff-fe-009-confirmation-20261018/gate.json)。A4原确认继续绑定c9deac5b/5bab5659，不重绑新候选。五个直接前置FE:BFF-FE-009、CORE:X01、CORE:X05、CORE-GATE:X3-SERVICE、PROVIDER:A4原manifest、源码/规范输入和日志/产物哈希逐项核验。X01兼容原legacy manifest→functionalManifest结构，原范围保持；全部referenceOnly/NOT_REVALIDATED，不执行上游Gate。

主要变更：[PerformanceHost](../../services/bff-gateway/src/performance.rs)、[原生测试](../../services/bff-gateway/src/performance/tests.rs)、[live注入](../../services/bff-gateway/src/live/performance.rs)、[C15只读来源](../../services/bff-gateway/src/reconciliation.rs)、[consumer](../../apps/terminal/src/performance/gateway.ts)、[OpenAPI](../../bff/openapi/quantos-bff.v1.yaml)、[门禁](../../scripts/bff-fe-008-functional-gate.mjs)及[规程](../operations/bff-fe-008-functional-admission.md)。完整[变更文件清单](evidence/bff-fe-008-local-20261018/changed-files.txt)包括生成产物、字段字典/页面登记、双计划、CI/Makefile、原确认与新验收证据。

八个C14 API：getPerformanceSummary、getPerformanceSeries、getPerformanceAttribution、createPerformanceReport、getReportStatus、getPerformanceReport、getReportDownload、downloadPerformanceReport。补齐独立get与实际内容下载；OpenAPI1.11.0共89操作/80schema、六类生成物一致；原85项安全修正摘要保持，只追加当前工程兼容版本，不授予A1/发布接受。

X01真实projection自校验并与C15 actual Book持仓成本/数量/mark/已实现和未实现P&L匹配；每点保留snapshot hash、actual book hash、runId/asOf。actual现金+有符号市值计算权益，simple=(末权益-初权益)/初权益，fees取期间新增累计费用，不双扣期初费、不把expected/actual或rerun相加。归因取符号realized+unrealized变化，LEDGER_RESIDUAL保留账本残差。回撤为观测权益的历史峰谷比。UTC自选/自然/滚动窗口同时返回请求与观测coverage；缺区间、未有每点匹配日结证明或证明过期强制provisional。

只支持USD/simple，其他币种、twr/mwr、seed现金流、无正权益、源历史改写/逆序估值均拒绝；不伪造FX或外部现金流收益。X01 f64容差校验不提升精度。参考数据体现真实差异而非伪造已对账成功；既有C15历史事实追加保留，Shadow不跨mode触发Paper/Strategy执行。沿用X05核心Owner/Operator/Service及execution.operate，Viewer拒绝，未扩权限。

报告冻结输入，202 queued→status执行本机待办一次→succeeded；未完成get/grant409。actor/session/key/intent原键恢复返回原queued回执，不重算/覆盖；40并发一个job，本机F05根一次。JSON内容immutable reportVersion1，元数据与正文版本交叉核对，真实字节sha256/size绑定，ticket60秒、报告15分钟，过期410、会话撤销401、跨actor/session404。无浏览器估值/余额/改账入口，无venue submit。live显式注入X01/C15租约，默认503；F06身份保持，F05失败后quarantine/503，真实数据库事务/持久恢复未验收。

| 当前验证 | 实际结果 |
|---|---|
| Rust | 52通过：C14 9、C15直接14、共享Auth/audit 29 |
| Node | 159通过：原确认41、Gate45、policy/CI 73 |
| Consumer/契约 | 44通过 /7文件；生成client丢回复恢复及字节/版本/元数据拒绝 |
| HTTP / Chromium | 146条当前记录，八API逐项成功401/403/schema，100精确重试、基本Chromium |
| Helper覆盖 | 19/19行、30/30分支100%，6/6函数 |
| 其他 | types/lint/clippy、生成物、compatibility、双计划及5实际入口PASS；24限定控制点PASS |

具体命令、起止、exit/signal/timeout、原日志与hash均见[manifest](evidence/bff-fe-008-local-20261018/manifest.json)及[结果](evidence/bff-fe-008-local-20261018/review-results.json)，[控制矩阵](evidence/bff-fe-008-local-20261018/control-matrix.json)明确本机范围。当前校验不因新提交或元数据自动扩大到全闭包。

保留开发中的编译/fixture/journal断言失败，首次冻结attempt-01因静态字符串不识别rustfmt换行失败、attempt-02实际HTTP发现correlation header/body不一致失败；均保留，修复后attempt-03完整通过。consumer首次43/44因新增下载路径specimen缺失失败，修正fixture而未放宽schema。一次低效逐文件Git hash检查主动停止并以等价批量blob hash替换，停止不记PASS。全部原53344个audit/gate文件哈希保持，见[记录](evidence/bff-fe-008-local-20261018/history-preservation.json)。BFF009独立当前READY因共享变化撤回NOT_ASSESSED，原确认/原回执不动。

未决风险：进程内租约与最多1000样本/jobs/tickets；当前完整覆盖间隔60秒，长周期可能partial；每点C15日结匹配/有效期保守标provisional，完整长期对账链尚待联调。仅USD/simple与X01 f64沿用边界。真实目标DB/Auth/MFA/RLS/私有Storage、跨实例/重启持久worker、真实数据许可、C16通知、完整P21 UI/G4/FEP4、性能/容量/长稳、部署及同SHA hosted CI全部NOT_RUN，移交RELEASE-GATE:BETA，不能视为运行/正式发布准入。未使用生产凭据，未外部发布/推送。

本地功能提交：d40f36a1（主体）、497c0869（格式门禁修复）、d926c246（correlation与契约fixture修复，最终候选）。验收元数据另行本地提交，未推送。下一可执行任务 **FE:BFF-FE-010 / A5：Operations、Admin 与 Alert API**；先确认本任务完整稿。PROVIDER:A5须等待009/008/010全部所需当前范围后再汇总，不提前READY。
