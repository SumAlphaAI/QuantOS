# A1 / BFF-FE-000 整改与复验报告

> 日期：2026-10-03；依据：[原全面复审](./BFF-FE-000-comprehensive-review-2026-10-03.md)第 4 节；前端计划 v3.15。
> 源码父基线：`75a563c62d3d7883d5b178111becec07d4da0301`；本次源码与证据随本报告一起提交，精确文件摘要见 [manifest](./evidence/bff-fe-000-remediation-20261003/manifest.json)。
> 结论：**13 项工程问题已整改，B-01 保持未验收；PROVIDER:A1 / 正式 G0 未放行。** 用户于本轮明确确认 staging 与联合签署资料“尚未具备”。

## 一、任务完成概况

按原报告顺序完成：数据保真与 SSE → 安全/错误/分页/追踪/版本契约 → 兼容性与语义门禁、mock/provider harness、领域转换和逐 operation 规格 → 活跃文档同步。最后为 B-01 提供可执行回执校验与规程，未代签、未编造目标环境证据。

当前 API 1.4.0 仍为 62 个 published、46 个 planned、51 个组件 schema；17 契约/22 页命名覆盖不变。新增同源 Rust 输入策略后生成资产为六项，全部纳入字节漂移检查。原报告、旧缺陷探针及历史验收记录保留原文；旧探针刻意断言缺陷，整改后的正确行为由新增回归验证。

本地参考 provider 的真实 HTTP 校验覆盖 C01/C17/C10 已实现的 26 个 operation，不要求 A1 提前交付 A3–A6 的 planned 实现。此模式使用内存、合成会话，不涉及真实 IdP、存储、Supabase 或 staging。本次没有启动本机数据库或 Docker，也没有执行 Supabase 数据库验收。CI 已接入工程检查，本轮未推送，未取得新提交对应的远端 CI 回执。

安全 required 条件修正属于兼容性变化。按 [ADR](../adr/ADR-A1-security-contract-correction.md)登记 1.3.0→1.4.0 的逐项差异/哈希与工程准入有效期（2026-11-03）；不授权生产启用或替代正常 `/v2` 破坏性发布规则。缺可信历史基线、未登记差异、相同版本破坏或过期登记均被拒绝。

## 二、完成情况明细统计

| 统计口径 | 当前结果 | 边界 |
|---|---:|---|
| 原 14 项问题工程闭环 | **13/14 = 92.86%** | 6 高危、6 中危、1 低危关闭；1 阻塞开放 |
| 当前可执行工程整改 | **13/13 = 100%** | 不将缺外部环境/签署折算为代码完成 |
| 严格任务验收 | **0/1 = 0%** | B-01 未关闭，当前提交不能继承旧阶段回执 |
| 原 C01–C23 工程控制点 | **22/23 = 95.65%** | 22 PASS；C01 新源码的 P0 同 SHA 准入须重新取得，记 PARTIAL |
| 原 C01–C24 全部控制点 | **22/24 = 91.67%** | 22 PASS、1 PARTIAL、1 NOT_RUN |
| 生成资产一致性 | 6/6 | TS/Zod/JSON Schema/MSW/manifest/Rust 输入策略 |
| 命名覆盖 / operation 发布 | 17/17 契约、22/22 页；62/108 发布 | 46 planned 合法递延，非 A1 未修问题 |

原 C01 包含 P0 当前 HEAD 回执。原父 SHA 在审计开始前曾验证 PASS；源码修改后工作区及后续新提交均不能继承。当前 `pnpm check:p0` 拒绝准入是符合预期的 fail-closed 行为，不应为了提高完成率修改 P0 校验器或伪造同 SHA F06 回执。PRE-01/PRE-04/PRE-06、核心任务状态与交叉计划静态检查已继续验证。

