# A1 / FEP-0：准备与契约全面复审报告

> 日期：2026-10-05（Asia/Shanghai）
> 源码基线：`ed2e6038a9d54f05768a29d9c8f0079bd1dacbdc`；开始检查时工作区干净。
> 结论：**CHANGES_REQUESTED；FEP-0 尚不能登记 DEVELOPMENT READY。**
> 必要控制点满足率：**18/20（90.00%）**；前端交付控制点 **18/18（100%）**。
> 发现：**2 阻塞级、0 高危、0 中危、0 低危**。阻塞在当前里程碑准入证明；本轮没有复现新的前端运行故障。

## 一、任务完成概况

### 1.1 检查依据与范围

依据[前端执行计划 v3.25 的 FEP-0 任务卡](../SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md#task-fep-0)、第2/2.1/3/5/6/7节、六个PRE任务完成标准与[G0检查点](../SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md#acceptance-frontend-gate-g0)，对照[核心 F0 当前 DEVELOPMENT 范围](../SumAlpha-QuantOS-Development-Plan.md#acceptance-core-gate-f0)、运行时/设计ADR、需求台账、契约、测试配置、源码与CI逐项检查。遵守[AGENTS.md](../../AGENTS.md)的数据库和单用户验收约定。

FEP-0 为 A1 窗口末尾的里程碑，覆盖工程运行时、设计系统、接口台账、环境和测试底座；交付放行条件包括G0冻结。它有 **8个直接依赖**：CORE-GATE:F0、PRE-01～06、FRONTEND-GATE:G0。G0完成不能自动替代CORE-GATE:F0和FEP-0自身评估。

本轮直接读取实现与配置，执行 **24个有效检查入口**，重新构建两应用并执行Chromium/loopback PoC、回归、覆盖率与破坏自检；核验已有15个READY节点的功能清单、日志/产物摘要与递归依赖，验证118份既有证据文件摘要。另执行3项独立内存反证。所有当前结果与旧结果分别记录，没有将历史报告的PASS直接当作本轮新执行。

### 1.2 当前完成事实与准入判断

- PRE-01～06和G0的功能回执当前有效，**直接依赖7/8 READY（87.50%）**。工程运行时、ADR/锁、需求与设计资产、生成接口、环境和测试底座均已交付；本轮前端静态及运行时检查全部通过。
- **CORE-GATE:F0为NOT_ASSESSED/null/[]**。其11个直接子项中，F01/F03/F04/F05/F06已有当前功能回执，F02/F07/F08/F09/TP01-A/TP01-B尚无当前阶段回执。2026-09-28正式ACCEPTED只证明历史main `91e222f`，计划已明确不能自动转移。
- 含全部F0/G0依赖的递归上游共 **22个节点，15 READY、7 NOT_ASSESSED（68.18% READY）**；再加FEP-0自身共有23节点，8项未评估。完整快照见[依赖记录](./evidence/fep0-review-20261005/dependency-snapshot.json)。未评估项不能推断为未实现功能，其当前准入证明需要补齐。
- **FEP-0自身仍NOT_ASSESSED/null/[]**，没有独立里程碑功能清单/回执及校验入口。`development_status=COMPLETED`描述已有交付进度，符合计划分维度记账方式；不等于阶段READY。本报告不把这项迁移状态单独列为缺陷。

可以继续不依赖这两个缺口的API工程工作；FEP-0的正式完成声明需先关闭B-01/B-02。新页面还须PROVIDER:ALL，发布验收由RELEASE承担。未来provider、完整业务页面、Desktop/native、真实staging/IdP、部署、性能/长稳、远程同SHA CI与发布用户确认不进入本次开发控制点分母。

## 二、完成情况明细统计

### 2.1 统计口径与逐项控制矩阵

从五类交付、G0冻结、开发规范、测试完成标准及阶段消费规则拆为20个等权必要控制点，完整PASS计完成，MISSING不计分。**18/20为审计控制点满足率**，不代表工时、全部核心功能或全量页面完成率；18/18为本里程碑前端交付控制点满足率。阶段准入单独为 **0/1 FEP-0 READY**。六个PRE子任务当前均READY（6/6），G0为READY（1/1）。

| 编号 | 控制点 | 结果 | 核对依据及边界 | 问题 |
|---|---|---|---|---|
| C01 | A1/DEVELOPMENT、一期 Web 与后续阶段边界 | PASS | 第2.1节、FEP-0任务卡和G0范围一致；COMPLETED表示交付进度，阶段记录独立 | — |
| C02 | 全部前置当前阶段准入 | MISSING | 直接依赖7/8 READY；CORE-GATE:F0及其6个未评估子项仍NOT_ASSESSED；递归上游15/22 READY | B-01 |
| C03 | 固定工具链、锁文件及运行时ADR | PASS | Node24.12.0、pnpm10.20.0；29锁依赖、2349运行时约束通过；现行ADR与解析版本相符 | — |
| C04 | 官网与Terminal构建、目标路由PoC | PASS | 两应用本轮重新构建，buildId绑定ed2e603；Web smoke两路由通过 | — |
| C05 | 前端开发规范、lint与typecheck | PASS | 当前生成客户端/应用/共享包lint和types入口全部退出0 | — |
| C06 | 设计token、状态、密度、断点及组件清单 | PASS | PRE-02正向与27负向通过；基准组件及44组件族的规划范围明确 | — |
| C07 | Storybook、WCAG基础与双语安全文案 | PASS | 可执行配置和基准Story核验、组件测试通过；历史同输入Storybook构建日志有效 | — |
| C08 | 页面、Story、权限矩阵及七态场景 | PASS | 30页面、132Story、210七态和10流程定义通过PRE-01；二期P16独立 | — |
| C09 | 页面→任务→契约→后端→测试→Gate追踪 | PASS | 30追踪行、operation归属/owner与负向通过；不是全量业务E2E | — |
| C10 | 字段字典、接口盘点与published/planned缺口 | PASS | PRE-04通过；17契约、413字段、62published/46planned归属准确 | — |
| C11 | OpenAPI最低冻结面与同源client/mock | PASS | API1.5.0/52schemas；BFF基线、生成逐字节漂移和catalog核验通过 | — |
| C12 | 会话、错误、安全输入和实时恢复 | PASS | 当前单元/coverage及OIDC/SSEPoC通过；F06已有内容绑定实际Supabase安全回执有效 | — |
| C13 | 生产前端BFF导入与fixture例外边界 | PASS | ESLint边界正负向通过；不允许生产使用旧InMemory及受限内部模块 | — |
| C14 | 环境矩阵、公开变量、DSN/回跳约束 | PASS | PRE-05正负向与配置包26测试通过，受控公开local-mock profile | — |
| C15 | 客户端产物与秘密检查 | PASS | 新Terminal/官网build实际通过client-secret检查；不暴露DATABASE_URL等凭据 | — |
| C16 | 同schema fixtures、单元、基本浏览器与SSE PoC | PASS | 211单元、238覆盖率测试、11ChromiumOIDC/页面通过；fixtures库存检查通过 | — |
| C17 | schema/权限/敏感字段/视觉破坏持续拒绝 | PASS | PRE-06破坏自检四类检出，264综合回归含跳过/未执行断言/first-fail策略；CI接线受检 | — |
| C18 | 领域覆盖率与关键风险分支 | PASS | 本轮Web行92.85%、分支79.90%；关键129行/111分支100% | — |
| C19 | 当前G0确认、冻结回执和遗留治理 | PASS | G0严格READY；项目用户确认与577输入范围一致，19子项阶段/期限/策略约束有效 | — |
| C20 | FEP-0自身内容绑定里程碑评估与回执 | MISSING | NOT_ASSESSED/null/[]；缺FEP-0独立manifest和消费F0+G0/六PRE证据的功能校验入口 | B-02 |

| 结果 | 数量 | 占比 |
|---|---:|---:|
| PASS | 18 | 90.00% |
| MISSING | 2 | 10.00% |
| PARTIAL / FAIL | 0 / 0 | 0.00% |
| 合计 | 20 | 100% |

完整机器可读[控制矩阵](./evidence/fep0-review-20261005/control-matrix.json)。C02检查上游当前准入，C20检查本里程碑自身清单与回执，属于可分别整改的两个缺口。C10的盘点与C11的最低冻结面只统计已声明范围，不将46planned操作算作已实现。Story/七态/流程为需求与测试定义，不等于全量页面业务E2E实际执行。

### 2.2 实际检查与证据

| 检查 | 本轮结果 | 实际执行与边界 |
|---|---|---|
| 计划结构与负向 | PASS；35项负向包含于综合套件 | 159节点/1462依赖边；只验证结构、依赖状态和证据形状 |
| PRE-01/02/04/05/06与生成/catalog/BFF基线 | 全部PASS | 需求、token/i18n、盘点、环境、测试结构、生成同源与API最低面 |
| 综合回归 / 设计负向 | **264/264；27/27** | 0 failed/skipped；含G0/用户确认、导入、PRE-01/03/04/05/06与计划负向 |
| 一期workspace单元 | **211/211** | 六个workspace，含API-client的7项SSEPoC；loopback HTTP实际执行 |
| 当前源码两应用构建 | PASS | buildId均绑定`ed2e603`；[Terminal产物](./evidence/fep0-review-20261005/terminal-build.json)、[官网产物](./evidence/fep0-review-20261005/website-build.json) |
| PRE-03 Web smoke | PASS | 29锁依赖、2349运行时约束、2构建路由；实际Chromium验证 |
| OIDC/页面浏览器PoC | **11/11，无重试** | Chromium、mock IdP/route拦截、布局/a11y/视觉；新鲜构建 |
| 覆盖率 | 238测试；Web行92.85%、分支79.90% | 关键政策另178测试，129行/111分支100%；与其他用例有交集 |
| PRE-06破坏自检 / 视觉库存 | PASS | schema、权限、敏感字段、视觉四类均检出；Linux入库基线完整性，非Linux浏览器新执行 |
| lint/typecheck / 客户端产物秘密检查 | PASS | 当前生成client、应用/共享包；新构建产物扫描通过 |
| 上游/G0回执内容核验 | **15 READY、118文件摘要一致** | 14个PROVIDER:A1闭包节点+G0；577个用户范围输入匹配 |
| 独立反证 | 3项观测符合入口职责 | 当前F0未READY时拒绝FEP-0假READY；缺证据拒绝；完整伪造闭包只通过结构校验 |

本轮[首轮执行](./evidence/fep0-review-20261005/executions.json)及[运行时执行](./evidence/fep0-review-20261005/runtime-executions.json)保留全部命令、时间、退出码与日志摘要；有效结果见[24项清单](./evidence/fep0-review-20261005/effective-results.json)。首轮3个检查受沙箱Chromium/loopback权限限制而失败，另一次破坏自检命令名称调用错误；后在授权运行环境/正确命令下成功。这4个原始结果保留，不列为工程缺陷、不算PASS，也没有删改原失败日志。

[输入清单](./evidence/fep0-review-20261005/source-inputs.json)记录583个前端/契约/配置/测试及规范文件。已有完整65项上游与16项G0执行来自`92dddbd`，当前内容一致性由[复核记录](./evidence/fep0-review-20261005/existing-evidence-validation.json)验证；本轮没有重新执行完整65/16项或数据库，也没有重新测得三轮构建和Supabase指标。当前双应用构建与浏览器结果另有真实新执行。

本轮**未连接数据库、未创建本机PostgreSQL/Supabase/容器数据库环境、未执行真实IdP/staging/部署/发布长稳、未取得当前SHA hosted CI/发布用户确认**。已有Supabase结果仅证明其原范围，F0历史重建和远程目录drift未在本轮重放。

## 三、问题清单及风险分析

### 3.1 分级总表

| ID | 优先级 | 所属模块 | 具体表现 | 影响范围 |
|---|---|---|---|---|
| B-01 | 阻塞级 | CORE-GATE:F0 / 当前DEVELOPMENT依赖 | F0及六个子项缺当前内容绑定阶段回执；历史ACCEPTED仍指91e222f，不能作为当前阶段READY | FEP-0及消费CORE-GATE:F0的后续功能准入 |
| B-02 | 阻塞级 | FEP-0里程碑功能评估 / 回执入口 | 自身NOT_ASSESSED/null/[]；缺独立输入/结果/依赖清单、manifest与内容校验入口；现有Frontend Baseline与结构检查不足以评估全里程碑 | FEP-0完成声明、其当前证据可信度与持续验收 |

高危、中危、低危均为0；本轮未发现证据支持新增前端功能、安全、数据正确性或契约缺陷。两个阻塞项为验收缺口，没有据此改写已完成PRE/G0结果或宣告核心代码失效。

### 3.2 B-01｜当前CORE-GATE:F0阶段依赖未闭环

[FEP-0任务卡](../SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md#task-fep-0)明确依赖CORE-GATE:F0。核心计划的F0检查点正式状态ACCEPTED、源码91e222f与旧7/7验收保留历史，当前`stage_gate`却明确NOT_ASSESSED。六个未评估子项为F02、F07、F08、F09、TP01-A、TP01-B；没有当前阶段输入摘要/功能回执，不能自动按历史正式验收继承。

本轮未裁定六项当前完整功能测试失败，缺口是依赖证明。历史main至当前源码间也存在相关测试/runner/第三方输入变化，例如`f02-gate-negative.mjs`、`f07-target-service-acceptance.cjs`、`f09-target-gate.cjs`，更不应仅改状态或复制旧SHA。已核验F01/F03/F04/F05/F06及其他准备节点的有效当前回执，可按内容一致性复用。

独立将FEP-0在内存改为READY，保持F0真实NOT_ASSESSED，计划校验明确拒绝“READY requires READY prerequisite CORE-GATE:F0”。因此当前依赖约束已阻止错误准入，风险是不能完成FEP-0，而非已有页面被实际放行。应按F0当前DEVELOPMENT范围评估六项并汇总F0，性能/长稳/正式签名/部署按RELEASE保留。

### 3.3 B-02｜FEP-0自身内容绑定里程碑回执缺失

当前FEP-0没有自身阶段摘要和证据；仓库未发现对应聚合评估/校验入口。[Frontend Baseline workflow](../../.github/workflows/frontend-baseline.yml)名称虽含FEP-0，实质执行PRE/Web/G0工程入口，不消费完整CORE-GATE:F0功能回执或生成FEP-0里程碑manifest。计划结构工具明确声明只做排程、状态/证据形状验证，不核对执行内容。

独立在内存把F0缺失子项、F0与FEP-0都填入READY、任意合法格式摘要并指向已有历史文档，结构工具接受。**这是结构入口职责边界的反证，不是结构工具违反其声明，也没有修改真实计划。** G0的功能校验只负责自身闭包，不能替代FEP-0对F0和六个PRE/G0的汇总评估。现有工具缺少承担这一完整验收内容的入口。

关闭时需形成FEP-0规范范围与所有直接依赖的当前内容绑定清单、实际子检查结果和环境边界，提供可持续验证的入口。缺F0READY、任一子证据漂移、少跑必要检查、日志/摘要替换或无自身manifest应拒绝，全部满足后才能登记自身READY。

### 3.4 风险边界

当前工程资产可运行，风险集中于里程碑的可验证完成和跨核心/前端依赖消费。原G0五项问题已关闭，当前单用户确认有效；FEP-0整改不需要重新收集六方回执。若需要新增范围人工确认，按现行流程由Codex拟稿、项目用户确认，而不是预先新增审批条件。

未来provider、全量页面、19个G0遗留子项及RELEASE任务继续按其原阶段管理。不得用历史F0签名、绿色Frontend Baseline、`development_status=COMPLETED`或本轮静态PASS将整个FEP-0写成阶段READY。

## 四、整改建议

| 顺序 | 对应问题 | 整改建议 | 可检验关闭条件 |
|---|---|---|---|
| 1 | B-01 | 列出F0当前DEVELOPMENT功能输入及六个待评估子项；比较历史与当前输入，复用内容有效证据，补跑受影响功能 | 每项具有真实输入/命令/结果/环境/摘要；不把正式或发布要求提前混入功能准入 |
| 2 | B-01 | 自底向上登记F02/F07/F08/F09/TP01-A/B的当前阶段结论，再生成CORE-GATE:F0聚合内容回执 | F0的11直接依赖READY，完整功能摘要、日志/产物及递归依赖可核验；缺证据拒绝 |
| 3 | B-02 | 为FEP-0建立轻量里程碑聚合评估/校验；复用PRE与G0有效结果，绑定规范范围、F0和全部前置证据 | 拒绝任意历史文档/假摘要、缺F0、漂移、少执行或被改日志；测试与CI覆盖职责范围 |
| 4 | B-02 | 实际评估FEP-0并逐项复核本报告20个控制点，最后登记READY和文档结论 | 20/20满足、8/8直接依赖READY、当前manifest有效；不自动转正式ACCEPTED |

涉及数据库的补证仅可连接工程已配置Supabase，并记录实际执行身份/环境范围；本报告不建议本机数据库、Docker隔离数据库或重新全量reset共享库。性能、长稳、发布环境与同SHA hosted CI按RELEASE执行。

本次仅交付审计报告与证据，未修复业务代码、修改计划阶段状态、生成Git notes、Git提交或推送。
