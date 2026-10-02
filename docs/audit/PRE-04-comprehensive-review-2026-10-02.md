# P0 / PRE-04「接口盘点」全面复审报告

> 检查日期：2026-10-02（Asia/Shanghai）
> 依据：前端开发执行计划 v3.6，PRE-04、§1.1–1.3、§5、§6.4、§7、§9；当前 PRE-01 页面基线；核心开发计划相关领域任务。
> 源码基线：`2b6c2cec6b0167d4552a560e4e5ccf27a0eadbe1`；检查开始时工作区干净。
> 范围：一期官网与 Web Terminal 的接口依赖、契约/Gap 台账、字段来源、owner、mock 状态及盘点门禁。
> 证据：[manifest.json](./evidence/pre04-review-20261002/manifest.json)。本轮只新增报告与证据，没有修改实现、任务状态或创建 Git 提交。

## 当前整改状态

2026-10-02 完成原9项问题的仓库整改，当前16/16控制点通过、4/4必需产出验收通过、各等级活动问题均为0。32项PRE-04回归及相关BFF/计划/fixture检查通过。详见[整改记录](./PRE-04-remediation-2026-10-02.md)及[本轮证据清单](./evidence/pre04-remediation-20261002/manifest.json)。远端CI、正式G0、指定模型及目标环境仍未运行。

**下文保留修复前基线的50%完成率和9项发现，不是当前未解决问题；完整原文另存[初审历史](./PRE-04-comprehensive-review-history-2026-10-02.md)。**

## 一、初审任务完成概况

**结论：PARTIAL，建议完成整改后复审；不能仅凭现有 PRE-04 Gate 的 PASS 整体放行。** 四项要求产出均已登记，BFF 生成物与当前 OpenAPI 一致，Terminal P0 依赖矩阵也有可执行检查。但字段字典与已发布契约存在实质差异，官网 P0 页面未进入依赖矩阵，Gap 状态及若干门禁不能准确反映盘点完成程度。

以本报告 16 个等权控制点计数：**PASS 8、PARTIAL 8、FAIL 0，严格完成率 8/16 = 50.00%**。辅助进度率按 PASS=1、PARTIAL=0.5、FAIL=0 为 **75.00%**，仅用于区分已存在产物与验收缺口，不能作为通过率。`development_status: COMPLETED` 是已有开发状态，本轮不以它推算完成率。

发现 **9 项活动问题：阻塞级 0、高危 2、中危 6、低危 1**。没有当前命令无法继续的阻塞项；高危来自字段权威映射错误和盘点门禁对关键错误输入的误放行，未发现或声称生产环境已经发生相应故障。

### 1.1 已完成产物及真实边界

| 要求产出 | 实际交付 | 完成判断 |
|---|---|---|
| OpenAPI gap list | GAP-01–17 全部存在，有能力、页面、任务、优先级、阶段和状态 | PARTIAL：部分 Closed 与未发布能力矛盾，二期范围混入一期 |
| 字段字典 | C01–C17、144 个四列表格行，类型/required/来源均非空 | PARTIAL：字段存在不等于来源可解析或 wire 语义准确 |
| 接口责任人 | 17/17 契约含 BFF TL 与领域角色；另有责任表 | PASS（角色级登记）：不是实际签署；ID/角色有效性门禁见 M-04 |
| mock 状态 | 区分 Inventory Fixture、生成式 Contract Mocked 和本地 Implemented | PARTIAL：未冻结契约的虚假升级能通过 Gate，参见 M-05 |

产物存在率为 4/4；按独立产出严格判断为 1/4。此口径与 16 控制点完成率分别列示，不能混用。144 指表格行，不是 144 个展开后的独立字段。

本轮在当前仓库、Node 24.12.0/pnpm 10.20.0、现有安装依赖下重放 9 条相关命令，全部退出 0；没有重新 frozen 安装、构建或联网下载。执行均为仓库/生成物/fixture 检查，无真实 BFF、数据库、IdP、Supabase、对象存储或 staging 连接。未运行远端 CI、正式 G0、指定模型、全浏览器矩阵和完整 F03/F06 目标环境验收。

## 二、完成情况明细统计

### 2.1 逐项控制点

