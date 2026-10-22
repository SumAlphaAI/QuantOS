# FRONTEND-GATE:G1 / FEP-1 本机联调缺口核对（2026-10-22）

本轮核对完成：**PASS_GAP_ACCOUNTING_ONLY**；**G1 / FEP-1 NOT_READY_GAPS_OPEN**，计划stage_gate仍INTEGRATION NOT_ASSESSED，formalAccepted=false、runtimeAdmission=DENIED。这是缺口核对与有界探针，不是G1业务联调通过、用户正式验收或发布许可。只修改QuantOS的审计工具/文档/证据和计划摘要；无业务代码、数据库、环境、推送或部署变更。

应用/契约观察基线 `2ccceeffe290611ddd75ee22fe5ce56e06909f21`（上一确认提交）；本轮审计工具另以hash绑定。旧页面和provider结果只按各自原SHA核对，不改绑为本轮PASS。见[机器回执](./evidence/frontend-g1-gap-20261022/receipt.json)、[依赖与确认](./evidence/frontend-g1-gap-20261022/dependency-audit.json)、[整改项](./evidence/frontend-g1-gap-20261022/actions.json)、[源码定位](./evidence/frontend-g1-gap-20261022/source-findings.json)、[恢复矩阵](./evidence/frontend-g1-gap-20261022/recovery-matrix.json)与[尝试历史](./evidence/frontend-g1-gap-20261022/attempt-history.json)。

## 核对结论与依赖

G1有13项直接依赖；FEP-1有26项，二者合并27个唯一引用（其中包含G1自身，不含FEP-1目标）。全部直接引用stage_gate均NOT_ASSESSED，没有通过本轮批量提升READY；159个计划节点的stage_gate保持原值。FEP-1原development_status=COMPLETED只陈述既有实现，不能覆盖本次联调缺口。

十个页面/组件条目中九项原稿已确认，P15仍IMPLEMENTED_PENDING_ACCEPTANCE。确认记录分别核验原始用户答复、唯一确认人、文稿/request摘要与版本；BFF001采用既有不可变prose兼容校验。另核对11个BFF原确认、PROVIDER:ALL原确认和G0 legacy确认，共22条；BFF002/004/006/008–011部分development_status仍待评估是共享输入变化后的记录，不能误写为用户未曾确认，也不据此要求用户重签全部旧稿。

UI页面历史范围核验了7142项原源码输入Git blob、128条原执行日志/命令绑定、590附件hash及1208个完整历史索引文件；这只是原证据完整性与来源核对，不是重跑这些检查。现有输入对比只统计原清单内变化文件，不包含新文件的完整适用性评估；即使P17变化0项，也不授予G1或当前HEAD验收。

| 页面/组件 | 原工程SHA | 原范围人工确认 | 原输入中现已变化数 | 阶段 |
|---|---|---|---:|---|
| FE:UI-103 | `804f52d1` | CONFIRMED_ORIGINAL_SCOPE | 47 | NOT_ASSESSED |
| FE:UI-VIS-000 | `45f3a307` | CONFIRMED_ORIGINAL_SCOPE | 43 | NOT_ASSESSED |
| FE:UI-102 | `fd2f3e64` | CONFIRMED_ORIGINAL_SCOPE | 43 | NOT_ASSESSED |
| FE:UI-101 | `4423badb` | CONFIRMED_ORIGINAL_SCOPE | 58 | NOT_ASSESSED |
| FE:UI-104 | `ab50c36d` | CONFIRMED_ORIGINAL_SCOPE | 52 | NOT_ASSESSED |
| FE:WEB-101 | `c9ae09bc` | CONFIRMED_ORIGINAL_SCOPE | 26 | NOT_ASSESSED |
| FE:UI-P01 | `5f7aec51` | CONFIRMED_ORIGINAL_SCOPE | 17 | NOT_ASSESSED |
| FE:UI-P02 | `a2132f51` | CONFIRMED_ORIGINAL_SCOPE | 9 | NOT_ASSESSED |
| FE:UI-P15 | `7bb249d8` | PENDING | 10 | NOT_ASSESSED |
| FE:UI-P17 | `dae4d014` | CONFIRMED_ORIGINAL_SCOPE | 0 | NOT_ASSESSED |