| 控制点 | 复验结果 | 主要依据 |
|---|---|---|
| C01 依赖与 P0 同 SHA 准入 | PARTIAL | 依赖/准备 Gate 通过；原回执只覆盖父 SHA，新提交待独立回执 |
| C02–C05 版本、命名、页面、Cookie/client | PASS | 精确源/catalog/manifest 集合与 client 单元测试 |
| C06 错误模型 | PASS | 62 default；闭合 ErrorEnvelope；VERSION_CONFLICT 条件必需 currentVersion、429 必需 retryAfter |
| C07–C08 分页与 sort/filter | PASS | 9 列表实际字段/operator 白名单；证据链固定因果顺序并明确 N/A；Rust 执行/拒绝表达式回归 |
| C09–C12 安全、幂等、对象版本、追踪 | PASS | 认证写 CSRF、22 业务写请求 ID/幂等；闭合输入与审批 recent-auth；ETag/header/error body 校验 |
| C13 SSE | PASS | schema/version 先验、Cookie、网络/5xx 退避、lastSequence 回补、401/403/事件撤权终态；关键状态分支 100% |
| C14–C16 生成与领域一致性 | PASS | 开放对象数据保真、实际 Proto 二进制/JSON 精度测试、UTC 纳秒精度、枚举差异、受信 metadata/字段裁剪 |
| C17–C20 harness、敏感字段、漂移、兼容 | PASS | MSW 请求/响应校验；26 operation 真实 HTTP；六项生成漂移及历史差异门禁 |
| C21–C22 单元/契约/参考 provider/负向门禁 | PASS | 原回归保留；原七类误放行输入被拒绝；六个风险政策文件逐文件 100% |
| C23 逐 operation 规格与活跃文档 | PASS | 62 policy/成功示例、全部正文请求示例；当前统计与 ADR/规程同步 |
| C24 staging/当期 G0 联签 | NOT_RUN | 用户确认尚未具备；回执 Gate 返回 NOT_ACCEPTED |

本地执行清单与退出码见 [commands.json](./evidence/bff-fe-000-remediation-20261003/commands.json)，原始输出按命令单独保存；首次发现同步缺口的失败日志保存在 attempt-1，参考响应敏感 key 的首次失败保存为 initial-provider-failure.json，不覆盖历史失败。

| 验证 | 结果 | 证据范围 |
|---|---|---|
| `make bff-contract-check` | PASS | 兼容 + 新安全/语义回归 + OpenAPI/漂移/覆盖 + 原 A1/A2 Gate |
| 新语义/兼容/回执负向测试 | 14/14 PASS | 原七类退化、CSRF、未登记约束、过期/缺基线、无效/篡改回执 |
| 原 A1 正负向测试 | 8/8 PASS | 删除共享组件返回 FAIL，保持结构化门禁结果 |
| contract / MSW | 24/24 PASS | 合法样例、伪造输入、错误扩展、correlation、CSRF、幂等重放/冲突 |
| API-client 单元 | 59/59 PASS | 实际 Proto 转换及 SSE HTTP/故障恢复 |
| Rust 参考 provider | 13/13 PASS | Auth/Settings 8、Audit/Export 5；无 DB |
| 真实 loopback HTTP | 26 个 operation，28 次请求 PASS | 同源请求/响应 schema/header 与恶意 actor 422；业务正常请求均成功 |
| Web 覆盖 + 关键风险覆盖 | PASS | 全 Web 224 测试、行覆盖 82.43% ≥80%；关键策略 165 测试、六政策文件逐文件 statements/branches/functions/lines 均 100% |
| Rust fmt/clippy；workspace lint/typecheck；锁文件 | PASS | 固定 Node 24.12.0 / pnpm 10.20.0；未新增 JS 依赖 |
| PRE-01/04/06、计划与 G0 治理 | PASS | 工程/治理一致性；G0 状态仍 NOT_STARTED |
| staging / 当前 P0 准入 | EXPECTED_NOT_ACCEPTED | 明确拒绝当前未满足的阶段准入；不算验收通过 |

## 三、问题清单及风险分析