| ID | 核对项及依据 | 实际完成情况 | 结果 | 问题 |
|---|---|---|---|---|
| C01 | 当前一期范围（§1.1–1.3） | 核心产物存在，但 C17/P16/cache/update/diagnostic 仍混入一期台账 | PARTIAL | M-06 |
| C02 | 对照 F03、F05–F09、R02–R04、S01–S04、X01–X06、L01–L03 | 领域来源、后端任务组与责任角色均可定位；F03 为共享资产来源，不要求每行重复 | PASS | — |
| C03 | 现有 Proto/API client 盘点 | 6 Proto、38 messages、15 enums、2 services、7 RPC、50 JSON Schemas；区分服务级与页面级 API、fixture adapter 与生成层 | PASS | — |
| C04 | C01–C17 Query/Command/Realtime 决策 | 17/17 行都有三类能力或理由明确的“无”，无未决占位符 | PASS | — |
| C05 | OpenAPI Gap 精确反映缺口 | 17 行齐备，但 GAP-04/05 Closed 与 catalog planned operation 不一致 | PARTIAL | M-02 |
| C06 | 字段均已决策、无“待开发时再定” | 17 组、144 行均四列非空；没有未决占位符 | PASS | — |
| C07 | 字段名、类型、required、枚举与已冻结 HTTP 契约一致（§5.3） | C03/C04/C05/C08/C10/C17 存在未说明映射或实际冲突 | PARTIAL | H-01 |
| C08 | 字段权威来源可解析（§5.7） | C10 引用不存在的 AuditEventRow 和 EventEnvelope.hash；C17 多个旧模型名无现行锚 | PARTIAL | H-01、H-02 |
| C09 | 接口责任人登记 | 17/17 为 BFF TL + 领域 owner；责任总表覆盖 Auth/Runtime/Data/Strategy/Risk/Execution/Audit 等角色 | PASS | — |
| C10 | mock 状态真实且可失败关闭（§6.4） | 当前登记有边界说明，但 C02 无发布契约仍可在 Gate 中冒充 Implemented | PARTIAL | M-05 |
| C11 | 每个 P0 页面有 Q/C/R 依赖（完成标准） | Terminal 17 页 + GS 已登记；官网 5 个 P0 页未登记；部分辅助契约也未进入矩阵 | PARTIAL | M-01 |
| C12 | 序列化、安全与领域权威原则（§5.3–5.6） | Decimal/Money、UTC、命令元数据、幂等、版本、敏感字段与服务权威原则明确；具体映射差异由 C07/C08 计入 | PASS | — |
| C13 | OpenAPI/client/schema/MSW 生成一致 | 1.3.0、62 operations、51 schemas；生成漂移检查及页面覆盖检查通过 | PASS | — |
| C14 | 台账/Gap 集合完整且唯一 | 当前数据没有重复；新增同 ID 行被 Map 覆盖，Gate 仍称 exactly once | PARTIAL | M-03 |
| C15 | 正负 Gate 足以支持盘点结论 | 现有 7/7 通过；独立 14 类负向输入中 12 类漏检，含字段删除/假来源/假 owner/错误状态 | PARTIAL | H-02、M-03–05 |
| C16 | CI 接线、计划结构与历史身份 | Frontend Baseline 调用 PRE-04 正负 Gate，计划校验通过；旧 SHA 证据独立保留 | PASS | — |

| 状态 | 项数 | 占比 |
|---|---:|---:|
| PASS | 8 | 50.00% |
| PARTIAL | 8 | 50.00% |
| FAIL | 0 | 0.00% |
| 合计 | 16 | 100.00% |

### 2.2 数量和语义交叉核对

- PRE-01 当前 P0：17 个 Terminal 页面、5 个官网页面，加 GS 共 **23 单元**。PRE-04 只登记 18，结构覆盖率 **18/23 = 78.26%**；不计 GS 时为 **17/22 = 77.27%**。已有官网访问申请 coverage 行不替代每个官网页的 Q/C/R 决策。
- 当前 catalog 为 **62 published + 46 planned operations**；10 个逻辑契约包有 published 面，但 C04/C05 仍有 planned 能力。未发布能力按后续 BFF-FE 任务承接，本身不是 PRE-04 必须提前实现的缺陷；误标 Closed 才是本轮问题。
- 当前 Gap 文档为 **9 Closed、7 Open、1 Partial**，这是文档标签统计，不是本报告确认的关闭数。
- 当前有 5 个独立业务场景文件（session 1、command-center 3、proposal 1），另有错误和 sabotage fixture。生成的 62 MSW handler 不等于 62 个成功业务 mock：未配置 operation 返回 501，此行为已由本轮 contract 测试确认。

