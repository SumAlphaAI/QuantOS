# A1 / FEP-0 整改与复验报告

> 日期：2026-10-05（Asia/Shanghai）。冻结功能源码：`04229ce1f93e2d6732411d68a38504702238093e`。
> 结论：**工程整改和复验通过；G0/FEP-0 保持 BLOCKED，等待当前范围的项目用户确认**。完整 F0/A1 检查 **86/86 PASS**，G0 工程 **16/16 PASS**，FEP-0 自身 **2/2 PASS**。
> 本报告更新当前整改事实；[初审原件](./FEP-0-comprehensive-review-2026-10-05.md)及各次失败证据保持不变。正式 ACCEPTED、RELEASE 与同 SHA hosted CI 不由本报告产生。

## 一、任务完成概况

按初审 B-01 → B-02 顺序补齐 F02/F07/F08/F09/TP01-A/B 的当前 DEVELOPMENT 功能策略、F0 聚合及 FEP-0 独立里程碑入口。变更的完整 F0/A1 闭包在同一冻结源码、干净初始工作区重新执行 86 项检查，全通过后自底向上发布 21 个内容绑定 READY 回执。随后 G0 实际执行 16 项工程检查，FEP-0 实际执行两项并独立消费八个依赖的当前回执。

真实数据库、Storage/RLS、服务、三次跨语言构建、覆盖率、wheel/UDS、供应链和反向探针均由实际命令产生；没有以旧审计正文、任意合法摘要或结构检查替代功能执行。数据库只连接工程已配置 Supabase PostgreSQL；没有建立本机、容器或临时 PostgreSQL/Supabase。FEP-0 聚合入口本身不连接数据库，数据库事实来自逐字节核验的子回执。

唯一待办：项目用户确认 [G0 DEVELOPMENT 当前文稿](../gate-records/G0-user-confirmation-draft-2026-10-05-9630623790b8.md)。旧确认原件保留；本轮脚本、CI、包锁及安全补丁改变当前功能输入，不能将旧确认自动转移。

## 二、完成情况明细统计

### 2.1 当前控制点与依赖

控制点仍按初审同一 20 项等权口径统计，PASS 才计完成；当前 **18/20（90%）**。工程代码修复完成不自动等于人工确认或阶段 READY。

| 指标 | 当前结果 |
|---|---|
| 原问题 B-01 | 已关闭；F0 的 11 个直接前置及其递归功能证据 READY |
| 原问题 B-02 | 工程整改通过；最终准入待当前 G0 用户确认 |
| FEP-0 八个直接依赖 | 7/8 READY，G0 BLOCKED |
| FEP-0 22 个递归上游 | 21/22 READY，G0 BLOCKED |
| 含 FEP-0 的 23 个节点 | 21 READY、2 BLOCKED、0 NOT_ASSESSED |
| FEP-0 stage_gate | BLOCKED；engineeringStatus=PASS；formalAccepted=false |
| 实际有效执行入口 | 86 F0/A1 + 16 G0 + 2 FEP-0 = 104/104 PASS；入口中的用例有交集，不把它们相加为独立测试数 |

