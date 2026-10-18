# PROVIDER:A2 当前功能汇总复核（2026-10-18）

当前结论：`A2_SCOPE_LOCAL / DEVELOPMENT READY`，仅当前C01/C17/C10共26操作本机功能汇总。活动功能问题0；26/26限定控制点PASS。完整业务联调与发布NOT_RUN，正式ACCEPTED未授予，runtimeAdmission=DENIED。本汇总用户确认PENDING，见[完整确认稿](evidence/provider-a2-local-20261018/confirmation-draft.md)。

依据最新AGENTS.md和[开发计划](../SumAlpha-QuantOS-Development-Plan.md)，基线`52865721d1bb14fba7d352212f5237fdf7605e30`；最终冻结功能源码`3f0c9bd5f67f95156d9c5162a82aa93ebe5972b8`，781个输入，精确输入/命令见[manifest](evidence/provider-a2-local-20261018/manifest.json)。元数据提交不重授新HEAD验收，不触发无关全仓、三轮构建或递归依赖复验。

## 变更与核对

- 保存项目用户本次对BFF-FE-007完整JSON确认稿的原始答复、时间/身份、原稿/原回执摘要并执行确认门禁：CONFIRMED，仍绑定7d0fc366功能与52865721回执，原稿字节不变。BFF-FE-001原确认同样保持85530021/4f261e67。两项均非本汇总或新HEAD批准。
- 修复旧A2汇总入口强制上游READY并复用历史目标回执的开发默认路径；新增scoped gate、单候选记录器、26项当前HTTP覆盖与mandatory CI分发，旧target入口保留原用途。仅汇总节点授予READY，共享输入变化撤回007独立READY；F05/A1/001/007独立准入均NOT_ASSESSED。
- 两原回执逐一核对Git blob和normative范围、14/17组原日志、语义/变异原产物摘要；这些只证明原范围完整，不拼接为本候选PASS或READY。当前26操作与成功/拒绝/恢复在同一最终源码重新执行。
- 扩充HTTP aggregate模式及同会话真实Rust consumer组合：设置写入/版本/幂等、近期认证、导出创建/因果根/对象归属、状态与下载metadata、SSE断线重放，注销后SSE终止及设置/证据链/导出状态/下载拒绝。下载URL未实际获取。
- 负向单测改为明确的synthetic receiver fixture，消除ignored旧执行缓存前置；真实证明缺失仍拒绝，实际CLI与scoped gate未放宽。Rust运行时代码、OpenAPI与生成输出未修改。

核心变更文件：`apps/terminal/tests/a2-aggregate-consumer.test.ts`；`scripts/provider-a2-functional-{scope,gate}.mjs`、`record-provider-a2-functional.mjs`、`provider-a2-functional-gate.test.mjs`；`provider-a2-development.mjs`、`test-bff-provider-contract.mjs`、`bff-fe-001-gate-negative.mjs`；`bff-fe-007-confirmation{,.test}.mjs`；阶段policy/checker、两份计划与规程。共95个变更文件；完整逐文件清单见[changed-files.json](evidence/provider-a2-local-20261018/changed-files.json)。

## 实际测试结果

最终只使用`function-attempt-03`，全部16组正常退出，无signal/error/timeout；5个真实激活入口全部PASS。最终未拼接前两次结果。

| 验证 | 实际结果 |
| --- | --- |
| Node契约负向 | 65 PASS |
| 原确认与拒绝用例 | 48 PASS |
| 汇总门禁/回滚负向 | 44 PASS |
| 计划/CI策略负向 | 66 PASS |
| Node合计 | 223 PASS，0 fail/skip |
| Rust | 35 PASS：F05 tenant1/checkpoint1、身份15/Audit14、共享audit core4 |
| Vitest生成consumer/契约 | 82 PASS，12文件，0 fail/skip |
| 当前HTTP | 26操作全部成功，55记录；六Audit操作各401/403，额外4项注销后401；6项409、1项422、1项410 |
| A1/F05直接边界 | 生成输出一致；F05静态、tenant/provenance与checkpoint行为PASS；目标DB未执行 |
| types/lint | api-client与terminal两个受影响包PASS |
| 激活入口 | development、CI、原001确认、原007确认、plans共5项PASS |
| 凭据扫描 | 三个源码/失败证据提交的gitleaks范围扫描及逐次staged扫描0发现；最终元数据staged扫描同样0发现 |
| 历史保全 | 52,575个原audit/gate文件SHA256全部一致 |

原始日志见[execution-results.json](evidence/provider-a2-local-20261018/function-attempt-03/execution-results.json)，逐项覆盖见[control-matrix.json](evidence/provider-a2-local-20261018/control-matrix.json)。两原mutation campaign仅核对原hash，当前Rust未修改，不声称本候选执行变异；当前所有必要权限/并发/恢复/有效期行为已执行。

## 失败、修复和保留

探索阶段的旧F001日志schema解析错误与synthetic fixture状态码错误均保留。首次冻结ffd40b64在旧F001负向单测因过期ignored执行缓存FAIL，已修复fixture隔离。第二次冻结731a519d在新组合consumer误读节点correlationId时FAIL；契约把该字段放在page，已改为page correlation+节点causation/objectRef核对，未改运行时。第三次冻结3f0c9bd5独立完成当前范围全部验证，前两轮未完成部分未记PASS。

第二轮Rust二进制一度停在macOS `_dyld_start`，采样已保存，签名只读验证有效，随后29项provider及4项audit core均正常通过；最终轮未再现同级停顿。只确认启动延迟，根因NOT_ESTABLISHED，不据此宣称性能/长稳通过。

## Gate、未决风险和后续

当前计划图159节点：PROVIDER:A2限定READY1，其余NOT_ASSESSED158；无历史READY拼接。functionImplementation=PASS、businessIntegration/releaseAcceptance=NOT_RUN、formalAccepted=false、runtimeAdmission=DENIED。两原用户确认CONFIRMED，本汇总完整确认稿仍PENDING。

未决风险：真实Supabase/Auth/RLS/跨租户持久并发、export worker lease进程重启、真实私有对象及一次性下载票据消费、完整UI/API链和浏览器矩阵、目标规模五分钟证据还原、部署/性能/长稳/同SHA hosted CI尚未执行；启动延迟根因未确定。以上按INTEGRATION/RELEASE独立排期，不扩大本轮开发范围。未使用生产凭据、未连接目标DB、未运行本地数据库，未推送或外部发布。

本地提交：ffd40b64（scoped功能与原确认）、731a519d（fixture隔离及首次失败）、3f0c9bd5（组合契约断言及第二次失败）；最终证据/计划同步另以本地提交保存，最终SHA见交付答复和git log。下一可执行任务：`FE:BFF-FE-003 / A3：Research、Snapshot 与 Artifact API 当前功能复核`，按当前直接消费边界执行；A2确认稿待项目用户审阅，不能将其PENDING替换为批准。
