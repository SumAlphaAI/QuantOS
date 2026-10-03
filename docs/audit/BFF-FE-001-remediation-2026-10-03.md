# BFF-FE-001 整改与复验记录（2026-10-03）

## 一、完成概况

依据 [原始全面复审](BFF-FE-001-comprehensive-review-2026-10-03.md) 的顺序，先修参考业务与 consumer，再交付真实 Supabase 上的 live provider，最后修执行 Gate、当前文档入口和关联 CI 根因。**15/15 工程问题已修复，X-01/X-02 两项 CI 根因已整改；20/20 A2 operation 完成现有 Supabase Auth/PostgreSQL + 本机 live BFF 联调。**

基线为 `28deabe961404fcde35791ea757b352c79e558fa`；修复提交是包含本记录的 Git 提交。代码内容绑定见 [source-inputs.json](evidence/bff-fe-001-remediation-20261003/source-inputs.json)，本地执行证明见 [semantics.json](evidence/bff-fe-001-remediation-20261003/semantics.json)。预提交联调回执明确保留 `sourceTreeClean=false`，不能将它声称为干净基线或正式 staging 签署。提交后 P0/F06 必须重新执行，回执以该新 SHA 的 `refs/notes/p0-acceptance`、`refs/notes/f06-acceptance` 保存；历史 28deabe 回执不自动迁移。

当前契约为 API **1.5.0 / 62 operations / 52 schemas**。新增的是可选 MFA 注册材料、方法能力和首因素注册引用，相对 28deabe 没有破坏性变更；历史 A1 69 项安全修正继续逐项校验 digest。参见 [实施 ADR](../adr/ADR-A2-live-auth-settings.md)。

## 二、完成情况明细统计

沿用原报告 R01–R24 的等权口径，PARTIAL 不折算通过。机读清单见 [remediation-status.json](evidence/bff-fe-001-remediation-20261003/remediation-status.json)。

| 项目 | 整改前 | 本次工程复验 |
|---|---:|---:|
| 工程问题关闭 | 0/15 | 15/15，100% |
| 关联 CI 根因 | X-01/X-02 未处理 | 2/2 已整改；新 SHA 托管 CI 待发布后执行 |
| 完整控制点 | 6/24，25% | 23/24，95.83% |
| PARTIAL / FAIL | 7 / 11 | 1 / 0 |
| live operation 覆盖 | 3/20，15% | 20/20，100%，43 条请求 |
| 严格任务正式验收 | 0/1 | 0/1；staging/签署与正式检查点独立 |

| 控制点 | 复验结果 | 对应证据 |
|---|---|---|
| R01–R03 | PASS | OpenAPI、生成漂移、C01/C17 owner/Page/任务边界 |
| R04–R07 | PASS | 真实 live 路由、会话、资料与偏好写读、重启后持久化 |
| R08 | PASS | If-Match / 409 / currentVersion；不同意图冲突 |
| R09–R11 | PASS | pending 不计失败；挑战用途/会话/时间/一次消费；验证前冷却；新鲜 grant |
| R12–R15 | PASS | live CSRF、CORS、logout、匿名申请、实际设置读取、当前会话/最后因素保护 |
| R16–R19 | PASS | 幂等副作用一次、correlation 一致、持续 SSE 与目标会话失效、401/403/404 |
| R20–R22 | PASS | 同源运行时校验、错误恢复元数据、真实语义 mutation 与有效 CI run 检查 |
| R23 | PARTIAL | 接线及本地 Rust/Python/frontend/契约检查已通过；当前 SHA 托管 CI 尚无回执 |
| R24 | PASS | 当前总结、版本/清单/活跃证据检查；历史记录保留 |

关键执行证据如下；完整命令与文件摘要见 [证据目录](evidence/bff-fe-001-remediation-20261003/README.md)。