| 编号 | 控制点 | 当前结果 | 实际依据 |
|---|---|---|---|
| C01 | A1/DEVELOPMENT、一期 Web 与后续阶段边界 | PASS | 本轮实际 PASS：plans, plans-negative |
| C02 | 全部前置当前阶段准入 | PENDING | F0 与六个 PRE 均 READY；G0 BLOCKED |
| C03 | 固定工具链、锁文件及运行时ADR | PASS | 本轮实际 PASS：f01, pre03 |
| C04 | 官网与Terminal构建、目标路由PoC | PASS | 本轮实际 PASS：build-website, build-terminal, pre03, chromium |
| C05 | 前端开发规范、lint与typecheck | PASS | 本轮实际 PASS：f01-lint, client-typecheck, client-lint |
| C06 | 设计token、状态、密度、断点及组件清单 | PASS | 本轮实际 PASS：pre02, pre02-negative |
| C07 | Storybook、WCAG基础与双语安全文案 | PASS | 本轮实际 PASS：storybook, ui-tests |
| C08 | 页面、Story、权限矩阵及七态场景 | PASS | 本轮实际 PASS：pre01, pre01-negative |
| C09 | 页面→任务→契约→后端→测试→Gate追踪 | PASS | 本轮实际 PASS：pre01, catalog |
| C10 | 字段字典、接口盘点与published/planned缺口 | PASS | 本轮实际 PASS：pre04, pre04-negative |
| C11 | OpenAPI最低冻结面与同源client/mock | PASS | 本轮实际 PASS：openapi, schema, generated, catalog, a1 |
| C12 | 会话、错误、安全输入和实时恢复 | PASS | 本轮实际 PASS：f06-target, api-client-tests, chromium |
| C13 | 生产前端BFF导入与fixture例外边界 | PASS | 本轮实际 PASS：pre01-negative, f01-lint |
| C14 | 环境矩阵、公开变量、DSN/回跳约束 | PASS | 本轮实际 PASS：pre05, pre05-negative, config-tests |
| C15 | 客户端产物与秘密检查 | PASS | 本轮实际 PASS：build-website, build-terminal, f02-secrets |
| C16 | 同schema fixtures、单元、基本浏览器与SSE PoC | PASS | 本轮实际 PASS：api-client-tests, ui-tests, chromium |
| C17 | schema/权限/敏感字段/视觉破坏持续拒绝 | PASS | 本轮实际 PASS：pre06, pre06-negative, sabotage, semantic-mutations |
| C18 | 领域覆盖率与关键风险分支 | PASS | 本轮实际 PASS：coverage, critical |
| C19 | 当前G0确认、冻结回执和遗留治理 | PENDING | G0 当前工程 16/16 PASS；当前范围 BLOCKED |
| C20 | FEP-0自身内容绑定里程碑评估与回执 | PASS | 独立 FEP-0 manifest、两项实际检查、39 项正负向、八依赖内容验证；BLOCKED |

机器可读 [20 项控制矩阵](./evidence/fep0-remediation-20261005/control-matrix.json)、[依赖快照](./evidence/fep0-remediation-20261005/dependency-snapshot.json)和[完整实际执行](./evidence/provider-a1-remediation-20261004/fep0-verified-20261005/execution-results.json)。C02 与 C19 的待办（若有）来自同一份 G0 当前范围确认，不新增两个审批流程。C20 评价独立里程碑机制已交付且执行通过；其 BLOCKED 状态继续诚实保留。

### 2.2 关键实际验证与范围

| 模块 | 当前验证 |
|---|---|
| F01/F03/F04 | 三次独立跨语言构建、工具链/锁/Proto、全仓 lint/tests、stable 行及 nightly 分支覆盖率；F01 19 项负向通过 |
| F02 | 全 Git 秘密扫描、许可证、四生态 SCA、日期有效豁免与 17 项负向；真实 Supabase 7 项 catalog/RLS/checksum 检查通过，DDL 变异全部事务回滚，不重建共享库 |
| F05 | 真实 Supabase 并发/租户/恢复；事件/唯一副作用/应用回执/分发均 10000/10000/10000/10000，checkpointNextSequence=10001；Storage/RLS 真实执行 |
| F06 | 7 类实际目标日志通过并绑定 SHA，包括 Auth/BFF/Runtime、Execution/Vault 与数据库拒绝矩阵 |
| F07 | 一个 worker 被 OS 终止后恢复 100 个任务、100 个唯一 Artifact 绑定；10 个任务的实际覆盖率；真实 Auth/BFF/Runtime/Storage 与跨租户、无 Cookie、无 CSRF、注销吊销拒绝通过 |
| F08 | stable 行/region 与 local nightly 分支各按正确口径验收；安装实际 mock wheel、release 编译执行 9 个 UDS/RPC/崩溃/取消/恢复/幂等/完整性/不可信 RPC 场景全部通过 |
| F09 | 两个一分钟 scheduler tick、实际 Supabase 容量/连接终止/消费者恢复、真实 Portfolio/Risk 查询、BFF/Runtime/Portfolio 持久写 trace、监督 Engine 崩溃和确定性告警；7 份嵌套日志摘要一致 |
| TP01-A/B | 使用现有 gh 登录做只读仓库保护核验、Git link 精确锁定与干净 checkout、sync 负向；11 行能力矩阵及用途/交易/记忆/消息边界核验；无远程仓库写操作 |
| 六 PRE / G0 | 当前两应用与 Storybook 构建、字段/页面/Story/权限追踪、生成同源、环境、Chromium/OIDC/SSE PoC、覆盖率、四类破坏自检及 G0 16 项独立工程入口 |
| FEP-0 | 八依赖递归内容校验、独立规范/源码/配置/测试输入、命令/时间/退出码/日志摘要和环境边界；39 项正负向通过，CI 消费工程入口及反向探针 |