| ID / 等级 | 所属模块 | 整改与正确行为 | 影响及剩余风险 | 状态 |
|---|---|---|---|---|
| H-01 高危 | 生成器/Zod | 开放对象 passthrough、显式闭合对象 strict；payload/parameters 深层数据原样保留 | 所有生成消费者；禁止手改生成文件 | CLOSED |
| H-02 高危 | API-client/SSE | 校验 frozen v1/1 envelope，Cookie include；网络/5xx 有界可中断退避；错误版本不 ACK、不应用；权限终态 | 跨域 CORS/Cookie 与真实 staging 撤权仍待目标验证 | CLOSED（工程） |
| H-03 高危 | OpenAPI/参考输入策略/前端 gateway | 认证写声明 CSRF；业务写必需 UUID X-Request-Id；正文闭合；审批 reauth 必需；客户端同步 | 旧不安全请求被拒绝；高风险服务端业务授权仍由 owner/staging 验收 | CLOSED（工程） |
| H-04 高危 | 兼容 Gate/CI | 可信 Git full SHA diff；逐条基线/候选值摘要登记；新 required/enum/边界约束、删接口、变类型被拒绝 | 本次工程安全修正不表示生产兼容；到期需另行决策 | CLOSED |
| H-05 高危 | A1 Gate/CI/风险覆盖 | 精确页面/owner、类型/required、每 operation 策略/实例、活动 YAML job/step；原七种退化均 FAIL；新增 SSE 状态政策加入 100% 清单 | 新提交远端 CI 尚未执行；本地 PASS 只证明当前源码 | CLOSED（工程） |
| H-06 高危 | MSW/provider harness | Cookie 契约一致；请求头/正文/CSRF/幂等与返回 status/header/schema 校验；26 接口实际 HTTP | 未实现 resolver 仍 501；完整真实 provider 需外部回执 | CLOSED（工程） |
| M-01 中危 | 分页/审计 | 9 个列表挂 sort/filter 与真实资源字段白名单；审计实际执行、非法表达式 422；证据链明确 N/A | 后续 provider 实现不得静默忽略已声明表达式 | CLOSED |
| M-02 中危 | 错误模型 | 全 62 发布安全 default；VERSION_CONFLICT 必需 currentVersion，429 必需 retryAfter；拒绝 debug 扩展 | 未知代码由既有消费策略 fail closed；不虚构所有 409 都是版本冲突 | CLOSED |
| M-03 中危 | 追踪/响应 | 成功、错误、204、stream 均声明 correlation/cache header；危险 RiskView 要求 body correlation；错误 body/header 一致受检 | 流中每业务事件 correlation 可不同于握手请求；实际审计关联由目标环境复验 | CLOSED（工程） |
| M-04 中危 | Settings/Draft | GET/写响应 ETag；If-Match/version conflict；保留原双客户端陈旧版本与幂等测试 | 真实多进程并发/数据库隔离不由内存测试证明 | CLOSED（工程） |
| M-05 中危 | Proto/BFF 转换 | Decimal/Money exact-string/int64；实际 protobuf 序列化与 UTC 纳秒；显式 mode/environment/quality/action/status 差异映射；未知/不支持枚举拒绝；服务端 metadata 注入与字段裁剪 | 页面聚合不强行等同 Proto；完整各域转换由 owner 后续集成验收 | CLOSED（基线） |
| M-06 中危 | operation 规格 | 每 operation 直接 request/success example 与 auth/capability/paging/cache/freshness/idem/version/audit/limit/recovery/sensitive policy | 配额由 provider 配置，不声称线上的 QPS 已验；N/A 有理由 | CLOSED |
| L-01 低危 | 活跃文档/计划 | 摘要、方案、PRE 关联、数量、1.4.0 与整改/ADR 索引同步；历史证据未修改 | 原历史报告仍是旧基线，阅读当前结果应走本报告 | CLOSED |
| B-01 阻塞 | PROVIDER:A1 / G0 | 增加 source/input/真实证据哈希/七角色组织回执 Gate 与操作规程；缺资料必须拒绝 | 尚无真实 staging、当期签署与新 SHA 回执，仍禁止阶段放行 | OPEN / NOT_RUN |

参考 HTTP 反校验另发现 seed 审计 redactedPayload 中仍有 secret key，即使其值为 [REDACTED] 也违背禁返规则。本轮删除该 key，改为 redactionSummary，并通过递归敏感字段扫描及 Rust 回归；未放宽扫描器。

行覆盖率不能替代风险状态行为证明。本轮把 SSE 状态策略独立为 sse-contract.ts 并纳入不可缩减的关键政策清单；迟到但 eventId 未见的事件不降低 ACK、撤权后事件不应用等行为均覆盖。整个 SSE 网络重试模块和真实目标环境的可靠性不因这个 100% 数值自动验收。

## 四、整改建议与剩余验收步骤

1. 用户/环境 owner 准备真实 staging 地址、受信会话及测试角色、可用业务资源；不在仓库记录凭据。按 [回执规程](../BFF-FE-000-openapi-proposal.md#验收回执)验证七类目标行为，并保留脱敏日志与 requestId。
2. 固定本次提交 SHA，分别重新校验 P0 准入与所需同 SHA F06 回执；不得使用父 SHA 证明新提交已通过。任何 DB 验证只连接工程已配置的 Supabase PostgreSQL，静态检查与实际执行分别登记。
3. 收集当期 Product/Frontend/BFF/QA/Security/Risk/Domain 签署及对应文件哈希，再运行 `pnpm check:bff-a1-acceptance`。回执校验记录组织确认，不提供公钥签名真实性认证；签署身份的真实性须由组织复核。
4. 新提交推送后核验对应远端 CI；本轮仅生成本地 Git 提交，不推送、不部署。完整目标证据复核通过后才能更新 PROVIDER:A1/G0 的 source_commit/evidence/status。
5. 2026-11-03 前由 BFF/前端 owner 处理兼容准入到期与迁移。后续 published/planned provider 和页面 Gate 保持各自责任，不由本次工程修复提前关闭。

证据重放：`python3 docs/audit/evidence/bff-fe-000-remediation-20261003/run-checks.py`。最后两项应为 EXPECTED_NOT_ACCEPTED；它们表示未验收，不能解释为阶段 PASS。不同执行时点和新增提交的门禁输出需独立保存。
