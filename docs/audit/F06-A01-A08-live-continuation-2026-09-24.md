# F06-A01/A08 隔离目标续修与 live BFF 验证

> 日期：2026-09-24。承接 [本地续修](./F06-A01-A08-local-remediation-2026-09-24.md)及[配置清单](./F06-BFF-setup-runbook-2026-09-24.md)。本记录对应提交前工作树；不作为已部署 Terminal、全部页面 API 或同一提交 SHA 的正式验收回执。未输出、提交或记录 `.env.local` 的凭据值。

## 完成概况

| 范围 | 本轮结果 | 边界 |
|---|---|---|
| 独立 BFF 登录 | 隔离 Supabase 项目已创建仅能切换 `quantos_bff` 的 `quantos_bff_login`；随机口令只写入被 Git 忽略、权限 `0600` 的 `.env.local`。严格 CA/主机名 TLS、角色隔离和身份表读取 Gate **PASS**。 | 不是 Execution Gateway 登录；未部署。 |
| 真实 Supabase Auth 测试身份 | 隔离 Auth Admin 创建专用用户，数据库映射唯一 tenant、active actor、Primary workspace 和 paper account；随机口令只存在 `.env.local`。服务端 publishable key 与 Admin API 只读预检均 HTTP 200。 | 邮箱/口令是 Supabase Auth 真实登录，未执行外部 OIDC provider 或 MFA AAL2。 |
| live BFF HTTP | 使用真实 Supabase access token、独立 BFF 数据库登录和 live router 运行 9 项请求探针：登录、缺 cookie、错误 Origin、无效 token、opaque cookie、会话、主上下文、跨账户隐藏、服务端撤销，**PASS**。 | `Origin` 使用明确标识的合成 HTTPS 值，仅验证服务端 HTTP 边界；真实 Terminal 尚未以 HTTPS 运行，浏览器 E2E `NOT RUN`。 |
| A08 四类拒绝 | `make f06-denial-matrix` 隔离库 **4/4**；`make f06-vault-check` UI/用户/BFF/Engine 四角色对解密视图与函数 **8/8** 实际 SQL 拒绝。BFF opaque session 的允许/拒绝 capability 与撤销数据库用例 **PASS**。 | 四类请求的正式页面 HTTP 矩阵尚未执行；数据库/中间件证据不等于所有页面已接线。 |

## 修复过程中暴露并关闭的接线问题

1. Rust `postgres` URL parser 不接受 libpq 的 `sslmode=verify-full` / `sslrootcert` 参数。连接器现在单独解析这两项，强制 TLS，并保留 CA 与主机名验证。
2. macOS `native-tls` 对当前 pooler 证书报有效期超限；相同 CA 在 Node/OpenSSL 严格校验通过。正式应用的严格 TLS 路径改用 OpenSSL 验证器，未关闭证书或主机名检查。
3. BFF 最小权限登录无 `vault` schema USAGE，旧启动检查解析 `to_regclass('vault.decrypted_secrets')` 即抛 `42501`。已改成系统目录 OID 权限判断；能直接读解密视图仍拒绝启动。
4. 阻塞型 Supabase Auth verifier 在 Tokio async 主线程初始化会触发 runtime drop panic。live router 初始化现移到 `spawn_blocking`，完整 HTTP 烟测通过。

## 可重放检查

| 命令 | 结果 |
|---|---|
| `make f06-bff-preflight`、`make f06-auth-preflight` | 同项目、CA 严格 TLS、独立登录、publishable key 与 Auth Admin 就绪 |
| `make f06-bff-login-check` | PASS，真实专用登录 + 严格 TLS + 受限角色 |
| `make f06-bff-live-smoke` | PASS，9 项真实 Auth/live BFF 服务端 HTTP 探针 |
| `make f06-denial-matrix` | PASS，4/4；缺 actor/tenant、capability、RLS 直读、Engine secret |
| `make f06-vault-check` | PASS，四角色 8/8 SQL 拒绝 |
| `make f06-bff-session-check` | PASS，主账户绑定、capability 允许/拒绝、服务端撤销 |
| `cargo test -p quantos-auth -p bff-gateway --locked`、Clippy `-D warnings`、脚本语法、secret-pattern、`git diff --check` | PASS；无环境变量时 PostgreSQL 测试的 `NOT RUN` 不计远端执行 |

## 留存风险与下一步

- **A01/A08 仍为 `OPEN`，F06 保持 `FIX_VALIDATION`。** live router 仍只挂载 F06 身份路由，正式页面 API 的 capability/403/404、MFA challenge/reauth、跨页面会话撤销流未接真实 provider；不能挂入参考 provider 固定夹具。
- 当前没有实际 HTTPS Terminal Origin。合成 Origin 烟测不等于浏览器验收。需要可访问的本地 HTTPS Terminal 或 staging Terminal 后再设置 `QUANTOS_TERMINAL_ORIGIN`，执行浏览器登录与 AAL2 MFA。
- 在正式页面路由落地后，针对同一完整 `sourceCommit` 重新收集目标 HTTP 四类拒绝计数、角色/SQLSTATE、会话撤销和页面 capability 回执；本轮隔离库与本机服务验证不能直接关闭 A01/A08。
