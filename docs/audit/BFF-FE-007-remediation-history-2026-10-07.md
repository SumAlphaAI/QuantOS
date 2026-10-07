# BFF-FE-007：Audit 与导出 API 整改复验报告

> 初审与整改启动：2026-10-06（Asia/Shanghai）；阶段：A2 DEVELOPMENT。
> 用户范围确认更新：2026-10-07T08:02:59+08:00；详见独立确认验收记录。
> 复验报告生成：2026-10-07T07:34:57+08:00。
> Audit 目标运行源码：`5e3339c9e5cc95d550c6e67ffa36701998cb0e2f`，目标回执逐文件核验 `sourceMatchesCommit=true`。文档提交另行生成，功能证据按内容绑定，不冒充新 HEAD 的 hosted CI 或正式验收。
> 当前工程冻结源码：`5227d25611a621e2d954b58b73fe10869246250d`；严格门禁已核对 Audit 目标的 13 项运行源码与当前内容一致。
> 依据：[前端任务卡](../SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md#task-bff-fe-007)、Terminal P12、OpenAPI 1.5.0/C10；运行与权限范围见 [live runtime](../BFF-FE-007-runtime.md)。
> [初始复审原件](archive/BFF-FE-007-initial-review-2026-10-06.md)及[原始证据](evidence/bff-fe-007-review-20261006/evidence-index.json)完整保留。

## 一、任务完成概况

**本任务 DEVELOPMENT 修复完成，严格功能门禁 READY。** 原 9 项问题（1 阻塞、1 高危、7 中危、0 低危）全部关闭；活动问题 0。31 个等权控制点 **31 PASS、0 PARTIAL、0 FAIL，完整完成率 100%**，初审为 41.94%。六个 published API 已接入实际 live BFF 并连接配置的 Supabase；不以参考 fixture 或静态检查代替目标执行。

[功能 manifest](evidence/bff-fe-007-remediation-20261006/final-sharp/development.json)严格核验当前源码/规范计划、三项直接依赖、执行日志、语义变异以及不可变提交上的目标证据。BFF-FE-001/F05/PROVIDER:A1 当前依赖已复评 READY。本结论不批准 PROVIDER:A2/ALL、十个消费页面联调、RELEASE 或 `review_status=ACCEPTED`。

2026-10-07，项目用户明确答复“确认 G0 DEVELOPMENT 文稿”，当前范围 `900e809c60dd` 已核验并登记。G0 消费原 16/16 工程 PASS 后严格 READY；确认后重新执行 FEP-0 两项检查，严格 READY，当前 25 READY、0 BLOCKED。原 PENDING 回执、台账及[确认前报告](archive/BFF-FE-007-before-G0-user-confirmation-2026-10-07.md)保留；见[本次确认验收记录](G0-FEP0-user-confirmed-acceptance-2026-10-07.md)。

## 二、完成情况明细统计

### 2.1 六接口实际执行

正常响应与当前能力拒绝均经 HTTP contract schema 校验。下表为本轮真实目标调用次数，轮询与重放会产生多次调用，不能相加作为唯一验收用例数。

| Operation | 实现/目标结果 | 200/202 次数 | 401 次数 | 403 次数 |
|---|---|---:|---:|---:|
| `searchAuditEvents` | live / PASS | 3 | 1 | 1 |
| `getEvidenceChain` | live / PASS | 5 | 1 | 1 |
| `createExport` | live / PASS | 4 | 1 | 4 |
| `getExportStatus` | live / PASS | 18 | 1 | 1 |
| `cancelExport` | live / PASS | 2 | 1 | 1 |
| `getExportDownload` | live / PASS | 7 | 1 | 1 |

目标回执共 **83 次 API 调用、45 条执行断言**；三格式真实下载字节、并发一次消费、篡改拒绝、取消/过期吊销、进程重启恢复、生成失败/审计和资源 owner 隐藏均已执行。[目标回执](evidence/bff-fe-007-remediation-20261006/live-final-15/receipt.json)明确 `configured-supabase`、`cleanupVerified=true`、`formalAccepted=false`。服务在本机 loopback，使用合成 HTTPS Origin；未部署 staging。

### 2.2 31 项完成矩阵

沿用初审等权口径：PASS=1，PARTIAL/FAIL=0，不把部分实现折算为完成。[机器可读矩阵](evidence/bff-fe-007-remediation-20261006/control-matrix.json)保存相同统计。

| ID | 控制点 | 结果 | 当前证据事实 |
|---|---|---|---|
| C01 | 六个 operation 与请求/响应 schema 发布 | PASS | OpenAPI 1.5.0 六 operation 未扩展；实际契约/生成门禁通过 |
| C02 | C10 owner 与十个消费页面映射 | PASS | C10 十页面映射保持一致；页面实现与集成独立验收 |
| C03 | client/Zod/JSON Schema/MSW 同源生成及无漂移 | PASS | 当前生成物、page contract coverage 通过，无生成漂移 |
| C04 | 参考搜索条件与有界 pageSize、sort/filter、时间输入 | PASS | 搜索范围、排序、时间和 pageSize 1–200 的业务回归通过 |
| C05 | 固定参考链的 correlation/causation 分页还原 | PASS | 参考链与真实域事件链分开验证；8 域 eventId/独立 auditRef/sequence 实测一致 |
| C06 | 六接口参考 cookie/capability 的 401/403 | PASS | 参考六接口 401/403，目标六接口缺身份 401 与 capability 403 矩阵全部通过 |
| C07 | 参考 create/cancel 的 CSRF、recent-auth | PASS | 实际创建缺 CSRF/recent-auth 返回 403；当前 session recent-auth 五分钟绑定 |
| C08 | 参考敏感响应 no-store 与错误外观隐藏 | PASS | 错误/no-store 规范回归通过；未知资源隐藏，trace 不记签名或票据 |
| C09 | 完整业务意图的幂等、冲突与恢复 | PASS | 完整范围规范化、主体/账号/目标绑定、持久相同 key 重放；改任一范围字段 409 且无业务/审计变化 |
| C10 | 不透明且不可篡改、绑定查询的稳定游标 | PASS | 服务器五分钟快照及高熵 token 摘要；伪造、不同 pageSize、跨搜索/链游标 422 |
| C11 | 证据链完整性判定与真实因果覆盖 | PASS | 真实 event_log causation 链三页完整还原；身份/完整导出生命周期因果根也实测，complete 结合依赖节点完整性 |
| C12 | 服务端字段级脱敏、禁止完整标识/秘密输出 | PASS | 白名单 audit-v1 脱敏真实载荷/自由文本；合成账号/秘密不进入返回/产物 |
| C13 | 真实 payload hash 与可验证证据摘要 | PASS | 实际脱敏载荷 canonical SHA-256；实际下载字节 SHA-256/sizeBytes 核对一致 |
| C14 | 六接口可由实际 live BFF 接收与处理 | PASS | live 挂载并实际执行六 API，成功和无能力拒绝均有 schema 验证 |
| C15 | F05 持久审计读模型及数据库功能连接 | PASS | Supabase audit_entries LEFT JOIN event_log、域 eventId/sequence；身份审计同事务桥接 F05 |
| C16 | 资源级主体/账号授权与无权资源隐藏 | PASS | RLS tenant/actor 与显式 scope，job owner/context；自有测试 job 改 owner/account scope 后 404，恢复原值 |
| C17 | 完整 ExportScope：eventKinds/time range/unique IDs | PASS | eventKinds/startAt/endAt 进入规范化意图及产物过滤；重复/逆序/未知字段 422，未知链 404 |
| C18 | 持久异步导出、生成产物、重启恢复与取消工作流 | PASS | 持久队列/独立 worker/私有 Storage，lease 与 fencing；真实重启恢复和取消吊销通过 |
| C19 | queued/generating/ready/cancel/expired/failed 状态机制 | PASS | queued/generating/ready/cancelled/expired/failed 实际状态；受控 oversized 触发三次失败后 failed 并留审计 |
| C20 | 真实短时、一次性签名 URL、实际水印与文件元数据 | PASS | 三种真实带水印产物；HMAC 签名资源票据五分钟内/一次消费；串行和并发二次消费 410 |
| C21 | retention/到期拒绝与下载吊销联动 | PASS | DB now 检查 retention；受控推进过期后签发/消费均 410；取消已发票据同样 410 |
| C22 | 导出与受限访问全过程审计、持久可追溯 | PASS | F05 持久记录受限读、拒绝、生成、完成、消费、取消、过期及失败；trace 掩盖 URL 签名 |
| C23 | 六个 typed gateway、cookie 与安全头携带 | PASS | 六 typed gateway 保留 cookie、CSRF、reauth 与业务头，consumer 回归通过 |
| C24 | 403/404/410 gateway 安全文案与 correlation 信息 | PASS | 安全 ErrorEnvelope 校验，403/404/410 外观隐藏内部消息与详情 |
| C25 | 成功响应 runtime schema 与安全约束校验 | PASS | 六响应 runtime schema；未脱敏、非水印、畸形/过期/越过 retention 的 lease 全部拒绝 |
| C26 | 基础 transport 截止时间与写请求不自动重试 | PASS | 共享 30 秒截止、写请求不自动重试保持；Auth 暂态重试仅在受控测试驱动内显式执行 |
| C27 | 三项直接依赖的实际内容绑定 READY | PASS | 严格递归校验 BFF-FE-001、CORE:F05、PROVIDER:A1 当前输入/依赖/执行日志 READY |
| C28 | 工程规范与既有本任务正负/业务/consumer 回归实际执行 | PASS | Rust/Terminal 业务语义、变异、类型、ESLint、fmt/Clippy 与迁移静态/目标检查通过 |
| C29 | 任务级功能 manifest、输入/目标摘要与严格阶段 Gate | PASS | 独立 development manifest 绑定功能输入/计划/日志/依赖/目标提交；注释冒充与失效前置等负向测试拒绝 |
| C30 | 六接口真实目标正常/安全负向/恢复/清理验收 | PASS | 真实 Supabase Auth/PostgreSQL/private Storage + 本机 live BFF 正常、拒绝、完整性、恢复及清理回执 PASS |
| C31 | 请求资源限制与每主体/操作的配额 | PASS | 64 KiB/pageSize 200/快照 10000/产物16MiB；持久每主体操作配额，创建5/min，其他120/min，目标429通过 |

| 分组 | 控制点 | PASS | PARTIAL | FAIL | 完整满足率 |
|---|---:|---:|---:|---:|---:|
| 契约/参考 C01–C08 | 8 | 8 | 0 | 0 | 100% |
| 业务/安全/live C09–C22 | 14 | 14 | 0 | 0 | 100% |
| consumer/前置/验收/资源 C23–C31 | 9 | 9 | 0 | 0 | 100% |
| 合计 | 31 | 31 | 0 | 0 | 100% |

### 2.3 执行层与证据边界

| 层次 | 当前实际结果 | 证据 |
|---|---|---|
| BFF Rust + Terminal + 严格 Gate 语义 | 三项规定命令全部 PASS；Audit Rust 9、身份 Rust 12、gateway 6、门禁 26，以及 lib 回归通过 | [semantic proof](evidence/bff-fe-007-remediation-20261006/final-sharp/semantics.json) |
| 语义变异 | 5/5 均由指定业务断言拒绝，未把编译失败计为有效变异 | [mutations](evidence/bff-fe-007-remediation-20261006/final-sharp/mutations.json) |
| 工程规范 | 类型/定向 ESLint/fmt/Clippy `-D warnings`、迁移静态与 RLS 负向通过；staged/history Gitleaks 无泄漏 | [迁移静态](evidence/bff-fe-007-remediation-20261006/migration-static-final.log)、[RLS 负向](evidence/bff-fe-007-remediation-20261006/rls-negative.log) |
| 实际 Supabase 迁移/目标 | 五项迁移真实 APPLIED；六 API / Auth / 私有 Storage / 清理 PASS | [目标回执](evidence/bff-fe-007-remediation-20261006/live-final-15/receipt.json)；migration*.log |
| F0/A1 当前前置复验 | 87/87 执行项 PASS，含三轮独立构建、真实 F06/数据库/Storage/恢复/量测 | [完整执行结果](evidence/provider-a1-remediation-20261004/bff007-final-6-20261007/execution-results.json) |
| 身份/设置跨模块回归 | 当前 BFF-FE-001 源码/目标/14 项强断言、8 项变异及清理 PASS | [当前 A2 manifest](evidence/bff-fe-001-remediation-20261005/bff007-sharp-20261007/a2.json) |
| G0/FEP-0 | 项目用户当前范围 CONFIRMED；两阶段严格 DEVELOPMENT READY | [G0 当前回执](evidence/frontend-g0-fep0-remediation-20261005/bff007-sharp-20261007/g0.json)；[FEP-0 确认后回执](evidence/fep0-remediation-20261005/user-confirmed-20261007-900e809c60dd/fep0.json) |
| hosted CI / 部署 / 目标规模 SLA / 正式签署 | 本轮未执行/没有新提交回执 | RELEASE 单独验收，不沿用旧 SHA green |

[历次目标执行台账](evidence/bff-fe-007-remediation-20261006/target-run-history.json)保留各轮源码、结果、断言数与清理边界；仅 live-final-15 为当前完整通过基线。此前字段/计数/会话/传输失败及 diagnostic PASS 均未拼接为最终通过。attempt-3 原清理声明未覆盖意外创建的额外任务，[追加清理纠正回执](evidence/bff-fe-007-remediation-20261006/attempt-3-cleanup-correction.log)已单独记录删除。

重复超时的诊断和修正见 [主体全量读取](evidence/bff-fe-007-remediation-20261006/transfer-diagnostic-before.log)、[范围下推读取](evidence/bff-fe-007-remediation-20261006/transfer-diagnostic-after.log)：494 行/365656 字节/29837ms 缩小为指定 correlation 的 8 行/6847 字节/2012ms，不作为正式 SLA 验收。最终驱动仅对可恢复传输执行有限 GET 重试、创建/取消同 key 同意图显式恢复，以及初始连接/握手/MFA 上游暂态恢复；业务拒绝和断言失败不重试。当前最终轮 transportAttempts 为空；消费者写请求未增加自动重试。

首次基础复评 87 项中 81 PASS、6 FAIL，原件保留在[失败基础执行](evidence/provider-a1-remediation-20261004/bff007-final-20261006/execution-results.json)。根因为 UUID 显式业务键精确清单缺项（同时影响 RLS/F07 诊断）、PRE-04 源码绑定过期及 reference 正向导出夹具引用未知 correlation；已补齐精确清单与反证、刷新本地参考绑定并修正夹具。

第二轮 86 PASS/1 超时：完整 F05 八项数据库命令达到通用 900 秒上限，没有断言失败。同提交、源码/计划未变时，将执行窗口设为 1800 秒，独立执行相同命令和全部八项断言，558.29 秒完成、8 PASS。[旧组合说明](evidence/provider-a1-remediation-20261004/bff007-final-3-20261006/composition.json)、[原超时轮](evidence/provider-a1-remediation-20261004/bff007-final-2-20261006/execution-results.json)和[完整重跑](evidence/provider-a1-remediation-20261004/bff007-final-3-20261006/f05-database-rerun.json)保留历史；该旧组合是独立命令组通过，未称为单次不间断 87 项通过。

写入 Audit 严格回执时还发现 Node 的 `pass/fail` 摘要与 Rust/Vitest 的 `passed` 不兼容。已按命令类型核验正数 Node 通过数及零失败，并补充 TAP/spec、零执行、失败、注释伪装反证；没有改写日志文本。修正后的冻结轮 86 PASS/1 FAIL，唯一失败为本轮 npm 新返回的 [Sharp 高危公告](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w)，[原失败 SCA](evidence/provider-a1-remediation-20261004/bff007-final-4-20261006/logs/f02-sca.log)保留。

已固定 Sharp 0.35.5、平台二进制及 libvips 1.3.4，校验 14 项 SPDX/完整性精确映射，维持既有 static-web-build-only 范围并保留原许可决定，更新 NOTICE；未新增漏洞豁免或一般许可证允许类型。[补充关闭依据](evidence/bff-fe-007-remediation-20261006/sharp-remediation-20261007.json)保存 SCA 与原生解码验证。最终在新冻结源码上，87 个必需命令组全部完成并通过，刷新 21 个基础节点及 A2/G0/FEP-0 回执；本轮 F05 八项命令自身正常通过。一万事件量测期间观测到约六小时墙钟跃迁，原量测未生成结束回执，受控终止后保留[中断记录](evidence/bff-fe-007-remediation-20261006/volume-environment-interruption-20261007.json)，其余 86 个命令组通过；同源码、未变化输入上独立完整重跑一万事件及全部断言通过。最终按[独立命令证据组合](evidence/provider-a1-remediation-20261004/bff007-final-6-20261007/composition.json)记录 87/87 PASS，没有宣称一次不间断 87 项全通过，也没有拼接半轮量测。历史迁移、原始验收回执和业务断言未修改。


G0 首次工程执行在 Buf 远程插件步骤遇到网络不可达，前七项已通过；保留[原失败日志](evidence/frontend-g0-fep0-remediation-20261005/bff007-sharp-20261007-proto-transport-failed/logs/proto.log)及[原件路径映射](evidence/frontend-g0-fep0-remediation-20261005/bff007-sharp-20261007-proto-transport-failed/archive-relocation.json)。同源码、同命令完整重跑后 16/16 通过，失败原件没有改写为通过。

## 三、问题清单及风险分析

**当前阻塞/高危/中危/低危均为 0。** 原报告 9 项问题全部关闭，复验中额外发现的 Sharp 高危依赖问题另列补充关闭依据，不混入原始发现统计。 下表为关闭摘要，完整原始表现、影响、建议与关闭依据见 [关闭台账](evidence/bff-fe-007-remediation-20261006/closed-findings.json)，历史严重度不重新归类。

| ID | 原优先级 | 模块 | 状态 | 根因修复与关闭依据 |
|---|---|---|---|---|
| B-01 | 阻塞级 | live BFF / F05 Audit read model / export worker 与 Storage | CLOSED | 完成六 live API、F05 查询/身份桥接、私有 Storage、持久 worker/lease/fencing、配额与完整目标回归。 |
| H-01 | 高危 | ExportScope / create_export / idempotency / request contract | CLOSED | 完整 scope 规范化校验与持久幂等绑定；重复/逆序/未知字段拒绝，scope 冲突 409 且零业务/审计副作用。 |
| M-01 | 中危 | 审计载荷脱敏 / record_audit_action | CLOSED | 统一 audit-v1 白名单脱敏及水印摘要，不输出自由文本中的账号/秘密。 |
| M-02 | 中危 | Audit payloadHash / evidence integrity / download metadata | CLOSED | 真实 canonical 脱敏载荷与最终产物 SHA-256、实际字节长度；下载前完整性核验。 |
| M-03 | 中危 | audit cursor / evidence pagination / complete | CLOSED | 服务器持久快照及绑定身份/查询/资源/pageSize 的不透明游标；真实域事件因果完整性。 |
| M-04 | 中危 | export retention / expiry / deterministic clock | CLOSED | DB now/统一参考时钟，retention 签发/消费双检查与取消/会话吊销；worker 到期清理。 |
| M-05 | 中危 | Terminal audit gateway / response validation | CLOSED | 六 gateway 调用 runtime schema，验证脱敏、水印、签名 URL/有效期/retention 安全约束。 |
| M-06 | 中危 | BFF-FE-007 Gate / stage evidence / completion accounting | CLOSED | 输入/计划/前置/语义/变异/不可变目标提交强绑定 development Gate，并接入 Makefile/CI。 |
| M-07 | 中危 | restricted audit reads / export lifecycle audit | CLOSED | 受限访问与导出生命周期/失败/拒绝追加 F05；身份/设置事实同事务触发器桥接。 |

当前可用范围为 authenticated actor 自身授权账本与显式 workspace/account scope，历史无 account 声明的记录仍限自身 actor。`payloadHash` 是实际返回的脱敏载荷摘要，原 F05 业务载荷及原始摘要保持不变。审计自由文本采用保守白名单，可见水印使用固定标签和请求摘要；完整文本不进入返回产物。私有 Storage 使用服务端凭据，下载为重新授权的 BFF 一次性签名资源；部署时需把 `/_bff/export-content/*` 代理到同一 BFF。上述明确范围不外推到全租户管理查询或正式部署。

测试恢复 capability 全字段、配额及原因素集合，删除临时会话/孤立设备、job/ticket/cursor/命令和私有对象；合成 event_log、audit_entries 和身份安全事实依 append-only 约束保留。没有本地 PostgreSQL/Supabase/Docker 实例，也未在文档或代码中保存真实凭据。最大快照/产物边界、重试上限和数据库清理进度明确；五分钟还原、长稳、分布式实例及目标规模性能不从本轮小规模功能测试推断。

## 四、整改建议与后续准入

9 项原始整改建议全部落实。本阶段继续以 `pnpm check:bff-fe-007:development` 作为内容门禁，保留语义变异、真实字节和清理断言；功能源码/计划/前置变化必须重评，不能只更新 stage 字段。

项目用户已确认[当前 G0 文稿](../gate-records/G0-user-confirmation-draft-2026-10-07-900e809c60dd.md)，G0/FEP-0 已通过严格 DEVELOPMENT 门禁，可按已准入范围继续开发。PROVIDER:A2/ALL、十个页面联调、真实部署/IdP、发布性能/长稳、同 SHA hosted CI 和 RELEASE 确认仍按对应窗口办理，不因本报告自动放行。
