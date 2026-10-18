# BFF-FE-010 / A5：Operations、Admin 与 Alert API

冻结源码 **5d41b7fbdb7453205dec534dd368094cfaabd1a8**，1058输入、18组当前功能与直接影响检查、6个实际入口PASS。仅 **BFF010_SCOPE_LOCAL DEVELOPMENT READY**；完整INTEGRATION/RELEASE=NOT_RUN，formalAccepted=false、runtimeAdmission=DENIED，本任务用户确认PENDING，见[完整确认稿](evidence/bff-fe-010-local-20261018/confirmation-draft.md)。

首先保存本次用户原始答复并核验BFF008完整原稿，绑定原源码d926c246d33ee766fe02d07aa8ef68c83a059f6c及原回执/文稿提交f2d8330f6174552b0cbfc508997b41c5bd0798a5，见[原确认](evidence/bff-fe-008-confirmation-20261018/user-confirmation.json)与[确认Gate](evidence/bff-fe-008-confirmation-20261018/gate.json)。A4、BFF009原确认继续保持各自原SHA。七直接前置FE:BFF-FE-001、FE:BFF-FE-007、FE:BFF-FE-009、CORE:F09、CORE-GATE:X3-SERVICE、SERVICE:X06、PROVIDER:A4原manifest/源码/规范输入/日志产物hash逐项核验；F09兼容原legacy PASS结构。全部referenceOnly/NOT_REVALIDATED，不运行上游Gate，不拼接历史READY。BFF008独立当前Gate因共享修改撤回NOT_ASSESSED，原manifest/稿/回执保持。

主要变更：[OperationsHost](../../services/bff-gateway/src/operations.rs)、[治理](../../services/bff-gateway/src/operations/governance.rs)、[原生测试](../../services/bff-gateway/src/operations/tests.rs)、[live接线](../../services/bff-gateway/src/live/operations.rs)、[X06告警](../../crates/quantos-operations/src/telemetry.rs)、[consumer](../../apps/terminal/src/operations/gateway.ts)、[OpenAPI](../../bff/openapi/quantos-bff.v1.yaml)、[Gate](../../scripts/bff-fe-010-functional-gate.mjs)和[规程](../operations/bff-fe-010-functional-admission.md)。完整[变更文件清单](evidence/bff-fe-010-local-20261018/changed-files.txt)涵盖六类生成物、catalog/字段字典、双计划、CI/Makefile、用户原确认及新证据。

C11 36个操作覆盖健康/metrics、incident list/get/timeline/open/ack/resolve、Runbook list/precheck/run与member/role/policy/capability/flag list/get/create/update/delete；C16 7个操作覆盖alerts、ack/unack、subscriptions与SSE。OpenAPI1.12.0共132操作/110schema；typed per-kind Spec/action及严格联合响应。修正契约示例按实际资源类型配对，通用请求示例测试根据path enum取合法值，没有放宽schema。原85项安全修正摘要保留，只追加工程兼容版本。

真实X06服务接F09结构化观测；只授权Service observer来源，四安全组件及数值latency/dlq，30秒clock校验、source/metrics hash。raw详情、labels及敏感metric value不出页面。owner进程租约保留F06能力上限、member/role/policy/capability交集；CRUD版本/tombstone/引用/最后独立管理员/本人及同user别名保护，typed deny与四个非安全flag不能弱化交易风控。身份变化跨页面拒绝旧身份，trusted F06刷新后才可恢复；不是目标身份表写回。

已签名Engine/plugin review只能由trusted Owner侧导入，真实EngineManager验证manifest/artifact/routing签名和tenant，独立Approver审核且有5分钟期限。页面只能审批安全metadata，name/version/description精确匹配；不能提交endpoint、key或安装命令。当前未批准/撤销/过期能力拒绝Research创建，reference共用状态锁、live持同治理锁完成工作流事务；不替代内核独立运行许可，不spawn Engine。该Research路径因本次直接改变能力准入而纳入HTTP成功/拒绝，不扩为R03/F07全闭包。