[最终内容核验](./evidence/fep0-remediation-20261005/final-validation.json)包含五项真实 PASS 和两项缺确认的预期拒绝；[四生态原始扫描](./evidence/provider-a1-remediation-20261004/fep0-verified-20261005/sca-raw/index.json)另存原字节及摘要，保留上游 finding。

完整产物与支持日志按摘要绑定；`.gitignore` 的 `artifacts/` 不作为遗漏证据的理由，所需当前及失败产物单独入库。此前各轮不是最终 PASS：

| 冻结源码 / 记录 | 真实执行 | 处理 |
|---|---|---|
| `f37360b` / [首轮](./evidence/provider-a1-remediation-20261004/fep0-20261005/execution-results.json) | 86 项、81 PASS / 5 FAIL | 不发布 READY；修 TLS、供应链、服务配置、stable/nightly 及 UDS 路径 |
| `3a592a4` / [中止轮](./evidence/provider-a1-remediation-20261004/fep0-final-20261005/assessment-summary.json) | 8 项、6 PASS / 2 FAIL；其余未执行 | 发现明确失败后中止，修补丁复制及 Runtime trace CA 配置 |
| `68c3362` / [第三轮](./evidence/provider-a1-remediation-20261004/fep0-rerun-20261005/assessment-summary.json) | 86 项、85 PASS / 1 FAIL | 反向测试旧夹具失败，不发布 READY；修正描述并新冻结源码完整重跑 |
| `04229ce` / [最终轮](./evidence/provider-a1-remediation-20261004/fep0-verified-20261005/execution-results.json) | 86/86 PASS | 独立生成 21 个当前 READY；不以失败轮的结果补齐最终轮 |

## 三、问题清单及风险分析

### 3.1 原报告问题关闭状态

| ID | 优先级 / 模块 | 原表现与影响 | 当前整改结论 |
|---|---|---|---|
| B-01 | 阻塞级 / F0 当前依赖 | F0 及六个子项缺当前回执，阻碍 FEP-0 前置 | 已关闭；11 个直接前置、完整闭包实际执行、输入/日志/产物/依赖校验全部通过 |
| B-02 | 阻塞级 / FEP-0 聚合、CI | 缺独立内容绑定机制，结构绿灯不足以证明完成 | 工程缺口已修复：独立评估、内容绑定、负向与 CI 已交付并实际通过；最终 READY 关闭条件仍待 G0 当前范围用户确认。 |

当前未关闭的阶段准入条件为 1 项阻塞级（当前 G0 用户确认）；无未修复工程故障。 原审计其余优先级为 0；整改复验中新发现的问题均已修复，具体如下。

### 3.2 复验新增问题及根因修复

