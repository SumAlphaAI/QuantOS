# A1 / BFF-FE-000 页面 BFF OpenAPI 基线全面复审报告

> 日期：2026-10-03（Asia/Shanghai）  
> 依据：前端开发执行计划 v3.14；任务 BFF-FE-000、PROVIDER:A1、G0，以及第 5.3–5.7、6、7.1 节。  
> 源码基线：`75a563c62d3d7883d5b178111becec07d4da0301`，分支 `main`；复审开始时工作区干净。  
> 结论：**CHANGES_REQUESTED / NOT ACCEPTED**。仓库资产和原 Gate 已交付，但独立复核发现契约、生成语义、实时安全、mock 和门禁缺口。  
> 严格任务完成率：**0/1 = 0%**；等权验收控制点通过 **11/24 = 45.83%**。仅仓库工程控制点通过 **11/23 = 47.83%**。这些比例各有独立分母，不能与 operation 发布比例混用。

## 一、任务完成概况

本轮重新读取[任务及 A1/G0 验收要求](../SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md#task-bff-fe-000)、[Terminal 设计规格](../SumAlpha-QuantOS-Terminal-Frontend-Design-Spec.md)、[契约目录](../../bff/page-operation-catalog.yaml)、[OpenAPI](../../bff/openapi/quantos-bff.v1.yaml)、生成器、client、SSE、fixture、Rust 参考 provider、CI 与治理记录；没有沿用 2026-09-16 的 PASS 作为本次结论。

当前 `development_status=COMPLETED` 仅反映历史交付。已有 OpenAPI 3.1 / API 1.3.0、17 个契约分组、22 个一期 Web 页面、62 个 published operation、46 个 planned operation、51 个组件 schema，以及同源 TS 类型/HTTP client、Zod、JSON Schema、operation manifest、MSW 路由。原 A1 Gate 8/8、contract 17/17、API-client 46/46、本地 Rust 参考 provider 12/12 均通过；独立探针仍复现了报告中的缺陷，因此不能判为实际验收完成。

范围边界如下：

- A1 要冻结最低 G0 契约面、全页 operation 命名/owner、统一基线、生成与测试 harness；46 个 planned operation 的 path/schema/provider 由 A3–A6 承接，**不因这些后续实现未完成而扣减 A1 的交付率**。
- A1 的 provider/staging 证据和正式 G0 签署仍需按计划独立关闭；本轮不要求 A1 提前实现 A2–A6 的全部 provider，也不将整套页面 E2E 当作本任务独立交付物。
- P16 属 Desktop 二期，不进入 22 页分母。当前一期任务规范不要求指定模型复审；旧总结中的 GPT-6 Astra 状态不作为本报告缺陷或强制验收条件。
- 开始写入审计文件前，`node scripts/check-p0-acceptance.mjs` 对上述 HEAD 返回 `PASS / A1_ONLY`，同 SHA F06 回执依赖校验通过。这是**已有回执的当前校验**，本轮没有重新执行 Supabase 数据库验收。审计文件新增后工作区不再干净，不据此宣称新的 P0 回执通过。
- 本次仅新增报告及审计证据，未修改实现、任务状态或历史验收报告，未提交、推送、部署；没有启动本机数据库、Docker 或 Supabase 本地服务。

## 二、完成情况明细统计

### 2.1 统计口径

将任务原文及其明确引用的规范拆为 24 个等权控制点。`PASS` 表示本控制点范围完整、当前证据成立；`PARTIAL` 表示资产存在但仍缺语义或验收覆盖；`FAIL` 表示已复现不符合要求；`NOT_RUN` 表示必要目标证据/签署尚未完成。部分完成不折算半分，避免凭主观权重高估完成率。

| 统计层 | 分子 / 分母 | 实际结果 | 含义 |
|---|---:|---:|---|
| 计划记录的开发状态 | 1/1 | 100% 标记 COMPLETED | 历史状态；不等于本轮验收 |
| 严格任务验收 | 0/1 | **0%** | 本任务仍有活动高危问题，且 A1/G0 未关闭 |
| 仓库工程控制点 C01–C23 | 11/23 | **47.83%** | 11 PASS、9 PARTIAL、3 FAIL |
| 全部验收控制点 C01–C24 | 11/24 | **45.83%** | 11 PASS、9 PARTIAL、3 FAIL、1 NOT_RUN |
| PROVIDER:A1 / 正式 G0 | 0/1；0/1 | 均未验收 | 两个独立检查点；不重复计入任务分母 |
| 契约分组 / 一期页面命名覆盖 | 17/17；22/22 | 100% / 100% | 命名与追踪覆盖，不等于全页 schema/provider 完成 |
| 全 catalog operation 发布 | 62/108 | 57.41% | 46 个 planned 合法递延；不作为 A1 完成率 |
| 同源生成资产一致性 | 5/5 | 100% | 字节漂移检查通过；Zod 语义仍有缺陷 |

### 2.2 逐项核对矩阵

| ID | 需求、规范或验收项 | 当前事实与证据 | 判定 | 问题 |
|---|---|---|---|---|
| C01 | PRE-04/PRE-06、F03/F05/F06 与 P0 准入 | 原依赖状态及当前 P0 同 SHA 回执验证通过；PRE-04/PRE-06 当前 Gate 通过 | PASS | — |
| C02 | 版本化 OpenAPI 与 G0 最低冻结面 | 1.3.0 覆盖 Session/Context、Research、DataSnapshot、Strategy、Risk、Proposal、Approval、Order；本地 ref 可解析 | PASS | — |
| C03 | C01–C17 命名、owner 与 published/planned | 17 分组，62/46 分类与源/manifest 一致，后续 owner 有登记 | PASS | — |
| C04 | 每个 UI-Pxx 有 operationId 追踪 | 一期 P01–P15/P17–P23 共 22 页均登记；P16 排除 | PASS | — |
| C05 | 会话认证与 typed HTTP client | OpenAPI 全局 cookieAuth；createBffClient 使用 credentials=include，测试验证 | PASS | — |
| C06 | 统一错误 envelope 与 401/403/404/409/422/429/5xx | 有 ErrorEnvelope/共享 4xx；62 个 operation 均无 5xx/default 契约；状态必需扩展字段未强制 | PARTIAL | M-02 |
| C07 | cursor/pageSize/nextCursor | 8 个直接 Page 列表参数齐备；AuditEventPage 等有共享分页结构 | PASS | — |
| C08 | 服务端统一 sort/filter | 共享组件存在，但 paths 中零引用；8 个直接 Page 列表均无 sort/filter | FAIL | M-01 |
| C09 | 受信上下文、安全命令与 CSRF/recent-auth | cookie 安全描述存在；14 个受认证写操作缺 CSRF 声明，16/18 request body 开放未知字段；审批 reauth 可选 | PARTIAL | H-03 |
| C10 | 202 job 与基础幂等语义 | AsyncAccepted 有 jobId/status/correlationId；业务写操作引用必需 Idempotency-Key；认证/访问申请例外已有声明 | PASS | — |
| C11 | ETag/objectVersion/If-Match/409 | draft GET 有 ETag；Profile/Notification 等版本资源未声明 ETag，Conflict.currentVersion 仍可缺省 | PARTIAL | M-04 |
| C12 | correlation ID 一致性 | 共享错误响应有 header；62 个成功响应仅 getSession/getContext 声明该 header | PARTIAL | M-03 |
| C13 | SSE envelope、回补、权限终态与未知版本拒绝 | 有 sequence/afterSequence 和断流/权限 PoC；未知版本会 apply，500 不恢复，跨 origin 不带 include | PARTIAL | H-02 |
| C14 | TS client 与生成 schema 导出 | typed paths 与 HTTP client、Zod registry 导出存在，lint/typecheck 通过 | PASS | — |
| C15 | 同源 Zod 的数据与开放对象语义 | 合法 StreamEvent.payload / StrategyDraft.parameters 被 parse 清为 {}，与 JSON Schema 行为不一致 | FAIL | H-01 |
| C16 | Proto / JSON Schema / 页面模型一致性 | BFF JSON Schema 与源同源；F03 Proto 自有检查，但未发现可执行的 BFF↔领域转换/枚举/精度一致性断言 | PARTIAL | M-05 |
| C17 | 同 schema mock 与 provider/consumer harness | 62 路由已生成；仅 4 个 resolver；cookie/status/request validation 与契约存在矛盾 | PARTIAL | H-06 |
| C18 | 敏感字段扫描进入 CI | fixture 递归敏感 key 扫描、别名与 sabotage 测试、CI contract 接线存在并通过 | PASS | — |
| C19 | 生成漂移阻断 | 5 个生成资产临时重生成并逐字节比较通过 | PASS | — |
| C20 | API 兼容性 / breaking 变更阻断 | 只有生成同步及 Proto breaking；BFF 无独立历史 OpenAPI diff/兼容 Gate | FAIL | H-04 |
| C21 | 单元、契约及本地 provider 基础测试 | 46/46、17/17、12/12；bff.ts+sse.ts 行覆盖率 98.11% ≥80%，此处只计本地基础层 | PASS | — |
| C22 | 可破坏门禁、有效 CI 和关键安全断言 | 原 8/8 通过；独立 7 类破坏输入均被 A1 checker 误放行；SSE 安全/错误路径未完整受检 | PARTIAL | H-05、H-02 |
| C23 | 每 operation 说明、示例、限流/审计/缓存及文档维护 | YAML 无 operation 直接请求/成功响应 example；仅 3 个共享错误 example；旧活跃总结仍指向 1.1.0 | PARTIAL | M-06、L-01 |
| C24 | A1 目标证据与当前 G0 联合签署 | PROVIDER:A1 与 FRONTEND-GATE:G0 均 NOT_STARTED、source_commit=null、evidence=[] | NOT_RUN | B-01 |

### 2.3 当前验证记录

执行记录见[commands.json](./evidence/bff-fe-000-review-20261003/commands.json)和[证据总清单](./evidence/bff-fe-000-review-20261003/manifest.json)；精确问题输入及输出见[inspection.json](./evidence/bff-fe-000-review-20261003/inspection.json)。

| 验证 | 本轮结果 | 证据边界 |
|---|---|---|
| OpenAPI、生成漂移、operation 覆盖、A1 Gate | PASS | 当前源/资产结构一致 |
| A1 原正负测试 | 8/8 PASS | 现有门禁样例，不覆盖全部安全/语义退化 |
| contract fixtures / MSW | 17/17 PASS | fixture/mock；不是真实 provider 返回的 schema 反校验 |
| API-client lint / typecheck / unit | PASS；46/46 | 初次受限环境 4 个 SSE 监听 EPERM；允许 loopback 后 46/46 通过 |
| 本地参考 provider | 12/12 PASS（auth/settings 8，audit/export 4） | Rust Router 内存参考实现；无数据库、IdP、对象存储或 staging |
| A1 client/SSE 定向覆盖率 | 行 98.11%，分支 85.71% | 仅 bff.ts+sse.ts；不代表关键风险分支 100% 或 workspace 总覆盖率 |
| PRE-01/PRE-04/PRE-06/计划/G0 治理 | PASS | 治理 Gate 的 PASS 明确返回 G0 NOT_STARTED，不是签署通过 |
| 锁文件 | PASS（复验） | 初次 uv 缓存访问受限；允许读取宿主缓存后 manifests/locks 检查通过 |
| 独立 Zod / Gate 探针 | 2 个数据丢失复现；7/7 破坏输入仍 PASS | 证明缺陷存在；没有修改源契约/CI |
| 独立 SSE / MSW 探针 | 5/5 缺陷复现成立 | 测试 PASS 的含义为“观察到缺陷”，不得算整改通过 |
| provider/staging 与正式 G0 | NOT_RUN / NO CURRENT RECEIPT | 未启动目标部署，也未补签署 |

## 三、问题清单及风险分析

### 3.1 分级与数量

阻塞级：缺少必须的阶段放行证据，阶段不能关闭。高危：影响安全、交易/实时状态真实性、数据保真或关键门禁可信度。中危：契约联调与规范完整性不足。低危：文档导航和版本维护不一致。

| 优先级 | 活动问题数 | 已整改关闭数 |
|---|---:|---:|
| 阻塞级 | 1 | 0 |
| 高危 | 6 | 0 |
| 中危 | 6 | 0 |
| 低危 | 1 | 0 |
| 合计 | **14** | **0** |

本轮为检查与报告交付，全部发现均保持 OPEN。B-01 是验收缺口，其余是仓库工程/契约问题；不把后续 planned provider 的合法未交付重复计为问题。

### 3.2 逐项问题清单

| ID / 优先级 | 所属模块 | 具体表现与定位 | 影响范围 / 风险 | 整改建议与验收条件 |
|---|---|---|---|---|
| B-01 / 阻塞级 | A1/provider、G0 治理 | [计划 A1](../SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md#acceptance-provider-a1)及[当前 G0 治理](../gate-records/G0-current-governance.json)仍无当前签署/目标证据；历史 2026-08-14 签署明确不代表当前版本 | 阻断 A1/G0 关闭；历史仓库 PASS 不能授权后续阶段 Integrated/Done | 明确本窗口最小 provider/harness 范围，完成真实 staging 合同验证及当期联合签署；回执绑定明确源码与环境；不要求先实现 A3–A6 全 provider |
| H-01 / 高危 | Zod 生成器 | [生成器](../../scripts/generate-bff-contracts.mjs)77–91 行对未关闭的 object 输出默认 z.object，开放键被剥离；独立解析合法 StreamEvent.payload 与 StrategyDraft.parameters 均变为 {} | 影响 SSE 撤权事件类型、策略参数及同类开放对象；JSON Schema 校验通过而 Zod 输出损坏；若消费者采用 parsed.data，会丢失关键语义 | 显式保留允许的未知键/开放 map，禁止键仍拒绝；对 allOf、additionalProperties true/false/schema 和 parse 后保真做对照测试；不能仅断言 success=true |
| H-02 / 高危 | SSE transport/reducer | [sse.ts](../../packages/api-client/src/sse.ts)46–59 行不检查 payloadVersion；107–115 行 fetch 未 include、非 2xx 直接 throw；独立探针分别复现未知 v999 被 apply、500 单次退出、跨 origin 无 include | 影响五类已发布订阅面的公共消费能力；可能应用不可理解的状态，无法按承诺恢复 5xx，在配置的独立 BFF origin 丢失 cookie；尚无真实目标测试，未宣称实际交易事故 | 在 apply 前校验 envelope/版本；按约定处理鉴权终态、网络/5xx 有界退避与 afterSequence 回补；携带符合 origin 策略的 cookie；补全这些安全路径断言及目标 SSE 证据 |
| H-03 / 高危 | 共享请求安全契约 | [OpenAPI](../../bff/openapi/quantos-bff.v1.yaml)：14 个受认证写操作无 X-CSRF-Token；18 个 body 中 16 个未关闭未知字段；decideApproval 的 reauthTokenRef 可选；高风险请求的 client request ID 未发布 | 覆盖 Research/Strategy/Risk/Approval/Execution；schema 层无法表达统一安全前置条件，允许额外 actor/tenant 类键；**这不证明后端已存在 CSRF 或越权漏洞** | 在统一基线落实 CSRF/Origin 与受信字段禁止输入；对需要扩展的 parameters map 单独开放；明确高风险 request ID、版本与 reauth/MFA 必需性及错误响应；生成 client/请求负向合同同步 |
| H-04 / 高危 | OpenAPI 兼容门禁 | [check-bff-generated](../../scripts/check-bff-generated.mjs)只比较当前源与当前生成物；[OpenAPI checker](../../scripts/check-bff-openapi.mjs)无历史契约比较；[Proto breaking](../../scripts/check-proto-breaking.mjs)仅保护 Proto | 同步重生成不能证明 BFF 只加不破；已有消费者可能面对 required/类型/枚举删除/响应变化；独立改 DecimalValue 的 A1 检查仍 PASS，但不据此声称所有 CI 都会通过 | 以 PR base / push before /受信冻结版本执行 BFF OpenAPI breaking diff；缺基线失败关闭；breaking 按 /v2 或正式兼容决策处理，并生成受影响页面报告 |
| H-05 / 高危 | A1 checker / CI 接线验证 | [check-bff-fe-000](../../scripts/check-bff-fe-000.mjs)检查共享组件存在及 workflow 字符串；七类输入破坏均 PASS：去 cookieAuth、IdempotencyKey 非必需、Sort 改整数、C03→P23 错配、A1 step if:false、DecimalValue 改 number、payloadVersion 无约束 | A1 Gate 单独不足以证明基线安全、页面语义或 CI 活跃性；其他任务 Gate 可能截获部分变更，本报告不把单 Gate 误放行等同完整 CI 逃逸 | 精确验证共享语义、operation 引用、catalog page/owner 映射；解析有效 YAML step/job 条件，禁止跳过/continue-on-error；把七类输入纳入反例，结合 H-04 独立兼容 Gate |
| H-06 / 高危 | MSW / provider-consumer harness | [handlers.ts](../../tests/contract/handlers.ts)7–19 行按 Authorization 放行 getSession，cookie-only 返回 403，而该 operation 只声明 200/401；draft fresh-version 对缺 Idempotency-Key 且 body 仅 name 的请求返回 200；原测试就是此类请求 | 现有测试可全绿但没有忠实验证 cookie、必需请求字段/头、允许状态码；仅 4/62 有 resolver，58 个未配置返回 501 是诚实未配置行为，不能冒充联调完成 | mock 校验 method/path/请求 headers/body/认证约定及响应 status/schema；provider harness 对真实 Router/HTTP 响应反校验同一 OpenAPI；保留 501 未配置语义；不把 MSW fixture 当目标 provider 回执 |
| M-01 / 中危 | 列表 sort/filter | [OpenAPI](../../bff/openapi/quantos-bff.v1.yaml)1264–1273 定义 Sort/Filter，但 paths 零引用；listResearchRuns 虽描述排序仍缺 sort，8 个直接 Page 列表全部缺通用参数 | 生成 client 无可依赖的 sort/filter；页面容易自行发明表达式或本地排序；与统一基线要求不符 | 对适用列表发布参数及每 operation 字段/operator allowlist，未知条件 422；不适用者显式注明原因并受 Gate 校验 |
| M-02 / 中危 | 错误模型 | 62/62 operation 未声明 5xx/default ErrorEnvelope；Conflict 的 currentVersion、RateLimited 的 retryAfter 只在共享 schema 可选；ErrorEnvelope 接受未知 debug 键 | 生成 client 无统一故障响应契约，不能保证409/429补充信息；敏感 key scanner 不等于错误 message/任意 debug 的脱敏证明 | 发布通用服务器错误响应和 operation 适用错误集；使用有明确条件的 conflict/rate-limit 变体；明确扩展字段与脱敏策略，增加状态码+内容校验；未知机器码必须 fail closed |
| M-03 / 中危 | correlation header | OpenAPI 总则要求所有响应携带 X-Correlation-Id；成功响应仅 2/62 声明，缺失清单共 60 项见 inspection.json；kill-switch 成功 RiskView 本身也无 correlationId | 生成类型、消费者和 provider 对追踪约定不一致；危险动作反馈与审计跳转无法凭契约保证完整 | 成功/错误/204/stream response 统一声明并实测 header；需要 body correlationId 的页面模型补齐；验证 header/body/audit 关联一致 |
| M-04 / 中危 | 版本并发契约 | 仅 getStrategyDraft 声明 ETag；Profile/Notification 依赖 objectVersion/If-Match，却没有 ETag response 声明；409 currentVersion 未受响应变体必需约束 | 统一 ETag 读取/回传与冲突恢复不能由生成客户端和合同完整证明 | 明确允许 body version 的等价规则，或补齐版本资源 ETag；409 返回匹配资源的 currentVersion；实测两客户端并发、草稿保留、幂等与版本校验先后 |
| M-05 / 中危 | wire/domain 一致性 | [Proto compatibility](../../scripts/check-proto-compatibility.mjs)测试 Proto 跨语言；BFF 生成器只读 YAML，BFF coverage 只检查 schema 名与 operation 引用；字段字典领域锚不是可执行序列化转换断言 | Decimal/Money/枚举/required/nullable/UTC 及字段裁剪存在双源漂移风险；本轮没有据此认定具体 Proto 字段错误 | 对批准的领域→页面模型映射建立可执行契约，验证精确数值、未知枚举、metadata 注入与字段裁剪；允许页面聚合模型不同于 Proto，但差异需明确且受测试保护 |
| M-06 / 中危 | operation 规格与示例 | YAML 中 0 个 operation 直接附请求或成功响应 example，仅 3 个共享错误 example；capability 结构化标注集中于 6 个 audit operation，其他多为 prose；无全量逐 operation 限流/缓存/审计/恢复适用性表 | 前端与 QA 难以独立判断全部 published operation 的合法场景；参考 provider no-store 不能弥补未发布契约说明；并非声称所有操作均无文档 | 为 62 个 published operation 提供可验证示例和适用性表，记录权限、错误、幂等、版本、审计、限流、cache/asOf、恢复、敏感字段；合法 N/A 应有原因；planned 继续单列 |
| L-01 / 低危 | 当前交付说明 | [BFF-FE-000-summary](../BFF-FE-000-summary.md)和[proposal](../BFF-FE-000-openapi-proposal.md)仍呈现 1.1.0 /55 operations/41 schemas/51 planned 为当前发布面；与 1.3.0 /62/51/46 不符 | 阅读入口和“下一任务”说明容易误导，历史回执日期正确，本身不应被改成新版本证据 | 保留 2026-09-16 验收证据原文，在活跃摘要/方案加历史标签与当前索引；同步当前数量及 G0/A1 放行边界 |

### 3.3 风险解释与验收限制

H-01 与 H-02 可能叠加：若调用方先使用生成 Zod 的 parsed.data，再将事件传入 reducer，permission_revoked 类型可能被剥离，撤权终态便不能按原数据触发。独立探针分别证明数据被剥离和未知版本被 apply；本轮没有运行此组合的真实页面/生产流程，组合影响为基于源码的风险推断。

绿色测试不消除这些问题。现有单元测试只证明它们实际断言的场景；行覆盖率 98.11% 不能证明未知版本、安全前置或错误契约正确。BFF-FE-001/007 的本地参考实现是有价值的增量证据，但 12 项测试的状态/字段断言不等于完整 OpenAPI 自动反校验，更不等于 staging 的真实身份、数据库、签名下载或全部 provider 验收。

当前工作区回执无法替代远端 workflow receipt。本轮未核验 GitHub 同 SHA CI 运行，因此远端 CI **未验证**，不宣称其不存在或失败。已有 Supabase/P0/F06 回执仅在 C01 明确范围内校验，不能用于证明本轮 provider/staging。现有 G0 治理有 10 项历史遗留，其中 9 项为 OVERDUE_PENDING_REPLAN；这些包含后续页面/原生工作，**不另计为本任务的十项缺陷**。

## 四、整改建议

### 4.1 推荐顺序与责任

| 顺序 | 整改范围 | 建议责任模块/角色 | 可验收交付 |
|---|---|---|---|
| 1 | H-01、H-02 | API-client owner、BFF TL、QA、安全 | Zod 数据保真；SSE schema/version/credentials/故障恢复实测；原缺陷探针改为正确行为断言 |
| 2 | H-03、M-01～M-04 | BFF TL、风险/执行/认证 owner、FE TL | 安全、错误、sort/filter、追踪、版本契约修订；请求/响应样例及客户端同步生成；明确版本兼容影响 |
| 3 | H-04、H-05、H-06、M-05、M-06 | BFF TL、CI owner、QA、领域 owner | 受信历史 BFF diff、有效 CI 与语义反例、mock 请求/响应验证、provider 反校验 harness、domain 映射和每 operation 规格 |
| 4 | L-01 | BFF TL、文档 owner | 活跃文档更新，历史证据保持原版本，报告/计划索引互通 |
| 5 | B-01 | BFF/Frontend/QA/安全/领域 owner；G0 所需产品/风控 | 当期 staging 范围及合同回执、当前联合签署、PROVIDER:A1 与正式 G0 更新 |

期限应由 owner 在接收问题后登记，不代替责任人虚构承诺。修订 required 字段/语义时先执行兼容分析，不能用“统一基线整改”绕过只加不破策略。

### 4.2 再复审退出条件

1. 全部 14 项问题逐条有整改证据；关键问题不因原测试绿或重生成一致而直接关闭。
2. C01–C23 仓库控制点完整通过，现有单元/contract/参考 provider 继续通过；新增测试以正确业务行为为断言，逐项拒绝原七类 Gate 退化。
3. Zod↔JSON Schema 不仅接受/拒绝一致，还应验证解析后的数据保真；MSW 与 provider 同时检查请求和响应、状态码和 headers。
4. CI 使用独立 BFF 兼容基线、活动步骤语义校验、schema/安全负向检查，并取得所需远端对应 SHA 证据。
5. 按 A1 实际最小范围取得 provider/staging 回执及当期 G0 签署；C24 才能由 NOT_RUN 晋级 PASS。只连接配置的 Supabase PostgreSQL，禁止本机建立数据库；目标执行与本地静态验证分别记账。
6. 更新任务工程复审结论及 A1/G0 检查点；保留后续 planned operation 的独立交付边界。新增源码提交不能自动继承本报告/P0 的旧 SHA 验收。

证据重放：`python3 docs/audit/evidence/bff-fe-000-review-20261003/run-checks.py`；`node docs/audit/evidence/bff-fe-000-review-20261003/inspect.mjs`；`pnpm exec vitest run docs/audit/evidence/bff-fe-000-review-20261003/runtime-probes.test.ts`。后两项刻意记录当前缺陷，整改后应重新解释其结果，不可长期作为成功行为回归。API SSE 测试需允许本机 loopback 监听；所有命令均不负责部署或目标数据库验收。