| 验证 | 结果 | 实际范围 |
|---|---|---|
| `make bff-contract-check` | PASS | 完整 A1/A2/Audit 结构、生成、语义与负向 Gate |
| auth/settings Rust | 12/12 PASS | reference：写读、幂等、冷却、过期挑战、单次消费、双会话持续流 |
| auth/settings consumer | 23/23 PASS | 成功/错误运行时响应；空 session 中止后续请求；401/403/409/429/503 恢复信息 |
| Terminal / contract | 79/79、25/25 PASS | 客户端单元与 fixture/HTTP validator；成功 correlation 破坏必须拒绝 |
| reference HTTP | 28 records PASS | C01/C17/C10 harness；只有其中 20 个 operation 属于本任务分母 |
| live Auth/PostgreSQL | 43 records PASS | 真实 TOTP 注册/验证/吊销、profile/prefs、幂等、SSE、非空元数据、预检和 CSRF；测试因素已恢复 |
| A2 负向检查 | 22/22 PASS | 陈旧执行证明、注释/禁用 CI、缺失当前文档、契约字段与依赖回退等 |
| 实际语义 mutation | 3/3 拒绝 | 独立临时源码及编译目录：取消最后因素保护、取消 CSRF、挑战 TTL 一年，均使对应业务断言失败 |
| F09 迁移负向 | 4/4 PASS | 后续合法迁移可前进；缺文件、缺前置迁移、改 SQL 摘要必须拒绝 |
| Supabase 迁移/授权 | PASS | 38 份迁移逐项匹配；10 张新表强制 RLS；BFF 无 Vault 原始读取/审计更新删除/会话主体更新权限 |
| 全仓规范 | PASS | Ruff 779→0、Pyright 0 errors、Rust fmt / workspace clippy、frontend lint/typecheck、四类锁文件 |
| PRE-04/06 | PASS | API 1.5.0 / 52 schemas 同步；字段字典 413 行；正向与负向均重放 |

普通 `cargo test` 未设置目标数据库开关时，PostgreSQL/F09 条件用例会直接返回，**不能作为数据库验收证据**。真实数据库证据限于本表单列的 Supabase 联调、迁移授权和提交后 F06 target 回执。未在本机安装或启动 PostgreSQL、Supabase、本地容器或临时数据库。

## 三、问题关闭清单与风险分析

| ID / 优先级 | 所属模块 | 修复及影响范围 | 复验依据 |
|---|---|---|---|
| B-01 / 阻塞 | live C01/C17 | 补齐原缺失 17 路由；使用真实身份、受限 BFF DB、持久化资料/偏好/安全状态/事件 | live 20/20；重启与非空元数据读回；迁移授权 |
| H-01 / 高危 | profile/prefs | 保存全部合法输入；版本与幂等响应原子写入，随后读取保持一致 | reference roundtrip；live PUT→GET 与重启 |
| H-02 / 高危 | 幂等命令 | 绑定主体、operation、资源及完整意图；同 key 不同意图 409；跨 operation 隔离 | Rust scoped intents；live profile/prefs 复用 key 与不同输入 |
| H-03 / 高危 | MFA/device/session 变更 | 副作用前查重；上游 MFA checkpoint + 确定名称；返回同一 job/audit；撤销重放 202 | Rust single side-effect；真实因素计数、setup/revoke 重放 |
| H-04 / 高危 | challenge/reauth | 绑定主体/session/purpose；五分钟有效期；验证时间限制；原子消费一次；grant 不延长挑战寿命 | 可控时钟后续续会话验证过期 challenge 403；单次消费；真实 TOTP→reauth |
| H-05 / 高危 | MFA limit | 先检查冻结再验证 code；受控主体/会话窗口；五次失败、60 秒冷却恢复 | 冻结期间正确 code 429；冷却后恢复 |
| H-06 / 高危 | session SSE | 持续订阅/游标；其他会话发送列表变化；目标订阅 permission_revoked 后结束；每次推送复查授权 | Rust 双订阅实时性；live 目标 401 与当前订阅保持可用 |
| H-07 / 高危 | auth/settings consumer | 从 operation responses 生成 runtime schemas；成功及错误同源校验；无效 session 阻止后续七项请求 | 缺 challengeRef、空 session、错误成功类型、畸形错误字段负向 |
| H-08 / 高危 | A2 Gate / CI | 执行实际业务回归并绑定源文件 digest；解析启用的 YAML run；Make recipe 必须执行；实际 mutation 独立编译 | 22 个负向与 3 项实际 mutation；完整 Make Gate |
| M-01 / 中危 | live CSRF/CORS | 签发 CSRF cookie；校验 Origin/cookie/header/数据库摘要；补 PUT/DELETE 和必需 headers | 无 token logout 403；预检允许 PUT/CSRF/版本/幂等 headers |
| M-02 / 中危 | response/validator | 统一所有含 body correlationId 的响应 header；成功重放和共享 evidence-chain 同样校验 | HTTP 故意错配成功 envelope 必须失败；28 条 HTTP harness |
| M-03 / 中危 | settings errors | 保留校验后的 status/code/currentVersion/correlationId/retryAfter，畸形元数据全部丢弃 | 401/403/409/429/503 以及错误版本字段测试 |
| M-04 / 中危 | reference session | TTL 来自可控时钟，输出/鉴权一致；过期后 401，fixture 续期不续期挑战 | 时间推进、过期会话拒绝、logout 与撤销 |
| M-05 / 中危 | MFA initiation | 无 code 发起 pending；只有实际错误验证才计失败 | schema 示例发起与限流回归；真实 Auth pending |
| L-01 / 低危 | 活跃验收入口 | 当前 summary/版本/operation/schema/证据必须一致；历史 9/16 内容保留并标明历史 | 新基线检查、删当前证据/旧版本负向 |
| X-01 / 关联 CI | Python 审计脚本 | 修复 43 文件的 779 Ruff 项，无目录排除；原始字节副本和摘要保留；Secret scan 对新增四项摘要逐项重算并仅豁免精确值 | Ruff 0；文档化 import/lambda 转换后的 AST 等价；Pyright 0 |
| X-02 / 关联 CI | F09 target ledger | 删除“最后文件永远是 F09 迁移”的错误假设；仍要求完整排序、全部摘要及 F09 前置迁移 | 4 类 ledger 用例；现有 Supabase 38 份迁移匹配 |