### 2.3 命令与负向结果

| 检查 | 结果 | 本轮证据 |
|---|---|---|
| PRE-04 正向 | PASS：17 契约、17 Gap、18 P0、144 行、62/51 BFF、38/15 Proto | [pre04.log](./evidence/pre04-review-20261002/pre04.log) |
| PRE-04 原套件 | 7/7：1 正向 + 6 负向测试项 | [pre04-negative.log](./evidence/pre04-review-20261002/pre04-negative.log) |
| PRE-01、计划结构 | PASS | [命令清单](./evidence/pre04-review-20261002/commands.json) |
| BFF OpenAPI/生成物/页面覆盖 | 全部 PASS；生成物精确比对当前源 | [generated.log](./evidence/pre04-review-20261002/generated.log)、[coverage.log](./evidence/pre04-review-20261002/coverage.log) |
| PRE-06 结构、contract fixtures | PASS；13/13 contract 测试 | [pre06.log](./evidence/pre04-review-20261002/pre06.log)、[contract.log](./evidence/pre04-review-20261002/contract.log) |
| 独立破坏检查 | 15 探针：1 正向控制；14 负向中仅 2 正确拒绝、12 误 PASS | [probes.json](./evidence/pre04-review-20261002/probes.json) |

全部负向漏检已归并至下文 9 项发现，不按每个探针重复计问题。变更仅发生在内存副本。错误 manifest path/method、同数量 schema/Proto 更名只证明 PRE-04 自身漏检；其他 OpenAPI/生成 Gate 可能补防，未据此声称整个 CI 会放过这些源变更。

## 三、问题清单及风险分析

### 3.1 优先级与完整清单

阻塞级：当前必经流程不能继续；高危：权威契约/关键错误输入被误认作合格；中危：覆盖、状态、映射或约束缺口；低危：总结及追溯口径不清、当前基础检查仍可运行。

