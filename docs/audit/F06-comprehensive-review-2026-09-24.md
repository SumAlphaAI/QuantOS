# F06 身份、授权、秘密引用与主上下文全面复审

> 后续验收边界修正：本报告的历史检查结果和 `3/18` 统计保持原样；将 Terminal 浏览器、MFA 页面及全部页面 API 当作 F06 Gate 的建议，已由 [F06 Gate 边界修正](./F06-gate-scope-correction-2026-09-24.md)取代。

> 复审日期：2026-09-24
> 审查基线：`8e5711baa97eb802c14b8e9ac5b50a51300dacfe`（审查开始时工作树干净）
> 范围：`docs/SumAlpha-QuantOS-Development-Plan.md` F06、相关 Rust 服务/库、Supabase migrations、数据库 Gate、BFF 参考 provider 与定向测试。未连接目标 Supabase 或真实 OIDC。
> 结论：**不通过 F06 完整验收**；计划中的 `development_status: COMPLETED` 表示开发声明，不等于本次复审结论。

## 一、任务完成概况

F06 已有 `quantos-auth`、`quantos-policy`、身份映射 migration、RLS 基线、短时服务会话元数据和两条秘密引用函数。`quantos-policy` 的局部规则及静态数据库检查可重放。但尚无从真实 Supabase Auth/OIDC 会话到 BFF/运行时鉴权、再到受限执行角色及 Vault 解密的闭环；多处租户、模式与能力约束存在源码级缺口。不能把独立库、参考 provider 或静态 migration 当成正式服务能力。

**完成率口径**：按下表 18 个互不重复的 F06 检查点等权统计。`完成`须有可用实现及相应本地证明；`部分`表示有代码但链路或关键约束缺失；`未完成/未验收`表示无实现或无必需执行回执。完成 3/18 = **16.7%**，部分 10/18 = **55.6%**，未完成/未验收 5/18 = **27.8%**。若只用于估算开发进度，部分按半项计为 (3 + 10×0.5)/18 = **44.4%**；此估算不代表安全验收通过。全部量化目标均未取得本 SHA 的 F06 专项目标环境回执。

## 二、完成情况明细统计

| # | 需求/交付/验收点 | 状态 | 当前证据与边界 |
|---|---|---|---|
| 01 | `auth.users` 用户主锚点 | 完成 | `actors.user_id` 外键，且未发现另建密码表；[migration](../../supabase/migrations/20260730110000_auth_policy_context.sql)。 |
| 02 | Supabase Auth/OIDC 已验证会话进入正式服务 | 未完成/未验收 | `UserRequestContext` 直接接收 user/tenant/mode/account；BFF 是固定 cookie 的 loopback 参考 provider，未调用 `quantos-auth`；[auth](../../crates/quantos-auth/src/lib.rs)、[BFF](../../services/bff-gateway/src/lib.rs)。 |
| 03 | actor/member/workspace/account 一致映射 | 部分 | 表与查询存在；跨表 tenant 一致性未由组合外键/查询全部保证，见 F06-A03。 |
| 04 | tenant/actor/account/mode 主上下文可信生成 | 部分 | `AuthContext` 有字段，`mode` 等由调用者提供；未绑定会话声明或账户 mode，见 F06-A02/A04。 |
| 05 | 一期固定 Primary workspace 且无切换 API | 部分 | 查询选 `is_primary=true`、唯一索引限制至多一个；未保证每 tenant 必有 Primary，亦未有正式 API 路由全量证明。 |
| 06 | RBAC 基本规则 | 完成 | `Role`、角色能力映射和局部拒绝测试存在；[policy](../../crates/quantos-policy/src/lib.rs)。 |
| 07 | capability 范围与越权拒绝 | 部分 | Rust 显式授权存在；SQL 函数在空 mode/account 参数时放宽条件，Owner 隐含所有 capability，见 F06-A04/A05。 |
| 08 | 默认拒绝及 RLS | 部分 | 36 表静态 ENABLE/FORCE/policy 检查通过；F06 身份负向矩阵和跨角色数据库执行未完成。 |
| 09 | Secret reference 元数据 | 完成 | `secret_references`、`execution_secret_refs` 及轮换字段存在；此项只计引用模型，不计 Vault 解密。 |
| 10 | Supabase Vault 静态加密秘密与真实解密 | 未完成/未验收 | 仓库中未发现对 `vault.secrets`/`vault.decrypted_secrets` 的受控读取、写入或目标环境回执；现有函数仅返回 `vault_path`/`vault_ref`。 |
| 11 | Execution Gateway 专用受控角色 | 部分 | `quantos_execution_gateway nologin` 在 migration 创建；未找到角色授予/受控连接或 Execution Gateway 实际调用，见 F06-A06。 |
| 12 | allowlist 秘密函数 | 部分 | 两函数有 GRANT/REVOKE；单参函数未过滤 `revoked_at` 且无服务会话约束，见 F06-A07。 |
| 13 | 短时服务会话与命令过期 | 部分 | 多参函数检查 session 过期/撤销；单参函数和执行命令未统一受该 Gate 约束。 |
| 14 | 轮换/撤销状态控制 | 部分 | 一条路径检查 `rotation_state='active'`；另一条返回已撤销引用，缺失真实轮换恢复证明。 |
| 15 | 鉴权中间件接入 | 部分 | `GatewayAuthMiddleware` 已实现，但 `runtime-gateway` 只在 dead-code builder 中构造；正式 BFF/Execution 入口未接入。 |
| 16 | 四类请求 100% 拒绝：缺 tenant/actor、越权、绕 RLS、Engine secret | 未完成/未验收 | 仅局部单测与可选 PostgreSQL 测试；没有覆盖四类的定量矩阵和目标回执。 |
| 17 | UI/Engine/普通 BFF/用户角色 100% 拒绝 Vault 解密视图与函数 | 未完成/未验收 | `db-cli.cjs` 只检查两条引用函数及一张引用表的部分角色 privilege，未检查 Vault 解密视图/函数，也未用四类实际角色执行负向测试。 |
| 18 | 鉴权读 P95 同区域 <100ms、开发机跨区域 <500ms | 未完成/未验收 | 可选 PostgreSQL 测试只采 20 次、默认只校验 <500ms；本次直接 Cargo 测试进程未加载 `.env.local` 中的 `DATABASE_URL` 而提前返回；无同区域/跨区域区分回执。 |

