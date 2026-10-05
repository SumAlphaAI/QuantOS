# A1 / FRONTEND-GATE:G0 验收检查点全面复审报告

> 日期：2026-10-05（Asia/Shanghai）
> 源码基线：`ca00fe80b1bbc772287193bc6b7973eaeda224b0`；开始复审时工作区干净。
> 结论：**CHANGES_REQUESTED；G0 DEVELOPMENT 尚不能 READY。**
> 完成率：**18/24 = 75.00%**；18 PASS、1 PARTIAL、2 FAIL、3 MISSING。
> 问题：**1 阻塞级、0 高危、4 中危、0 低危**。缺 staging、正式发布签署和远端同 SHA CI 不计作本阶段缺陷。

## 一、任务完成概况

### 1.1 依据、范围与方法

依据[前端执行计划 v3.20 第 2.1 节、G0 冻结要求及检查点、第 5.4–5.7/6/7.1 节](../SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md#acceptance-frontend-gate-g0)，逐项核对契约最低冻结面、同源生成/mock、页面追踪、Web/OIDC/SSE PoC、开发规范、当前功能范围确认、遗留项与阶段回执。补充对照[页面接口登记表](../PRE-01-page-api-coverage-register.md)、[验收场景](../PRE-01-acceptance-scenarios.md)、[BFF 基线说明](../BFF-FE-000-openapi-proposal.md)、[G0 历史联合记录](../gate-records/G0-PRE-01-review-record.md)、[当前治理记录](../gate-records/G0-current-governance.json)及 [AGENTS.md](../../AGENTS.md)。

本轮直接读取当前源码与 CI，实际执行 22 个检查命令、三个 PoC 及独立输入/导入反证；重新校验上游 manifest 的文件内容、命令/结果、日志/产物摘要和递归依赖。未把历史报告的 PASS 直接算作本轮新执行。

G0 的三个直接依赖为 `PREPARATION:P0`、`PROVIDER:A1`、`FE:BFF-FE-000`，当前均 DEVELOPMENT READY；递归上游共 **14/14 READY**。G0 自身仍为 `NOT_ASSESSED`、`input_digest=null`、`evidence=[]`，正式字段为 `NOT_STARTED/null/[]`。含本节点的闭包共 15 节点，只有 G0 尚无功能准入回执，见[阶段快照](./evidence/frontend-g0-review-20261005/dependency-stage-snapshot.json)。

A2–A6 未交付的 provider、`PROVIDER:ALL`、后续页面、P16/native、真实 staging/部署、发布性能/长稳及正式签署不进入本轮 G0 DEVELOPMENT 完成率分母。六方对**当前契约/功能范围的确认**属于 G0 开发要求；RELEASE 的正式签署另行完成。

### 1.2 当前交付事实与准入判断

- 最低冻结面已经发布：API **1.5.0 /62 published operations /52 schemas**，覆盖 Session/Context、Research、DataSnapshot、Strategy、Portfolio/Risk、Proposal/Approval/Order 与统一错误。17 个契约、一期 22 个 Terminal 页面、46 planned operation 的命名和后续 owner 明确。
- 六类生成资产与 OpenAPI 逐字节一致，生成、Proto 与页面覆盖检查已接入 CI。四类旧 InMemory backend 已明确 deprecated、仅作 fixture、待迁移/删除；当前 Next 页面未直接引用它们。
- Web 页面、OIDC callback、SSE 三项开发 PoC 均通过；当前未复现 PoC 功能失败。OIDC 使用 mock IdP，SSE 使用真实 loopback HTTP，二者范围写入证据。
- 页面链路有 **30/30** 追踪行、132 Story、210 条逐页七态及 10 条流程**定义**；这不是 220 条页面业务 E2E 已执行。登记表有 24 行，其中 18 行 API/mock 仍标 1.4.0，与当前契约不符。
- 当前范围确认、遗留项阶段处置及 G0 自身内容绑定回执未闭环，生产导入边界还缺持续拒绝。**可以继续整改及不依赖 G0 的功能开发，不能把本轮工程绿灯作为 G0 READY，或据此放行新页面。** 新页面还独立依赖 `PROVIDER:ALL`。

## 二、完成情况明细统计

### 2.1 统计口径与逐项矩阵

将 G0 五项冻结要求及其适用开发规范/验收条件拆为 24 个等权控制点，仅完整 PASS 计完成；PARTIAL 不给半分，缺必要产物记 MISSING。多个控制点可对应同一根因，问题清单按独立整改事项去重。因此 **18/24 = 75.00%** 表示审计控制点满足率，不表示工时、全部 API 或页面完成率。阶段准入单独统计为 **0/1 G0 READY**，不代表已交付代码完成率为零。

| 编号 | 控制点 | 结果 | 核对事实及边界 | 问题 |
|---|---|---|---|---|
| G01 | DEVELOPMENT/RELEASE、Web/未来 provider 范围 | PASS | 计划第 2.1 节及 G0 范围一致；P16、正式签署/staging 不计开发分母 | — |
| G02 | 直接与递归依赖准入 | PASS | 直接 3/3 READY；上游递归 14/14 READY，当前内容验证通过 | — |
| G03 | G0 输入清单、摘要与阶段回执 | MISSING | 自身 NOT_ASSESSED/null/[]，没有可验证的 G0 manifest | B-01 |
| G04 | 最低冻结领域与版本化 OpenAPI | PASS | API 1.5.0，Session/Research/Data/Strategy/Risk/Proposal/Approval/Execution 已发布 | — |
| G05 | 统一错误、状态、correlation 与缓存头 | PASS | OpenAPI、25 项 contract 回归及既有内容绑定基线通过 | — |
| G06 | 会话、幂等、版本与高风险输入契约 | PASS | A1 基线/负向与客户端受信字段、SSE 安全回归通过 | — |
| G07 | mock 与正式 schema 同源 | PASS | 生成 MSW + request/response validators，无额外 transition schema | — |
| G08 | 六类生成资产与漂移检查 | PASS | 重新生成临时副本逐字节一致；未覆盖原生成文件 | — |
| G09 | Proto/JSON Schema/domain 一致性及 CI | PASS | PRE-04 + client/domain 回归；既有 proto 日志内容有效、主 CI 接线 | — |
| G10 | InMemory 迁移或显式待删除 | PASS | 四类均 deprecated/fixture-only；当前 Next 页面未直接引用 | — |
| G11 | 生产导入边界的强制门禁 | FAIL | 页面路径下构造 InMemory backend 的 ESLint stdin 探针退出 0 | M-04 |
| G12 | 页面→任务→契约→后端→用例→Gate | PASS | 30/30 追踪行、132 Story、210 七态+10流程定义通过结构/归属校验 | — |
| G13 | 页面登记表的 API/mock 版本绑定 | FAIL | 24 行中 18 行 API 与 mock 仍为 1.4.0；虚构版本 99.99.0 被接受 | M-03 |
| G14 | operationId 反查影响页面/owner | PASS | 62 published/46 planned 明确归属，32 项 PRE-01 回归与 A1 缺失映射拒绝 | — |
| G15 | Web 页面与当前输入构建 PoC | PASS | 29 锁依赖/2349 运行时检查/2 路由，既有同输入构建 smoke 通过 | — |
| G16 | OIDC callback 正向 PoC | PASS | Chromium PKCE authorize→callback→安全 return path；mock IdP 范围 | — |
| G17 | OIDC state、URL、错误与 session bridge | PASS | 浏览器 4 项与 auth 单元回归；本轮未执行真实 IdP | — |
| G18 | SSE 去重、断流、gap 与撤权 PoC | PASS | 7 项 SSE PoC 及安全回归包含在本轮 100 项测试；真实 loopback HTTP | — |
| G19 | 基本浏览器、a11y、布局与视觉 | PASS | Chromium 共 11/11；/command axe serious/critical 0、390只读、1440视觉 | — |
| G20 | 前端 lint/typecheck 与锁/ADR 规范 | PASS | 七个一期 workspace lint/typecheck 通过；29 项固定选型核验 | — |
| G21 | 领域覆盖率与关键风险分支 | PASS | 内容绑定的既有 Web 92.85% 与关键129行/111分支100%仍有效；本轮未重跑 coverage | — |
| G22 | 六方当前契约/功能范围确认 | MISSING | 仅有2026-08-14历史签署，未见当前1.5.0/Web/阶段范围的确认记录 | M-01 |
| G23 | 未冻结项当前 owner、期限、阶段与兼容策略 | PARTIAL | 历史10项有owner/期限/策略，但9项逾期；未拆分开发/发布/二期、未重排 | M-02 |
| G24 | G0 功能验收入口、持续拒绝与 CI | MISSING | CI只有历史记录校验，缺当前G0范围/manifest/PoC/确认的聚合入口 | B-01 |

| 结果 | 数量 | 占比 |
|---|---:|---:|
| PASS | 18 | 75.00% |
| PARTIAL | 1 | 4.17% |
| FAIL | 2 | 8.33% |
| MISSING | 3 | 12.50% |
| 合计 | 24 | 100% |

G10 的 PASS 按原要求“迁移或明确标记待删除”判定，不等于旧 adapter 已全部删除；G11 独立核对生产使用边界。G12 的 PASS 表示追踪链完整，G13 独立核对其版本可信度。G21 使用当前输入内容一致的既有覆盖率证据，不记为本轮重新测得。

### 2.2 实际检查与证据

| 检查 | 本轮实际结果 | 范围 |
|---|---|---|
| 计划结构 / 负向 | PASS；35/35 | 159 节点/1462 边、阶段与依赖形状；不核验 G0 功能证据内容 |
| PROVIDER:A1 回执 / 负向 | READY；41/41 | 14 上游节点当前输入与既有执行内容有效；65 项有效结果未全部重跑 |
| G0 历史治理记录 | PASS；10 遗留项、9 逾期 | 明确输出 `current_formal_g0=NOT_STARTED / NO CURRENT RECEIPT`，不是 G0 功能准入 |
| PRE-01 / 负向 | PASS；32/32 | 30 页、124 页面 Story+8流程 Story、210七态+10流程、30追踪行 |
| OpenAPI / 生成漂移 / 页面覆盖 | 全部 PASS | API1.5.0、62 operations、52 schemas；六类生成物无漂移 |
| A1 基线 / 负向 / 兼容 | PASS；8/8；69项安全修正登记 | 最低冻结契约及已有兼容决策；不代表未实现 provider 通过 |
| PRE-02 / PRE-04 / PRE-06 | PASS；PRE-04负向38/38 | 252对比度配对、413字段、17契约、24视觉基线完整性；非全平台新执行 |
| Auth/API client/contract | **100/100，9个文件** | 包含 OIDC 单元、7项SSE PoC、SSE安全、Proto/domain、schema回归 |
| Web runtime smoke | PASS | 29锁依赖、2349运行时检查、2构建路由；实际Chromium验证 |
| Chromium基本页面/OIDC | **11/11，无重试** | OIDC4、Command7；含axe、390只读、1440视觉 |
| 一期 workspace lint/typecheck | PASS | 七个子 workspace；未运行 Rust/Python 全仓规范检查 |
| 独立范围与约束反证 | 5项被现有入口接受 | 2项确认历史/静态入口范围；3项证明兼容策略、版本和生产导入约束未被强制检查 |

所有命令、时间、退出码及日志摘要见[执行记录](./evidence/frontend-g0-review-20261005/executions.json)与[运行时记录](./evidence/frontend-g0-review-20261005/runtime-executions.json)，独立反证见[探针源码](./evidence/frontend-g0-review-20261005/independent-probes.mjs)与[结果](./evidence/frontend-g0-review-20261005/independent-probes.json)。测试套件有重叠，不能累加用例数作为独立验收项数。

[输入清单](./evidence/frontend-g0-review-20261005/source-inputs.json)记录 **955 个文件**及 83 个依赖证据文件的 SHA-256。Web smoke 使用已有构建，其 buildId 来源是 `4eee7f7…`，实际 sourceDigest/profile 与当前输入匹配；本轮没有重新 build 或伪造新 SHA 的构建回执。[环境记录](./evidence/frontend-g0-review-20261005/environment.json)保留工具链与受控公开 local-mock profile。上游 Proto、coverage、Supabase 等日志仅作内容已验证的既有证据，本轮没有重新执行它们。

本轮**未连接数据库、未创建数据库/容器/Supabase本地服务、未执行真实IdP/staging/部署、未取得当前SHA hosted CI或组织签署回执**。这些边界不抵消已执行的开发PoC，也不将模拟验证升级为真实集成或正式发布通过。

## 三、问题清单及风险分析

### 3.1 分级总表

| ID | 优先级 | 所属模块 | 具体表现 | 影响范围 |
|---|---|---|---|---|
| B-01 | 阻塞级 | G0 stage_gate / 功能入口 / CI | 本节点无完整功能回执；历史治理及静态形状不能验 G0 内容 | G0、FEP-0及消费G0的后续功能准入 |
| M-01 | 中危 | 当前契约/功能范围确认 | 仅有历史六方签署，无当前Web/1.5.0/阶段范围确认记录 | 产品、前端、BFF、QA、安全、风控责任边界 |
| M-02 | 中危 | 遗留项阶段处置 / 兼容策略门禁 | 历史十项未按当前开发/发布/二期重新归属；清空策略仍PASS | 未冻结项跟进、期限与范围判断 |
| M-03 | 中危 | 页面API登记 / 版本与阶段文案 | 18行旧版本；虚构版本可PASS；仍要求正式G0/staging后开发或Integrated | 页面消费版本、变更追踪和下游准入 |
| M-04 | 中危 | ESLint生产导入边界 | deprecated InMemory backend在生产页面路径实例化仍lint PASS | 后续页面可能脱离生成接口与服务端权威 |

高危、低危均为 0；没有证据支持扩大为真实数据泄露、越权执行或全部 provider 失效。

### 3.2 阻塞级

**B-01｜G0 自身功能冻结与准入回执缺失。** 上游三个直接依赖及递归闭包已经 READY，缺口在本节点，不应重复将 PROVIDER:A1 旧问题列为 OPEN。[计划G0记录](../SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md#acceptance-frontend-gate-g0)仍是 NOT_ASSESSED/null/[]；仓库未提供按第2.1节绑定代码/契约/配置/测试、PoC结果、当前范围确认、遗留项及依赖的 G0 manifest 与功能校验入口。

现有 [check-g0-records.mjs](../../scripts/check-g0-records.mjs)读取三个历史/治理文档，检查正式字段仍NOT_STARTED、历史勾选与十项台账；它不运行PoC，不验G0 stage_gate/input_digest。独立在内存把G0填为READY、任意`sha256:aaaa…`并指向历史文档，治理校验和计划结构校验都PASS；删掉readiness主体、仅保留历史/NOT_STARTED标签，治理校验也PASS。**这是两类入口的范围反证，不是静态工具违反其声明范围，也不表示真实计划已被放行。** 风险是当前没有承担完整G0功能准入的入口。

关闭要求：有内容可验证的G0功能清单、实际结果与全部前置READY，当前冻结/范围确认完成后再登记READY；缺当前G0内容、日志/摘要被替换、必要PoC未跑或依赖不READY应拒绝。无需提前要求staging或正式发布签署。

### 3.3 中危

**M-01｜当前六方契约/功能范围确认没有可核对记录。** G0开发要求仍明确产品、前端、BFF、QA、安全与风控确认契约/功能范围。现有[联合记录](../gate-records/G0-PRE-01-review-record.md)明确只适用2026-08-14的OpenAPI1.0.0及拆分前范围；[治理JSON](../gate-records/G0-current-governance.json)同样声明“Not a signature of the current artifacts”。当前1.5.0/Web最低冻结面、planned排除项及新阶段边界尚无独立确认记录。

影响：工程资产已存在，当前范围的责任归属与认可仍无法从仓库验明。这里记录的是**可验证记录缺失**，不推断组织成员从未讨论；也不要求开发阶段取得RELEASE正式签署或公开个人身份。应补当前功能范围确认，历史签署保留原身份。

**M-02｜遗留项未按当前阶段重新处置，兼容策略缺强制校验。** 当前治理快照仍为2026-10-02，十项混合了已发布契约、planned扩展、真实staging、桌面回跳、页面设计、Linux视觉、性能和InMemory迁移；九项`OVERDUE_PENDING_REPLAN`，期限为2026-08-21至09-25，均无当前阶段处置证据。C17/C10等部分契约已经发布，不能因此把混合遗留项整体伪记CLOSED；P16/native、staging、性能也不能继续整体当作A1开发阻塞。

现有校验只绑定owner、deadline和状态，并强制所有遗留项无关闭证据；未核验第四列兼容策略。独立清空十行策略仍PASS。风险是当前冻结范围、未冻结功能及后置验收混淆，兼容约束被删也没有持续拒绝。应保留历史十项，另列当前子项/阶段/状态、owner、有效期限、策略与证据；不以未来provider未实现新增G0缺陷。

**M-03｜Page API Coverage 版本过期，阶段文案与当前计划不一致。** [登记表](../PRE-01-page-api-coverage-register.md)的摘要、mock说明及24行中18行API/mock字段仍为1.4.0，当前OpenAPI及生成资产实际为1.5.0。其正文仍写“provider/staging与PROVIDER:ALL、正式G0通过后才允许新页面开发和Integrated晋级”，以及“staging签署后升级Integrated”，与计划的DEVELOPMENT/INTEGRATION/RELEASE分工不符。

独立将所有1.4.0改为不存在的99.99.0，`validatePre01`仍PASS；现有规则只拒绝特定更旧版本，没有绑定真实OpenAPI/生成版本。影响当前冻结版本可信度及后续准入判断，不能由operationId/owner映射正确掩盖。关闭时同步published/planned范围的真实版本，并把版本不一致加入持续负向；按stage_gate消费G0/PROVIDER:ALL，真实功能联调与发布staging分别记账。

**M-04｜“生产页面禁止旧InMemory backend”只剩注释，缺强制导入边界。** 四个旧类的deprecated注释明确“页面组件禁止引用”；计划第6.2节要求ESLint强制页面→api-client/domain-ui边界并拒绝内部数据库/Engine/venue类型。[eslint.config.mjs](../../eslint.config.mjs)未配置相应边界或禁止旧类规则，api-client仍导出四类，场景辅助`src/app.ts`仍默认构造旧backend。

独立通过ESLint stdin，以`apps/terminal/app/g0-import-probe.tsx`为生产组件路径，执行真实`import { InMemoryTerminalBackend }…; new InMemoryTerminalBackend()`，退出0，无拒绝。**没有向生产目录写文件；当前Next页面未直接使用旧类，本报告不声称已经发生生产绕过。** 风险在持续防退化能力：未来页面可把手写状态误作领域事实。应对生产代码强制禁止旧backend/受限内部类型，保留明确测试例外并验证违规引用实际失败。

### 3.4 风险与验收边界

主要风险是功能冻结的内容可信度、当前范围确认及未冻结项管理，而不是三项PoC不可运行。历史治理PASS、上游READY、契约/客户端/浏览器全绿可以证明各自已执行范围，不能替代G0自身完整准入。既有历史签署既不删除，也不自动延伸至当前版本。

本报告不改写P0、BFF-FE-000或PROVIDER:A1关闭结论，不把planned名称当已发布schema/provider。后续全量API、页面业务联调、目标浏览器完整矩阵、安全全范围及RELEASE性能/部署/签署继续独立验收。

## 四、整改建议

| 顺序 | 问题 | 建议 | 可检验关闭条件 |
|---|---|---|---|
| 1 | B-01（先整理） | 建立G0受检输入、冻结项/PoC/范围确认/遗留项的检查清单，复用内容有效的上游结果 | 明确自身与依赖证据，不能以历史文档或任意摘要宣告READY |
| 2 | M-03 | 按当前OpenAPI/生成版本同步页面登记；纠正正式G0/staging提前阻塞开发/Integrated的表述 | 真实版本一致；99.99.0等替换被拒绝；阶段消费与第2.1节一致 |
| 3 | M-04 | 增加生产导入边界，对四类旧backend及受限内部类型强制拒绝；限制fixture例外 | 本轮生产路径探针lint失败，合法生成client与测试fixture仍通过 |
| 4 | M-02 | 将历史遗留拆为当前功能子项，区分开发、集成、发布和二期；由owner补证或重排 | 每项有当前阶段/范围/owner/有效期限/非空策略/证据；清空策略和越界提前关闭均失败 |
| 5 | M-01 | 六方确认当前最低冻结面、版本/输入摘要、planned排除与未冻结项 | 有当期功能范围确认可复核；不复用历史签署，不要求RELEASE回执提前到位 |
| 6 | B-01（最后收口） | 建立G0 DEVELOPMENT聚合校验与负向，接入CI；逐项复评并最后登记READY | 24必要控制点满足、依赖仍READY、当前manifest摘要/日志/PoC/范围证据有效；伪造/少跑/漂移均拒绝 |

整改会改变受检台账、lint配置、测试或治理输入。应按清单选择器重新评估受影响节点及其依赖绑定，不能继续沿用失效摘要；未受影响的数据库/长稳结果依计划做内容有效性评估，无需因普通文档变化重新全量执行。涉及数据库的实际验证只能使用工程既有Supabase配置。

建议复验入口为现有计划/上游回执、OpenAPI/生成/页面追踪、G0新功能入口及负向、生产导入拒绝、auth/API-client/contract、Web/OIDC/SSE与必要浏览器回归。独立反证可以运行：

```sh
node docs/audit/evidence/frontend-g0-review-20261005/independent-probes.mjs
```

该脚本记录现有入口是否接受特定变更，不把脚本退出0当作整改PASS；修复后应核对相应`observed`变为REJECTED，并使用受维护的正式回归断言。正式staging、签署与发布候选同SHA回执按RELEASE执行。

本次仅交付复审报告与证据；**未修复业务代码、修改计划准入、生成Git notes、Git提交或推送**。