| ID / 优先级 | 所属模块 | 具体表现与证据 | 影响范围 |
|---|---|---|---|
| **H-01 / 高危** | 字段字典、已冻结领域→HTTP 映射 | C08 originator 写 ActorRef，但 Approval 为 string actorId；C10 AuditEventRow 不存在，EventEnvelope 无 hash 字段，实际 AuditEvent 为 payloadHash/retentionUntil；ExportJob 缺 cancel_requested/failed 状态，signedUrl 应在独立 ExportDownloadMetadata.downloadUrl；C17 引用不存在的 Profile/Session/Device/BrowserCapability/PlatformCapabilities，theme 缺 system，DownloadRecord 字段也不同。另有 C03 costUnits 标必填但 OpenAPI 可选、artifactRefs wire 为 UUID[]，C04 maxAge→maxAgeSeconds/sources、C05 draftVersion→objectVersion 未说明映射。证据：[字段字典](../PRE-04-field-dictionary.md)、[逐项源摘录](./evidence/pre04-review-20261002/inspection.json) | 审批主体、审计完整性、导出终态、设置和数据读模型的消费方会按错误类型/字段/状态接线；领域与 HTTP 不同可以存在，但必须记录 transport 映射，不能两套口径都声称已冻结 |
| **H-02 / 高危** | PRE-04 字段与源一致性 Gate | `pre04-inventory.mjs:120–123` 只检查非空及 `proto:`/`bff:` 字符串；删 C01 必填 actorId、改为 boolean/非必填、来源改 bff:DoesNotExist 都 PASS。第133–149行只比 operationId 集合及 schema/Proto 数量，错误 manifest path/method、schema/Proto 同数量更名也 PASS | standalone 盘点回执无法证明字段来源、关键字段完整性或源身份一致；字段错误没有被其他本轮已绿检查抵消。不得将补防 Gate 的能力归给 PRE-04 |
| **M-01 / 中危** | P0 页面依赖矩阵 | `pre04-inventory.mjs:92` 排除 WEB-*；台账 §3 漏 WEB-01/02/03/06/07。对比 PRE-01 与 operation catalog，GS 的 C02/C17、P10 的 C07、P22 的 C09/C10 等也没有在矩阵显式登记或给出不适用理由 | “每个 P0 页面”的标准只覆盖 Terminal 子集；官网静态页也需有理由的无依赖决策，登录/申请需明确操作与本地跳转；辅助风险/审计/订单依赖容易漏排 |
| **M-02 / 中危** | OpenAPI Gap 清单与 published/planned 状态 | GAP-04 将 getArtifactAttachment 纳入必须能力却标 Closed，catalog 仍 planned；GAP-05 的 backtest stream 同样 planned。C17 当前 Web 已 published，却以 P16/二期任务保持整体 Partial，状态粒度混乱 | 页面 Sprint 的 Reviewed/Mocked 准入可能提前通过，或者被二期缺口错误阻挡；本轮不要求提前实现全部 46 planned 能力 |
| **M-03 / 中危** | 契约/Gap 唯一性 Gate | 第57/76行先建 Map 再比 keys；重复 C01 或 GAP-01 行均 PASS，仍输出17/17并声称 exactly once | 同 ID 多个互相冲突的 owner/能力/状态会被后行覆盖，审计数量与维护者看到的行不一致 |
| **M-04 / 中危** | 页面、后端任务及 owner 引用校验 | 页面/后端只查非空，BFF task 只查格式，owner 只查 BFF TL/owner 文本。改为 P99/Z99、BFF-FE-999、Nonexistent owner 都 PASS | 拼错或失效的任务与责任链不会阻断盘点；现有角色级登记不等于门禁能保证其持续有效 |
| **M-05 / 中危** | mock/实现状态门禁 | frozenContracts/implementedContracts 硬编码，只约束选定 Cxx；C02 的 Inventory Fixture 可直接改成“Implemented；生产已验收”而 PASS，未验证对应 published/schema/fixture/provider 依据 | 未冻结或无证据契约可在台账中虚假升级；生成 handler 不应被解释成已配置成功场景或目标环境 Integrated |
| **M-06 / 中危** | 一期/二期与后端任务语义 | C17 台账、GAP-17、字段字典和 owner 表仍将 P16、cache clear/update check/diagnostic、Desktop/Web 一致性当作当前一期盘点项；把 Platform owner 绑定 L02，而现行核心 L02 是 Supabase Vault/mTLS/受限执行区，不能据此充当 Desktop 更新/缓存能力责任任务 | 与执行计划 v3.6 一期 Web 和独立 Desktop 计划不一致；职责、阶段及 Gap 关闭范围容易误判。Desktop 本身未实施不列为一期缺陷 |
| **L-01 / 低危** | 总结、版本与证据说明 | summary §4 仍把 GAP-10 列入 Open，与当前 Gap-10 Closed 冲突；§3 将原6测试项描述成6个负向（含正向控制），当前实际为7测试项；四份当前产物仍标1.1/2026-09-16，却已含后续1.3.0基线和provider信息 | 当前总结与历史证据容易被混读；需更新当前日期、版本和测试口径，保留旧 SHA 原始回执，不能改写为本轮结果 |

### 3.2 风险与验收边界

1. **仓库源和生成物当前一致，盘点文档却不完全准确。** BFF OpenAPI/生成检查通过证明生成代码忠于源；不能证明人工字段字典、Gap 状态或所有页面依赖也忠于源。
2. **没有发现必须停止所有开发的基础设施阻塞。** 本轮 9 条命令全绿，当前计划结构有效；建议阻止 PRE-04 整体验收升级，优先修正依赖和字段事实。
3. **开放业务接口不是盘点未完成的充分条件。** 62 published/46 planned 可作为合格盘点输入；PRE-04 的责任是准确记录缺口与 owner，而不是提前完成 BFF-FE-002–011 的 provider/staging 工作。
4. **数据库、远端和模型验收独立。** 本轮无数据库连接、生产副作用或发布动作；历史 F03/F06/BFF-FE 的成功记录只能按原 SHA/环境解释。当前目标环境与实际 CI 均 NOT RUN / NO RECEIPT。

