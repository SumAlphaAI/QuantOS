# BFF-FE-007：Audit 与导出 API 全面复审报告

> 复审日期：2026-10-06（Asia/Shanghai）  
> 源码基线：`ce4907cd819cdca30cba2a59f66cc51dc30fffda`；开始时工作区干净  
> 依据：[前端开发执行计划 A2 任务卡](../SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md#task-bff-fe-007)、[Terminal P12 规格](../SumAlpha-QuantOS-Terminal-Frontend-Design-Spec.md)、当前 OpenAPI 1.5.0 / C10、现行 DEVELOPMENT/INTEGRATION/RELEASE 阶段约束  
> 范围：六个 Audit/导出 API、十个消费页面的 API 映射及共同安全/审计/恢复/验收要求；不复审尚未进入本阶段的十个 UI 页面实现。

## 一、任务完成概况

**未达到当前 A2 DEVELOPMENT 完整完成与准入要求。** 契约已发布 **6/6（100%）**，六个参考路由存在并有业务测试；实际 live BFF 中本任务路由 **0/6（0%）**。严格复审的 **31 个等权控制点：13 PASS、6 PARTIAL、12 FAIL，完整完成率为 13/31 = 41.94%**。PARTIAL 不折算完成，避免把部分 fixture 或仅有 schema 当成完整功能。

问题共 **9 项：阻塞级 1、高危 1、中危 7、低危 0**。任务当前 `development_status=COMPLETED` 表示此前仓库交付声明；`stage_gate=NOT_ASSESSED`、摘要为空且没有阶段证据，不能升级为当前 DEVELOPMENT READY 或正式 ACCEPTED。应补齐功能实现及验收后再重新评估，不能仅根据 CI green 关闭任务。

直接依赖 BFF-FE-001、CORE:F05、PROVIDER:A1 的当前内容门禁与 READY 回执已核验。本任务的缺口来自自身实现及证据，不来自前置不就绪。现有已确认 G0 文稿没有变化，本轮不代用户批准任何新阶段或 RELEASE。

本轮没有修改业务源码、契约、生成物、CI、数据库或阶段台账；只生成复审报告和证据。未安装/启动本地 PostgreSQL、Docker 或 Supabase local；六接口无 live 实现，因此未开展 Supabase 目标 API 测试，不把静态/参考检查记作数据库验收。

## 二、完成情况明细统计

### 2.1 六接口状态

| Operation | 方法/路径 | 契约 | 仓库参考实现 | 实际 live provider | 本任务目标功能证据 |
|---|---|---|---|---|---|
| `searchAuditEvents` | `GET /v1/audit/events` | 已发布 | 参考路由/测试覆盖 | 未挂载 | NOT RUN / NO RECEIPT |
| `getEvidenceChain` | `GET /v1/audit/evidence-chains/{correlationId}` | 已发布 | 参考路由/测试覆盖 | 未挂载 | NOT RUN / NO RECEIPT |
| `createExport` | `POST /v1/exports` | 已发布 | 参考路由/测试覆盖 | 未挂载 | NOT RUN / NO RECEIPT |
| `getExportStatus` | `GET /v1/exports/{exportId}` | 已发布 | 参考路由/测试覆盖 | 未挂载 | NOT RUN / NO RECEIPT |
| `cancelExport` | `POST /v1/exports/{exportId}/cancel` | 已发布 | 参考路由/测试覆盖 | 未挂载 | NOT RUN / NO RECEIPT |
| `getExportDownload` | `GET /v1/exports/{exportId}/download` | 已发布 | 参考路由/测试覆盖 | 未挂载 | NOT RUN / NO RECEIPT |

live 接线通过 `main.rs` 的 live 分支、`live.rs` 及 `live/settings.rs` 的路由清单核对；参考路由位于 `lib.rs`。该 0/6 是源码接线统计，**不是声称本轮在 Supabase 逐接口得到失败响应**。[关键源码摘要及路由/依赖清单](evidence/bff-fe-007-review-20261006/source-inventory.json)可逐项追溯。

### 2.2 控制点矩阵与口径

控制点由任务需求、PROVIDER:A2 DEVELOPMENT 必须实现/功能验证的范围、C10 policy 与 P12 异常/数据流展开。契约/生成、参考基础行为、真实服务能力、consumer 安全和功能门禁分别统计；对“仅有参考基础行为”的控制点明确限定，不外推到真实 API。表中 PASS 只计该条写明的完整范围，其余 PARTIAL/FAIL 均计 0；这不是工时完成率或产品发布完成率。

| ID | 控制点 | 结果 | 检查事实 | 关联问题 |
|---|---|---|---|---|
| C01 | 六个 operation 与请求/响应 schema 发布 | PASS | OpenAPI 1.5.0；六个 published operation | 无 |
| C02 | C10 owner 与十个消费页面映射 | PASS | P04/P07/P09–P14/P22/P23，catalog 对应一致 | 无 |
| C03 | client/Zod/JSON Schema/MSW 同源生成及无漂移 | PASS | check:bff-generated 与 contract coverage 实际通过 | 无 |
| C04 | 参考搜索条件与有界 pageSize、sort/filter、时间输入 | PASS | Rust 搜索及 sort/filter 测试通过；pageSize 1–200 | 无 |
| C05 | 固定参考链的 correlation/causation 分页还原 | PASS | 8 个节点、7 条种子 causation；3 页还原 | 无 |
| C06 | 六接口参考 cookie/capability 的 401/403 | PASS | 新增六接口授权矩阵实际通过，12 个状态断言 | 无 |
| C07 | 参考 create/cancel 的 CSRF、recent-auth | PASS | 共享 guard、既有取消测试与新增缺 CSRF/reauth 拒绝 | 无 |
| C08 | 参考敏感响应 no-store 与错误外观隐藏 | PASS | 统一 response/error；已有未知资源与未就绪/过期拒绝 | 无 |
| C09 | 完整业务意图的幂等、冲突与恢复 | PARTIAL | normal reason/watermark/retention 冲突通过；scope 可选字段变化未冲突，只有进程内保存 | H-01/B-01 |
| C10 | 不透明且不可篡改、绑定查询的稳定游标 | FAIL | audit:offset 可任意构造，不绑定查询/主体/快照 | M-03 |
| C11 | 证据链完整性判定与真实因果覆盖 | PARTIAL | 种子链通过；audit:999 返回空 items、complete=true；未验证真实账本 | M-03/B-01 |
| C12 | 服务端字段级脱敏、禁止完整标识/秘密输出 | FAIL | 用户 reason/watermark 直接进入 redactedPayload，固定声明 redactionApplied=true | M-01 |
| C13 | 真实 payload hash 与可验证证据摘要 | FAIL | payloadHash 是 sequence 的十六进制填充；下载摘要是常量 42 | M-02 |
| C14 | 六接口可由实际 live BFF 接收与处理 | FAIL | main live 分支仅挂载身份/settings 路由，本任务六接口未挂载 | B-01 |
| C15 | F05 持久审计读模型及数据库功能连接 | FAIL | 参考 Vec 与种子事件；live 无 Audit 查询；本轮不执行目标数据库 | B-01 |
| C16 | 资源级主体/账号授权与无权资源隐藏 | PARTIAL | 全局参考 capability 拒绝通过；无资源 owner/context 过滤，未知导出范围获 202 | B-01/H-01 |
| C17 | 完整 ExportScope：eventKinds/time range/unique IDs | FAIL | serde 丢弃可选字段；逆序时间和重复 correlationIds 获 202 | H-01 |
| C18 | 持久异步导出、生成产物、重启恢复与取消工作流 | FAIL | 无 export worker/对象；GET status 将 queued 直接变 ready | B-01 |
| C19 | queued/generating/ready/cancel/expired/failed 状态机制 | PARTIAL | 参考 queued/ready/cancelled/seeded expired 通过；生成、失败、恢复不具备真实执行 | B-01/M-04 |
| C20 | 真实短时、一次性签名 URL、实际水印与文件元数据 | FAIL | downloads.invalid；constant sha256/sizeBytes，无真实文件/签名器/一次性消费 | B-01/M-02 |
| C21 | retention/到期拒绝与下载吊销联动 | FAIL | 只有 status==expired 判定；没有 retentionUntil 当前时间比较或过期机制 | M-04/B-01 |
| C22 | 导出与受限访问全过程审计、持久可追溯 | PARTIAL | 四种成功导出动作写内存事件；受限审计读取不留事件，未接 F05 | M-07/B-01 |
| C23 | 六个 typed gateway、cookie 与安全头携带 | PASS | gateway 六函数及客户端 credentials:include；既有 5 项 consumer 测试通过 | 无 |
| C24 | 403/404/410 gateway 安全文案与 correlation 信息 | PASS | 拒绝资源、过期下载不泄露 transport 返回的内部 message | 无 |
| C25 | 成功响应 runtime schema 与安全约束校验 | FAIL | 过期/缺字段/watermarked=false 元数据及 redactionApplied=false 的审计页被成功接受 | M-05 |
| C26 | 基础 transport 截止时间与写请求不自动重试 | PASS | 共享 bff-transport 缓冲 JSON、默认 30 秒、无自动 retry；网络错误为安全 BffTransportError | 无 |
| C27 | 三项直接依赖的实际内容绑定 READY | PASS | BFF-FE-001 严格门禁；CORE:F05 与 PROVIDER:A1 当前回执独立核验 | 无 |
| C28 | 工程规范与既有本任务正负/业务/consumer 回归实际执行 | PASS | Terminal 类型/定向 ESLint、Rust fmt/clippy 通过；11 Gate、6 Rust、5 gateway 通过；不把通过率当功能完成率 | 无 |
| C29 | 任务级功能 manifest、输入/目标摘要与严格阶段 Gate | FAIL | stage_gate=NOT_ASSESSED/null/[]，无任务功能门禁；结构 Gate 可被 comments-only provider 绕过 | M-06 |
| C30 | 六接口真实目标正常/安全负向/恢复/清理验收 | FAIL | 不存在六接口的目标功能证据；NOT RUN / NO RECEIPT，未用 A2 身份证据代替 | B-01/M-06 |
| C31 | 请求资源限制与每主体/操作的配额 | PARTIAL | body 64KiB/pageSize 200 有限制；C10 无 provider 配额/429 执行配置，实际服务未实现 | B-01 |

| 分组 | 控制点 | PASS | PARTIAL | FAIL | 完整满足率 |
|---|---:|---:|---:|---:|---:|
| 契约、基础参考行为 C01–C08 | 8 | 8 | 0 | 0 | 100% |
| 业务、安全与真实 provider C09–C22 | 14 | 0 | 5 | 9 | 0% |
| consumer、前置、验收与资源限制 C23–C31 | 9 | 5 | 1 | 3 | 55.56% |
| **合计** | **31** | **13** | **6** | **12** | **41.94%** |

[机器可读逐项矩阵](evidence/bff-fe-007-review-20261006/control-matrix.json)保存同一口径与每条归属。

### 2.3 本轮测试、反证及证据真实性

| 执行层 | 实际结果 | 可确认范围 |
|---|---|---|
| OpenAPI / generated / page coverage | 3/3 命令 PASS | 当前 1.5.0 的契约及生成一致性 |
| 工程规范：类型、ESLint、Rust fmt/clippy | 4/4 命令 PASS，clippy 保留 `-D warnings` | 当前源码符合这些静态工程规范；不代替业务完整性 |
| BFF-FE-007 Gate / negative | Gate PASS，11/11 测试 PASS | 现有结构条件；不能证明业务正确/目标实现 |
| Rust audit_export_provider | 6/6 PASS，`--locked --offline` | 参考 Axum provider 的既有用例 |
| Terminal audit-gateway | 5/5 PASS | 现有 cookie/安全头、错误外观等 consumer 用例 |
| 新增 Rust 复审探针 | 13 个观察项：2 个健康控制、11 个缺口观察；全部指定观察断言成立 | 内存 reference Axum 调用，不使用真实用户/数据库；部分观察合并为同一问题 |
| 新增 gateway 探针 | 外部 Vitest 1/1 观察测试 PASS | 直接调用当前 gateway，证实畸形成功响应被接受；安全 transport 错误作为正常事实保留 |
| 新增 Gate mutation | 2/2 破坏漏检，均仍报 PASS | provider 仅保留注释 marker / 前置 stage 改 NOT_ASSESSED 的实际 validator 结果 |
| 三前置及开发计划 | 当前内容及结构 PASS | 不等于本任务已有功能回执 |
| hosted CI | 当前 `ce4907c` 实际触发的 8/8 工作流成功 | 包含 Frontend Baseline；结构与既有业务测试 green 不代替六个 live API 的目标证据 |
| Supabase / Storage API 目标 | **NOT RUN / NO RECEIPT** | 本轮未连接目标执行本任务；不得写为目标验收成功 |

既有测试通过率为 100%，但本轮已复现多项语义违约，因此测试通过率不能替代 41.94% 的功能控制点满足率。观察型探针以“缺陷实际出现”作为断言通过；上述 PASS 不表示错误行为已经修复。套件/状态断言有交叉，不相加为唯一验收用例总数。

参考还原基线：8 事件、3 页、**835 μs**（进程内 Axum 单次观察，含分页；不含网络、数据库、真实索引/规模）。用于记录开发基线；五分钟目标数据规模/长稳 SLA 按任务要求在 RELEASE 独立验收，不将其未执行计为当前缺陷。

源码原锁保持不变；外部审计 harness 先使用 source Cargo.lock，再离线补充自身 manifest，核对全部依赖版本/来源/checksum均属于当前锁，最终使用 `--locked --offline` 执行。[依赖比对](evidence/bff-fe-007-review-20261006/probe-dependency-comparison.json)与原件保存。首次外部新 manifest 自动解析产生不同锁定版本的探针原件标为 `nonbaseline-*`，**未纳入当前基线结论**；新授权矩阵首次缺有效业务头导致 422 的 harness 重试日志也保留，没有将其误报为业务缺陷。

## 三、问题清单及风险分析

### 3.1 优先级与影响范围

阻塞级表示当前 DEVELOPMENT 准入无法成立；高危表示当前可复现的核心业务范围/幂等语义失真，须优先整改；中危表示受限参考/consumer/门禁中已确认的合规、完整性或验收缺口。当前 reference provider 仅可绑定 loopback，live 缺路由；**没有本轮生产泄露、线上下载越权或 staging 漏洞实测结论**。风险均给出本轮实际影响与后续接线风险，避免把占位实现直接描述为已在生产可利用。

| ID | 优先级 | 所属模块 | 具体表现 | 影响范围 |
|---|---|---|---|---|
| B-01 | 阻塞级 | live BFF / F05 Audit read model / export worker 与 Storage | 六个契约 operation 均只在参考 router 中；live router 没有 Audit/exports 路由。没有持久查询、资源授权的真实实现、导出生成器、真实文件/签名 URL/一次性消费以及完整目标验证。status GET 在内存把 queued 改 ready；下载是占位元数据。 | 本任务六 API、十个消费页面及 PROVIDER:A2 的 DEVELOPMENT 实现/功能准入；阻断本任务认定 COMPLETED/READY。不是 staging 不可用导致的阻塞。 |
| H-01 | 高危 | ExportScope / create_export / idempotency / request contract | OpenAPI 的 eventKinds/startAt/endAt 被 ExportScopeInput 反序列化丢弃；审计 scope 和幂等 intent 都缺这些字段。相同 key 改这些条件仍返回 202 和同一 exportId。逆序日期、重复 correlationIds、未知 correlation scope 均被 202 接受。通用 validator 未落实 uniqueItems。 | 请求范围、幂等冲突和审计理由的语义不一致；一旦接入产物，可能生成比请求更宽的内容或复用错误导出。已证实参考实现错误，未声称当前生产数据已经泄漏。 |
| M-01 | 中危 | 审计载荷脱敏 / record_audit_action | record_audit_action 原样保存用户 reason、水印等自由文本，并固定 redactionApplied=true；包含合成完整账户标识的 reason 经 audit search 原样返回。只对种子 fixture 写 REDACTED，不构成运行时脱敏器。 | 脱敏 attestation 与实际处理不符，参考调用可观察未遮盖文本；未来移植到真实审计链有秘密/标识泄露风险。本轮仅合成值，没有实测生产泄露。 |
| M-02 | 中危 | Audit payloadHash / evidence integrity / download metadata | 种子及新增事件 payloadHash 为 sequence 的 64 位填充，未做 SHA-256；导出 sha256 恒为 42，sizeBytes 恒为 1024。不同产物没有实际字节可供核对。 | 哈希面板无法证明载荷或文件完整性，不能作为验收的可验证证据。参考占位的限制已确认，真实下载缺口另由 B-01 阻断。 |
| M-03 | 中危 | audit cursor / evidence pagination / complete | cursor 只解析 audit:usize，没有查询/链/主体/快照绑定。已有 8 节点的链使用 audit:999 返回 200、items=[]、complete=true；仅由 offset>=events.len() 判定完整。 | 客户端可构造跳页或混用游标并获得误导性的完整标记；并发写入下 offset 排序分页没有稳定快照保证。后者为源码推导风险，本轮直接复现的是伪造游标与空完整页。 |
| M-04 | 中危 | export retention / expiry / deterministic clock | 到期只依赖人为 status=expired，没有比较 retentionUntil，也没有 sweeper；新的下载每次以 Utc::now()+5min 发票。参考时钟推进 31 天并续期 fixture session 后仍返回下载 200，业务时钟与认证参考时钟不一致。 | retention 与过期语义没有落实，无法验收到期后不可再次签发和取消/吊销联动。虚拟时间测试不是实际经过 31 天的目标实测；真实过期限制缺失由源码明确确认。 |
| M-05 | 中危 | Terminal audit gateway / response validation | 六个 gateway 函数直接 return result.data，不调用现有 parseBffResponse。缺 sha256/sizeBytes/mediaType/auditRef、expiresAt=2000、watermarked=false 的下载响应被成功接受；redactionApplied=false 且不完整的 AuditEvent 同样被接受。 | TypeScript 类型不能保护运行时安全语义，调用方把错误/未脱敏/过期对象当正常成功结果。没有把安全 BffTransportError 本身列为缺陷。 |
| M-06 | 中危 | BFF-FE-007 Gate / stage evidence / completion accounting | Gate 仅检查文案、schema、marker 和 development_status=COMPLETED；把整个 provider 换成只有 marker 的注释、把前置 BFF-FE-001 stage_gate 改 NOT_ASSESSED，仍 PASS。没有功能输入/业务执行/目标证据/依赖 READY 的本任务严格门禁。当前 stage NOT_ASSESSED 是诚实状态，但旧 COMPLETED 无法代表当前 DEVELOPMENT 完成。 | 结构 green 无法检测实现/依赖/目标失效，本轮已复现的语义问题未被 11 项 Gate 测试发现；PROVIDER:A2 不能据此准入。 |
| M-07 | 中危 | restricted audit reads / export lifecycle audit | search_audit_events/get_evidence_chain 不记录受限访问；多次授权审计/证据读取后事件仍为原 8 项。导出四种成功动作写内存，但 queued->ready 本身没有生成完成审计，失败/拒绝与实际下载消费没有完整生命周期事实。 | 不符合 C10 x-quantos-policy 的受限读取留痕和导出全过程追踪；既有 count 只证明四种成功动作。持久目标链缺口另计 B-01，不把读取副作用当业务状态修改。 |

全部问题的结构化归属、表现、影响和建议见[问题台账](evidence/bff-fe-007-review-20261006/findings.json)。

### 3.2 反证定位与风险拆分

### B-01 — 阻塞级：live BFF / F05 Audit read model / export worker 与 Storage

- 定位/反证：source-inventory.json；main.rs:31、live.rs:123、lib.rs:1529/1648；runtime read_promotes_placeholder_ready。
- 整改：在实际 live router 中实现本任务六 API，接入 F05 和持久 job/私有对象存储；提供完整资源授权/恢复/配额；使用现有 Supabase 做正常和负向功能测试，不建立本地数据库。

### H-01 — 高危：ExportScope / create_export / idempotency / request contract

- 定位/反证：lib.rs:1407–1483；input_contract.rs:64–81；runtime changed_scope_replays/scope_fields_dropped/reversed_export_range/unique_items_unenforced/unknown_scope_accepted。
- 整改：完整保留并校验 ExportScope；规范化全部业务意图后持久保存 actor/key/target；验证 uniqueItems、时间顺序与资源授权；同 key 改任一有效范围字段应 409 且零副作用。

### M-01 — 中危：审计载荷脱敏 / record_audit_action

- 定位/反证：lib.rs:1422–1442/1495–1504；runtime unredacted_user_reason。
- 整改：统一字段白名单与结构化敏感信息清理，对自由文本处理后再输出；绑定真实 redaction 策略版本；以合成 token/完整标识做业务反证，不仅检查 schema enum。

### M-02 — 中危：Audit payloadHash / evidence integrity / download metadata

- 定位/反证：lib.rs:267/1440/1649；runtime noncryptographic_payload_hash/read_promotes_placeholder_ready。
- 整改：定义可重放的 canonical serialization/hash 规则，输出账本真实摘要和真实文件摘要/大小；篡改载荷或产物应被检测，保留完整性反证。

### M-03 — 中危：audit cursor / evidence pagination / complete

- 定位/反证：lib.rs:1190–1215/1332/1395；runtime forged_cursor_complete。
- 整改：服务端签名或服务端状态型 cursor，绑定授权、筛选、链和快照；未知/跨范围/超边界游标拒绝；增加篡改、换筛选、写入间分页、不漏不重反证。

### M-04 — 中危：export retention / expiry / deterministic clock

- 定位/反证：lib.rs:1519–1541/1616–1651；runtime reference_clock_does_not_expire_exports。
- 整改：统一注入可测业务时钟，在读取/签发下载时根据权威时间及持久状态校验 retention/expiry；实现 sweeper 和取消吊销；测试过去/现在/临界时刻而非只用一个预置 expired fixture。

### M-05 — 中危：Terminal audit gateway / response validation

- 定位/反证：apps/terminal/src/audit/gateway.ts:39/52/68/75/93/105；gateway-probes.json；既有 audit-gateway.test.ts 最后一段还肯定缺字段响应成功。
- 整改：每个 operation/status 使用现有生成 runtime parser；下载 additionally 校验有效时间及允许 URL 规则；缺必填/不合枚举等成功响应必须失败；将现有肯定畸形成功的测试改成拒绝断言。

### M-06 — 中危：BFF-FE-007 Gate / stage evidence / completion accounting

- 定位/反证：scripts/check-bff-fe-007.mjs:60–133；gate-mutations.json；task stage_gate in source-inventory.json。
- 整改：保留 local_contract Gate 标签，另建任务功能 manifest 与严格 DEVELOPMENT checker，绑定全部功能输入/实际业务日志/目标及三依赖；加入真实 mutation/替换回执/陈旧依赖反证；把开发状态调整为尚未完成当前准入，复验后再发布 READY。

### M-07 — 中危：restricted audit reads / export lifecycle audit

- 定位/反证：lib.rs:1218–1340/1349–1403/1533–1550；runtime restricted_reads_add_no_audit_events；OpenAPI C10 policy.audit。
- 整改：明确并实现受限访问与各生命周期状态/失败/消费的审计事件，绑定 actor/scope/outcome/correlation/causation，持久接入 F05；避免自记录访问时递归污染业务 evidence chain，独立测试留痕。

### 3.3 阶段与历史边界

- 当前 DEVELOPMENT 必须落实真实 provider 的功能实现、权限/错误/幂等/恢复/审计及安全负向验证；A1 catalog/生成 harness 与进程内 fixture 无法替代。缺实际 live 实现是 B-01，不能移到 RELEASE 当作单纯 staging 待办。
- 十个消费页面的真实 UI/consumer 功能链按对应 I 迭代验收，本轮只复审 C10 映射与 API gateway；完整 UI 实现不加入本轮分母。
- 真实部署/HTTPS/IdP、目标规模五分钟性能/长稳、用途许可及 RELEASE 用户确认独立进行，未执行保持 NOT RUN，不凭现有 CI或 G0 确认放行。
- [2026-09-16 交付摘要](../BFF-FE-007-summary.md)与[历史证据](BFF-FE-007-acceptance-evidence-2026-09-16.md)如实注明参考实现/NOT RUN；本轮没有改写这些原件。其早期“仓库交付完成”声明不替代后来更新的 DEVELOPMENT 功能准入标准。旧模型复审声明不作为本轮额外未授权模型调用或发布批准。

## 四、整改建议

### 4.1 按优先级的整改顺序

1. **先处理 B-01**：明确 live provider 的 F05 读模型、资源级授权、持久导出状态/worker、私有 Storage、真实文件/水印/签名/消费能力；六个 operation 接线后使用已配置 Supabase 做受控功能及负向测试，保留 requestId/correlation、恢复与清理原件。
2. **同步处理 H-01**：完整保留/校验/规范化 ExportScope，约束未知/无权资源、去重与时间范围；所有影响产物的字段进入 actor/key/intent，持久恢复且不同意图冲突，不允许静默丢弃筛选。
3. **处理 M-01～M-04、M-07**：脱敏器、实际摘要、绑定快照的安全游标、可测权威业务时钟与到期/吊销、完整生命周期和受限读取审计；每项以当前已保存反证做整改后拒绝/正确处理断言。
4. **处理 M-05、M-06**：gateway 用现有生成 parser 验证全部成功与错误响应，拒绝畸形/未脱敏/过期对象；新增本任务严格功能 Gate/manifest，校验业务执行、源码/契约摘要、目标支持日志及三前置 READY。保留结构 Gate 的明确标签，不替代实际功能回执。
5. 完整执行六 API 的正常、未认证/无能力、跨账号/资源、CSRF/reauth、每范围字段幂等冲突、篡改游标、空/缺失/过期、恢复/取消、秘密/哈希/文件篡改、配额及清理反证。核验后更新实际开发完成状态及 stage_gate；PROVIDER:A2 与后续 RELEASE 分别验收，不自行批准正式状态。

### 4.2 整改验收出口

- 31 项 DEVELOPMENT 控制点全部完整满足，六个 live API 正常/负向/恢复证据合格；新增完整功能 manifest 与源/日志/目标/依赖摘要校验，不存在仅有 fixture 的目标 PASS。
- 本轮九项问题分别有关闭记录，已复现的反证转为预期拒绝/正确处理；保留当前失败/占位原件，不覆盖历史。
- 真实数据库只使用工程已有 Supabase，按本会话授权/工程规程执行受控操作与恢复；未执行的环境/性能事实继续独立列明。人工确认按现行统一用户确认流程，不要求用户收集多个角色签署，不代用户批准。

报告与证据目录：[本轮证据](evidence/bff-fe-007-review-20261006)。包括逐项统计、九项问题台账、关键源码摘要、真实命令日志、external harness 原件、运行期反证、Gate mutation、consumer 反证及同 SHA hosted 运行清单；最终摘要索引见[证据索引](evidence/bff-fe-007-review-20261006/evidence-index.json)。
