# BFF-FE-009 / A5：Reconciliation 与账本 API 当前功能复核

冻结源码 **15d1fd65eb358c3363ccb75c36eca5fd3bb5784b**，989输入、15组当前功能/必要编译静态/直接影响检查及5个实际激活入口PASS。仅 **BFF009_SCOPE_LOCAL DEVELOPMENT READY**；完整INTEGRATION/RELEASE=NOT_RUN，formalAccepted=false、runtimeAdmission=DENIED，本任务用户确认PENDING。全图1 READY /158 NOT_ASSESSED /0 BLOCKED。

首先保存用户对A4完整稿的原始答复并验证原确认，见[原始确认](evidence/provider-a4-confirmation-20261018/user-confirmation.json)与[门禁](evidence/provider-a4-confirmation-20261018/gate.json)。仍绑定原源码c9deac5b465c2146a1dfd0c316cbe47607f20451、原回执提交5bab565973ae847e4d4410959c43c6a509f15bf1；未重绑为本C15或新HEAD接受。

五个直接前置FE:BFF-FE-006、FE:BFF-FE-007、CORE:X05、CORE-GATE:X3-SERVICE、PROVIDER:A4原manifest/源码输入/规范及日志/产物hash均已核对，详情见[references](evidence/bff-fe-009-local-20261018/review-results.json)。全部NOT_REVALIDATED/referenceOnly；共享源码/契约变化后A4独立当前READY撤回NOT_ASSESSED，原稿与历史回执均未改。A4原确认前执行了变更前原候选严格预检；C15冻结复核未执行上游Gate、全仓测试、三次独立构建或无关大事件/性能闭包。

C15发布七个API：run list/get、break list/get、ledger entries、受控rerun与run stream。OpenAPI1.10.0共81操作/72schema，catalog中七个planned移为published，六类生成产物精确同步。新nullable联合类型生成严格Zod校验，拒绝任意对象/数值替代null、UUID、cursor或hash；兼容登记只增补1.10.0的工程范围，原85项安全修正摘要保留，不授予A1/staging/发布。

适配真实X05 ReconciliationService，owner侧注入Book并可追加带day的观察；页面仅提交reason，服务端取当前可信来源。保留X05原生Shadow/tenant/workspace/account/角色/execution.operate授权，不为Paper页面改写核心授权。显式Shadow reference同步Context并拒绝Paper/Strategy执行路径；默认live无host503，显式owner注入仍使用F06可信身份；真实目标执行NOT_RUN。

账本按run追加源快照与Fill投影、Decimal字符串、source hash/revision/asOf/day及证据引用；旧entry字段原样保留，无edit-ledger或浏览器差异关闭路由。Order/Fill为拥有者source_record，Alert为真实x05_exception，不能冒充当前BFF订单或尚未实现C16 API。rerun的F05 auditRef/correlationId闭链可定位；初始owner observation没有BFF写事件时auditRef=null，不伪造审计事实。

原键恢复不重跑/追加，变更意图409；If-Match竞争、源快照期限外写入、跨day替换、浏览器Book/余额/关闭状态注入均拒绝。分页绑定当前角色/能力/session/作用域/查询，冻结且限期；quota429带retry envelope。流提供完整事件信封、afterSequence、去重/gap/过期和注销拒绝。clean比较结果不等于关闭：差异关闭遵循真实X05 ack/新鲜修复/核验规则，只有匹配day-close proof且未过期的报告可解除provisional；新观察使同day批准失效，事实变化追加journal。202不乐观改变异常/账本状态。

| 当前验证 | 结果 |
|---|---|
| Rust | 61通过：C15 14、X05直接flow/source 18、共享Auth/audit 29 |
| Node | 145通过：原确认29、Gate44、policy/CI72 |
| Consumer/契约 | 44通过 /7文件；真实单provider丢回复后恢复、事实与F05闭链 |
| HTTP / Chromium | 147条当前记录，七API逐项成功401/403/schema；100原键重试与一个基本Chromium |
| 覆盖率 | helper行20/20、分支23/23、语句37/37、函数9/9，100% |
| 生成与静态 | generated、types、lint、Clippy、plans通过 |
| 实际入口 | development、CI、A4原确认、直接前置metadata、plans，5/5通过 |
| 历史保护 | 53,247个既存audit/gate文件逐字节未变 |

HTTP状态分布：{"200": 22, "422": 2, "409": 5, "404": 1, "202": 101, "401": 8, "403": 7, "204": 1}。本轮全部15组在同一冻结源码实际运行，没有取探索/历史PASS代替。见[manifest](evidence/bff-fe-009-local-20261018/manifest.json)、[完整回执](evidence/bff-fe-009-local-20261018/function-attempt-01/function-receipt.json)、[逐组结果](evidence/bff-fe-009-local-20261018/review-results.json)、[24控制点](evidence/bff-fe-009-local-20261018/control-matrix.json)、[变更清单](evidence/bff-fe-009-local-20261018/changed-files.json)、[证据索引](evidence/bff-fe-009-local-20261018/evidence-index.json)及[规程](../operations/bff-fe-009-functional-admission.md)。

探索失败、修复与中间结果均保留于[探索记录](evidence/bff-fe-009-local-20261018/exploratory/README.md)，包括初始ref/nullable契约、live夹具编译、示例/policy缺失、percent编码成员查询、loopback EPERM、synthetic fixture和Clippy失败。它们均为工作树诊断，observed Git HEAD不是该脏工作树的源码证明；仅上述冻结完整回执可用于当前READY。

未决风险：本机可信合成Shadow/观察Paper输入、进程内租约不等于真实feed/许可/撤权、持续Paper/Shadow或10个实际交易日/自然SLA；真实Supabase/Auth/MFA/RLS/Storage、审计与账本持久事务/跨实例/重启恢复、P11/P21/P22/G5/FEP-5完整UI/API联调、目标安全/性能/容量/长稳/部署及同SHA hosted CI和正式发布全部NOT_RUN。目标专用自动化NOT_IMPLEMENTED。保留X01 f64、固定quote与非零异币费用拒绝边界；X05 Decimal字符串不提升上游精度。

仅修改QuantOS，未使用生产凭据、未连接目标库或建立本地PG/Supabase、无venue submit、未push或外部发布。下一可执行：用户确认[本任务完整稿](evidence/bff-fe-009-local-20261018/confirmation-draft.md)后，执行 **FE:BFF-FE-008 / A5：Performance 与报表 API**，按影响范围核对直接前置与A4/本任务原确认回执。