## 四、整改建议

按 H → M → L 顺序处理；下列为建议责任角色，不表示签署已经发生。

| 问题 | 建议责任角色 | 整改动作 | 可验证关闭标准 |
|---|---|---|---|
| H-01 | BFF TL + 领域 owner + FE TL | 将 domain 字段和 wire 字段分列，按已发布 schema 映射名称/类型/required/枚举；request/response/stream 分组，C10/C17 优先修订；未发布模型明确标 planned | 每个字段有可解析源锚和明确映射；上述 Approval/Audit/Export/settings 差异全部对齐，危险字段/终态没有错误默认 |
| H-02 | FE TL + QA | 以结构化契约映射或共享源解析驱动 Gate；核对关键字段集合、属性与源身份；复用 OpenAPI/生成校验并准确描述各门禁职责 | 必填字段删除、假来源、类型/required 漂移、错误 path/method、同数量源替换均拒绝；合法映射和当前真实数据通过 |
| M-01 | FE TL + 产品/BFF | 从 PRE-01 全一期 P0 集合动态推导矩阵；给5个官网页逐格记录Q/C/R或带理由的无；补辅助契约和operation反查 | 23/23单元齐备、引用有据；删除任一官网页、辅助风险/审计依赖或改为未决值都拒绝 |
| M-02 | BFF TL | 按 catalog 的published/planned逐operation记录Gap；部分发布用Partial，剩余能力有明确owner/阶段；二期独立承接 | GAP-04/05保留真实未发布能力；无planned残项或经批准移交后才Closed；不得用本地provider替代staging签署 |
| M-03 | FE TL + QA | 在构造Map前验证原始ID序列、行数及重复；重复行明确报错 | 重复C01/GAP-01等全部FAIL，正常17行仍PASS |
| M-04 | 计划维护者 + BFF TL | 从PRE-01、前端BFF任务、核心任务及责任登记解析允许ID和角色，支持范围表达但拒绝假引用 | P99/Z99/BFF-FE-999/假owner都FAIL，真实跨域角色与全部合法任务通过 |
| M-05 | BFF TL + QA | 按published/fixture/provider/目标回执区分状态；避免仅对少量硬编码Cxx作字符串断言 | C02虚假升级拒绝；未配置MSW仍501；本地Implemented与目标Integrated/Verified依据严格分开 |
| M-06 | FE TL + 平台/安全owner | 一期C17只覆盖P15/P17 Web能力；P16/cache/update/diagnostic迁到二期承接；按真实任务语义重建owner映射 | 一期文档和默认Gate不以Desktop缺口为前置，二期有可追溯承接；L02安全职责不冒充Desktop任务 |
| L-01 | 文档维护者 | 更新当前产物版本/日期、Gap状态和测试数；链接本轮审计，保留旧验收原文及其SHA | 当前summary/台账/Gap/字典互相一致，历史证据清楚标注历史身份 |

复审退出条件：9项逐一取得关闭证据；在修复提交上重放PRE-04正负、PRE-01、计划结构、OpenAPI、生成一致性、页面覆盖及contract fixture检查，重新统计16项控制点。不得仅把测试预期改成PASS或扩大字符串允许值来关闭问题。

### 4.1 证据与重放

- [输入/日志摘要与完整清单](./evidence/pre04-review-20261002/manifest.json)、[命令参数/退出码/耗时](./evidence/pre04-review-20261002/commands.json)。
- [范围与字段源核对](./evidence/pre04-review-20261002/inspection.json)，由[inspect.mjs](./evidence/pre04-review-20261002/inspect.mjs)读取当前实际源生成。
- [独立破坏探针](./evidence/pre04-review-20261002/probes.mjs)及[结果](./evidence/pre04-review-20261002/probes.json)，只改内存输入。
- [重放脚本](./evidence/pre04-review-20261002/replay.py)在仓库根执行，使用现有Node/pnpm及依赖；本轮不安装数据库或部署。脚本检查运行时HEAD，重放前复制证据目录，避免覆盖原始结果；后来SHA的输出必须另建证据身份。