剩余验收风险按实际范围记录：

1. 真实 staging consumer/provider、浏览器 cookie/CSP/代理行为与联合签署延至 FINAL；此次不提前要求，也不冒充已通过。PROVIDER:A1/G0/A2/G1、完整页面和 Desktop 保持各自正式 Gate。
2. live 已启用真实 TOTP；方法能力明确返回仅 `authenticator`，未启用 passkey 请求返回 422。实际 WebAuthn 与浏览器集成不在本次 Supabase TOTP 回执中。
3. Auth proof 不持久化；重启后安全/MFA 操作需重新 bridge，返回可分流的 `AUTH_REFRESH_REQUIRED`。部署到多实例需验证 sticky routing/重新 bridge；资料、会话、幂等与游标已持久化。
4. 上游 Auth 与 PostgreSQL 不共享事务。命令 checkpoint 可恢复单次因素副作用；一次性注册 URI 重放不重新泄露，必要时取消未验证注册后重试。联调曾出现真实上游超时，失败回执保留；测试按命令引用清理自己创建的因素并恢复原因素集合。
5. X-01/X-02 根因关闭不等于全仓远端 CI、F09 overall ACCEPTED。当前 SHA 发布后仍须下载并核对托管 CI/Nightly 证据；F09 `f09Accepted=false` 保持其独立语义。

## 四、后续整改与放行建议

本报告已无未修复的工程缺陷，可以进入独立代码复审与新 SHA 的开发基线复验。提交后重新执行 P0 的 39 项命令/六浏览器 135 场景、F06 实际 Supabase/Auth/Runtime/Execution/Vault/PostgreSQL，再生成绑定同一 SHA 的 Git notes。源码与 notes 的远端发布授权、托管执行和回执分别核验，不能复用旧 28deabe 的 PASS。

后续任务仍按结构化依赖检查：BFF-FE-007 依赖 CORE:F05 与 PROVIDER:A1；本次工程整改不代为关闭该正式前置。最终 ACCEPTED 仍需最终环境、对应 review 与签署。历史复审中的原失败证据不覆盖或删除，本次证据另目录保存。