| 优先级 / 模块 | 实际表现、影响 | 修复及证据 |
|---|---|---|
| 阻塞级 / F09 TLS | macOS 原 native TLS 拒绝目标证书寿命，随后 Runtime trace 使用未带 CA 的管理员 URL | 改为 workspace OpenSSL PEER/主机名校验；Runtime 测试复用 verify-full + root CA；缺 CA 负向和完整真实目标通过，没有关闭 TLS 校验 |
| 高危 / Node 供应链 | `braces@3.0.3` 高危递归栈耗尽公告，影响 micromatch/fast-glob 实际消费者 | 增加深度上限安全补丁、锁定 patch；真实已安装文件摘要和字符串/AST/兼容性探针；SCA 明确 BACKPORT_VERIFIED，原上游 finding 保留、waived=false；其他公告仍拒绝 |
| 中危 / F01 锁负向、F02 SCA 夹具 | 冻结锁临时目录和负向夹具未复制实际 package 引用的 patch，造成检测失败 | 精确复制安全相对路径补丁；缺失/变更/越界补丁、真实消费者、未豁免公告及篡改源仍拒绝；F01 19/19、F02 17/17 |
| 中危 / F07 服务 runner | 缺 trace 出口导致启动失败；注销请求缺 CSRF Cookie/header，导致安全契约拒绝 | 独立临时 trace 目录；保留两种 Cookie 并发送 CSRF；实际确认无 CSRF 403、正确注销 204、Runtime 吊销 401 |
| 中危 / F08 覆盖率 | stable 工具合成分支计数不一致被当作 nightly 验收失败 | stable 按行/region 门槛记账、分支 NOT_ASSESSED_STABLE；nightly 保留一致性和 85% 门槛，正负向通过 |
| 中危 / F08 macOS UDS | 系统 tmp 的 canonical 路径超出 socket 限制，9 个真实场景无法 bind | 使用受控短路径、700 权限、103-byte 上限检查；实际 wheel/release 九场景通过 |
| 低危 / FEP-0 反向夹具 | 旧文字把 100 个任务恢复表达为 worker 数，修正文案后夹具未同步，完整轮最后一项失败 | 夹具与实际一个 worker/100 tasks 语义一致；141 项针对性门禁回归和新完整轮 39 项 FEP-0 正负向通过 |

### 3.3 保留风险与正式验收边界

- F07 本轮 `scheduleP95Ms=892.403625`，回执为 DIAGNOSTIC_ONLY；未宣告满足 200ms 性能目标。临时管理员 Storage 身份仅供诊断，受限 Runtime Storage 凭据、部署 HTTPS、性能/长稳仍由 L04/RELEASE 验证。
- F02 事务内 catalog/RLS 反证证明当前机制；`fullReferenceRebuild=false`，未做共享库 reset/完整重建或建立本地参考库。历史完整重建与正式环境回执独立保留。
- braces 上游公告尚无已发布修复版本，当前由受校验的本地回移补丁承担维护；升级或补丁变化会使当前证明失效，应重新核验。见 [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) 与[本地安全说明](../../security/braces-backport.md)。
- OIDC/browser、loopback 服务、local nightly、mock wheel 和当前 Supabase 目标不代表真实 IdP/staging、hosted CI、部署或生产验收。PROVIDER:ALL、全量业务页面、Desktop 和后续发布要求按原计划；没有扩展实盘或第三方用途许可。
- 所有 manifest 的 observedSourceCommit 保留实际执行源码；后续仅报告、证据索引或阶段状态提交按功能内容一致性消费，不冒充新 HEAD 的同 SHA 正式 RELEASE 验收。

## 四、整改建议与后续操作

工程整改按 B-01、B-02 顺序完成，严格入口持续消费当前内容：`pnpm check:f0-development`、`pnpm check:provider-a1`、`pnpm check:g0-engineering`、`pnpm check:fep0:engineering`。缺日志、产物、执行、输入漂移或依赖变化持续拒绝；绿色 CI 仅代表已明确执行的工程门禁。

唯一待办：项目用户确认 [G0 DEVELOPMENT 当前文稿](../gate-records/G0-user-confirmation-draft-2026-10-05-9630623790b8.md)。旧确认原件保留；本轮脚本、CI、包锁及安全补丁改变当前功能输入，不能将旧确认自动转移。

实际确认后先执行 `node scripts/g0-development.mjs --finalize`，独立核验原 PENDING snapshot、全部工程输入/日志/依赖后消费真实用户答复，保留原 pending manifest；再在新子目录 `pnpm assess:fep0 docs/audit/evidence/fep0-remediation-20261005/user-confirmed` 评估，运行严格 `pnpm check:g0-development` / `pnpm check:fep0`，更新为 20/20、8/8 和 READY。若工程输入变化则重新执行对应完整闭包，不把人工确认代替测试。

发布环境、性能/长稳、完整参考重建、同 SHA hosted CI 及正式发布确认继续按 RELEASE 执行。两份计划同步当前 stage_gate，历史正式字段保持原事实。工程及最终证据生成本地 Git 提交；本轮未推送。
