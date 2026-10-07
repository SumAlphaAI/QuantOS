# PROVIDER:A2：验收检查点全面复审报告

> 复审日期：2026-10-07；范围：A2 DEVELOPMENT；基线：`2835e41fcaa9f3924e9f03f95c62727b9e6c69b9`（开始时工作区干净）。
> 依据：[前端执行计划 v3.39](../SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md#acceptance-provider-a2)、[页面操作清单](../../bff/page-operation-catalog.yaml)、[OpenAPI 1.5.0](../../bff/openapi/quantos-bff.v1.yaml)、现有功能门禁、provider/consumer 测试及目标原件。

## 一、任务完成概况

**PROVIDER:A2 尚未完成窗口验收，不能认定为 DEVELOPMENT READY。** 三项直接依赖 `FE:BFF-FE-001`、`FE:BFF-FE-007`、`PROVIDER:A1` 的现有严格门禁均返回 READY，但窗口节点自身仍为 `NOT_ASSESSED`，没有聚合输入摘要与证据回执。计划级结构检查通过不等于 A2 功能验收完成。

26 个范围内 API 的实现、契约及现存实际目标成功记录均可核实，API 成功覆盖率为 **26/26，100%**。按本报告拆解的 24 个等权检查点级控制项，**18 PASS、3 PARTIAL、3 FAIL，完整完成率 75%**。PARTIAL 不折算完成；此统计是复审量化口径，不是计划字段或对子任务完成率取平均。6 个未完整满足控制项归并为 **4 个活动问题：阻塞级 1、高危 1、中危 1、低危 1**。

本轮实际执行本地契约/生成检查、Rust/Terminal 业务回归、既有负向回归、三项严格子门禁和计划结构检查；新增内存负向探针揭示了现有门禁未覆盖的证据缺口。未修改业务代码、计划或历史证据，未连接或变更数据库。目标层复用已配置 Supabase + 本机 live BFF 的原执行回执，并独立核对目标源码内容；没有将旧目标调用记作本轮实测，也没有建立本地数据库环境。

## 二、完成情况明细统计

### 2.1 范围、计算方法与逐项控制矩阵

| 检查分组 | 控制项 | PASS | PARTIAL | FAIL | 完整完成率 |
|---|---:|---:|---:|---:|---:|
| 范围、契约、依赖 C01–C03 | 3 | 3 | 0 | 0 | 100% |
| 实现、安全、状态与审计 C04–C15 | 12 | 12 | 0 | 0 | 100% |
| 测试与现存目标证据 C16–C18 | 3 | 3 | 0 | 0 | 100% |
| 证据防误放行与文档 C19–C21 | 3 | 0 | 3 | 0 | 0% |
| 窗口聚合与准入 C22–C24 | 3 | 0 | 0 | 3 | 0% |
| **合计** | **24** | **18** | **3** | **3** | **75%** |

统计公式：`完整完成率 = 完整 PASS 控制项 / 范围内控制项 = 18 / 24`。没有为缺失验收赋予推测分数；测试数量不替代需求控制项数。机器明细见[控制矩阵](evidence/provider-a2-review-20261007/control-matrix.json)。

| ID | 模块 | 检查要求 | 结果 | 核对依据/边界 |
|---|---|---|---|---|
| C01 | 范围与依赖 | C01/C17/C10 26 API、两任务及 A1；Desktop/其他窗口边界明确 | PASS | catalog、OpenAPI、前端计划 A2 |
| C02 | 契约与开发规范 | OpenAPI/client/Zod/schema/MSW 生成一致；现有规范输入绑定有效 | PASS | generated.log、当前 A1 回执；本轮未重跑完整 fmt/lint/typecheck |
| C03 | 依赖门禁 | 三项直接依赖当前严格 DEVELOPMENT READY | PASS | identity-gate.log / audit-gate.log / provider-a1-gate.log |
| C04 | 实际 provider | 26 API 在 live Router 挂载，均有实际目标成功记录 | PASS | api-matrix.json；live.rs:124、settings.rs:285、audit.rs:290 |
| C05 | 身份与授权 | opaque cookie、Origin、capability、workspace/account/owner 范围 | PASS | Rust 回归；两目标回执正常及拒绝记录 |
| C06 | 敏感操作保护 | CSRF、recent authentication、MFA 恢复与最后有效因素保护 | PASS | auth/settings 回归、14 条身份目标强断言 |
| C07 | schema 与错误 | 输入/响应 schema、安全错误及资源隐藏、过期拒绝 | PASS | 契约检查、consumer 回归、目标 records issues 为空 |
| C08 | 幂等与并发 | 相同意图回放、改变意图拒绝、If-Match 与无副作用冲突 | PASS | provider 回归、目标 durable-identical-intent-replay 等 |
| C09 | 持久化与恢复 | 资料/偏好持久化、MFA 中间态、export worker 重启租约恢复 | PASS | 原实际 Supabase 回执及已执行断言；不是本轮数据库重测 |
| C10 | 会话实时流 | SSE 撤销关联、会话/设备撤销及安全终止 | PASS | 身份实际 stream/revocation 目标证据及策略回归 |
| C11 | 审计可追溯 | 响应 correlation、F05 账本桥接、causation 与导出全生命周期 | PASS | 目标 traces、identity-audit-bridged-to-f05 / export-lifecycle-causal-root |
| C12 | 审计查询 | 稳定快照/分页、脱敏、canonical payload hash、证据链 | PASS | audit_export_provider 回归及真实账本目标断言 |
| C13 | 导出内容 | 真实 Storage 字节、摘要、全范围水印脱敏、JSON/CSV/PDF | PASS | actual-storage-integrity / real-csv-artifact / real-pdf-artifact |
| C14 | 下载与吊销 | 短时一次性下载、过期/retention/取消/权限撤销拒绝 | PASS | 目标 concurrent-ticket-consumption-once 等；consumer 到期错误映射 |
| C15 | 资源边界 | 分页/快照/产物限制、每 actor 导出 quota | PASS | 目标 per-actor-create-quota；audit 源码与运行说明 |
| C16 | 业务测试 | Rust provider + Terminal consumer 本轮语义回归通过 | PASS | provider-regressions.log、consumer-regressions.log |
| C17 | 业务安全负向与变异 | 已有 62 门禁负向回归；旧 8+5 业务变异实际拒绝证据有效 | PASS | gate-regressions.log；当前两个 manifest 内 mutation 原件，未新增执行旧变异 |
| C18 | 实际目标证据复用 | 26/26 成功、20 项摘要匹配原提交/当前文件、清理回执有效 | PASS | api-matrix.json / source-inventory.json；本轮无目标调用 |
| C19 | 证据语义防误放行 | 成功状态/SSE 状态负向检查：007 拒绝，001 错误接受 | PARTIAL | H-01；receipt-negative-probes.json、audit-receipt-negative-probes.json |
| C20 | 执行提交溯源门禁 | 两实际回执可溯源，但两个子门禁均接受删除 sourceCommit | PARTIAL | M-01；source-inventory.json、两份新增负向探针 |
| C21 | 当前文档一致性 | 007 当前报告有效；001 当前报告仍引用旧 G0/READY 数/回执 | PARTIAL | L-01；BFF-FE-001 报告:4/17/19/74 |
| C22 | 窗口聚合回执 | A2 自身规范输入、26 API 覆盖、依赖摘要、执行结果未聚合 | FAIL | B-01；checkpoint stage_gate input_digest=null / evidence=[] |
| C23 | 窗口专用检查与 CI | 缺少 A2 聚合校验器、负向套件及 CI 强制检查入口 | FAIL | B-01；现有 package/Makefile/workflow 仅子任务/A1 检查 |
| C24 | 窗口阶段准入 | PROVIDER:A2 未执行阶段评估，仍 NOT_ASSESSED | FAIL | B-01；checkpoint-validator-probe.json、计划 A2 JSON |

C02 的新执行范围为契约/生成漂移检查；完整开发规范工具执行沿用当前 A1 内容绑定回执，未宣称本轮重跑全部 lint、格式或类型检查。C17 的本轮新执行为 62 项既有门禁负向回归，8+5 业务变异为已执行原件的重新校验。既有负向测试全部通过，并不意味着新发现的回执语义缺口已被覆盖。

### 2.2 全部 API 明细

A2 主责任范围：C01 六项、C17 十四项属于 BFF-FE-001；C10 六项属于 BFF-FE-007，合计 26 项 published、0 项 planned。C17 的 Desktop 第二期共责、其他 A 窗口接口不混入本统计。整个 OpenAPI 的 62 项 published 仅证明契约基线，不能记作 A2 已实现 62 项。

下表成功状态来自**原实际目标记录**，与 OpenAPI 成功响应逐项核对；实际 live router 挂载见 `services/bff-gateway/src/live.rs:124`、`live/settings.rs:285`、`live/audit.rs:290`。完整调用数、所有观测状态和原回执路径见[26 项 API 矩阵](evidence/provider-a2-review-20261007/api-matrix.json)。

| 契约 | operationId | 方法与路径 | 实际成功状态 | 结果 |
|---|---|---|---|---|
| C01 | getSession | GET `/v1/session` | 200 | PASS |
| C01 | getContext | GET `/v1/context` | 200 | PASS |
| C01 | reauth | POST `/v1/auth/reauth` | 200 | PASS |
| C01 | mfaChallenge | POST `/v1/auth/mfa/challenges` | 200 | PASS |
| C01 | logout | POST `/v1/auth/logout` | 204 | PASS |
| C01 | submitAccessRequest | POST `/v1/access-requests` | 202 | PASS |
| C17 | getProfile | GET `/v1/settings/profile` | 200 | PASS |
| C17 | saveProfile | PUT `/v1/settings/profile` | 200 | PASS |
| C17 | getNotificationPrefs | GET `/v1/settings/notification-preferences` | 200 | PASS |
| C17 | saveNotificationPrefs | PUT `/v1/settings/notification-preferences` | 200 | PASS |
| C17 | getSecuritySettings | GET `/v1/settings/security` | 200 | PASS |
| C17 | listSessions | GET `/v1/settings/sessions` | 200 | PASS |
| C17 | revokeSession | DELETE `/v1/settings/sessions/{sessionId}` | 202 | PASS |
| C17 | subscribeSessionRevocations | GET `/v1/settings/sessions/stream` | 200 | PASS |
| C17 | listDevices | GET `/v1/settings/trusted-devices` | 200 | PASS |
| C17 | revokeDevice | DELETE `/v1/settings/trusted-devices/{deviceId}` | 202 | PASS |
| C17 | setupMfa | POST `/v1/settings/mfa/setup` | 202 | PASS |
| C17 | revokeMfaFactor | DELETE `/v1/settings/mfa/factors/{factorId}` | 202 | PASS |
| C17 | listDownloads | GET `/v1/settings/downloads` | 200 | PASS |
| C17 | getPlatformCapabilities | GET `/v1/platform/browser-capabilities` | 200 | PASS |
| C10 | searchAuditEvents | GET `/v1/audit/events` | 200 | PASS |
| C10 | getEvidenceChain | GET `/v1/audit/evidence-chains/{correlationId}` | 200 | PASS |
| C10 | createExport | POST `/v1/exports` | 202 | PASS |
| C10 | getExportStatus | GET `/v1/exports/{exportId}` | 200 | PASS |
| C10 | cancelExport | POST `/v1/exports/{exportId}/cancel` | 202 | PASS |
| C10 | getExportDownload | GET `/v1/exports/{exportId}/download` | 200 | PASS |

### 2.3 验证执行与证据有效性

| 层次 | 本轮结果 | 证据 |
|---|---|---|
| 子任务和 A1 功能门禁 | 三项 READY；校验当前规范输入、依赖与旧实际执行证据 | [身份](evidence/provider-a2-review-20261007/identity-gate.log)、[Audit](evidence/provider-a2-review-20261007/audit-gate.log)、[A1](evidence/provider-a2-review-20261007/provider-a1-gate.log) |
| 计划结构 | PASS；全计划 25 READY / 0 BLOCKED / 134 NOT_ASSESSED，A2 仍未评估 | [结构检查](evidence/provider-a2-review-20261007/plans.log) |
| 契约与生成 | 两子任务 local contract PASS；生成六类产物一致；全基线 62 操作/52 schema | [命令结果与 stdout 边界](evidence/provider-a2-review-20261007/command-results.json)、[OpenAPI](evidence/provider-a2-review-20261007/generated.log) |
| Rust 业务回归 | lib 14、身份 12、Audit 9 PASS；1 项 F09 目标数据库测试 ignored，不计 PASS | [Rust 日志](evidence/provider-a2-review-20261007/provider-regressions.log) |
| Terminal consumer | 三文件 35 PASS | [consumer 日志](evidence/provider-a2-review-20261007/consumer-regressions.log) |
| 既有门禁负向 | 62 PASS、0 FAIL | [负向回归](evidence/provider-a2-review-20261007/gate-regressions.log) |
| 本轮新增语义探针 | 身份全 500、全 401、SSE 500 误放行；两子门禁删除执行提交误放行；Audit 全 500 正确拒绝 | [身份探针](evidence/provider-a2-review-20261007/receipt-negative-probes.json)、[Audit 探针](evidence/provider-a2-review-20261007/audit-receipt-negative-probes.json) |
| 身份原实际目标 | 原提交 `d758c839fbd57366346d0f2b9ef2081c68ab51e6`：51 次调用、20 API、14 强断言、清理通过 | [不可变原回执](evidence/bff-fe-001-remediation-20261005/bff007-live-20261006/receipt.json) |
| Audit 原实际目标 | 原提交 `5e3339c9e5cc95d550c6e67ffa36701998cb0e2f`：83 次调用（含身份准备）、45 执行断言、六接口正常/401/403、清理通过 | [不可变原回执](evidence/bff-fe-007-remediation-20261006/live-final-15/receipt.json) |
| 目标内容复核 | 身份 7 项 + Audit 13 项，共 20 次逐文件摘要核对（17 个不同文件），均匹配原 Git 提交及当前源码 | [源码清单](evidence/provider-a2-review-20261007/source-inventory.json) |

两份原回执共 134 次调用，含准备操作与重复场景，不是 134 个独立需求；Rust、consumer、契约与门禁套件有重叠，不将通过数累加为总验收用例数。身份目标 `sourceTreeClean=false` 不单独认定失效：本轮逐项验证的七项目标源码确实与原提交一致。文档/证据变化不应强制否定内容未变化的目标证据；必须保留原执行提交、范围和时间边界。

现有有效子任务回执为[身份格式复评回执](evidence/bff-fe-001-remediation-20261005/core-plan-format-reassessment-20261007/a2.json)和[Audit 格式复评回执](evidence/bff-fe-007-remediation-20261006/core-plan-format-reassessment-20261007/development.json)。它们明确不覆盖 PROVIDER:A2/ALL，不能自动继承为窗口 READY。

## 三、问题清单及风险分析

| ID | 优先级 | 所属模块 | 具体表现 | 影响范围 |
|---|---|---|---|---|
| B-01 | 阻塞级 | PROVIDER:A2 聚合门禁/计划/CI | 自身 NOT_ASSESSED、摘要空、证据空，无专用聚合门禁和 CI 入口 | 窗口验收和依赖 A2 的 A3 准入 |
| H-01 | 高危 | 身份 API DEVELOPMENT 证据校验 | 失败状态仍满足 operationId 存在判断并返回 READY | 身份子任务及递归依赖/未来窗口的验收可信度 |
| M-01 | 中危 | 两子任务 live 执行溯源 | 两门禁均接受缺失 sourceCommit 的合成回执 | 执行 provenance、复现及历史证据追踪 |
| L-01 | 低危 | 身份 API 当前检查报告 | 旧 G0/READY 数及过期回执被标为当前 | 人工核对与开发准入判断 |

### B-01：窗口验收链尚未建立

计划 A2 节点自身为 `stage_gate.status=NOT_ASSESSED`、`input_digest=null`、`evidence=[]`。工程中存在身份/Audit/A1 入口，却未找到 A2 窗口专用聚合 policy、脚本、负向套件、package/Makefile 入口或强制 CI 步骤。[现有 frontend CI](../../.github/workflows/frontend-baseline.yml)第 91–106 行检查的是两个子任务；[入口探针](evidence/provider-a2-review-20261007/checkpoint-validator-probe.json)也确认 A1 校验器不处理 A2，此处不是 A1 校验器自身的缺陷。

风险是把“两个子任务 READY”误当成“窗口验收完成”。需要窗口级证明，绑定范围与 API 全量覆盖、当前规范输入、依赖摘要、执行结果和专用负向证据，再评估自身状态。全计划的 `0 BLOCKED` 是已标记节点状态统计，不代表 `NOT_ASSESSED` 的 A2 没有准入阻塞；本报告的“阻塞级”是审计严重度，未改写计划为 BLOCKED。

### H-01：身份目标失败状态会被错误接纳

[身份校验器](../../scripts/bff-fe-001-development.mjs)第 28–32 行只要求 live 总状态 PASS、固定断言字符串、源码摘要、每个 operationId 至少出现一次、issues 为空及清理通过，未核验各操作的成功响应状态。内存探针保留原源码摘要、断言字符串、成功 traces 与其他证据，修改 records 状态并重算外层 live 文件摘要，出现以下结果：

- 全部调用改为 500：返回 READY。
- 全部调用改为 401：返回 READY。
- 仅 `subscribeSessionRevocations` 改为 500：返回 READY。

探针名称 `missing-sse-stream-proof` 的实际变更仅为 SSE 记录状态改成 500，并未删除其他 revocation 断言，不扩大解读为已验证任意 SSE 消息伪造。实际目标原件仍具有 20/20 成功记录；本发现证明的是**门禁对内部不一致的失败回执缺乏拒绝能力**，不是生产 API 故障、真实账户越权或源码漏洞。外层摘要能防无意篡改，但不能替代重新打包时的业务语义检查。007 的全 500 对照探针正确拒绝。

### M-01：执行提交缺失未被门禁拒绝

两个子任务都能在删除 `live.sourceCommit` 后返回 READY。[Audit 校验器](../../scripts/bff-fe-007-development.mjs)第 24–27 行虽检查 `sourceMatchesCommit=true` 和当前输入摘要，却不要求 live 执行提交标识存在并可解析。外层 `observedSourceCommit` 记录工程回执生成时的观察提交，不能替代目标执行提交。

本轮额外用 `git show <目标 sourceCommit>:<path>` 完成 20 项核对，因此现存证据可追溯。问题在于程序未强制这一前提，未来丢失执行提交的回执仍可准入。修复应按功能文件内容绑定，允许无关文档变化后的证据复用，不要求历史目标提交与当前 HEAD 完全相同。

### L-01：身份当前报告未反映最新工程状态

[身份当前报告](BFF-FE-001-comprehensive-review-2026-10-05.md)第 4/17/19/74 行仍引用 `dd8672c`、`ci-cold-cache-lint-final-20261006/a2.json`、22 READY，以及“新 G0 用户确认待办、保持 BLOCKED”。当前计划已记录 25 READY；[G0 原始确认记录](../gate-records/G0-user-confirmation-2026-10-07-1d2bce97fcfb.json)为 CONFIRMED；当前身份 stage_gate 指向格式复评回执。应保留这些文字的历史意义，同时让“当前”结论引用最新证据和本轮新问题。

### 不计为本次活动缺陷的后续边界

完整 consumer/UI 页面链路属于 I 迭代；staging、真实部署/IdP、性能/长稳、目标规模下五分钟还原和正式签署属于 RELEASE。未执行这些范围不扣本次 DEVELOPMENT 完成率，也不以 A2 `review_status=NOT_STARTED` 本身列缺陷。按照用户确认规程，若后续阶段需要签署，由 Codex 拟定文稿并保留用户真实答复；本轮不自行批准。没有获取本基线新 hosted CI 回执，本地通过不等于 hosted CI 或正式 `ACCEPTED`。

## 四、整改建议

| 顺序 | 对应问题 | 建议操作 | 关闭标准 |
|---|---|---|---|
| 1 | H-01 | 以 catalog/OpenAPI 固定 20 API 清单及成功状态；逐接口检查合法成功记录，SSE 要求 200 和已执行流/撤销关联断言；拒绝缺失、全部拒绝或失败状态冒充覆盖 | 新增全 500、全 401、逐项成功缺失、SSE 失败等反例均拒绝；正常旧目标和业务回归通过 |
| 2 | M-01 | 两个 live 回执要求 40 位可解析 sourceCommit，核对 sourceHashes 与该不可变 Git 提交和当前功能输入；记录复用/重新执行边界，不只信任 boolean | 删除/伪造/不存在提交、原提交源码不匹配均拒绝；原目标7/13项匹配且无关文档变化时可合法复用 |
| 3 | B-01 | 建立 PROVIDER:A2 专用规范输入清单与聚合 manifest；递归校验两个严格子任务和 A1、26 API 覆盖、证据摘要/执行结果/目标边界；增加 package/Makefile 和 CI 强制入口、专用负向套件 | 缺子依赖/回执、过期输入或依赖、planned冒充实现、缺API、失败证据、借用A1/子任务回执等反例拒绝；实际正向评估通过后再写入自己的 READY/digest/evidence |
| 4 | L-01 | 将旧身份当前结论移为历史，更新有效 manifest、G0/阶段统计及新活动问题；同步跨报告的当前结论 | 当前链接解析且内容校验通过；旧问题/执行原件完整保留；人工表述与实际 stage_gate 一致 |

聚合脚本应先检查有效证据再发布状态，并在 CI 中实际调用，避免只加一个 READY 字段或只检查路径存在。修复后按相同控制矩阵复核，全部 24 项满足再认定检查点完成；按受影响功能输入及依赖内容刷新相关回执，功能内容变化需要相应目标重测。未经实际执行的数据库检查保持 NOT RUN。

本次审计仅保存本报告与[机器证据清单](evidence/provider-a2-review-20261007/evidence-index.json)，没有修改计划、发布 A2 READY、生成 Git 提交或替项目用户签署。
