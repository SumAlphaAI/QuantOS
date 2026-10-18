# PROVIDER:A5：当前功能汇总复核

冻结源码 **a036f73baaae984386e43b5eec0294fdfe44c031**，1087输入、17组当前功能/直接影响检查与8实际入口PASS。仅 **A5_SCOPE_LOCAL DEVELOPMENT READY**，完整INTEGRATION/RELEASE=NOT_RUN，formalAccepted=false、runtimeAdmission=DENIED，汇总人工确认PENDING，见[完整稿](evidence/provider-a5-local-20261018/confirmation-draft.md)。未发现本次范围需要更改既有业务实现的缺陷；新增组合验证与严格汇总门禁，修复执行工具和测试请求中的确认nodeId、查询参数和CI别名错误，未扩大为无关任务。

首先保存本次用户原始答复并确认BFF010完整原稿，绑定原源码5d41b7fb与原文稿/回执提交569412ef，见[确认记录](evidence/bff-fe-010-confirmation-20261018/user-confirmation.json)及[确认Gate](evidence/bff-fe-010-confirmation-20261018/gate.json)。四原确认与回执如下；核验原完整稿、Git source/normative inputs、日志、产物和激活入口hash，均referenceOnly/NOT_REVALIDATED。未运行子Gate或递归上游闭包，不改绑历史READY。

| 原对象 | 原源码 | 原文稿/回执commit | 当前确认 |
|---|---|---|---|
| FE:BFF-FE-009 | 15d1fd65eb358c3363ccb75c36eca5fd3bb5784b | b973fedb87ff12b17d0a85bd508733e76881e854 | CONFIRMED原范围 |
| FE:BFF-FE-008 | d926c246d33ee766fe02d07aa8ef68c83a059f6c | f2d8330f6174552b0cbfc508997b41c5bd0798a5 | CONFIRMED原范围 |
| FE:BFF-FE-010 | 5d41b7fbdb7453205dec534dd368094cfaabd1a8 | 569412efadb10aa7426b514aaa234e225276b8eb | CONFIRMED原范围 |
| PROVIDER:A4 | c9deac5b465c2146a1dfd0c316cbe47607f20451 | 5bab565973ae847e4d4410959c43c6a509f15bf1 | CONFIRMED原范围 |

主要变更：[同一provider原生组合](../../services/bff-gateway/src/a5_tests.rs)、[生成consumer组合](../../apps/terminal/tests/a5-aggregate-consumer.test.ts)、[严格Gate](../../scripts/provider-a5-functional-gate.mjs)、[影响范围](../../scripts/provider-a5-functional-scope.mjs)、[新HTTP执行器](../../scripts/test-provider-a5-http.mjs)、[规程](../operations/provider-a5-functional-admission.md)，以及CI/Makefile、双计划和原确认保存。全部[变更文件](evidence/provider-a5-local-20261018/changed-files.txt)和[证据索引](evidence/provider-a5-local-20261018/evidence-index.json)可逐项复核。

A5覆盖7项C15、8项C14、43项C11/C16共58操作；OpenAPI1.12.0/132操作110schema、六生成物与原85项安全修正摘要一致，没有为汇总改写既有接口。当前原生组合在同一Shadow BffProvider内：C15旧账本/差异追加保留，Performance使用真实X01/C15 book/估值版本，report冻结结果不随rerun/ack/治理改变；X06/F09合成可信observer修复不关闭C15 open差异，不把provisional伪造成已对账。明确是独立owner来源，完整跨域数据/告警联动不在本次验收。

三个路径同时使用同一幂等UUID并发发起，report/rerun/governance各得独立回执，各40重试精确恢复、一个可查询F05根。生成consumer在同一进程模拟三域丢回复后恢复相同事实；验证report实际字节hash/metadata/账本与估值版本和C15原历史。Owner禁用当前member后，所有三域旧重试、cursor、report ticket及SSE请求401；本地consumer清理失效事实。observer过期/Runbook预检/stream拒绝、ticket过期410；C15 source quarantine使current financial/ledger查询503，不把告警自动resolve。

当前C15/C14/C11-C16功能类分别复核原实际模块行为：只读账本及关闭证明/day绑定，USD/simple/f64/fees/period/coverage/provisional，immutable report保留/下载及scope，治理CAS/版本/tombstone/最后管理员读写/SoD/MFA，签名Engine review/撤销过期拒绝Research，ack不改变source resolved，安全Runbook及SSE/pagination。额外仅回归sharedAuth/settings与audit/export直接边界，不重跑无关Strategy/Trade/kill/10万事件或上游Gate。

| 当前验证 | 结果 |
|---|---|
| Rust | 72通过：组合5、C15 14、C14 9、C11/C16 15、sharedAuth/audit 29 |
| Node | 196通过：四原确认65、Gate负向55、policy/CI 76 |
| Consumer/契约 | 47通过/10文件；三helper65/65行、95/95分支100% |
| 当前HTTP | 584条，58操作逐项成功401/403/schema；三个域各100原键重试，三个基本Chromium |
| 其他 | 一次必要binary构建、types/lint/clippy、六生成物/compatibility、双计划、8入口与24限定控制PASS |

命令、起止、exit/signal/timeout、日志及hash见[manifest](evidence/provider-a5-local-20261018/manifest.json)、[结果](evidence/provider-a5-local-20261018/review-results.json)与[控制矩阵](evidence/provider-a5-local-20261018/control-matrix.json)。冻结候选17检查全部实际执行；三个子HTTP脚本在本候选重新运行，原HTTP只用于显式synthetic Gate单测fixture。诊断结果不冒充正式尝试；保留首次确认器nodeId不匹配、组合测试缺query的422、Gate误写A4 CI alias失败，修正请求/工具且未放宽契约；native/consumer中新增混合并发和冻结游标/原键撤权验证。没有生产凭据、DB或外部发布。

原53,577个audit/gate文件保持byte-for-byte，见[历史校验](evidence/provider-a5-local-20261018/history-preservation.json)。共享源码/工具变化后BFF010独立当前READY撤回NOT_ASSESSED；原确认、原稿、原manifest与旧失败记录不动，其他上游不重授READY。当前仅本汇总1 READY，未自动批准本稿。

未决风险：治理/报告/回执/游标/stream为process lease，不证明Supabase/F06成员写回、F05/outbox目标事务原子性、跨实例及重启持久恢复。固定USD/simple、X01 f64、coverage/provisional边界保持；X06/F09独立来源与C15 exception不能当成真实跨域告警自动联动。真实DB/Auth/MFA/RLS/Storage、feed/observer/Engine/许可、完整P02/P13/P14/P21/P22/P23/G4/G5/G6/FEP与业务联调、性能/容量/长稳/部署/同SHA hosted CI及正式发布全部NOT_RUN，移交RELEASE-GATE:BETA；runtime DENIED，formalAccepted=false。

功能/工具冻结提交 **a036f73baaae984386e43b5eec0294fdfe44c031**，验收元数据另行本地提交，不将meta HEAD改绑为新功能候选；未推送。下一可执行 **FE:BFF-FE-002 / A6：Command Center聚合API**，先确认本A5完整稿，再按该卡直接前置和原回执/当前影响执行，不预授后续READY。