| 直接引用 | 所属目标 | 实现记录 | 当前阶段 | 既有确认账本 |
|---|---|---|---|---|
| FE:UI-103 | G1 FEP-1 | COMPLETED | INTEGRATION / NOT_ASSESSED | CONFIRMED_ORIGINAL_SCOPE |
| FE:UI-VIS-000 | G1 FEP-1 | COMPLETED | INTEGRATION / NOT_ASSESSED | CONFIRMED_ORIGINAL_SCOPE |
| FE:UI-102 | G1 FEP-1 | COMPLETED | INTEGRATION / NOT_ASSESSED | CONFIRMED_ORIGINAL_SCOPE |
| FE:UI-101 | G1 FEP-1 | COMPLETED | INTEGRATION / NOT_ASSESSED | CONFIRMED_ORIGINAL_SCOPE |
| FE:UI-104 | G1 FEP-1 | COMPLETED | INTEGRATION / NOT_ASSESSED | CONFIRMED_ORIGINAL_SCOPE |
| FE:WEB-101 | G1 FEP-1 | COMPLETED | INTEGRATION / NOT_ASSESSED | CONFIRMED_ORIGINAL_SCOPE |
| FE:UI-P01 | G1 FEP-1 | COMPLETED | INTEGRATION / NOT_ASSESSED | CONFIRMED_ORIGINAL_SCOPE |
| FE:UI-P02 | G1 FEP-1 | COMPLETED | INTEGRATION / NOT_ASSESSED | CONFIRMED_ORIGINAL_SCOPE |
| FE:UI-P15 | G1 FEP-1 | IMPLEMENTED_PENDING_ACCEPTANCE | INTEGRATION / NOT_ASSESSED | PENDING |
| FE:UI-P17 | G1 FEP-1 | COMPLETED | INTEGRATION / NOT_ASSESSED | CONFIRMED_ORIGINAL_SCOPE |
| CORE:F06 | G1 FEP-1 | COMPLETED | DEVELOPMENT / NOT_ASSESSED | NO_JSON_CONFIRMATION_SELECTED_NOT_ASSERTED_ABSENT |
| CORE:F09 | G1 FEP-1 | COMPLETED | DEVELOPMENT / NOT_ASSESSED | NO_JSON_CONFIRMATION_SELECTED_NOT_ASSERTED_ABSENT |
| PROVIDER:ALL | G1  | — | DEVELOPMENT / NOT_ASSESSED | CONFIRMED_ORIGINAL_SCOPE |
| FE:BFF-FE-000 | FEP-1 | COMPLETED | DEVELOPMENT / NOT_ASSESSED | NO_JSON_CONFIRMATION_SELECTED_NOT_ASSERTED_ABSENT |
| FE:BFF-FE-001 | FEP-1 | COMPLETED | DEVELOPMENT / NOT_ASSESSED | CONFIRMED_ORIGINAL_SCOPE |
| FE:BFF-FE-002 | FEP-1 | IMPLEMENTED_PENDING_ACCEPTANCE | DEVELOPMENT / NOT_ASSESSED | CONFIRMED_ORIGINAL_SCOPE |
| FE:BFF-FE-003 | FEP-1 | COMPLETED | DEVELOPMENT / NOT_ASSESSED | CONFIRMED_ORIGINAL_SCOPE |
| FE:BFF-FE-004 | FEP-1 | IMPLEMENTED_PENDING_ACCEPTANCE | DEVELOPMENT / NOT_ASSESSED | CONFIRMED_ORIGINAL_SCOPE |
| FE:BFF-FE-005 | FEP-1 | COMPLETED | DEVELOPMENT / NOT_ASSESSED | CONFIRMED_ORIGINAL_SCOPE |
| FE:BFF-FE-006 | FEP-1 | IMPLEMENTED_PENDING_ACCEPTANCE | DEVELOPMENT / NOT_ASSESSED | CONFIRMED_ORIGINAL_SCOPE |
| FE:BFF-FE-007 | FEP-1 | COMPLETED | DEVELOPMENT / NOT_ASSESSED | CONFIRMED_ORIGINAL_SCOPE |
| FE:BFF-FE-008 | FEP-1 | IMPLEMENTED_PENDING_ACCEPTANCE | DEVELOPMENT / NOT_ASSESSED | CONFIRMED_ORIGINAL_SCOPE |
| FE:BFF-FE-009 | FEP-1 | IMPLEMENTED_PENDING_ACCEPTANCE | DEVELOPMENT / NOT_ASSESSED | CONFIRMED_ORIGINAL_SCOPE |
| FE:BFF-FE-010 | FEP-1 | IMPLEMENTED_PENDING_ACCEPTANCE | DEVELOPMENT / NOT_ASSESSED | CONFIRMED_ORIGINAL_SCOPE |
| FE:BFF-FE-011 | FEP-1 | IMPLEMENTED_PENDING_ACCEPTANCE | DEVELOPMENT / NOT_ASSESSED | CONFIRMED_ORIGINAL_SCOPE |
| FE:PRE-06 | FEP-1 | COMPLETED | DEVELOPMENT / NOT_ASSESSED | NO_JSON_CONFIRMATION_SELECTED_NOT_ASSERTED_ABSENT |
| FRONTEND-GATE:G1 | FEP-1 | — | INTEGRATION / NOT_ASSESSED | NO_JSON_CONFIRMATION_SELECTED_NOT_ASSERTED_ABSENT |

