# A1 / PROVIDER:A1 验收检查点全面复审报告

> 复审日期：2026-10-04（Asia/Shanghai）
> 源码基线：`4a3fbe9fe79025422d1cdf87331cacbb77fe1861`；开始复审时工作区干净，本轮只新增审计报告及证据。
> 结论：**CHANGES_REQUESTED，尚不能作为后续节点的 READY 前置。**
> 21 个控制点中：**15 PASS、2 PARTIAL、2 FAIL、1 NOT_ASSESSED、1 MISSING；完整完成率 15/21 = 71.43%。**
> 问题总计：**1 阻塞级、1 高危、3 中危、1 低危**。staging/联合签署仍在 RELEASE 执行，不因当前缺少它们阻塞开发。

## 一、任务完成概况

### 1.1 依据与范围

依据[前端执行计划 v3.18 第 2.1 节、PROVIDER:A1、第 5.6–5.7/6/7.1 节](../SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md#acceptance-provider-a1)，核对需求范围、开发规范、契约、生成客户端、schema、安全负向、已实现 provider/consumer harness，以及阶段依赖和验收证据。补充对照 [BFF OpenAPI 基线说明](../BFF-FE-000-openapi-proposal.md)、[页面 API 覆盖台账](../PRE-01-page-api-coverage-register.md)、[Terminal 页面规格](../SumAlpha-QuantOS-Terminal-Frontend-Design-Spec.md)及根目录 [AGENTS.md](../../AGENTS.md)。

当前检查点的直接依赖为 `FE:BFF-FE-000`、`PREPARATION:P0`。本阶段必须验证已有工程实现与功能证据；A2–A6 尚未交付的 provider、P16 Desktop、全站最终业务闭环不计入 A1 实现分母。对于当前已经存在并被 A1 开发测试使用的 C01/C17/C10 reference harness，以及 C01/C17 live 安全接口的契约配置，仍应验证其声称的行为。

本轮未复用旧审计 PASS 作为当前执行结果，未变更业务代码、计划状态或 Git notes。真实 Supabase PostgreSQL、IdP/Storage、目标浏览器、staging、托管同 SHA CI、性能/长稳及 RELEASE 联合签署均 **NOT RUN / NO NEW RECEIPT**。没有启动本地数据库、容器或 Supabase 本地服务；所有 HTTP 探针使用合成身份和回环 reference 模式。CORS 探针执行当前源码中的独立中间件配置，不初始化 live 数据库。

### 1.2 已交付成果与实际完成率

- 基线资产已交付：API `1.5.0`，17 个契约、22 个一期页面、62 published operation、46 planned operation、52 schema；六类生成资产与 OpenAPI 一致。
- 当前现有正向 reference harness 覆盖 C01/C17/C10 的 **26/26 operation，28 次请求**，其余 36 个 published operation 在本轮仅验证契约/生成/consumer 基线，不能由 26 个 reference operation 推断为真实 provider 已实现。46 planned operation 是明确后续范围，不算 A1 缺陷。
- 检查点完整完成率为 **71.43%**，只计矩阵中的完整 PASS，不给 PARTIAL 半分。若仅统计工程控制点、排除 A02/A03 两个阶段准入项，则为 **15/19 = 78.95%**。比例表示审计控制点的完整满足程度，不表示工时或全业务交付比例。
- DEVELOPMENT 检查点准入为 **0/1 READY = 0%**；两个直接依赖为 **0/2 READY**。含本节点的 14 个依赖闭包节点全部 `NOT_ASSESSED`，见[依赖快照](./evidence/provider-a1-review-20261004/dependency-stage-snapshot.json)。这表示阶段评估未闭环，并不表示这些任务的代码开发完成率为零。
- 计划原记录为 `review_status=NOT_STARTED`、`source_commit=null`、`stage_gate=NOT_ASSESSED/null/[]`。本报告给出复审结论，不自动修改其正式状态。RELEASE 的正式 ACCEPTED 尚未取得，但它不进入本阶段完成率分母。

### 1.3 准入判断

**可以继续开展整改和开发；不能以当前工程命令 PASS 宣布 PROVIDER:A1 已 READY，或据此关闭 BFF-FE-001/BFF-FE-002/PROVIDER:A2/G0 的依赖准入。** 原因是上游阶段证据缺失，以及本轮已复现的幂等和跨域预检缺陷；不是缺少 staging。

`pnpm check:bff-a1-development` 当前 PASS，输出明确为 `engineering baseline only`、`formalAccepted=false`。`check:development-plans` 当前结构 PASS。二者都不能替代第 2.1 节要求的功能输入清单、结果证据和依赖 READY。

## 二、完成情况明细统计

### 2.1 逐项核对矩阵

统计方法：每个控制点等权，只有 PASS 记为完成；PARTIAL 是已有证据但覆盖不足，FAIL 是已复现不符合要求，NOT_ASSESSED/MISSING 是阶段评估或必要产物缺失。同一根因可以影响多个控制点，但问题清单按独立整改事项去重。

| 编号 | 控制点 | 结果 | 核对事实及验收范围 | 问题 |
|---|---|---|---|---|
| A01 | 阶段范围、排除项与验收口径 | PASS | 计划 v3.18 DEVELOPMENT/INTEGRATION/RELEASE 边界一致；未交付 A2–A6 provider 不计 A1 实现范围。 | — |
| A02 | 直接依赖及递归前置功能准入 | NOT_ASSESSED | 两个直接依赖均无 READY；含本节点的 14 个依赖闭包节点均 NOT_ASSESSED。 | B-01 |
| A03 | PROVIDER:A1 功能输入清单、摘要与回执校验 | MISSING | 计划记录为 null/[]；现有工程命令不核验完整输入清单或阶段依赖。 | M-01 |
| A04 | OpenAPI 语法、组件与 operation 完整性 | PASS | API 1.5.0，62 operation / 52 schema；验证通过。 | — |
| A05 | 页面、契约、owner 与 published/planned 追踪 | PASS | C01–C17 / 22 页面，62 published / 46 planned 精确映射，P16 排除。 | — |
| A06 | 六类生成资产与同源一致性 | PASS | TS、Zod、JSON Schema、operation manifest、MSW、Rust input policy 重生成逐字节一致。 | — |
| A07 | 破坏性变更与兼容性决策 | PASS | 69 项安全修正均登记；未登记/过期/删除/收紧负向断言通过。 | — |
| A08 | 客户端类型、Lint 与 Rust 格式规范 | PASS | api-client typecheck/lint、bff-gateway cargo fmt --check 均通过。 | — |
| A09 | 已实现 reference provider 正向 HTTP harness | PASS | C01/C17/C10 的 26/26 operation、28 次请求通过现有 harness；仅声明其正向范围。 | — |
| A10 | 认证、Origin/CSRF、capability 与输入防伪 | PASS | 真实 reference 回环拒绝缺/错会话、缺 CSRF、坏 Origin、viewer 越权及伪造 actor。 | — |
| A11 | 响应 schema、错误 envelope、correlation 与缓存头 | PASS | 当前契约测试及 18 条独立 HTTP 记录均通过 response schema；错误/成功 correlation 校验通过。 | — |
| A12 | 领域精度、枚举、受信字段转换 | PASS | 当前 api-client 的 Proto/domain 与 response 回归通过；不宣称所有后续聚合已实现。 | — |
| A13 | C01/C17 幂等、版本冲突与近期认证 | PASS | 12 个 Rust auth/settings 测试通过；独立 stale-version 409 / MFA+reauth 建立成功。 | — |
| A14 | C10 导出创建/取消的业务幂等冲突 | FAIL | 同键改 reason 或改 exportId 均返回 202，未拒绝不同业务意图。 | H-01 |
| A15 | SSE 游标、重连、版本与撤销终态 | PASS | 客户端 SSE 安全回归及 Rust 持续流/目标撤销/过期断言通过；未验证目标浏览器网络。 | — |
| A16 | 参考审计、脱敏、导出生命周期及期限 | PASS | 5 个审计导出 Rust 回归和 HTTP queued/ready/download/cancel 正向流程通过；不同意图重试独立列 A14。 | — |
| A17 | 稳定门禁对独立失败场景的检测能力 | PARTIAL | 已有负向测试通过，但未包含本轮两条 C10 冲突及 live 近期认证预检场景。 | M-02 |
| A18 | TypeScript 覆盖率与已登记关键分支 | PASS | Web lines 92.85% >=80%；六文件关键清单 129 lines /111 branches 全部覆盖。 | — |
| A19 | 本地门禁与有效 CI 接线 | PASS | Frontend Baseline 执行 A1/兼容/negative；main CI 执行 Rust provider 与 HTTP harness；未声明远端本 SHA CI 成功。 | — |
| A20 | 测试执行范围与数据库结果可观测性 | PARTIAL | 一项 real DB test 未启用却由 Rust 输出 ok；需执行状态或独立回执澄清。 | L-01 |
| A21 | 已实现 live 安全操作的跨域预检契约 | FAIL | 精确 CorsLayer 片段执行不允许必需 X-Reauth-Token-Ref；控制用例通过而必需头用例失败。 | M-03 |

| 结果 | 数量 | 占比 |
|---|---:|---:|
| PASS | 15 | 71.43% |
| PARTIAL | 2 | 9.52% |
| FAIL | 2 | 9.52% |
| NOT_ASSESSED | 1 | 4.76% |
| MISSING | 1 | 4.76% |
| 合计 | 21 | 100%（分项四舍五入） |

### 2.2 当前源码的实际验证结果

全部命令、退出码和原始日志保存在[证据目录](./evidence/provider-a1-review-20261004/README.md)。这些测试有重叠，不能将各套用例数量相加成独立验收项数量。

| 验证 | 实际结果 | 边界 |
|---|---|---|
| 开发计划结构及阶段负向 | PASS；35/35 negative | 验证图与状态形状，不执行功能或证据内容校验 |
| A1/OpenAPI/生成/契约追踪/开发基线 | 全部 PASS | 基线工程一致性 |
| 兼容性及 A1/整改负向 | PASS；69/69 登记修正，26/26 negative | 当前授权范围含精确安全修正；不含 staging/owner 签署 |
| PRE-01/04/05/06 静态入口 | PASS | 未进行完整 P0 PoC/浏览器/目标数据库验收 |
| PRE-04/06 negative | 38/38、17/17 PASS | 只证明这些断言执行 |
| api-client 类型、Lint，Rust 格式 | PASS | 受检模块，不宣称全仓 Lint/typecheck |
| api-client 单元回归 | 61/61 PASS | 包括 Proto、响应、SSE 安全逻辑 |
| contract 回归 | 25/25 PASS | 62 operation /52 schema 的契约基线 |
| Rust bff-gateway | Cargo 汇总 21 ok；实际 17 集成＋3 非数据库单测执行通过 | 另 1 个 real DB case 因开关关闭直接返回，不能计数据库执行 |
| reference 正向 HTTP harness | PASS；26 operation /28 request | 无真实 DB/IdP/Storage/staging |
| 独立 reference HTTP 业务负向/准备探针 | **16/18 PASS，2 FAIL** | `createExport` 改内容、`cancelExport` 改资源同键冲突失败；18/18 response schema 本身均通过 |
| 当前 live CorsLayer 独立预检 | **1/2 PASS，1 FAIL** | 用当前代码片段执行真实中间件；非完整 live/browser 链路 |
| Web TS coverage | 238/238 测试 PASS；lines **92.85% (1326/1428)** | 当前 Vitest 配置的 TS 范围，不含 TSX/生成 Proto；不代表 Rust 覆盖率 |
| 已登记 critical coverage | 178/178 PASS；lines **129/129**、branches **111/111**、functions **31/31** | 六文件关键清单四指标均 100%；不外推所有 provider 分支 |
| 阶段内容绑定探针 | 静态结构校验接受不相关文档及假摘要 | 属静态校验器既定范围，反证不能把结构 PASS 用作功能 READY |
| 当前 SHA 的 legacy `check:p0` | FAIL / admission NONE | 当前本地 P0/F06 notes 不存在；不是本轮实际重跑 39 项业务失败 |
| `check:bff-a1-final-review` | 预期 `NOT_ACCEPTED`，formalAccepted=false | 无当期 staging/签署回执；按 RELEASE 保留，不计开发缺陷 |

本轮源输入清单含 388 个受检文件的 SHA-256/大小，[环境记录](./evidence/provider-a1-review-20261004/environment.json)绑定[源输入清单](./evidence/provider-a1-review-20261004/source-inputs.json)。这份清单是审计追溯产物，没有替代各依赖节点的功能回执，也没有自动授权阶段 READY。

## 三、问题清单及风险分析

### 3.1 分级总表

| ID | 优先级 | 所属模块 | 具体表现 | 影响范围 |
|---|---|---|---|---|
| B-01 | 阻塞级 | PROVIDER:A1 / 上游 stage_gate | 直接依赖和本节点无阶段 READY 证据 | A1 准入及依赖它的后续检查点 |
| H-01 | 高危 | C10 reference 导出/取消 | 同键不同意图/资源返回原 202 结果 | 已实现 reference harness、导出重试/取消/审计语义 |
| M-01 | 中危 | 阶段验收入口、manifest 校验 | 缺完整范围的可执行功能回执校验 | 手工 READY 记录的内容可信度与增量复评 |
| M-02 | 中危 | provider/consumer 回归与 CI | 已有绿灯未检测本轮三条业务/边界失败 | 契约基线的持续防退化能力 |
| M-03 | 中危 | live CORS / C01/C17 | 缺近期认证 header 的预检允许项 | 跨域 Web 的会话/设备/MFA 安全操作 |
| L-01 | 低危 | Rust real DB 测试状态 | 未执行的数据库 case 显示为 ok | 测试摘要和验收统计的准确性 |

### 3.2 阻塞级

**B-01｜功能准入依赖尚未完成评估和登记。** 计划第 2.1 节明确：下游 READY 需要自身输入摘要、非空证据和全部依赖 READY。`FE:BFF-FE-000` 虽为 development COMPLETED，其 stage_gate 仍未评估；`PREPARATION:P0` 虽登记历史 `ACCEPTED` 与 `0149e568…` 回执，其当前功能 stage_gate 也未评估。本节点同样 null/[]。历史完整验收或代码已完成不能替代这些独立记录。

影响：阻塞“把该检查点作为已通过前置”的准入，不阻塞继续工程开发。当前 SHA 缺 P0/F06 formal note 是历史严格入口的状态事实；按新计划不能据此要求因无关文档变化重跑整套 Supabase/staging。需按受影响功能输入与现有证据聚焦评估。证据：[14 节点依赖快照](./evidence/provider-a1-review-20261004/dependency-stage-snapshot.json)、[当前 note 存在性](./evidence/provider-a1-review-20261004/note-presence.json)。

### 3.3 高危

**H-01｜C10 reference 幂等缓存未绑定业务意图与资源。** [create_export/cancel_export](../../services/bff-gateway/src/lib.rs)分别使用 `export.create:{key}`、`export.cancel:{key}` 取旧结果，没有检查 actor/session、请求内容或目标 exportId。已有 `IdempotentCommand` 在 auth/settings 路径实现了内容/资源冲突检查，但这两个处理器未使用它。

独立复现：创建导出后，保持键不变、将 reason 改为另一合法用途，期望 409，实际 202 且复用原 exportId。创建第二个导出后，对第二个资源复用第一次取消的键，期望 409，实际 202，返回第一次取消的 exportId。两种响应均符合 JSON Schema，因此只验响应结构不会发现问题。与 OpenAPI 的 `same actor/key/business intent; changed payload conflicts` 政策不符。

影响：错误业务意图被误认为成功执行，取消另一任务时返回旧任务结果，消费者回归与审计解释可能出现假通过。本轮**只在合成 reference provider 复现**；当前 live router 没有挂载 C10 导出业务，不宣称生产数据泄露或真实 Storage 命令存在同一漏洞。该模块在目录中归属后续 `BFF-FE-007`，本轮因其已被现有 A1 harness 执行而检查，不要求提前交付尚未实现的 live C10。证据：[两条失败及重放对照](./evidence/provider-a1-review-20261004/independent-http-probes.json)、[可执行探针](./evidence/provider-a1-review-20261004/independent-probes.mjs)。

### 3.4 中危

**M-01｜新阶段规程尚未接入完整功能回执入口。** 现有 [check-bff-a1-acceptance](../../scripts/check-bff-a1-acceptance.mjs) 的 development 分支只调用 BFF-FE-000 结构/语义基线；`inputsDigest` 是 OpenAPI＋生成 Zod 两文件的契约摘要，不是第 2.1 节规定的代码/契约/配置/测试/依赖证据完整清单摘要。没有 PROVIDER:A1 的功能结果聚合或依赖内容验证。

反证：仅在内存将本节点及 13 个前置填入 `sha256:aaaa…` 与不相关的 F01 历史文档，`validatePlans` 返回结构 PASS/14 READY；文档真实摘要为 `f4212ac4…`，与填入值不同。其 [静态校验器](../../scripts/check-development-plan-order.mjs)明确声明不核验证据内容，因此这不是该工具违背自身范围的 bug，也不表示当前计划已错误放行。风险在于用它作为唯一 READY 验收入口。执行计划已提示 runner 混合阶段尚需拆分，此处属于 A1 准入收口的未完成项。证据：[内容绑定探针](./evidence/provider-a1-review-20261004/stage-binding-probe.json)。

**M-02｜业务失败与浏览器边界尚未成为稳定回归断言。** [现有 HTTP harness](../../scripts/test-bff-provider-contract.mjs)遍历 26 个 operation、一次 actor 防伪，没有同键不同导出意图/资源断言；5 项 Rust 审计导出测试覆盖同内容重放及生命周期，没有此类冲突。Rust/reference 测试也不运行 live CORS 的近期认证预检断言。结果是已有契约/Rust/正向 HTTP 全绿，本轮独立探针仍有 3 条明确失败（两条幂等、一条 CORS）。

影响：一次性修复若没有持续断言会再次退化。现有 main CI 第 137 行已有效执行 `make bff-provider-test && pnpm test:bff-provider-contract`，Frontend Baseline 也有 A1 负向门禁；本问题是断言覆盖不足，不是 provider CI 未接线。证据：[Rust 当前日志](./evidence/provider-a1-review-20261004/rust-reference.log)、[正向 HTTP 记录](./evidence/provider-a1-review-20261004/reference-http.json)、上述独立失败记录。

**M-03｜live CORS 遗漏必需近期认证请求头。** [live Router](../../services/bff-gateway/src/live.rs)允许 `x-csrf-token/idempotency-key/if-match/x-request-id` 等，但没有 `x-reauth-token-ref`；[recent()](../../services/bff-gateway/src/live/settings.rs)从该 header 读取 grant；[settings consumer](../../apps/terminal/src/settings/gateway.ts)撤销会话/设备/MFA 因素的请求也携带该 header。允许的 DELETE/POST 方法不能弥补请求头缺失。

将当前源码 CorsLayer 原样装配到空 Router，针对可信 Terminal origin 执行 OPTIONS：常见 header 控制用例通过，携带 `x-reauth-token-ref` 的必需头用例失败；响应 `Access-Control-Allow-Headers` 确实没有它。影响 Terminal/BFF 跨域时安全操作的可用性；不是推断 CSRF 可被绕过。该测试没有连接 Supabase、初始化 live 身份服务或驱动真实浏览器，结论限于已执行的 CORS 配置。probe 的 axum/tokio/tower 0.5/tower-http 版本与仓库 Cargo.lock 对应版本一致。证据：[原样源码片段](./evidence/provider-a1-review-20261004/live-cors-source-fragment.txt)、[Rust probe](./evidence/provider-a1-review-20261004/live-cors-probe.rs)、[1 PASS/1 FAIL 原始日志](./evidence/provider-a1-review-20261004/live-cors-probe.log)。

### 3.5 低危

**L-01｜未执行的数据库用例在 Cargo 摘要显示 ok。** [real_logout_db_write_matches_persistent_trace](../../services/bff-gateway/src/live/f09_live_tests.rs)在 `QUANTOS_RUN_F09_POSTGRES_TESTS != 1` 时直接 return。当前开关关闭、测试耗时 0ms，Cargo 却计为 ok，而非 ignored/NOT RUN。

影响：阅读汇总时可能把未连接数据库当作通过。当前正式 F09/数据库验收有独立入口，本轮不据此宣称可绕过其正式门禁。报告已纠正统计：17 集成＋3 非数据库单测实际执行；该 1 项数据库 case **NOT RUN**。证据：[环境状态](./evidence/provider-a1-review-20261004/environment.json)、[Rust 日志](./evidence/provider-a1-review-20261004/rust-reference.log)。

### 3.6 风险边界

主要风险是：阶段依赖没有闭环、参考命令业务语义与契约不符，以及已实现 live 安全操作无法完成跨域预检。已有 schema 和生成契约一致性较好，不能将这些局部缺陷扩大为全部 62 个 operation 失效，也不能以全绿结构测试冲抵已复现失败。

原 BFF-FE-000 的 13 项历史工程问题关闭结论不在本轮改写。本轮发现按当前检查点范围另行记录。原 B-01 staging 延后政策继续适用；本报告的 PROVIDER:A1/B-01 是**阶段依赖未评估**，并非重新启用旧 staging 阻塞。

## 四、整改建议

### 4.1 执行顺序与关闭标准

| 顺序 | 问题 | 整改建议 | 可检验的关闭条件 |
|---|---|---|---|
| 1 | B-01（先整理） | 盘点依赖闭包的已有代码与有效证据，区分功能输入变更和无关文档变更；建立每节点评估清单，列出需补的聚焦测试。历史 formal 字段保持原事实。 | 所有前置都具备当前适用的功能输入/结果回执；在其他缺陷修完前，不提前将本检查点标 READY。 |
| 2 | H-01 | 将 create/cancel 纳入统一幂等命令机制；键按受信主体/session、operation、key 隔离，intent 包含资源标识及规范化业务内容；比较冲突必须早于副作用/审计写入。 | 同意图重试返回同结果且只执行/审计一次；改 reason/scope/format/watermark/retention 或 exportId 返回 409 IDEMPOTENCY_CONFLICT；原任务状态不受错误取消影响。 |
| 3 | M-03 | CORS 精确允许当前契约需要的 X-Reauth-Token-Ref；核对全部已实现 Web operation 的方法、请求头及响应可读头。 | 可信 origin 的近期认证 POST/DELETE 预检通过；不可信 origin 被拒绝；不要以任意 origin/header 通配替代精确策略。 |
| 4 | M-02 | 将本轮两种幂等冲突和 CORS 预检加入受维护的 Rust/HTTP/consumer 回归，接入既有 CI；加入可令实际业务断言失败的 mutation。 | 禁用 intent 比较、遗漏 reauth 允许头时相应测试失败；正常修复后所有回归通过；只修改 schema 或输出标记不能使其通过。 |
| 5 | M-01 | 新增明确的 PROVIDER:A1 DEVELOPMENT 聚合入口和 manifest schema：列代码/契约/配置/测试/依赖结果路径、内容摘要、环境、命令、退出码、范围及遗留项；验实际文件内容和清单 digest；复核所有依赖 READY。保留 static 和 legacy formal 命令的原范围。 | 代码/配置/测试/依赖证据被篡改、摘要错、依赖未 READY 或必要测试未跑都失败；无关文档变化按计划做受影响范围评估；开发 PASS 不需要 staging/发布签署。 |
| 6 | L-01 | 将数据库用例分为显式忽略的 target suite 或由独立强制环境 runner 执行；输出 enabled/executed/NOT RUN 及独立目标回执。 | 默认 Cargo 输出不会把未执行 case 当成 DB PASS；目标执行使用现有配置的 Supabase，并有真实执行证据；本机不得创建数据库。 |
| 7 | B-01（最后收口） | 自底向上完成阶段回执校验和 READY 登记，最后评估 PROVIDER:A1；同步后续准入结论。 | 全部矩阵必要项完整通过，所有依赖 READY，本节点有内容可验证的 input_digest/evidence，才可用于下游准入。 |

### 4.2 复验与交付约束

先运行当前已存在的 OpenAPI/生成/兼容、A1 positive/negative、PRE 相关静态与 negative、api-client/contract、Rust provider、真实回环 HTTP harness，再运行本轮独立失败场景及新阶段内容绑定/依赖负向测试。必要的数据库功能复验仅在受影响时连接已配置 Supabase，并独立记录目标执行；不把模拟或无连接测试记为数据库验收。

本轮独立 JS 探针可在仓库根目录按以下顺序复跑（Node/pnpm/Rust 使用工程版本）：

```sh
cargo build -p bff-gateway --bin bff-gateway --locked --offline
node docs/audit/evidence/provider-a1-review-20261004/independent-probes.mjs
```

第二条在当前基线应退出 1 并记录两条业务失败；不能将这个预期审计失败改成成功状态。CORS probe 的源码片段、临时 Cargo manifest 和测试源码已保存；修复后须**重新提取当前配置**复验，不能继续运行本轮冻结片段证明新代码正确。

第 2.1 节允许以输入清单评估功能 READY；不因本轮文档新增就重跑未受影响的真实环境/长稳，更不能伪造当前 SHA 的旧 formal notes。正式 staging、安全七类目标证据、七角色签署及发布同 SHA CI 按 RELEASE 规程收口，继续 fail-closed。

本次交付为审计报告、机器可读矩阵/问题清单、源输入清单、运行日志及独立探针；**未执行修复、Git 提交或推送，也未自动变更计划的 READY/ACCEPTED 状态**。
