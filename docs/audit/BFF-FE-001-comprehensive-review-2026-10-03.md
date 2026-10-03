# A2 / BFF-FE-001 身份、会话与设置 API 全面复审报告

> 日期：2026-10-03（Asia/Shanghai）
> 源码基线：`28deabe961404fcde35791ea757b352c79e558fa`，本地 HEAD 与远端 main 一致；复审开始及新增审计文件前工作区干净。
> 结论：**CHANGES_REQUESTED / NOT ACCEPTED**。可进入整改，不能将本任务作为已验收前置放行 BFF-FE-007 / PROVIDER:A2。
> 严格任务验收：**0/1 = 0%**；本轮 24 个明确范围的工程控制点：**6 PASS、7 PARTIAL、11 FAIL；完整通过率 25%**。本比例不是工时进度或生产业务完成率。

## 一、任务完成概况

### 1.1 依据与范围

本轮依据[执行计划 BFF-FE-001](../SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md#task-bff-fe-001)、同计划第 5.3–5.7、6、7.1 节的开发与测试规范，以及 [Terminal 设计规格 P01/P15](../SumAlpha-QuantOS-Terminal-Frontend-Design-Spec.md)，重新核对 C01/C17 的 20 个 operation、OpenAPI、生成资产、参考与 live provider、auth/settings consumer、SSE、Rust/TS 测试及托管 CI。没有沿用旧报告的 PASS。

范围覆盖身份/上下文/reauth/MFA/logout/访问申请，资料与通知偏好，安全姿态、会话/设备/因素撤销，下载与浏览器能力。P16 Desktop 和 BFF-FE-011 的实现、BFF-FE-007 的审计导出业务不计入本任务分母。旧总结提到的指定模型复审不是当前任务的强制准入要求。

已有资产足以证明“契约和参考实现已经交付”：API 1.4.0，全仓 62 个 published operation / 51 个组件 schema；其中 C01/C17 的 20 个 operation 全部发布并被参考 Router 挂载，生成资产与页面追踪通过当前 SHA 的 Frontend Baseline CI。**业务语义并未因此全部成立**：独立 HTTP 探针发现保存输入丢失、幂等作用域与副作用错误、认证挑战复用、撤销事件误关闭消费者等问题。

live 模式另有完整的受信 Auth/BFF 基础链路，但本任务只挂载 `getSession`、`getContext`、`logout`，其余 17 个 operation 返回无契约 envelope 的 404。`POST /v1/auth/session` 是核心会话握手，不属于本任务 20 个 operation，不能据此将覆盖率记成 4/20。**3/20 = 15% 是路由 smoke 覆盖率，logout 尚存在 CSRF 偏差，不是 15% 业务验收通过。**

### 1.2 两个 Git notes 已发布并核验

经用户授权，两个 notes 通过一次 `git push --atomic` 推送到 origin，没有 force。随后读取远端引用与 GitHub Git Tree，比较绑定本次源码 SHA 的 note blob 与本地 blob，内容哈希完全一致。证明见 [notes-publication.json](./evidence/bff-fe-001-review-20261003/notes-publication.json) 和两份远端 tree JSON。

| 回执 | 远端 notes 引用提交 | 本 SHA 对应 note blob | 发布结论 |
|---|---|---|---|
| F06 | `78f9a1f9ab180a820fa0d91cef068e2404327c7e` | `6b6cf93129f9142c26003049a3b4444864f0ab2c` | PUSHED_AND_VERIFIED |
| P0 | `bfe64349a47ef5bc0a7380cc1bdf7c55f7397de1` | `ed3251dac5b918c8c695ee63442ff94b27d7bdda` | PUSHED_AND_VERIFIED |

写报告前重新执行 `pnpm check:p0` 与 `make f06-acceptance-gate`，均对本 SHA 返回 PASS；P0 准入仍为 `A1_ONLY`。F06 的既有同 SHA 回执包含真实 Supabase 执行结果，本轮做了回执校验，另执行了下述有限 live 路由探针；没有将核心 F06 验收扩张为 C17 全部业务验收。

### 1.3 开发审查与最终环境验收分别记账

- 遵守已批准的 A1 调整：BFF-FE-000 的真实 staging 与联合签署移到最后评审，不因当前缺少 staging 回退开发准入，也不把缺 staging 列为本轮开发缺陷。
- `PROVIDER:A1`、`FRONTEND-GATE:G0` 仍为 `NOT_STARTED / source_commit=null / evidence=[]`；正式 PROVIDER:A2 按原计划等待对应业务 provider 与目标验收。此次开发复审不能提前关闭这些检查点。
- 本轮真实连接工程已配置的 Supabase Auth/PostgreSQL，建立并撤销本次测试主体自己的 BFF 会话。BFF 在本机回环地址运行，使用合成 HTTPS Origin；这不是 staging 部署或浏览器安全属性验收。没有本机数据库、Docker/Supabase 本地服务、数据库初始化、迁移或重置。
- 阻塞级 B-01 指 **A2 所需业务路由与实现尚未交付**，与“现在尚无 staging 验收”不同。即使只审参考实现，H-01–H-08 也足以得出开发整改结论。
- 报告及证据新增后工作区不再干净；本轮 P0/F06 PASS 只针对写入前的干净源码基线。没有创建新源码提交或将这些 notes 自动套用到未来 SHA。

## 二、完成情况明细统计

### 2.1 统计口径

任务验收以整项任务为分母；工程控制点按下表 24 项等权计数。PASS 只说明该行明示范围成立，参考实现的安全单项通过不代表 live 业务已交付。PARTIAL 不折算半分；目标 staging/签署单独记账，不混入这 24 个开发审查控制点。没有用接口数量、测试通过数量或主观权重替代验收完成率。

| 层次 | 统计 | 结论 |
|---|---:|---|
| 计划历史开发状态 | 1/1 COMPLETED | 交付状态，不是复审结果 |
| 严格任务验收 | 0/1，0% | 存在已复现工程问题，未 ACCEPTED |
| 工程控制点完整通过 | 6/24，25% | 另有 7 PARTIAL、11 FAIL |
| 存在完整或部分资产 | 13/24，54.17% | 仅辅助统计，不能称验收通过率 |
| C01/C17 发布与参考路由挂载 | 20/20，100% | 结构覆盖；业务语义另检 |
| live 路由 smoke | 3/20，15% | 17 缺失；成功响应仍须安全语义验收 |
| 本轮同 SHA 托管 workflow | 4 SUCCESS / 4 FAILURE | 前端成功，全仓未全绿 |
| 正式 A1/G0、PROVIDER:A2 | 未关闭 | 不因缺 staging 判当前开发缺陷；最终验收另行执行 |

### 2.2 逐项核对矩阵

| ID | 需求、规范或验收项 | 当前证据与具体范围 | 判定 | 问题 |
|---|---|---|---|---|
| R01 | C01/C17 发布 20 个 operation | 当前 OpenAPI/catalog 与 A2 checker 的 inventory 一致 | PASS | — |
| R02 | OpenAPI/TS/Zod/MSW/JSON Schema 同源生成 | 同 SHA Frontend Baseline 的结构、生成漂移与 contract steps 通过 | PASS | — |
| R03 | P01/P15、owner 与 Desktop 边界 | C01/C17 owner 清楚；C17 二期 co-owner 为 BFF-FE-011 | PASS | — |
| R04 | A2 live provider 业务覆盖 | 有效 Supabase 会话下，17/20 operation 返回空 404 | FAIL | B-01 |
| R05 | session/context 与过期处理 | live 两项 smoke 成立；参考实现返回过去 expiresAt 却仍认证成功 | PARTIAL | M-04 |
| R06 | profile/locale/theme 保存与读回 | PUT 200、版本递增；重新 GET 未保存输入 | FAIL | H-01 |
| R07 | notification preferences 保存与读回 | PUT 200；quietHoursEnabled/digestFrequency 未保存 | FAIL | H-01 |
| R08 | 参考实现乐观锁 | 原 Rust stale-write 测试验证 If-Match/409/currentVersion 且无版本变更 | PASS | — |
| R09 | MFA 发起与 challenge 生命周期 | 缺 code 被判失败；同一已验证 challenge 可反复签新 grant | FAIL | H-04、M-05 |
| R10 | MFA 失败限流 | 达到 429 后仍验证并接受正确 code；无时间窗口/冷却状态 | FAIL | H-05 |
| R11 | recent-auth 安全授权 | grant 有五分钟过期；challenge 无时间/消费状态，可反复刷新 grant | FAIL | H-04 |
| R12 | logout、cookie、Origin 与 CSRF | live Secure/HttpOnly/SameSite 与 Origin 有校验；缺 CSRF header 仍 204 | PARTIAL | M-01 |
| R13 | 匿名访问申请与审计受理 | 参考实现校验与 auditRef 测试通过；live 路由缺失 | PARTIAL | B-01 |
| R14 | 安全/会话/设备/下载/平台读取 | 参考响应有 schema 资产，下载仅空集合；live 读取缺失 | PARTIAL | B-01 |
| R15 | 参考实现当前会话及最后因素保护 | 原 Rust 测试对当前会话/最后因素断言 409 且保留状态 | PASS | — |
| R16 | 会话撤销重试与 correlation | 同 key 可重放 202；未绑定意图，重放 header/body correlation 不一致 | PARTIAL | H-02、M-02 |
| R17 | 设备/因素撤销与 MFA 创建幂等 | 重试撤销变 404；重复 setup 同 job 实际增加两个因素 | FAIL | H-02、H-03 |
| R18 | 撤销 SSE 范围与实时失效 | 撤销远端会话关闭当前 reducer；流为一次性快照后 EOF | FAIL | H-06 |
| R19 | 参考实现 401/403/404 和资源隐藏 | 原 Rust 8/8 对缺认证、Origin/CSRF、无权资源作断言 | PASS | — |
| R20 | client 对真实响应与会话默认拒绝 | 畸形 MFA 响应被接受；空 session 仍发 7 个设置读取并返回 bundle | FAIL | H-07 |
| R21 | 客户端冲突/认证错误恢复 | SettingsGatewayError 丢失 status/code/currentVersion/correlationId | FAIL | M-03 |
| R22 | A2 Gate 与语义破坏自检 | 原 10/10 通过；新增 5 类实质破坏全部误返回 PASS | FAIL | H-08 |
| R23 | 当前 SHA CI 接线与结果 | Frontend Baseline 成功、Secret scan 成功；主 CI 等仍失败；checker 只做字符串检查 | PARTIAL | H-08；外部风险 X-01/X-02 |
| R24 | 当前交付与验收文档准确性 | checker 仍只要求旧 summary/evidence 存在；无当前版本与证据一致性约束 | PARTIAL | L-01 |

机读统计及问题 ID 见 [inspection.json](./evidence/bff-fe-001-review-20261003/inspection.json)。不同表中的相同问题只计一次。

### 2.3 本轮执行与证据

| 验证 | 结果 | 边界 |
|---|---|---|
| P0 / F06 当前 SHA 回执门禁 | PASS / PASS | 干净源码基线；P0 为 A1_ONLY |
| 原 A2 正向 / 负向 | PASS；10/10 | 原负向以删除契约字段/标记为主，不能覆盖以下业务退化 |
| auth/settings Rust 测试 | 8/8 PASS | 内存 reference Router，无数据库 |
| Terminal 单元测试 | 68/68 PASS | mock/fetch 单元层，包含 auth/settings，非 staging UI 集成 |
| contract tests | 24/24 PASS | fixture/schema 层 |
| reference HTTP contract harness | 28 records PASS | C01/C17 20 项以及 harness 的其他参考请求；不能将 28 作为本任务接口分母 |
| 独立参考 HTTP / 实际 consumer 探针 | 16 observations，缺陷成立 | 实际源码 transpile 后调用，验证参考 HTTP、auth/settings client 和 SSE reducer |
| 独立 A2 Gate 破坏 | 5/5 误放行 | 内存修改 checker 输入；没有修改仓库实现或 workflow |
| 有效 Supabase 会话下 live 探针 | 20 项：3 个 2xx、17 个 404 | 实际 configured Supabase + 本机 live BFF；只创建/撤销本次测试会话 |
| staging / 正式签署 | NOT_RUN / NO_CURRENT_RECEIPT | 最终环境验证单独执行 |

所有原始数据、重放脚本和日志索引见 [evidence README](./evidence/bff-fe-001-review-20261003/README.md) 与 [manifest.json](./evidence/bff-fe-001-review-20261003/manifest.json)。**独立探针“执行成功”表示复现了缺陷，不计作整改通过。**

## 三、问题清单及风险分析

### 3.1 分级数量

| 优先级 | 活动问题数 | 定义 |
|---|---:|---|
| 阻塞级 | 1 | 对应 A2 业务 provider 实现缺失，不能完成该 provider 验收 |
| 高危 | 8 | 数据丢失、安全状态/幂等语义错误、事件范围错误或关键门禁失真 |
| 中危 | 5 | 契约、安全联调或恢复信息不一致 |
| 低危 | 1 | 活跃入口与当前证据版本缺少同步约束 |
| 合计 | **15** | 未将历史全仓 CI 遗留项或缺 staging 重复计入本任务 |

参考 provider 以 loopback/reference 模式隔离，不宣称其硬编码测试 cookie/MFA code 已暴露到生产。以下参考实现问题的直接影响是错误的联调行为、回归证明和后续实现基线；真实部署可利用性未在本轮验证。live 缺路由是直接执行事实。

### 3.2 阻塞级

**B-01｜A2 live 业务覆盖缺失。** 模块：[live router](../../services/bff-gateway/src/live.rs:109)。有真实 Supabase 会话时，reauth、MFA、访问申请及所有 C17 设置/安全/下载/平台路由共 17 项仍为空 404，并缺 JSON envelope、no-store 或部分 correlation header；不是资源权限隐藏产生的契约 404。影响 P01/P15 的真实 query/command 流程和 PROVIDER:A2。证据：`live-observations.json` 全部 20 项及 router 源码。整改：实现 A2 的受信身份映射、持久化业务与完整路由/错误响应，再连接现有 Supabase 做本阶段业务测试；不得将 fixture reference Router 直接挂到 live。

### 3.3 高危

**H-01｜资料与通知写入成功但输入丢失。** 模块：[save_profile](../../services/bff-gateway/src/lib.rs:603)、[save_notifications](../../services/bff-gateway/src/lib.rs:659)。二者忽略 `Json(_input)`，只改版本并返回固定数据。探针修改 displayName/theme、quietHoursEnabled/digestFrequency，均 200 但 GET 未保存。影响 P15 所有资料/语言/时区/主题及通知偏好保存，用户成功反馈失真。整改：按 actor/context 保存已校验字段，读写同一状态；加入写回、各字段组合、版本冲突不变更、重启/持久化检查。探针：`profile-roundtrip`、`notification-roundtrip`。

**H-02｜幂等 key 未绑定 operation、资源、主体和请求意图。** 模块：`ProviderData.idempotency`、`accepted`、资料/通知/撤销 handlers（[lib.rs](../../services/bff-gateway/src/lib.rs:394)）。全局 raw key 命中即复用；同 key 换输入返回 200，profile 的 key 用于 notification 会返回 ProfileSettings，缺通知必需字段。影响 C17 写操作返回类型、错误状态和审计意图；多主体 live 风险尚未验证。整改：至少绑定受信 actor/context + operation + resource + normalized request fingerprint；同意图重试重放，异意图按统一契约拒绝；跨 operation 不共享 response。探针：`changed-intent`、`cross-operation-idempotency`；AJV 复现 7 个必需字段缺失。

**H-03｜幂等检查位于安全副作用之后。** 模块：[revoke_device/setup_mfa/revoke_factor](../../services/bff-gateway/src/lib.rs:813)。相同 key 的 setup 连续返回同 job，但因素数增加 2；device/factor revoke 第二次由 202 变 404。影响安全配置重试、网络恢复与“只执行一次”的审计证明。整改：先完成身份/意图及已受理结果判断，再原子提交业务变化、幂等记录和审计；验证并发重试、失联重试、同 key 异资源和副作用次数。探针：`mfa-setup-replay`、`device-revoke-replay`、`factor-revoke-replay`。

**H-04｜旧 challenge 可反复签发新的 recent-auth。** 模块：[MfaInput/reauth](../../services/bff-gateway/src/lib.rs:440)、`ProviderData.challenges`。challenge 仅存 bool，没有受信主体、purpose、verifiedAt、expiresAt、消费状态；相同已验证 challenge 重复 reauth 返回两个不同 grant。虽然 grant 自身五分钟过期，旧挑战仍能不断刷新。超过五分钟的绕过由无挑战期限/消费检查的源码逻辑确定，本轮没有将立即重试冒充等待五分钟的测试。影响近期认证的新鲜性与安全操作授权。整改：定义并验证挑战用途、主体绑定、短期寿命、一次性消费及安全操作需要的新鲜时间；用可控时钟验证过期/重放/跨主体，避免以日志字符串作为安全证明。探针：`challenge-reuse`。

**H-05｜限流未形成验证前的冷却约束。** 模块：[mfa_challenge](../../services/bff-gateway/src/lib.rs:445)。达到 429 后提交正确参考 code 仍返回 200；限流检查只在 code 已被判断错误的分支执行，计数是进程全局且没有窗口/冷却期限。影响 P01 MFA 失败限流验收；其他请求的计数也无法证明按会话/主体隔离。整改：在执行验证前检查时间窗口及冻结状态，按受控主体/会话和来源策略限流，定义窗口恢复规则与统一 429；测试冻结期间所有验证请求、冷却后恢复和隔离。探针：`mfa-limit-and-init`；仅参考模式，未证明线上 MFA 可被攻击。

**H-06｜撤销事件范围错误，流不具备持续推送。** 模块：[revoke_session/session_stream](../../services/bff-gateway/src/lib.rs:755)、[SseStreamReducer](../../packages/api-client/src/sse-contract.ts:40)。撤销 `session-remote` 后，当前 session GET 仍 200，却收到 `permission_revoked`，实际 reducer 进入 closed；session stream 将已有 events 拼成 Body 后 EOF，没有等待新事件的订阅。影响当前用户事件可用性和被撤销会话实时失效的验收真实性。整改：区分列表会话变化与订阅主体权限终态，对事件和认证按当前订阅主体路由；实现持续流、游标回补与撤销后主动断流；同时验证“撤销其他会话当前订阅保持可用”和“目标会话即刻失效”。探针：`remote-revoke-current-stream`；有限快照流由 `.text()` 完成和源码共同确认。

**H-07｜consumer 接受不符合契约的安全/设置成功响应。** 模块：[auth postJson](../../apps/terminal/src/auth/bff.ts:47)、[settings gateway](../../apps/terminal/src/settings/gateway.ts:8)、[createBffClient](../../packages/api-client/src/bff.ts:14)。TS 类型 cast 与 `data !== undefined` 没有做运行时校验：MFA `{status:"verified"}` 缺 challengeRef 仍被接受；空 `{}` session 仍触发 7 个设置读取，返回缺字段 bundle；profile write 返回 `{status:"accepted"}` 也被接受。影响错误 provider 响应后的会话默认拒绝、界面状态和字段真实性。整改：复用同源 operation/schema 的运行时 response 校验，session 无效时中止后续请求；安全 mutation/错误 envelope 也应校验。探针：`auth-response-validation`、`settings-response-validation`、`settings-mutation-response-validation`。

**H-08｜A2 Gate 检查标记而非安全执行语义，CI 可被注释骗过。** 模块：[check-bff-fe-001](../../scripts/check-bff-fe-001.mjs:83)。provider/tests/workflow 主要 `.includes()`；禁用最后因素保护、禁用 mutation guard、recent-auth 改为一年、前端 Gate 或主 CI provider test 变注释，5/5 均 PASS。checker 不加载 live router，也不覆盖本报告业务读回/重试/事件范围。影响所有 A2 PASS 结论与未来 CI 退化检测；当前 workflow 正常执行，注释破坏只发生在探针内存中。整改：执行有业务断言的 provider/consumer regressions，解析 YAML 实际 run step，加入能够令测试失败的语义 mutation；结构 Gate 仅声明结构范围，不能宣称已验证安全实现。证据：`gate-observations.json`、`gate-probes.mjs`。

### 3.4 中危

**M-01｜live CSRF 与浏览器预检声明不一致。** 模块：[live.rs](../../services/bff-gateway/src/live.rs:112)、[logout](../../services/bff-gateway/src/live.rs:307)。live logout 只检查 exact Origin，没有签发 CSRF cookie/token 或校验必需 X-CSRF-Token，真实会话无该 header 仍 204；CORS 只放 GET/POST、Authorization/Content-Type/X-Account-Id，未放 C17 PUT/DELETE、CSRF/幂等/版本/request headers。影响 Web 跨域设置联调和声明一致性。Origin 防护已存在，本轮没有据此断言存在跨站利用。整改：补齐 live 双提交/服务端 CSRF 方案与精确 CORS 方法/headers，增加实际预检与缺 token 拒绝测试；保留 Origin 防护。证据：`live-observations.json` logout 项及源码。

**M-02｜成功重放的 header/body correlation 不一致。** 模块：[revoke_session replay](../../services/bff-gateway/src/lib.rs:748)、[HTTP validator](../../tests/contract/http-contract.mjs:65)。重放 body 保留旧 correlationId，header 新生成；validator 仅在 body 有 code 的错误响应时比较二者。影响 job/audit/support 链路定位和成功响应契约证明。整改：明确幂等 job correlation 与每次请求 correlation 的字段职责并一致返回，校验所有带 correlation 的成功/错误 envelope。探针：`accepted-correlation-replay`。

**M-03｜设置 client 丢弃业务错误与版本恢复信息。** 模块：[SettingsGatewayError/required](../../apps/terminal/src/settings/gateway.ts:4)。真实 409 ErrorEnvelope 经 openapi-fetch 返回 error 后被 required 转成泛化异常，status/code/currentVersion/correlationId 全部丢失。影响版本冲突刷新、重新认证分流及 support 查询。整改：保留受校验的错误类型与响应状态，正确向 UI 提供 currentVersion、认证分流和 correlation；测试 401/403/409/429/5xx，而不只测试 data 缺省。探针：`settings-error-envelope`。

**M-04｜参考 session 固定过期时间与认证行为相矛盾。** 模块：[session_payload/authenticate](../../services/bff-gateway/src/lib.rs:410)。expiresAt 固定 `2026-09-17T10:00:00Z`，在本轮日期已经过期，参考认证仅判断固定 cookie 和 session_active，仍 200。影响“过期会话拒绝/恢复”测试和 UI 时效语义，不能复用它证明 F06 实际 session TTL。整改：使用可控时钟和真实参考会话记录，输出与检查同一 expiresAt；覆盖跨过过期点、logout 和撤销。探针：`reference-session-expiry`。

**M-05｜发起 MFA 被当作一次失败验证。** 模块：[MfaInput/mfa_challenge](../../services/bff-gateway/src/lib.rs:440)、OpenAPI `mfaChallenge`。合法发起示例仅 `{purpose:"login"}`，应进入 pending；当前返回 failed 并递增失败计数。影响初次 MFA 界面及失败限流阈值。整改：区分发起/完成语义，发起不记失败，完整保留目的与挑战状态；对同源发起示例断言 pending，对错误 code 才计失败。探针：`mfa-limit-and-init.initialStatus`。

### 3.5 低危

**L-01｜当前验收入口仍只验证历史文档存在。** 模块：[BFF-FE-001-summary](../BFF-FE-001-summary.md)、checker 的 summaryExists/evidenceExists。2026-09-16 总结作为历史交付记录可保留，但 checker 不区分它与当前基线，仍用 API 1.2.0 / 56 operations / 43 schemas、旧 CI/真实身份状态作为唯一总结入口。影响后续人员判断当前 scope 与验收证据；当前实际为 1.4.0 / 62 / 51，已有核心 F06 与托管 CI。整改：保留历史，给活跃总结增加当前基线与本报告入口；校验版本/证据来源及明确 local/core/staging 边界，不重写历史 PASS 为当前 PASS。

### 3.6 跨任务风险与当前远端 CI

以下不计入上面的 15 项，但影响全仓交付可信度与后续正式 Gate，不能宣称“全仓 CI 已通过”。每个 workflow 的 SHA 都是本报告基线，原始 metadata 和 failed logs（gzip）已存档。

| Workflow | 当前结果与根因 | 风险处置 |
|---|---|---|
| [Frontend Baseline](https://github.com/SumAlphaAI/QuantOS/actions/runs/37096279924) | SUCCESS，包括 A1 开发 Gate、生成漂移、A2 原 Gate、前端测试/build/browser steps | 证明当前接线正常，不能覆盖独立发现的语义问题 |
| [QuantOS CI](https://github.com/SumAlphaAI/QuantOS/actions/runs/37096279931) | Secret scan SUCCESS；Lint workspace FAILURE：779 Ruff errors；后续 evidence/download 依赖失败或跳过 | X-01：全仓 Ruff 另行专项整改；Secret 摘要误报整改已获远端成功证明 |
| [F01 Clean Room](https://github.com/SumAlphaAI/QuantOS/actions/runs/37096279919) / [F08 Engine CI](https://github.com/SumAlphaAI/QuantOS/actions/runs/37096279929) | 同为 779 Ruff errors 阻断 | 与 X-01 共用根因，不重复计数 |
| [F09 Observability Gate](https://github.com/SumAlphaAI/QuantOS/actions/runs/37096279940) | local-observability SUCCESS；Supabase Gate FAILURE：`F09 target migration is not current` | X-02：按 F09 所属范围处理目标迁移与正式验收；本次未执行迁移 |
| F03 / QuantOS Compatibility / R01 | SUCCESS | 见 ci-runs.json；不能替代 A2 业务验收 |

## 四、整改建议

### 4.1 建议执行顺序

1. **先修参考业务与消费者语义，建立可靠回归。** BFF owner 修 H-01/H-02/H-03；安全 owner 修 H-04/H-05/M-04/M-05；BFF 与 FE 联合修 H-06/H-07/M-02/M-03。使用确定时钟、合法与非法 schema、写入读回、相同/不同意图重试、完整审计次数和双会话 SSE 场景，确认原有 8 个 Rust 测试之外新增探针能红后绿。
2. **实现本任务的 live 业务 provider。** BFF owner 修 B-01/M-01，沿用既有 Supabase 配置与受信身份映射；落实资料/偏好、会话/设备/因素、幂等、审计与事件的一致性。测试与迁移均直接面向已配置 Supabase，遵守工程约定；不得临时搭建本机数据库，也不得将 fixture 状态转成线上状态。
3. **将语义回归接入有效 CI。** QA/BFF owner 修 H-08；每项破坏必须令对应实际验证失败。结构校验、执行测试、目标证据分别报告。修 L-01 的当前入口，并由仓库维护者单独关闭 X-01/X-02；不通过放宽 Ruff、伪造目标 PASS 或注释 CI 来消除红灯。
4. **复验开发基线后安排最终验收。** 新源码 SHA 须重新执行与生成对应 P0/F06 回执并推送 notes；本报告的 notes 仅绑定 28deabe。参考/本机 live/Supabase 结果通过后，再依计划完成部署、staging consumer/provider、安全浏览器行为与正式签署，最后关闭对应正式检查点。

### 4.2 放行条件与下一步判断

- **当前放行：整改与独立代码审查。** 可以继续阅读 BFF-FE-007 的代码，但不能将 BFF-FE-001 标记 ACCEPTED，不能把它当作完成的验收依赖推进 BFF-FE-007 / PROVIDER:A2 关闭。
- **开发复验至少关闭本报告所有工程缺陷。** 写读一致、幂等副作用一次、近期认证新鲜性、限流、会话范围/流实时性、运行时响应/错误校验及实质 Gate 破坏均需可执行证据；live 业务完成度与剩余目标验收分别明确。
- **最终验收按现行 Gate 执行。** A1 staging 与签署仍在最后评审，当前不提前要求；PROVIDER:A1/G0/A2、页面 G1 和 Desktop 具有各自边界，不能互相代替。

本轮未修复实现或更改执行计划的历史 `development_status`。下一次整改报告应逐个引用上述稳定问题 ID，记录修改 SHA、复现转绿证据和仍待执行的目标项，而不是只列现有测试全部通过。