本次命令：`cargo test -p quantos-auth -p quantos-policy --locked` 报告 8/8 测试 PASS，其中 2 个 PostgreSQL 测试因**该次 Cargo 进程的环境变量**没有 `DATABASE_URL` 而提前返回，**实际数据库执行为 0/2**。项目根目录 `.env.local` 实际已配置 `DATABASE_URL`；此前说“未设置”未区分文件配置与进程环境，判断不准确。`Makefile` 会加载 `.env.local`，直接运行 `cargo test` 则不会自动加载。`node scripts/check-rls-baseline.mjs` PASS（36 表静态检查）；`node scripts/check-secrets.mjs .` PASS（仓库 secret-pattern）。这些初审结果不能推出 F06 的远端 RLS、Vault、OIDC 或延迟验收。F03/F05 已有独立审计，但不能替代 F06 专项回执。

## 三、问题清单及风险分析

分级原则：阻塞级=缺少验收必需闭环/证据；高危=在可达条件下可能跨身份、跨租户、跨模式或访问已撤销引用；中危=隔离或验收覆盖不足；低危=文档/诊断一致性。下列源码缺口为静态可证，实际攻击可达性仍须在隔离目标库用权限身份验证。

| ID/级别 | 模块 | 具体表现 | 影响范围与证据 |
|---|---|---|---|
| F06-A01 阻塞级 | OIDC/BFF/运行时 | 正式服务入口未将已验证 OIDC 会话绑定到 `GatewayAuthMiddleware`；BFF 参考 provider 使用固定 cookie 与固定上下文；runtime builder 未调用。 | 无法证明真实请求身份、主上下文及权限；[BFF](../../services/bff-gateway/src/lib.rs)、[runtime](../../services/runtime-gateway/src/main.rs)、[auth](../../crates/quantos-auth/src/lib.rs)。 |
| F06-A02 阻塞级 | Vault/Execution | 只建引用表/返回引用值，未见受控角色取得 Vault 解密秘密的实现；Execution Gateway main 只运行观测/打印健康状态，未接鉴权或秘密函数。 | F06 核心交付及四角色解密拒绝无法验收；[Vault migration](../../supabase/migrations/20260801120000_execution_secret_zone.sql)、[Execution main](../../services/execution-gateway/src/main.rs)。 |
| F06-A03 高危 | 身份 migration / Auth SQL | `workspace_memberships`、`actor_capabilities`、`execution_service_sessions` 等只对各 ID 做独立外键，未强制其 `tenant_id` 与 actor/workspace/account 一致；用户上下文查询也未限定 `wm.tenant_id`、`w.tenant_id`、`ac.tenant_id`。 | 错误或恶意写入跨租户关联时，可能把别的租户 workspace/能力映射进本租户请求；[migration](../../supabase/migrations/20260730110000_auth_policy_context.sql)、[查询](../../crates/quantos-auth/src/lib.rs)。 |
| F06-A04 高危 | 主上下文/模式 | `UserRequestContext.mode` 由调用者提供；查询未校验 `accounts.mode`；`authorize_action` 仅在调用者设置 `allowed_modes` 时限模式。 | 已有账户可能被带入不匹配运行模式，模式策略依赖每个调用方自律；[auth](../../crates/quantos-auth/src/lib.rs)、[policy](../../crates/quantos-policy/src/lib.rs)。 |
| F06-A05 高危 | capability / SQL helper | `Role::Owner` 对任意 capability 返回 true；`current_user_has_capability` 接受空 mode/account 并跳过范围条件，且未检查 capability 所属 actor/tenant 一致。 | 禁止能力、受限账户或模式的调用方若依赖这些宽泛入口，可能发生越权；[policy](../../crates/quantos-policy/src/lib.rs)、[migration](../../supabase/migrations/20260730110000_auth_policy_context.sql)。 |
| F06-A06 高危 | 专用数据库角色 | 角色为 `nologin`，仓库未见 `GRANT quantos_execution_gateway TO ...` 或受控 `SET ROLE`/连接配置；两函数 GRANT 给该角色，但其表/模式权限与服务接线未给出可执行证明。 | 受限角色可能无法在正式服务中取得引用；若改用高权角色，又会破坏最小权限边界；[migration](../../supabase/migrations/20260801120000_execution_secret_zone.sql)、[hardening](../../supabase/migrations/20260808150000_f0_gate_hardening.sql)。 |
| F06-A07 高危 | secret allowlist | 单参 `resolve_execution_secret_ref` 仅按名称查询，返回 `revoked_at` 但不排除已撤销值，也不检查服务会话、租户、capability、命令过期；多参函数与 Rust store 使用另一张引用表。 | 两条并行引用路径语义不一致，专用角色可得到撤销引用；[单参函数](../../supabase/migrations/20260801120000_execution_secret_zone.sql)、[多参函数](../../supabase/migrations/20260730110000_auth_policy_context.sql)。 |
| F06-A08 中危 | RLS/授权测试 | `live-rls` 检查 catalog 和部分引用权限，但未执行完整 F06 四类拒绝及 Vault 解密视图负向矩阵；PostgreSQL 测试在缺 URL 时返回成功。 | `100%` 拒绝指标没有分母/执行回执；[DB Gate](../../scripts/db-cli.cjs)、[测试](../../crates/quantos-auth/tests/postgres_auth_context.rs)。 |
| F06-A09 中危 | 性能验收 | 单个可选测试采样 20 次且默认阈值 500ms，没有同区域 100ms Gate、环境拓扑、样本量与回执绑定。 | 无法判断两种拓扑的 P95 是否满足规格；[测试](../../crates/quantos-auth/tests/postgres_auth_context.rs)。 |
| F06-A10 低危 | 状态治理 | 开发计划为 `COMPLETED`，F06 review 区仍 `NOT_STARTED`，下游 Gate 仅检查开发状态字符串。 | F06 易被下游误读为已完整验收；[计划](../SumAlpha-QuantOS-Development-Plan.md)、[依赖 Gate](../../scripts/check-bff-fe-001.mjs)。 |