CORE:F06/F09保留历史ACCEPTED与各自范围。计划最近引用的2026-10-12/e4c45a7c回执仍记录TARGET_DATABASE_READ_ONLY、Auth未进入/真实tick未通过；本轮未接触目标，**不能宣称目标今天仍只读或已经恢复**。历史服务端接受不等于浏览器OIDC、MFA页面或G1组合已通过。BFF000/PRE06/Core没有在本轮选定的JSON确认账本中选出记录，不意味着不存在历史签署；本轮不递归执行其严格门禁。G0/ALL原4fdc67b4有限DEVELOPMENT READY也不迁移为当前READY。

## 下载链路与恢复边界

1. **G1-DL-01，已复现的本机reference链路缺口。** 同一参考进程通过真实MFA/reauth/export API准备内存导出，再由实际C01/C17 consumer读取并点击意图申请租约。返回downloads.invalid/query-ticket，不符合当前HTTPS同BFF origin与签名内容路径限制，安全拒绝；没有内容消费，不能计为文件交付。测试桥只替换fixture身份与传输端口，响应原字节转发、不重写URL，安全响应仅hash保存。
2. **G1-DL-02，条件性的origin契约缺口。** live源码的内容URL以terminal_origin生成，consumer以BFF origin校验。两origin分离的合成模板拒绝，同origin模板仅通过URL校验。OpenAPI约束一次性URI/5分钟，未写明两origin关系。此处未运行live signer/DB/Storage/部署；需先确定单origin代理或严格受信内容origin策略，不能放开任意跨域。HMAC-SHA256/opaque ticket、会话/保留期/300秒最早期限、一次性消费和审计要求保留。
3. **G1-REC-01，撤权到路由的组合缺口。** 实际Command/Settings路由目前是HTTP快照、刷新/重连或最早期限重验。独立CommandFacts支持permission_revoked reducer，但路由与root layout没有挂接它；不能以reducer存在或API可返回SSE认定实际页面即时撤权。需验证真实授权事件/有界失效模型与跨标签、迟到响应、重连、私有投影清除和写入拒绝；正确性不能延期到发布。
4. **G1-REC-02，同候选完整旅程与审计证据未执行。** 本轮98项覆盖guard、最早期限、离线冻结、不重放、迟到lease/重载/卸载拒绝、CAS、未知结果重试幂等键、429、MFA/reauth/202后保留与重读；这是运行时/受控Node组合，未执行登录→Command→P15→P17→导出内容→权限拒绝/恢复的完整浏览器旅程，也未验证完整correlation/audit贯通。旧浏览器结果保持原SHA。

实际参考身份失效401在私有C17读取前停止；viewer缺audit:read时history403，不显示不完整快照。对拒绝语义的测试PASS不意味着成功链路已闭环。二进制复用先核验P17已冻结字节hash及其Rust源码树在本轮基线未变化，probe记录binaryBinding；未冒称新构建或目标服务部署。

## 可执行整改项

每项的验收产物、owner及执行条件均在[actions.json](./evidence/frontend-g1-gap-20261022/actions.json)记录；本轮没有自行关闭。

