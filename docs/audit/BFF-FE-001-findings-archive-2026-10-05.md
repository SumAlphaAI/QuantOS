# A2 / BFF-FE-001 身份、会话与设置 API 全面复审报告

> 复审日期：2026-10-05，Asia/Shanghai。源码基线：`de74b112dab8e4ec5141142cdced75f59b58626c`。
> 结论：**CHANGES_REQUESTED；当前功能范围尚不能推荐 DEVELOPMENT READY**。
> 工程控制点：**18 PASS / 3 PARTIAL / 3 FAIL，完整完成率 18/24 = 75.00%**。
> 活动问题：**阻塞级 0、高危 2、中危 4、低危 0，共 6 项**。高危问题仍阻止相关功能准入。
> 20/20 operation 已发布并在真实 Supabase + 本机 live BFF 执行；这表示接口覆盖 100%，不表示全部业务语义验收通过。

## 一、任务完成概况

### 1.1 依据、范围与结论

依据[前端执行计划 BFF-FE-001](../SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md#task-bff-fe-001)、第 2.1/2.2、5.3–5.7、6、7.1/7.4/7.5 节，以及 [Terminal 设计规格](../SumAlpha-QuantOS-Terminal-Frontend-Design-Spec.md) P01/P15，独立检查实现、生成契约、实际执行、负向检查、文档与准入证据。

任务范围为 C01/C17 的 20 个 operation：身份与主上下文、MFA/reauth/logout/访问申请、资料与语言/主题、通知偏好、安全状态、会话/设备/因素撤销、撤销 SSE，以及下载元数据/浏览器能力。Desktop/P16、完整 Audit 导出业务、页面视觉及全浏览器旅程分别由 BFF-FE-011、BFF-FE-007、I1/G1 与 RELEASE 承接，不加入本任务功能分母。通知规则保存不等于通知投递服务已验收，下载元数据读取不等于签名 URL/对象存储已验收。

当前 API **1.5.0 / 全仓 62 published operations / 52 schemas**；其中本任务 20 个 operation 均已交付 reference 和 live 路由。资料与偏好写读、版本冲突、重启持久化、真实 TOTP、幂等重试、CSRF、撤销实时失效与主要错误响应均有本轮执行证据。此前“仅 3 个 live 路由”等结论已不适用。

但独立探针发现：账户完成首个 MFA 因素验证后，另一个尚未完成 MFA 的会话仍能使用先前的 `first_factor` grant 注册新因素；设置写入的审计与响应 correlation ID 不一致；安全页面最近验证时间由会话到期时间倒推；实际 live 最后因素保护被删除时，A2 使用的 Rust 语义套件仍全部通过。此外，transport 超时/取消与本节点阶段准入证据仍存在缺口。因此，既有测试 PASS 和历史 `COMPLETED` 不能支持当前阶段 READY。

### 1.2 基线与证据边界

- 复审开始时 Git 工作区干净；本轮仅新增本报告和证据目录，没有修改生产代码、迁移、计划阶段状态、历史报告或 Git notes，没有提交或推送。
- [受检源码清单](evidence/bff-fe-001-review-20261005/source-inputs.json)绑定代码、契约、迁移、脚本和 workflow 内容；本轮 Supabase 回执记录当前 HEAD，但 `sourceTreeClean=false`，原因是新增了审计文件。不能称为干净发布候选的正式同 SHA 验收。
- [历史输入比较](evidence/bff-fe-001-review-20261005/historical-input-comparison.json)：2026-10-03 清单中 12/15 文件内容仍一致，3 个已变；旧回执仅用于追溯，不代替本轮执行。历史 15 项工程关闭记录保留，本次 6 项发现使用新的 ID，不覆盖历史结论。
- 使用工程已有 Supabase Auth/PostgreSQL 配置；BFF 在本机回环运行，使用合成 HTTPS Origin。未安装或运行本机 PostgreSQL、Docker、Supabase CLI 服务或临时数据库，未应用迁移或重置目标。
- 用户在本会话明确授权“授权受控测试并恢复原值”。两个 live runner 均完成清理并返回 `failure=null`：核验原 MFA 因素集合，恢复原资料/偏好，删除本次临时会话；保留追加式测试审计。脚本、回执和日志不保存 bearer、密码、TOTP code 或 enrollment URI。
- 本报告不批准验收。当前计划的 BFF-FE-001、PROVIDER:A2 仍为 `NOT_ASSESSED`，正式 PROVIDER:A2 `review_status=NOT_STARTED`。后续人工确认采用项目用户单人确认，按[统一规程](../gate-records/user-acceptance-confirmation-workflow.md)执行，不再索取多角色回执。

### 1.3 本轮实际检查结果

完整命令、退出码、产物摘要见[执行台账](evidence/bff-fe-001-review-20261005/commands.json)与[证据清单](evidence/bff-fe-001-review-20261005/manifest.json)。各套件范围有重叠，不相加为“总验收用例数”。

| 检查 | 本轮结果 | 实际边界 |
|---|---|---|
| `make bff-contract-check` | PASS，退出码 0 | A1/A2/Audit 结构、生成漂移、兼容、语义及负向；A2 22 项负向、3 项 reference mutation 拒绝、4 项迁移账本测试 |
| `cargo test --locked --offline -p bff-gateway` | 24 passed、1 ignored | 6 个 lib、6 个 Audit、12 个 auth/settings；ignored 的 F09 DB 测试不记数据库 PASS |
| A2 consumer 语义执行 | 23/23 PASS | auth/settings 两文件；实际 runtime schema/error handling |
| Terminal 全单元 | 79/79 PASS | mock/fetch 单元层，非页面目标联调 |
| 契约与 API client | 86/86 PASS | 含本机 HTTP SSE PoC，8 文件 |
| Web 覆盖率 | 238/238；行 92.85%，分支 79.90% | `coverage:web` 行门槛 ≥80%；auth/bff 与 settings/gateway 行均 100%，分支分别 90.90%/90.00% |
| 关键分支门禁 | 178/178；6 个登记文件四指标均 100% | 当前清单含 auth/flow、SSE 等；**不覆盖 live/settings.rs**，不能推出服务端安全分支 100% |
| reference HTTP harness | 38 records PASS | C01/C17/C10；接口分母仍为本任务 20 |
| Supabase 主回归与新增探针 | 50 records，runner PASS | 20/20 operation；原有业务断言通过，但新增 observations 确认 H-01/M-01/M-02，不等于缺陷关闭 |
| Supabase 输入负向 | 4 条 helper 请求 + 2 条直接 HTTP 请求，PASS | 身份只读字段与错误类型均 422，原身份字段保持一致 |
| live 最后因素 mutation | 编译成功，12/12 语义测试仍 PASS | **反证 H-02**；不是安全验证通过 |
| 阶段依赖反证 | 内存输入中将上游改为 NOT_ASSESSED，local_contract checker 仍 PASS | 不修改实际计划；证明该 checker 不能承担阶段准入 |
| 规范 | Terminal lint/typecheck、API client typecheck、Rust fmt/clippy PASS | 聚焦受影响模块；不宣称全仓所有规范/供应链检查均重跑 |
| 前置回执与计划 | PROVIDER:A1 READY、G0 READY、计划校验 PASS | 当前内容绑定回执有效；未以旧 SHA notes 代替本任务评估 |

第一次外联在沙箱内 `fetch failed`，0 条目标请求记录；第一次契约/API 与 critical coverage 运行因 `127.0.0.1` 监听被拒，分别 4 个 SSE 用例失败。已保留失败日志，随后在获准条件下完整复跑通过。初始系统 pnpm 11 启动受阻并中断，最终所有 pnpm 检查使用缓存中的 **10.20.0**；Node **24.12.0**。这些环境失败不列为产品缺陷，也没有删掉后只保留成功结果。

## 二、完成情况明细统计

### 2.1 统计口径

以 24 个等权工程控制点统计“本次要求的完整满足率”，PASS 计 1；PARTIAL 和 FAIL 不折算半分。该比例不是工时进度、发布完成率或生产业务覆盖率。R21/R23 按当前三阶段规则纳入 transport 恢复和功能准入；不再把远程 CI 缺回执算作当前 A2 未实现功能。因此不能将本表与旧报告 23/24 直接作同口径升降比较。

| 维度 | 实际统计 | 含义 |
|---|---:|---|
| 历史交付状态 | 1/1 `COMPLETED` | 保留计划事实，不能替代当前评估 |
| 接口发布/live 执行覆盖 | 20/20，100% | 已交付并执行到，不表示全部语义通过 |
| 本轮 operation 明细完整满足 | 14 PASS / 4 PARTIAL / 2 FAIL，14/20 = 70% | 仅对应下面逐接口表的明确范围 |
| 工程控制点完整满足 | 18/24，75.00% | 3 PARTIAL、3 FAIL |
| 工程控制点有完整或部分证据 | 21/24，87.50% | 辅助数字，不称验收通过率 |
| 本任务 DEVELOPMENT 准入 | 0/1 READY | 计划仍 NOT_ASSESSED；本次不推荐放行 |
| 正式整项验收 | 0/1 ACCEPTED | RELEASE 独立要求未收口；不是“功能完成率 0%” |

### 2.2 逐项控制矩阵

| ID | 核对项 | 本轮证据与判断 | 结果 | 关联问题 |
|---|---|---|---|---|
| R01 | C01/C17 20 operation 发布 | OpenAPI/catalog/checker 与 live 覆盖一致 | PASS | — |
| R02 | OpenAPI/TS/Zod/MSW 同源 | 生成漂移、schema、兼容与 runtime fixture 重放通过 | PASS | — |
| R03 | P01/P15/owner/二期边界 | 页面追踪与 C17 co-owner 保留；未把 P16 算入 | PASS | — |
| R04 | A2 live provider 可运行与覆盖 | 当前 Supabase 主回归执行 20/20，非参考 fixture | PASS | — |
| R05 | session/context 与恢复 | 真实身份/不透明 cookie、401；重启保留资料，proof 缺失 401、重新 bridge 恢复 | PASS | — |
| R06 | profile/locale/theme 保存读回 | live PUT→GET→重启；输入只读字段负向 422 | PASS | — |
| R07 | 通知偏好保存读回 | live quietHours/digest/rules roundtrip；与 profile 幂等作用域分离 | PASS | — |
| R08 | If-Match/版本冲突 | stale write 409/currentVersion；不覆盖已有值 | PASS | — |
| R09 | challenge 生命周期 | reference 可控时钟及 live pending→verified→单次 reauth，重放 403 | PASS | — |
| R10 | MFA 失败限流/冷却 | reference 实际断言五次失败、冻结前置、冷却恢复；live 有相同持久窗口实现 | PASS | — |
| R11 | recent-auth/首因素授权范围 | 同主体另一个未 MFA 的 session，在首次因素验证后仍用旧 first_factor 注册成功 | FAIL | H-01 |
| R12 | logout/cookie/CSRF/Origin | live 缺 CSRF 403、合法 logout 204、cookie 清理；CORS/reference 负向通过 | PASS | — |
| R13 | 匿名访问申请 | live 202/auditRef；reference 输入/Origin/审计与限流检查 | PASS | — |
| R14 | 安全/会话/设备/下载/平台读取正确性 | 非空元数据及其他读取通过；lastVerifiedAt 与真实 MFA 时间相差约 63.5 秒 | FAIL | M-02 |
| R15 | 当前会话/最后有效因素保护 | reference 当前 session 409；live 最后已验证因素 409，因素保留 | PASS | — |
| R16 | 幂等响应与观测/审计关联 | security command job/correlation 重放通过；资料 audit correlation 与响应不一致 | PARTIAL | M-01 |
| R17 | 设备/因素撤销与注册幂等 | live setup/revoke 重放、因素计数、一次性注册材料/持久层不存 URI | PASS | — |
| R18 | 撤销 SSE/实时失效 | live 双订阅，其他会话 session_revoked，目标 permission_revoked/401；afterSequence 与通用 replay 测试 | PASS | — |
| R19 | 401/403/404/资源主体约束 | live 缺/失效 session 401、窄授权错误 403、随机不存在资源 404；SQL 主体过滤与 reference 负向 | PASS | — |
| R20 | consumer runtime schema/default deny | 空 session 中止后续读取，畸形成功/错误拒绝，generated response parser 重放通过 | PASS | — |
| R21 | 错误恢复/超时/取消 | 401/409/429/503 恢复 metadata 保留；transport 无 deadline/signal 入口与慢请求取消回归 | PARTIAL | M-03 |
| R22 | A2 正负 Gate 的实际业务退化检出 | reference 三项 mutation 能拒绝；live 最后因素保护删除仍 12/12 PASS | FAIL | H-02 |
| R23 | CI 接线/前置功能准入/输入绑定 | CI 有效接线、真实前置 READY；本节点无 stage manifest/严格阶段 runner，local_contract 不能代替 | PARTIAL | M-04 |
| R24 | 版本/总结/历史与验收边界 | API 1.5.0 清单准确；新旧证据分别归档，当前单用户确认规程优先 | PASS | — |

R10 的 PASS 限于已实际执行的 reference 限流/冷却及 live 源码一致性；未宣称本轮对真实 Auth 重做全部穷举验证码/并发限流。R18/R19 也不代表全浏览器、跨实例或多租户目标环境验收；本项目当前为单主上下文。本表中的 PASS 均限于该行陈述的检查范围，其他未验证范围见 3.3。

### 2.3 20 个 operation 明细

| operationId | 实际实现/测试情况 | 结果 |
|---|---|---|
| getSession | 真实 cookie/Auth/主上下文，缺认证/撤销后 401 | PASS |
| getContext | 真实主上下文读；catalog 与 schema 一致 | PASS |
| reauth | 单次消费/过期保护通过；审计生成 ID 与响应另行生成，需统一 | PARTIAL（M-01） |
| mfaChallenge | 真实 TOTP/pending/验证通过；verify 审计与响应 correlation 需统一 | PARTIAL（M-01） |
| logout | CSRF/Origin、撤销、204/cookie 清理 | PASS |
| submitAccessRequest | 匿名输入校验、202/job/auditRef、受控 Origin | PASS |
| getProfile | 持久资料读回与身份只读字段保护 | PASS |
| saveProfile | 写读/版本/幂等通过；实测 audit/response correlation 不一致 | PARTIAL（M-01） |
| getNotificationPrefs | 偏好持久读取 | PASS |
| saveNotificationPrefs | 写读/版本/幂等通过；共用 save_preferences 存在相同审计关联问题 | PARTIAL（M-01） |
| getSecuritySettings | 因素/方法能力/首因素引用可读；最近验证时间来源错误 | FAIL（M-02） |
| listSessions | 主体限定活动 session 与 current 标记 | PASS |
| revokeSession | recent-auth、当前 session 保护、同 key 重放、目标失效 | PASS |
| subscribeSessionRevocations | 持续双订阅、目标终态、其他会话不中断、游标参数 | PASS |
| listDevices | 真实验证后设备记录与 current 标记 | PASS |
| revokeDevice | 受控撤销、关联 session 失效，reference 重试检查 | PASS |
| setupMfa | 真实 TOTP 与幂等注册可用；旧 first_factor 仍获准扩张注册 | FAIL（H-01） |
| revokeMfaFactor | 最后有效因素保护、未验证注册取消、重放、URI 不落库 | PASS |
| listDownloads | 非空受控元数据读回；本轮 fixture 删除，无短时 URL 持久化 | PASS |
| getPlatformCapabilities | Web 能力响应，Desktop 边界保留 | PASS |

此表按接口本身数据/业务语义统计，H-02 的测试保障缺口和 M-03 的跨接口 transport 缺口另在控制矩阵计数，不再机械地把同一缺口重复扣到每个接口。

## 三、问题清单及风险分析

### 3.1 分级与范围

| 优先级 | 数量 | 本次适用定义 |
|---|---:|---|
| 阻塞级 | 0 | 整段业务实现缺失、无法执行或不可恢复的数据破坏；本轮未确认此类问题 |
| 高危 | 2 | 高风险身份前置不成立，或关键 live 安全退化不能被现有保障检出；阻止对应功能准入 |
| 中危 | 4 | 数据/审计/恢复/阶段证据不完整，影响正确性或可追溯性 |
| 低危 | 0 | 本轮未确认独立的低影响问题 |

同一根因只计一次。没有因为 staging/远程 CI 后置、沙箱失败或 `NOT_STARTED` 的正式状态增加开发缺陷数量。

### 3.2 活动问题台账

| ID | 优先级 / 所属模块 | 具体表现与证据 | 影响范围与风险 | 整改要求 |
|---|---|---|---|---|
| H-01 | 高危；live MFA / first_factor grant | `live/settings.rs:189` 的 recent 只验证 session、scope、expiry，未在注册时重查“仍无已验证因素”；`mfa_command:840` 获取 factors 后也未限制该授权。主回归先为两个 session 签 first_factor；A 验证首因素后，未 MFA 的 B 用旧 grant 调 setupMfa，**202 且创建新因素**。[实测 observations](evidence/bff-fe-001-review-20261005/live/receipt.json) | 首次注册的例外授权可在账户 MFA 已建立后继续注册其他未验证因素，绕过所规定的 recent MFA 前置，可能消耗注册配额。**未证明这些新因素可直接验证、可删除最后因素或获得交易权限** | 在主体锁内重查因素状态；已有已验证因素时新增注册必须 security grant。首因素验证成功后使其他 first_factor grant 不再具有新注册权限，保留合法幂等重放和受控未验证因素取消 |
| H-02 | 高危；A2 回归/CI / live provider | `bff-fe-001-execution.mjs:31` 实际只跑 reference Rust 与 consumer；三个 mutation 也仅改 lib.rs。隔离源码删除 live/settings.rs 最后有效因素保护，编译成功，**同一 auth_settings_provider 套件 12/12 仍 PASS**。[mutation 证据](evidence/bff-fe-001-review-20261005/live-last-factor-mutant.json) | 真实实现可失去关键保护而本地语义套件继续绿。source hash 能拒绝陈旧证明，重新执行 reference 后仍不能证明 live 业务安全；登记关键分支 100% 不涵盖此实现 | 抽取实际 live 授权/状态机为可运行测试单元或提供 Auth/store adapter；对真实路径做 last-factor、CSRF、首因素状态、challenge TTL、授权撤销的 mutation。受控 Supabase 功能证据独立绑定 |
| M-01 | 中危；资料/偏好/reauth/MFA 审计观测 | `save_preferences:350` 为 audit 单独生成随机 ID；`respond:182` 对无 correlation 的 payload 再随机生成响应 ID。实测 saveProfile 响应 `986e477f-…`、审计 `5cf4e062-…`，不相等；同 key 重放响应 ID 也变化。reauth、MFA verify 的 audit/response 有同类生成路径；撤销 emit 的事件 ID 关联同样需统一评估 | 响应/trace ID 无法直接查到对应 settings audit，失败定位和后续 Audit 链条存在断口。不是“缺审计记录”，而是已写记录与观测链不一致 | 请求/业务命令统一 correlation，上下游 audit/trace/SSE 关联沿用或明确存 causation；幂等记录保存可追溯引用，补真实 DB 关联断言 |
| M-02 | 中危；getSecuritySettings 安全元数据 | `live/settings.rs:753` 返回 `context.expires_at - 5 minutes`，实际是会话签发/受 token 限制的倒推时间，不是 MFA verified_at。主回归响应 `12:30:51.585972Z`，DB 验证 `12:31:55.131Z`，差 **63,546ms** | P15 最近验证信息不准确，未 MFA session 也得到倒推时间；不能用于解释真实安全姿态。**未发现服务端 recent-auth 使用这个显示字段授权** | 从可信验证记录返回时间，明确“首因素身份验证”与“MFA 验证”的语义；无对应事实时采用契约允许的缺省/可空表达，并同步兼容策略 |
| M-03 | 中危；auth/settings HTTP transport 与恢复 | `auth/bff.ts:54`、`settings/gateway.ts:27`、`api-client/bff.ts` 无显式 deadline、AbortSignal 或调用方取消入口；bundle 七个读使用 Promise.all，单个慢请求可持续挂起或失败后让其他请求继续。当前测试未验证这类取消/慢请求恢复 | 不满足计划第 2.1/7.4 节的功能边界超时/取消要求，路由离开或依赖慢时不能明确结束 pending。Auth 上游已有 5 秒超时；目标 DB statement_timeout 实测 2min，故**不声称所有服务端 SQL 永久无界，也不将发布 P95 未验收当此缺陷** | transport 加可配置 deadline/调用方 signal；请求组失败/离开取消剩余读取，保留未提交草稿；写超时后用原 key/版本恢复，避免自动新意图重试 |
| M-04 | 中危；A2 功能阶段证据与依赖消费 | 本节点 stage_gate 仍 NOT_ASSESSED/null/[]，没有 A2 内容绑定功能 manifest/严格 READY runner。`check-bff-fe-001` 校验历史 COMPLETED；内存重置 BFF-FE-000 的 stage_gate 后仍 local_contract PASS。[阶段反证](evidence/bff-fe-001-review-20261005/dependency-stage-probe.json) | 当前 local_contract Gate **本来就不是 stage Gate**，其 PASS 不能用于把 BFF-FE-001 当作下游可消费前置；当前上游 READY 已核验，未发现实际越过该缺口放行。风险在后续错误消费或上游输入变化失效 | 补本任务功能 manifest、受检输入摘要、受控环境/遗留记录和递归依赖内容校验；本次缺陷关闭后重评，显式 READY runner 拒绝上游失效或自身失败证据 |

所有问题当前为 **OPEN**。本轮只复审和报告，未实施整改，也未把原测试 PASS 当成问题关闭。

### 3.3 未执行/待后续验收的风险

| 项目 | 当前状态 | 所属阶段/处置 |
|---|---|---|
| 正式 HTTPS staging、反向代理 Origin/cookie domain/浏览器 Secure/SameSite 行为 | 本轮 NOT RUN | RELEASE；本机 HTTP fetch 携 cookie 不验证浏览器 cookie 策略 |
| 当前发布候选远程同 SHA CI、部署/回滚、长期负载 | 本轮未获取候选回执 | RELEASE，不计入本轮 24 控制点缺陷分母 |
| PROVIDER:A2、PROVIDER:ALL、FEP-1/G1 页面完整业务链 | 尚未按各自范围验收 | 本任务局部 PASS 不能传递为这些节点 READY/ACCEPTED |
| passkey/WebAuthn | live 明确仅提供 authenticator，其他方法 422 | 当前 TOTP 能力边界；不可宣传 passkey 已集成，扩展前先冻结范围 |
| 多实例 MFA proof 与持久恢复 | bearer proof 在进程内，重启返回 AUTH_REFRESH_REQUIRED | 已按 ADR 明示；真实部署需重新 bridge/sticky 或相应设计及验收 |
| 未经本轮执行的多主体并发、跨租户/全角色、全部 MFA 限流负向、连续长稳 | 不宣称全量通过 | 后续聚焦功能/集成与 RELEASE 补齐；单主上下文/source 过滤和 reference 负向不替代全部真实矩阵 |
| 人工正式验收确认 | 本报告不是确认文稿或批准 | 技术问题关闭并形成具体范围文稿后由项目用户确认，不代签、不重复要求六份回执 |

资料只读字段注入和响应形状损坏作为候选进行了反证：OpenAPI operation 的请求是闭合 inline schema，reference 与 live 都返回 422，原 identity 数据保持一致。[reference 探针](evidence/bff-fe-001-review-20261005/reference-profile-probe.json)、[live 负向](evidence/bff-fe-001-review-20261005/live-input-negative/receipt.json)。因此不将组件输入 schema 的开放属性误报成实际接口漏洞。

## 四、整改建议

### 4.1 优先顺序与责任模块

1. **先修 H-01（BFF/Auth）**：账户因素状态与首因素授权条件在主体锁内统一校验。验证 A/B 双 session 场景：首次注册可用；首因素验证后 B 的旧 first_factor 新注册必须拒绝；普通 security grant 可注册；原成功 key 重放不产生额外因素；受控取消仍可恢复。
2. **同时补 H-02（BFF/QA）**：让实际 live 保护进入可执行的功能回归与 mutation。至少删除 last-factor/首因素状态保护时出现业务断言失败，而不是编译错误或仍全绿。真实 Supabase 测试继续与无 DB 测试分账，不安装本机 DB。
3. **修 M-01/M-02（BFF/观测）**：把保存、验证、reauth、撤销关联的 correlation/audit/事件统一；验证同一真实命令可从响应追溯 DB 审计与 trace。安全时间来源改为真实事实，补 MFA 前、后与重复验证的数据断言。
4. **修 M-03（API client/Frontend）**：提供 deadline/signal，测试慢依赖、用户取消、bundle 部分失败、401/409/429/503 及写响应丢失；必须保留草稿、原 key 与版本，禁止把未知写结果当未执行而新建命令。
5. **收口 M-04（工程验收）**：生成 A2 功能输入清单/摘要，记录当前实际命令与目标结果，消费 BFF-FE-000、CORE:F06、PROVIDER:A1 的有效 READY 范围。关闭上述问题后重评本节点；PROVIDER:A2 还需要 BFF-FE-007，不能因本报告单项复验自动放行。

### 4.2 复验完成标准

| 关闭对象 | 必须提交的证据 |
|---|---|
| H-01 | 真实受控 A/B session 负向与合法恢复路径；创建因素计数、清理结果；旧 grant 不再扩张权限 |
| H-02 | 实际 live 授权/状态机测试和至少对应 critical mutation 被业务断言拒绝；reference/live/目标结果各自清楚 |
| M-01 | 响应 correlation → trace → DB audit/事件引用关联成功；同 key 重放可追溯，副作用仍一次 |
| M-02 | 响应时间与权威验证时间一致；未验证状态不伪造最近 MFA 时间；契约/生成/consumer 同步 |
| M-03 | 受控延迟与取消回归、明确终态、资源释放、草稿保留，以及写超时安全恢复 |
| M-04 | 本节点内容绑定 manifest、严格阶段正负 runner；自身缺陷/陈旧输入/上游非 READY 必须拒绝；最终准入依当前有效证据 |

完成必要聚焦复验和契约/生成/规范检查后，更新当前审计入口与功能 stage_gate；正式候选另取 RELEASE 回执和用户确认。无需因为只整理无关文档重跑全部数据库/长稳测试，也不得将旧同 SHA formal notes 套用到新提交。

本次交付为本报告、[机读统计](evidence/bff-fe-001-review-20261005/inspection.json)、[源码输入](evidence/bff-fe-001-review-20261005/source-inputs.json)、[命令台账](evidence/bff-fe-001-review-20261005/commands.json)、重放脚本、原始正负日志及[摘要清单](evidence/bff-fe-001-review-20261005/manifest.json)。所有发现均可追溯到本轮受检源码和明确范围的执行/静态证据。