风险最高的是身份来源未绑定正式会话、跨租户关系缺少数据库一致性约束，以及两套 secret 引用路径分叉。现有 PASS 仅证明局部代码/静态检查，不应据此开放真实交易凭据或把 F06 作为安全准入已关闭。

## 四、整改建议与复验顺序

1. **先收紧身份与数据模型**：以验证后的 Supabase Auth/OIDC 主体生成 `user_id/tenant_id`，服务端选择 Primary workspace；用组合唯一键/外键及查询谓词约束 actor、membership、workspace、account、capability、service session 的同租户关系，并做双租户错配写入/读取负向测试。
2. **封闭主上下文与能力**：mode 从经授权的账户/会话状态导出并核对账户 mode；对高风险动作显式要求 account/mode；列出 Owner 允许的 capability，SQL helper 禁止通过空参数绕过受限范围。
3. **合并 secret 路径**：确定唯一的 tenant/account 绑定的 allowlist schema 与函数；要求受控角色、有效服务会话、未过期命令、active rotation、未撤销值同时成立，再在该边界取得 Vault 静态秘密。给专用角色最小权限和可重放的连接/角色切换配置，不向 UI、Engine、普通 BFF 或 `service_role` 暴露解密路径。
4. **接入正式服务**：让 BFF 与 Execution Gateway 的实际路由调用身份中间件及 allowlist 函数，保留参考 provider 的明确隔离标识。禁止下游仅凭 `development_status` 宣称 F06 已验收。
5. **建立 F06 专项 Gate**：在隔离 Supabase/真实 OIDC 测试身份上，逐项枚举四类请求拒绝和 UI/Engine/BFF/用户角色 Vault 视图与函数拒绝，记录请求总数、拒绝数、角色及 SQLSTATE/HTTP 状态；加跨租户、跨账户、撤销/过期/轮换负向探针。分别记录同区域与开发机跨区域的鉴权读 P95，绑定部署环境、migration digest 和完整 `sourceCommit`。所有必需测试在缺凭据时应 `NOT RUN` 或 Gate 失败，不能计 PASS。

完成上述修复后重跑本地 Rust/静态 Gate，再获取同一完整 SHA 的隔离目标环境回执；只有所有 F06 量化项达到标准，才把复审状态改为 `ACCEPTED`。