| ID | 优先级 | 缺口/任务 | Owner | 状态 | 验收条件 |
|---|---|---|---|---|---|
| G1-DEP-01 | P1 | 冻结G1功能候选与直接依赖适用范围 | FE/BFF owners + Codex | OPEN | 13项G1、26项FEP-1前提逐项登记当前阶段适用证据/原确认/输入差异；按受影响模块补组合，不机械重跑全部上游；必要阶段评估完成后才能申请READY。 |
| G1-CONF-01 | P1 | P15原完整稿尚待独立确认 | ProjectUser confirms; Codex records and validates | AWAITING_PROJECT_USER | 用户明确确认UI-P15原稿与工程7bb249d8范围后，保存原始答复并执行独立确认门禁。已确认其他原稿不重复索取回执。 |
| G1-DL-01 | P0 | 参考provider租约与真实内容消费链未闭环 | BFF + FE download contract owners | OPEN | 参考实现签发符合明确issuer/content-origin策略的短链，提供实际文件内容及审计，原字节provider→generated consumer成功；过期/撤销/篡改/跨scope/重复消费/Storage失败后重取新链有用例。不能在测试桥重写URL。 |
| G1-DL-02 | P0 | live terminal-origin与消费者BFF-origin限定需统一 | BFF + FE + deployment configuration owners | OPEN | 明确单origin反向代理或受信内容origin配置方案，写入C10/C17契约/环境模板并测试相同与分离origin、协议/userinfo/query/hash、TTL=min(session,retention,300s)、opaque ticket；禁止任意跨域放行。 |
| G1-REC-01 | P0 | 撤权事件到实际路由失效的组合证据不足 | Identity/BFF + FE route owners | OPEN | 同一候选验证授权stream或经明确评审的有界快照失效策略，跨标签/迟到响应/重连/最早会话期限均停止私有投影与后续写入；不能只凭独立reducer测试声称路由已接入SSE。 |
| G1-REC-02 | P1 | 完整本机G1业务旅程与审计/恢复矩阵尚未冻结执行 | FE + BFF + QA | OPEN | 同一候选实际UI/Auth/BFF组合覆盖登录→Command→P15变更→P17历史→导出内容→401/403→重连，核验correlation审计、CAS/幂等、未知结果、429、202受理后重读及不重放；端口替代清楚标注。 |
| G1-ENV-01 | P1 | Firefox与WebKit拦截附件接收及人工可访问性保留 | QA/browser environment owner | BLOCKED_ENVIRONMENT | 在获准环境取得Firefox关键功能与WebKit实际内容端点附件字节证据；保留旧启动/下载事件失败；另行执行人工读屏和原生200%。 |
| G1-TARGET-01 | P1 | 核心服务当前阶段与目标端口证据缺口需单独组织 | Core F06/F09 + provider/environment owners | NOT_RUN_AUTHORIZED_ENVIRONMENT_REQUIRED | 按实际授权非生产环境核对F06身份/权限与F09审计/错误/恢复必要功能证据，保留历史只读失败与无实际tick；完整部署、性能、长稳和远程同SHA CI仍按RELEASE矩阵组织。 |

顺序建议：先执行G1-DL-01并同步G1-DL-02的封闭origin契约，用离线reference实现可消费内容及拒绝/恢复；随后按G1-REC-01/02做同候选路由与权限/审计组合。P15原稿确认只能由用户独立给出，不能由本任务执行指令代替。G1-DEP-01在实际受影响模块上更新阶段适用性，不要求为每项整改机械重跑全部上游。完整部署、性能、长稳、跨OS发布矩阵和远程CI仍由RELEASE收口。

## 实际测试与门禁

最终attempt-03六条限定命令全部exit0；**98/98测试，7文件，零skip**：5项新probe（3项实际Rust reference拒绝/读取、2项合成origin消费者模板）+93项既有直接运行时/平台回归。34项审计门禁负向、17项确认规程回归、计划结构、ESLint均通过。没有执行新浏览器、构建、目标数据库、全仓coverage/campaign或递归依赖Gate。

