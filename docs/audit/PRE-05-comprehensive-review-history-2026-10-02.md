# P0 / PRE-05「环境方案」全面复审报告

> 复审日期：2026-10-02（Asia/Shanghai）
> 源码基线：`16f34747c1b6232a0b2ef10ee15c04383f6f846c`；前端执行计划 v3.8；开始时工作区干净。
> 结论：**CHANGES_REQUESTED（仓库工程范围）**。16 个等权控制点：7 PASS、6 PARTIAL、3 FAIL；严格完成率 **7/16 = 43.75%**。
> 未解决问题：**0 阻塞级、1 高危、7 中危、1 低危，共 9 项**。现有正向检查通过不等于全部完成标准通过。

## 一、任务完成概况

### 1.1 复审依据与范围

以[前端开发执行计划 PRE-05](../SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md#task-pre-05)的主要动作、三项产出和完成标准为主，结合[Web 与 Terminal 设计](../SumAlpha-QuantOS-Web-and-Terminal-Design.md)的环境/mode、身份与观测要求、[Terminal 规格](../SumAlpha-QuantOS-Terminal-Frontend-Design-Spec.md) A07 秘密边界，以及[环境开发说明](../PRE-05-environment-guide.md)中明确承诺的配置约束核对。

检查三套 Web 模板、共享配置模型/CLI/测试、两个应用的 Next 配置及认证配置消费者、CI 接线和总结/历史回执。Desktop 草案不作为一期验收项；根 `.env.example` 是后端远程 Supabase 配置，不能替代 Web 三套模板。本轮只创建审计报告与证据，没有修复源码或修改任务状态。

执行计划标记 `COMPLETED`，历史[2026-09-16 验收记录](./PRE-05-acceptance-evidence-2026-09-16.md)记录了当时的仓库通过结果；本轮独立负向检查发现未被覆盖的语义、安全和文档问题，故当前不能认定 PRE-05 全面验收通过。

### 1.2 已确认完成的部分

- 三套模板齐备；一期集合仅 `local-mock/local-integrated/staging`，Desktop 被排除。
- BFF/官网/Terminal origin、OIDC、mode、mock、观测和 feature flag 已登记；staging 四类测试身份以非敏感占位标识记录，口令/MFA/令牌注入边界明确。
- 缺少公开必需变量时，两应用均在 Next 配置加载阶段拒绝构建；未知公开 key、非法默认实盘 mode、staging 开 mock 等已有负向测试通过。
- 以三套模板分别构建官网与 Terminal，六组均成功；Frontend Baseline 有 PRE-05 正向/测试接线。成功构建只证明配置可被消费，不证明真实服务可用。

### 1.3 执行与证据边界

从上述精确 SHA 归档到新临时源码目录，冻结离线安装；复用宿主 pnpm 下载缓存，开始无 node_modules 或构建缓存。工具链 Node 24.12.0、pnpm 10.20.0。

| 本轮验证 | 实际结果 | 证据 |
|---|---|---|
| 安装、PRE-05 CLI/测试、计划、lint、typecheck、workspace 单测、contract | 8 条检查全部退出 0；配置 12/12，workspace 167/167（25 文件），contract 13/13（另计） | [commands.json](./evidence/pre05-review-20261002/commands.json) |
| website / terminal 缺环境构建 | 均退出 1，明确 fail-fast 缺变量 | `missing-env-website.log`、`missing-env-terminal.log` |
| 三 profile × 两应用构建 | 6/6 退出 0；各组官网 8 个 HTML、Terminal 15 个 HTML | 同上执行记录及各 profile 的 `*-artifacts.json` |
| 独立配置探针 | 14 个：2 正向均通过，12 个应拒绝输入中 8 个误放行、4 个正确拒绝 | [probes.json](./evidence/pre05-review-20261002/probes.json) |
| 模板替换与身份删除 | 两模板替换为 local-mock；或删除 staging 四身份；CLI 和既有 12 项测试均仍退出 0 | [补充执行记录](./evidence/pre05-review-20261002/supplement-commands.json) |
| 真实认证函数探针 | 2/2 成功复现 issuer 路径被丢弃、mock 授权仍使用外部 issuer；fetch 为内存替身，无网络 | `auth-runtime-probes.log` |
| dotenv 解析对比 | 同一合法行内注释：Next 接受、CLI 拒绝；诊断首次依赖定位失败保留，修正定位后重放成功 | [parser-comparison.json](./evidence/pre05-review-20261002/parser-comparison.json) |
| 合成 token 构建 | 校验与构建通过，合成 token 形态进入 login/callback 两个客户端 JS 文件 | [bundle-canary.json](./evidence/pre05-review-20261002/bundle-canary.json) |

全部探针只使用公开占位值或纯合成标记，**未发现或使用真实凭据，也未据此断言发生生产泄露**。模板破坏仅发生在临时归档副本，原文件已恢复。输入和证据摘要见[manifest.json](./evidence/pre05-review-20261002/manifest.json)。

远端 CI、正式 G0、指定模型复审、真实 staging DNS/TLS/BFF/IdP/Sentry/账号、数据库执行、全浏览器与完整业务验收均为 **NOT RUN / NO RECEIPT**。本轮没有启动本地 PostgreSQL/Supabase、容器或临时数据库，也没有连接目标数据库。构建成功不能记作数据库或 staging 验收。

## 二、完成情况明细统计

PASS 表示该控制点全部要求有本轮证据；PARTIAL 表示已有部分实现，但存在未闭环条款；FAIL 表示已被负向输入直接推翻。16 项等权，只有 PASS 计入严格完成率，PARTIAL 不折算分数。该百分比反映本报告定义的验收控制点，不估算开发工时或代码比例。

| 控制点 | 需求/验收要求 | 当前结果与缺口 | 判定 |
|---|---|---|---|
| C01 一期范围 | 仅三套 Web；Desktop 独立承接 | 配置枚举、CLI、开发说明均明确分开 | PASS |
| C02 配置产物 | 三模板各定义必需公开配置 | 三套当前文件齐备，六组 Web 构建成功 | PASS |
| C03 BFF 与 Web origin | 绝对 http/https、纯 origin；staging HTTPS；无凭据/query/fragment | 当前校验实现符合，已有相关负向测试 | PASS |
| C04 OIDC 配置契约 | callback 精确匹配、issuer 与消费者一致 | 尾斜杠被额外放行；issuer 路径可配置却被认证函数丢弃（M-03） | PARTIAL |
| C05 环境/mode 分离 | profile 与 research/paper/shadow 独立；禁止默认实盘 | 当前枚举与拒绝测试通过 | PASS |
| C06 flags 语义 | 布尔/off-on 值、profile/mock 绑定与实际消费一致 | 校验 trim，消费者读取原值；带空格 mock flag 走错分支（M-01） | PARTIAL |
| C07 观测方案 | 观测启用时有效公网 DSN，URL 安全约束一致 | 本地缺 DSN/非法 DSN/含密码 URL 放行；staging query/fragment 放行（M-02） | PARTIAL |
| C08 测试账号定义 | 角色身份、公开标识与秘密注入边界明确 | staging 四标识与秘密注入说明存在；不声称真实账号已创建 | PASS |
| C09 启动 fail-fast | 缺必需变量时 dev/build 的配置入口拒绝 | 两应用 assertEnv 接线存在；实际 build 缺变量均拒绝 | PASS |
| C10 输入秘密防线 | 公开值不得容纳已知 server credential 形态 | AWS/GitHub 形态在允许的 client id 中均放行（H-01） | FAIL |
| C11 客户端产物安全 | 客户端 bundle 不含 server secret 形态 | 合成 token 穿过校验与构建并进入客户端 JS；无产物防线阻断（H-01） | FAIL |
| C12 CLI 与实际解析 | 校验和 Next 加载语义一致，文件参数可用 | 行内注释解析不同；绝对路径被错误拼接（M-05、L-01） | PARTIAL |
| C13 CI 接线 | PRE-05 正向/回归及显式构建配置进入 CI | Frontend Baseline 接线存在；不声明当前远端 run 通过 | PASS |
| C14 验收负向有效性 | 三 profile 身份、身份清单和安全/语义错误能拒绝 | 模板退化/账号删除仍绿；独立 12 负向输入中 8 误放行（M-06及关联发现） | FAIL |
| C15 开发说明可执行性 | 配置行为、mock/集成边界忠于当前实现 | 文档声称本地 MSW/伪认证隔离，应用未注册 worker；仅 E2E route 拦截（M-04） | PARTIAL |
| C16 当前状态可追溯 | 总结与当前范围/测试/启动/评审身份一致 | 总结仍为旧四环境/10测试/未接线、未区分历史 G0 与当前记录（M-07） | PARTIAL |

统计：**PASS 7/16（43.75%）／PARTIAL 6/16（37.5%）／FAIL 3/16（18.75%）**。阻塞级 0 不表示任务可直接通过验收，高危安全防线仍需修复。

| 要求产出 | 存在情况 | 完整验收情况 |
|---|---|---|
| `.env.example`（三套 Web 模板） | 3/3 文件存在，当前内容可构建 | 模板身份和测试身份清单缺少可执行约束；与实现行为说明有偏差 |
| 配置校验 | 模型、assertEnv、CLI、12 测试及 CI 均存在 | 秘密、原值、DSN、OIDC、解析与覆盖问题未闭环 |
| 开发说明 | 开发说明与总结均存在 | mock 行为和当前验收口径须修订 |

三个产出类别存在率 **3/3 = 100%**，存在率不能代替上述 **43.75%** 的严格验收完成率。

## 三、问题清单及风险分析

### 3.1 优先级统计

| 优先级 | 数量 | 风险判断 |
|---|---:|---|
| 阻塞级 | 0 | 没有阻止读取源码、执行既有检查或三套正常构建的问题 |
| 高危 | 1 | 客户端秘密防线可被已知凭据形态穿透 |
| 中危 | 7 | 配置实际语义、OIDC/观测、本地操作说明、验收有效性与状态判断失真 |
| 低危 | 1 | 指定文件 CLI 的路径可用性缺陷 |

### 3.2 逐项发现

| ID / 优先级 | 所属模块与定位 | 具体表现及复现 | 影响范围 |
|---|---|---|---|
| H-01 高危 | `packages/config/src/env.ts:45` 秘密指纹；Web 构建/CI | value 只识别 sk/JWT/PEM/sbp；允许 client id 携带合成 AWS 或 GitHub credential 形态。合成 GitHub token 用于实际 Terminal 构建，退出 0 且出现在 login/callback 两个客户端 JS。输入测试不是 bundle 扫描；Git 历史 secret Gate 不覆盖运行时注入值 | 任一公开变量被误填秘密时，构建不能可靠拒绝，浏览器可下载该值。这里证明防线缺陷，未证明真实泄露 |
| M-01 中危 | `packages/config/src/env.ts:64`；`apps/terminal/app/auth/callback/page.tsx:52` | validateEnv 读取 trim 后值但 assertEnv 不返回/应用规范化值。`MOCK_ENABLED=' true '`通过，页面原值不等于 `'true'`，走集成/BFF session 分支；profile 和业务值也存在同类规范化分歧 | local-mock 认证行为与校验结论不一致；环境/flag 决策不可靠 |
| M-02 中危 | `packages/config/src/env.ts:159`；开发说明 §2.1 | DSN 必填/格式只在 staging+观测开启时检查。本地观测开但缺 DSN、非法 DSN、含密码 DSN 均通过；staging DSN query/fragment 也通过，与“所有 URL 无密码/query/fragment”说明不一致 | 三套 profile 的观测配置与 URL/敏感信息边界；误配置不能 fail-fast |
| M-03 中危 | `packages/config/src/env.ts:135`；`apps/terminal/src/auth/flow.ts:72,118` | callback 校验主动移除尾斜杠，放行与注册 URI 不完全相同的值；issuer 允许路径，但真实 authorize/token 构造用根路径，丢弃 `/tenant/realm`。2 项认证函数探针确认，fetch 未联网 | 路径型 IdP 与精确 callback 注册的 local-integrated/staging 登录；不是要求本轮实现完整 OIDC provider |
| M-04 中危 | `env/local-mock.env.example` 注释；开发说明 §1；`apps/terminal/app/login/page.tsx`；`tests/e2e/auth-callback.spec.ts` | 文档承诺 MSW 拦截全部 BFF、伪认证不跳转真实 OIDC；应用无 setupWorker/worker.start，也无随应用分发的 mock worker。登录直接 location.assign mock issuer；测试里的 page.route 不会随普通 dev 启动 | 开发者照说明启动后的本地离线与认证体验；配置完成被误解为 mock 运行面已实现。完整业务 mock 应由后续任务负责 |
| M-05 中危 | `packages/config/src/env.ts:218`；CLI 与 Next 环境加载 | 自制 parser 不处理 dotenv 行内注释等语法。同一 `MOCK_ENABLED=true # local mock`：CLI 值包含注释而拒绝，Next 值为 true 而通过，已对比实际 Next 依赖加载器 | 校验指定文件与应用实际启动不一致；正向配置误拒绝，双解析器维护风险 |
| M-06 中危 | `packages/config/scripts/check-env.mjs:16`；`packages/config/tests/config.test.ts:31` | 只逐文件调用通用 validateEnv，不绑定文件名对应 profile/集合身份。在临时副本把 integrated/staging 都替换为 local-mock，CLI 与12测试全绿；删除 staging 四测试身份也全绿 | 三套环境覆盖和测试身份产出可静默退化；CI 不能证明交付集合完整。需与源控制点绑定，而非只增加测试数量 |
| M-07 中危 | `docs/PRE-05-summary.md:3,10,21,33,36` | 当前总结仍写四套环境、4/4 CLI、10/10测试、assertEnv待接线及Desktop smoke；历史 G0 纳入表述没有历史源身份/当前未评审边界。与三套当前模型、12测试、已接线及 `G0-current-governance.json` 的 NOT_STARTED 不一致 | PRE-05状态、第一期范围及阶段评审判断；不可将历史范围表述沿用为当前通过 |
| L-01 低危 | `packages/config/scripts/check-env.mjs:27` | 对绝对路径仍使用 join(root,file)，存在的绝对 env 文件被拼成根目录下的另一条路径，CLI 报不存在；同文件相对路径成功 | 编辑器/自动化传入绝对路径时的开发检查；三模板默认命令不受影响 |

没有将同一 H-01 输入和产物漏洞重复计为两个问题；M-06 为集合/身份检查缺陷，其他问题为具体语义缺陷。M-02 的 URL 密码放行归入观测配置，不另增加秘密问题。

### 3.3 风险与验收边界

当前最重要风险是安全检查和实际客户端产物之间缺少闭环：allowlist 保证 key 属于已知公开集合，但不证明 value 的数据分类正确。三套配置正常构建和 12 个测试通过，均无法抵消本轮合成 token 构建证据。

此外，字符串校验通过不保证消费者采用相同语义；模板数量、文件存在及测试名称不保证 profile 身份齐备。文档应分别表达配置准备、应用能力、历史签署与当前目标验收，不能让 `COMPLETED` 掩盖这些差异。

真实 staging 未运行是预研验收边界，不单独计为阻塞级或缺陷；仍需后续任务提供精确提交、部署配置与目标回执。观测 SDK 全接线、完整 mock/provider/业务模式切换不作为本次 PRE-05 必须新增的实现范围。

## 四、整改建议

按下列顺序处理；每项均应补充失败关闭证据，再重新核对完成矩阵。当前建议维持 **CHANGES_REQUESTED**，不要仅通过修改状态或旧回执宣称关闭。

| 顺序 / 问题 | 建议整改 | 关闭标准 |
|---|---|---|
| 1 / H-01 | 完善已知凭据指纹与公开值分类；把客户端实际 JS/HTML/map 等产物安全检查接入构建/CI，检查注入配置与产物。不要把“前缀允许”当作秘密隔离证明 | 合成 token 输入在产物生成前拒绝；绕过输入层后的客户端合成秘密由产物 Gate 拒绝；正常公开 client id/DSN 通过；不记录真实凭据 |
| 2 / M-01 | 拒绝非规范原值，或提供统一解析后的强类型配置并让消费者统一使用；保持 profile 与业务 mode 独立 | 带空格 flag/profile/mode 不能造成校验与消费不一致；回调分支回归覆盖 |
| 3 / M-02 | 冻结所有 profile 的观测开关/DSN条件与URL规则，统一校验；Sentry 公共用户名与密码明确区别 | local 两环境开观测缺/坏 DSN 拒绝；密码/query/fragment拒绝；合法公共 DSN通过 |
| 4 / M-03 | 冻结精确callback；明确issuer是完整OIDC issuer还是受限origin。路径型issuer使用受控端点解析/发现，或在当前未支持时明确拒绝并记录后续承接 | callback 尾斜杠漂移拒绝；合法路径型IdP的端点正确，或未支持值启动前明确拒绝；保留mock与目标验收区别 |
| 5 / M-04 | 修正本地启动说明，明确配置准备与当前应用mock实现、Playwright拦截各自范围；如需普通dev离线认证，独立承接可重放启动入口 | 按文档能获得所承诺的行为；无mock实现时明确限制和后续任务，不强迫PRE-05完成全部页面mock |
| 6 / M-05 | CLI复用与Next一致的dotenv规则或共同加载器；规定环境覆盖优先级，避免两套独立解释 | 引号、空格、行内注释等代表性文本在CLI/Next得到一致值和拒绝结果 |
| 7 / M-06 | 独立约束三profile文件身份/唯一性、staging测试角色清单及占位标识边界；把本轮错误输入与集合退化纳入回归 | 两模板退化、profile替换、身份删除均使Gate非零；真实账号可用性仍由目标回执证明 |
| 8 / M-07 | 重写当前总结，同步三Web环境、12项或修复后实测数量、启动接线、当前审计与历史G0链接；保持历史验收原文不被改写 | 当前总结/开发说明/执行计划状态相互一致；历史签署不冒充当前SHA与范围 |
| 9 / L-01 | 绝对路径直接使用，相对路径按仓库根解析；更新CLI参数说明 | 同一文件相对/绝对路径均成功；不存在文件依然非零 |

整改后在干净源码副本重放配置正负检查、两应用缺变量启动拒绝、三profile构建、产物安全检查、关联lint/typecheck/测试和文档链接/摘要校验。只有全部未解决问题关闭、16控制点重新通过，才可将本报告更新为仓库工程验收PASS；正式G0与staging仍需各自证据。
