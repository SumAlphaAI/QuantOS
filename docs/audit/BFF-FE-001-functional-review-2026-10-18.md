# FE:BFF-FE-001 / A2 当前功能复核（2026-10-18）

本轮功能复核完成：**A2_IDENTITY_LOCAL / FE:BFF-FE-001 DEVELOPMENT READY**，只允许继续后续功能开发。冻结源码 `855300213db81476f7fd61cd21f5439364fee8c0`；727个功能输入，14组当前功能/直接边界及3个实际激活入口通过。24/24控制点为本轮限定本机功能PASS；完整页面/API联调、目标环境与发布验收NOT_RUN，用户确认PENDING，formalAccepted=false、runtimeAdmission=DENIED。

仅修改QuantOS；依据最新AGENTS.md，无无关全闭包、全仓测试、三轮构建或历史READY拼接，未使用生产凭据、未启动本地数据库、未执行外部发布或推送。C01/C17当前20操作，消费API1.7.0/70published/62schemas的A1基线。

## 修复与代码

| 文件 | 变更与验证目的 |
| --- | --- |
| `services/bff-gateway/src/lib.rs` | SSE发送每条事件（含积压重放）前复核会话；撤销/过期终态关闭，拒绝旧数据交付 |
| `services/bff-gateway/tests/auth_settings_provider.rs` | 新增积压撤销、并发版本竞争/同键唯一副作用、只读会话拒绝测试 |
| `packages/api-client/src/sse-contract.ts`、`sse.ts` | HTTP401/403关闭传入reducer并取消响应体；同一reducer后续不再重连 |
| `packages/api-client/tests/sse-poc.test.ts` | 两类拒绝状态的终态、取消与复用验证 |
| `apps/terminal/tests/a2-provider-consumer.test.ts` | 实际Rust HTTP经生成client/auth/settings完成读写、重放/冲突、断流未确认事件回补、afterSequence恢复与撤销拒绝 |
| `scripts/test-bff-provider-contract.mjs` | C01/C17专用20操作HTTP模式，排除另一个任务的Audit/export |
| `scripts/bff-fe-001-execution.mjs`、`test-bff-fe-001-mutations.mjs` | filtered live policy，凭据环境白名单/单job/offline；9类实际源码变异，临时锁裁剪且包身份/校验和为原锁子集，实际测试--locked |
| `scripts/bff-fe-001-functional-scope.mjs`、`functional-gate.mjs`、`functional-gate.test.mjs`、`record-bff-fe-001-functional.mjs` | 新限定源码/日志/产物内容门禁、失败保留、原子激活与回滚 |
| `scripts/bff-fe-001-development.mjs`、`check-development-plan-order.mjs`、`development-plan-order-policy.json`、`package.json` | strict开发入口和CI调用同一限定验证器；登记任务专用reference-only前置例外与命令 |
| 两份开发计划、`docs/operations/bff-fe-001-functional-admission.md`、本报告与证据目录 | 同步功能/联调/发布状态、验收证据及完整确认稿 |

[全部变更路径](./evidence/bff-fe-001-local-20261018/changed-files.json)。SQL、RLS与live数据库实现未改；live逐次授权逻辑以当前pure policy和F06边界验证，未替代目标执行。

## 测试与证据

| 验证 | 当前候选结果 |
| --- | --- |
| 契约/历史strict拒绝负向 | 66 PASS |
| 新限定门禁负向 / 计划与CI负向 | 35 / 66 PASS；Node合计167 |
| live纯策略 / reference provider / F06 / session / CORS | 8 / 15 / 6 / 2 / 3 PASS；Rust合计34，无ignored |
| 当前auth/settings及共享client/schema/SSE/契约消费者 | 128 PASS（语义入口另重复运行auth/settings 29项，不重复计入128） |
| 实际loopback Rust HTTP | 20/20成功operation，21条响应契约PASS（含伪造actor拒绝422） |
| 真实源码变异 | 9/9被业务断言拒绝，均exit101、无timeout/signal/spawn error |
| 生成产物/TypeScript/lint/双计划 | PASS |
| 激活后的开发CLI / CI disposition / 计划检查 | 3/3 PASS，失败会回滚manifest与stage_gate |
| 历史审计/门禁 | 52,392个文件逐字节不变 |

执行入口 `node scripts/record-bff-fe-001-functional.mjs .../function-attempt-02`。最终每项结果、精确命令、范围原因、时间/退出状态与原始日志见[限定manifest](./evidence/bff-fe-001-local-20261018/manifest.json)、[结果统计](./evidence/bff-fe-001-local-20261018/review-results.json)、[24项控制点](./evidence/bff-fe-001-local-20261018/scope-and-controls.json)和[证据索引](./evidence/bff-fe-001-local-20261018/evidence-index.json)。

A1两份回执在基线`054945644e1b685720a7a33c3280c87c641b10ed`上核验有效，保存在[preflight](./evidence/bff-fe-001-local-20261018/preflight/a1-before-change.json)。共享源码变化后A1独立READY撤回；F06/A1三个直接前置均NOT_REVALIDATED、referenceOnly=true，覆盖范围为本任务当前直接边界，未授予上游READY。当前全图仅本任务1 READY / 158 NOT_ASSESSED。PROVIDER:A2、FE:BFF-FE-007、G1与FEP-1独立未准入。

## 失败保留与已关闭问题

当前功能缺陷已关闭2项：reference撤销后积压事件交付；consumer拒绝后reducer/响应体未终止。对应Rust新断言与401/403两类PoC通过。

首轮源码`5a15f8b15bb9654bfc992f63419aaa2a0d3aea8a`完成8组后，变异工具因缩减workspace的锁裁剪被--locked拒绝而FAIL；未执行到业务断言，未计作变异拒绝通过。见[原始失败](./evidence/bff-fe-001-local-20261018/function-attempt-01/failure-context.json)。源码`85530021`修复工具，临时副本offline裁剪后324个包均匹配原353个包的身份/版本/source/checksum，原Cargo.lock不变；第二轮14组独立执行通过，不拼接首轮结果。试跑的只读字段误回传、测试ProcessEnv缺NODE_ENV，以及首次历史路径inventory引用转义错误也保留在exploratory/preflight；均已修复。

## 未决风险、阶段与下一任务

当前限定功能无已知未关闭缺陷。真实Supabase/Auth/IdP/MFA、RLS/持久事务、跨账号/租户并发持久恢复、完整页面/API业务链、三浏览器/真实部署/性能/长稳/同SHA hosted CI均NOT_RUN；这限制本轮结论为本机reference与直接边界功能，不能代表目标生产行为。按INTEGRATION/RELEASE单独验收，当前未改数据库不触发无关整库重验。

项目用户原始确认尚未收到，[完整确认稿](./evidence/bff-fe-001-local-20261018/confirmation-draft.md)为PENDING；工程READY不代替正式ACCEPTED。遵循统一用户确认规程，不自行批准、不借用历史签署。

Git：本地功能提交`5a15f8b1`、工具修复/冻结源码`85530021`；本报告、最终证据与计划状态另随收口提交。所有提交未推送。下一可执行任务为 **FE:BFF-FE-007：Audit与导出API当前功能复核**，按F05/A1直接影响范围验证；随后再独立处理PROVIDER:A2汇总，不跳过当前任务门禁。
