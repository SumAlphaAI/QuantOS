# FE:BFF-FE-007 / A2 当前功能复核（2026-10-18）

本轮完成：**FE:BFF-FE-007 / A2_AUDIT_LOCAL DEVELOPMENT READY**，仅当前C10六操作功能。源码`7d0fc3664904627972e3d82559eabd4405c0a9f2`，760个功能输入，17组检查、4个实际激活入口和28项限定控制点PASS。完整业务联调、目标环境与发布NOT_RUN；本任务用户确认PENDING，formalAccepted=false、runtimeAdmission=DENIED。

先处理原确认：项目用户明确确认BFF-FE-001完整确认稿，原始全文/时间/身份/原稿与范围摘要已保存，[确认门禁](./evidence/bff-fe-001-confirmation-20261018/current-gate.json)CONFIRMED，绑定原85530021源码及4f261e67回执。原稿不改写；该确认不授予本任务或新HEAD的正式ACCEPTED。见[原始答复](./evidence/bff-fe-001-confirmation-20261018/user-confirmation.json)与[纯文稿兼容规程](../operations/committed-prose-confirmation.md)。默认JSON/RELEASE确认校验不放宽。

仅修改QuantOS，未使用生产凭据、未建立本地数据库、未推送或外部发布；没有递归上游闭包、全仓测试或三轮独立构建。SQL/live持久实现未改，旧31项目标控制点及历史READY不改绑为本轮通过。

## 修复和变更文件

| 文件 | 变更及目的 |
| --- | --- |
| `services/bff-gateway/src/lib.rs` | reference导出独立correlation/因果根，auditRef作为根eventId，生命周期锚定根；响应关联稳定重放；status/cancel/download统一一次retention过期转换 |
| `services/bff-gateway/src/audit_core.rs` | 新增4项live/reference共享纯策略测试：归一化范围、脱敏/hash、UTC筛选和JSONL/CSV/PDF水印编码 |
| `services/bff-gateway/tests/audit_export_provider.rs` | 新增独立链/HTTP关联、过期转换、并发唯一效应、六操作权限矩阵、分页无重复遗漏/游标有效期 |
| `apps/terminal/src/audit/gateway.ts` | chain/status/cancel/download响应绑定请求ID，所有六入口支持超时/取消；未知写入不自动重试 |
| `apps/terminal/tests/audit-gateway.test.ts`、`audit-provider-consumer.test.ts` | 实际Rust HTTP经生成audit consumer恢复丢响应、遍历脱敏证据/分页、同键重放、受控取消及过期拒绝；资源绑定/超时取消负向 |
| `scripts/user-acceptance-confirmation.mjs`、`bff-fe-001-confirmation.mjs`、`committed-prose-confirmation.test.mjs` | 原用户确认、不可变Git文稿及原计划规范输入校验；限定DEVELOPMENT FUNCTION_ONLY，不重授旧READY或放行RELEASE |
| `scripts/bff-fe-007-functional-scope.mjs`、`functional-gate.mjs`、`functional-gate.test.mjs`、`record-bff-fe-007-functional.mjs` | 当前源码/输入/精确命令/日志/产物门禁；失败保留、原子发布及激活失败回滚 |
| `scripts/bff-fe-007-development.mjs`、`test-bff-fe-007-mutations.mjs`、`test-bff-provider-contract.mjs` | canonical开发/CI入口识别当前限定回执；八类实际变异；C10 HTTP成功/拒绝/过期矩阵 |
| `scripts/check-development-plan-order.mjs`、`development-plan-order-policy.json`、`package.json`、两份计划与两份操作规程 | 登记任务专用reference-only前置例外、确认/功能命令、功能/联调/发布状态；PROVIDER:A2旧默认闭包说明迁移为最新阶段原则 |

[完整变更文件](./evidence/bff-fe-007-local-20261018/changed-files.json)。

## 当前测试结果