所有mutation要求CSRF、幂等键与If-Match；高风险还重验recent MFA/reauth精确caller/期限。当前权限先于幂等回放，40并发同键一个结果，1000 native回放；100 HTTP重试同一Runbook回执且一个F05审计根。治理clone/校验后swap，拒绝不部分更新；live审计/commit不确定后quarantine，真实持久事务/重启恢复未验收。

ack/unack是实际X06 CAS，只改变确认状态；source resolved只能来自新观测。incident独立Approver、已ack且新source修复才可resolve，复发重开，timeline只追加。可信reference clear-once feed明确仅用于合成来源修复，非浏览器注入/live观测。Runbook只读inspect-health/evidence，后者还需实际证据；不能执行shell/改账/任意命令/venue submit。冻结cursor绑定身份/session/query/config及5分钟；SSE按订阅过滤后连续、gap/租约/订阅/撤权冲突拒绝重建。consumer仅以authoritative facts更新，不乐观解决告警。

| 验证 | 实际结果 |
|---|---|
| Rust | 48通过：当前15、X06直接4、共享Auth/audit 29 |
| Node | 172通过：原确认53、Gate45、policy/CI 74 |
| Consumer/契约 | 44通过/7文件；helper26/26行、42/42分支100% |
| HTTP / Chromium | 287条，43API逐项成功401/403/schema，100精确重试，一次审计根，基本Chromium |
| 其他 | types/lint/clippy、六生成物、compatibility/页面登记、双计划、6入口与24限定控制PASS |

全部命令、起止、exit/signal/timeout、日志和hash见[manifest](evidence/bff-fe-010-local-20261018/manifest.json)、[结果](evidence/bff-fe-010-local-20261018/review-results.json)与[矩阵](evidence/bff-fe-010-local-20261018/control-matrix.json)。仅选取X06四项直接observer/alert/incident/safe-runbook测试，没有重跑无关执行/kill/交易回放或上游全Gate。源码冻结后新候选实际18检查均执行，不借用诊断或历史PASS。

首候选18检查/6入口曾通过，但追加审阅以真实HTTP复现admin.read禁用200后管理403的最后管理员锁死缺口，故撤回当前READY；按admin.read与admin.write双条件修复，增加能力禁用/删除及policy deny的native和HTTP拒绝测试，重新冻结最终候选并独立执行相同18组。首候选完整回执/日志、缺口复现及初次缺mandatory header的无效probe均保留。扫描曾识别新增复现中的已终止合成实例reauth grant；在新候选提交前作有sha256记录的脱敏，失败扫描保留，后续不加豁免通过。

保留开发中的编译/初始告警revision0断言、YAML重复响应键生成、页面登记operation token、MFA路径typecheck、Clippy及契约示例失败。修正原因为真实实现/fixture错误后复验；未删除、覆盖或计入最终PASS。此前286条HTTP诊断缺listIncidents成功记录，coverage校验拒绝，补实际请求后冻结复验。全部原53,439个audit/gate文件blob保持，见[历史保留](evidence/bff-fe-010-local-20261018/history-preservation.json)。新source/metadata staged密钥扫描只作工程检查。

未决风险：owner注入的单账户Paper/Shadow process lease不等于Supabase/F06成员/治理持久写回；真实权限/MFA/RLS/Storage、F05/outbox事务回滚和持久原子性、多实例/重启恢复、真实F09 observer、远程Engine运行、完整P02/P13/P14/P23与G6/FEP6业务联调、性能/容量/长稳/部署/同SHA hosted CI及发布全部NOT_RUN，移交RELEASE-GATE:BETA。当前只提供typed deny policy与安全UI flag，不实现任意风险阈值编辑。未用生产凭据、未连接DB、无venue submit、未推送或外部发布。

本地主体提交41f224fc、最后管理员修复/最终候选 **5d41b7fbdb7453205dec534dd368094cfaabd1a8**；验收元数据另行本地提交，两个层次不把meta HEAD改绑为新功能候选。下一可执行任务 **PROVIDER:A5：当前功能汇总复核**，先确认本任务完整稿，再核对009/008/010原回执与直接边界；不提前授予汇总READY。