| 检查 | 实际命令 | 结果 | 记录 |
|---|---|---|---|
| historical-audit | `node docs/audit/evidence/frontend-g1-gap-20261022/audit.mjs --inventory docs/audit/evidence/frontend-g1-gap-20261022/attempt-03/dependency-audit.json` | exit 0 | [日志](./evidence/frontend-g1-gap-20261022/attempt-03/historical-audit.log) |
| bounded-probes | `pnpm exec vitest run docs/audit/evidence/frontend-g1-gap-20261022/probes.test.ts apps/terminal/tests/ui-p17-runtime.test.ts apps/terminal/tests/ui-p15-runtime.test.ts apps/terminal/tests/browser-platform-provider-consumer.test.ts apps/terminal/tests/ui101-source.test.ts apps/terminal/tests/ui101-runtime.test.ts apps/terminal/tests/ui104-runtime.test.ts --reporter=verbose --reporter=json --outputFile=docs/audit/evidence/frontend-g1-gap-20261022/attempt-03/vitest.json` | exit 0 | [日志](./evidence/frontend-g1-gap-20261022/attempt-03/bounded-probes.log) |
| audit-negative | `node --test docs/audit/evidence/frontend-g1-gap-20261022/audit.test.mjs` | exit 0 | [日志](./evidence/frontend-g1-gap-20261022/attempt-03/audit-negative.log) |
| confirmation-policy | `node --test scripts/user-acceptance-confirmation.test.mjs` | exit 0 | [日志](./evidence/frontend-g1-gap-20261022/attempt-03/confirmation-policy.log) |
| plans | `node scripts/check-development-plans.mjs` | exit 0 | [日志](./evidence/frontend-g1-gap-20261022/attempt-03/plans.log) |
| lint | `pnpm exec eslint docs/audit/evidence/frontend-g1-gap-20261022/audit.mjs docs/audit/evidence/frontend-g1-gap-20261022/audit.test.mjs docs/audit/evidence/frontend-g1-gap-20261022/probes.test.ts` | exit 0 | [日志](./evidence/frontend-g1-gap-20261022/attempt-03/lint.log) |

复核：`node docs/audit/evidence/frontend-g1-gap-20261022/audit.mjs --verify`。其PASS只证明缺口账本、历史完整性、当前有界测试及不误提升门禁成立；G1/FEP-1仍不READY。首轮73/74：前一viewer并发响应落入后续invalid案例的完成日志，断言失败；按身份归属修复审计工具，原工具/JSON/日志保留。第二轮74项通过后，为直接核对CAS/未知结果/202补入24项相关回归，独立第三轮98项，不拼接通过。计划同步后的首次静态复核因checkpoint evidence误加docs/前缀失败；只修正两条相对docs的路径后，audit --verify和计划校验均exit0，见final-metadata-attempt-01.json与final-*.log。

## 保留项与验收边界

Firefox BLOCKED_ENVIRONMENT、WebKit BLOCKED_ENVIRONMENT_TEST_INTERCEPTION，附件接收仍NOT_RUN；本轮只核对原诊断证据，不声称环境恢复。真实环回附件诊断PASS不能替代拦截附件接收。原axe incomplete、首次P17预检日志覆盖局限、P15待确认和所有历史失败仍保留。[NOT_RUN账本](./evidence/frontend-g1-gap-20261022/retained-not-run.json)逐页保留原字段，另记完整G1/FEP-1旅程及目标只读状态复查NOT_RUN。

真实IdP/MFA/DB/Storage、Cookie/CORS、目标headers/privacy、持久撤销、原生通知/原生200%/人工读屏、真实设备/跨OS、远程同SHA CI、性能/容量/长稳及发布均未执行。原有内部Research、授权/许可证、交易模式及风险限制不扩大。无生产凭据读取、无本地PostgreSQL/Supabase服务、无推送或部署。

本次不申请G1人工验收，不将gap-review当正式确认稿；Codex核对工程事实，用户既有确认只作用原稿。六维结论：Product业务旅程未闭环；Frontend路由仍快照/环境边界保留；BFF下载契约需统一；QA当前有界测试有效但完整组合缺失；Security拒绝与原授权边界保留；Risk不授阶段/运行/发布准入。

**下一可执行任务：G1-DL-01 / G1-DL-02，本机reference下载内容链与封闭origin契约整改。** 完成后再组织恢复/撤权及同候选G1组合，不越过G1直接宣称I2已获联调放行。独立功能开发仍按分阶段规程和自身授权开展。