| 验证 | 结果 |
| --- | --- |
| 契约及旧严格门禁负向 | 30 PASS |
| 原确认 / 新限定门禁 / 计划及CI负向 | 36 / 40 / 66 PASS；Node合计172 |
| F05 tenant/provenance与checkpoint恢复 | 1 / 1 PASS，只验证直接纯行为；PostgreSQL NOT_RUN |
| Audit provider / 共享身份provider | 14 / 15 PASS |
| 共享audit_core | 4 PASS；Rust合计35，无ignored、无零用例计入 |
| 生成consumer、transport及响应schema契约 | 42 PASS |
| 实际loopback HTTP | 6/6成功操作，34条响应契约PASS，包含六操作各401/403、幂等冲突与过期410；身份调用为setup |
| 真实源码变异 | 8/8由预期业务断言拒绝；均exit101、无signal/timeout/spawn error；临时锁包版本/source/checksum为原锁子集 |
| 生成一致性、TypeScript、lint、双计划 | PASS |
| 激活后的开发CLI、CI disposition、原确认CLI、计划检查 | 4/4 PASS，失败会回滚manifest/stage_gate |
| 历史审计/门禁 | 52,482个文件逐字节不变，包括原确认稿、原BFF-FE-001回执/报告/失败记录 |

[限定manifest](./evidence/bff-fe-007-local-20261018/manifest.json)、[执行统计](./evidence/bff-fe-007-local-20261018/review-results.json)、[28项当前控制点](./evidence/bff-fe-007-local-20261018/control-matrix.json)、[证据索引](./evidence/bff-fe-007-local-20261018/evidence-index.json)保留实际命令、范围原因、时刻/退出状态与日志摘要。所有最终组来自function-attempt-02，不拼接首轮PASS。

F05仅静态append-only/来源/tenant/correlation/causation和两个直接纯行为；A1仅当前API1.7.0/生成输入；BFF-FE-001修改前[回执门禁](./evidence/bff-fe-007-local-20261018/preflight/identity-before-change.json)有效，原用户确认单独通过。共享输入改变后身份独立READY撤回，三项前置NOT_REVALIDATED/referenceOnly=true，不授予上游READY。当前全图本任务1 READY / 158 NOT_ASSESSED；PROVIDER:A2/G5/FEP-5独立未准入。

## 问题关闭与失败保留

已关闭当前功能问题：reference导出混用来源业务correlation/缺少根关联；retention到期后状态仍ready；consumer未验证响应资源ID，以及无法传入取消/超时。对应业务与consumer断言已通过，失去create响应后使用原键恢复只产生一个job及created audit。

修复前业务失败、chrono类型遗漏编译失败、旧确认校验误依赖当前全局登记/缓存策略、游标测试先触发会话过期401、TypeScript intersection测试写法错误均保留在[试跑失败台账](./evidence/bff-fe-007-local-20261018/exploratory/failure-ledger.json)。过滤运行的0 provider用例不计为PASS。

首个冻结627c5fe5完成8组后，HTTP harness预检拦截故意缺cookie的401请求，FAIL且未计作服务拒绝验证，见[原失败](./evidence/bff-fe-007-local-20261018/function-attempt-01/failure-context.json)。修正负向探针后冻结7d0fc366，在新attempt独立执行17组；旧结果只保留原范围。

## 未决风险、Git与下一任务

当前限定功能无已知未关闭缺陷。实际Supabase/Auth/RLS、跨账号/租户持久并发事务、export worker lease跨进程重启、真实私有对象存储/完整性与单次票据并发消费仍NOT_RUN。reference的生成是本机同步模拟，downloads.invalid元数据链接不实际下载；F05内存checkpoint与丢HTTP响应恢复不能替代数据库worker恢复。

完整十页面/API业务链、目标规模五分钟还原、跨浏览器/部署/性能/长稳/同SHA hosted CI、正式用户确认和RELEASE继续独立验收；功能实现PASS / businessIntegration NOT_RUN / releaseAcceptance NOT_RUN，不把本机证据提升为生产准入。

本任务[完整确认稿](./evidence/bff-fe-007-local-20261018/confirmation-draft.md)已含标准JSON request并绑定当前源码/输入摘要，状态PENDING；原BFF-FE-001确认只用于原范围人工条件。Git本地功能/原确认提交627c5fe5、工具修复/冻结源码7d0fc366，报告/证据与计划另随收口提交；均未推送。

下一可执行任务：**PROVIDER:A2：当前功能汇总复核**，围绕BFF-FE-001与BFF-FE-007两项API及F05/A1直接边界执行本窗口必要验证，不默认递归全部上游；通过后再评估A3开发。
