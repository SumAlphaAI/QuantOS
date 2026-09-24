# F06-A01/A08 本地续修记录

> 后续验收边界修正：本记录中正式页面 API、Terminal Origin 和浏览器 MFA 的待办，已由 [F06 Gate 边界修正](./F06-gate-scope-correction-2026-09-24.md)移出 F06 Gate；本地测试结果保持不变。

> 日期：2026-09-24。承接 [F06 续修记录](./F06-continuation-2026-09-24.md)。本记录只记本轮仓库代码和隔离库结果；不是正式目标环境回执，`review_status` 仍为 `FIX_VALIDATION`。

## 完成概况

| 问题 | 本轮已修复或验证 | 仍待完成 |
|---|---|---|
| A01 身份与正式 BFF | 签发 cookie 前要求唯一主账户上下文；已签发会话每次从数据库重载该主上下文，`X-Account-Id` 不能切换到另一账户。live 路由按未认证、禁止访问、隐藏账户、服务不可用区分状态，错误含 correlation ID 且禁止缓存。隔离库验证跨账户隐藏、服务端撤销。 | 独立 BFF 数据库登录、真实 Supabase/OIDC 测试身份、正式页面 API 的 capability/MFA/再认证/撤销链路及 403/404 目标 HTTP 复验。live router 仍仅挂载 F06 身份路由，参考 provider 不作为正式实现。 |
| A08 四类拒绝 | 新增 `make f06-denial-matrix`，隔离 PostgreSQL 上逐项执行缺 actor/租户、未授权 capability、跨租户 RLS 直读、Engine 调用 Vault 函数四类负向探针，**4/4 拒绝**。其中角色授予在回滚事务内完成。 | 真实 OIDC/BFF HTTP 请求矩阵、独立服务角色与目标部署的同一完整 `sourceCommit` 回执。当前 4/4 是数据库/中间件层证据，不等于正式服务 100% 请求拒绝验收。 |

## 检查结果

| 命令 | 结果 | 证据边界 |
|---|---|---|
| `cargo test -p quantos-auth -p bff-gateway --locked` | PASS | 代码测试；无 `DATABASE_URL` 的 PostgreSQL 测试打印 `NOT RUN` 后返回，本项不计数据库执行。 |
| `cargo clippy -p quantos-auth -p bff-gateway --all-targets --locked -- -D warnings` | PASS | 静态检查。 |
| `cargo fmt --all`、`git diff --check` | PASS | 格式检查。 |
| `make f06-denial-matrix` | PASS，4/4 | 使用 `.env.local` 的 operator/test `DATABASE_URL` 连隔离库；非独立 BFF/Execution 登录。 |
| `make f06-bff-session-check` | PASS | 隔离库人工插入 opaque session 元数据后，验证主账户绑定、跨账户拒绝、撤销后失效；不证明真实 OIDC 签发。 |

首次在默认沙箱运行 `make f06-denial-matrix` 时 DNS 被限制，未到 SQL；随后以获准网络权限重跑成功。未输出或提交 `.env.local` 秘密值。

## 风险与下一步

1. 在隔离目标修复严格 TLS 信任链，配置只能切换 `quantos_bff` 的登录、publishable key、Terminal Origin 和测试身份；以真实登录流程运行 live BFF。不能以 operator `DATABASE_URL` 代替。
2. 将 C01/C17 等正式页面路由接入真实服务提供者、会话与 capability 检查，并对 MFA、近期再认证、跨账户资源隐藏及会话撤销做 HTTP 负向矩阵。参考 provider 固定夹具不得挂入 live。
3. 对部署后的完整 `sourceCommit` 采集四类请求数量、拒绝数量、HTTP/SQLSTATE、角色及目标拓扑回执；随后再决定 A01/A08 是否关闭。当前无此回执，保持 `OPEN`。
