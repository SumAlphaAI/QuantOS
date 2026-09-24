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

> 验收边界已按 [F06 Gate 修正](./F06-gate-scope-correction-2026-09-24.md)更新。上表及提交后复验段落保留当时实际执行情况；其中浏览器 `NOT RUN` 和页面 API 未接线不是 F06 阻塞项。

- **A01/A08 仍为 `OPEN`，F06 保持 `FIX_VALIDATION`。** 需要按修正后的服务端范围整理真实 Auth/OIDC 到 BFF 会话与主上下文、四类拒绝和四角色 Vault 拒绝的同一完整 `sourceCommit` 目标回执，并独立完成 F06 其余 Execution 与 P95 验收。
- 合成 HTTPS Origin 已用于服务端 CORS/请求拒绝烟测。真实 Terminal Origin、浏览器登录、MFA 页面交互、跨页面撤销流和全部页面 API 的 capability/403/404 联调转入 Web 前端 G1/页面与接口阶段；不再据此保持 F06-A01/A08 `OPEN`。

## 提交后同 SHA 复验

代码提交 `f1c27bfc4f10cc6ab0d1f2ba821254f8c1abddda` 上重新运行：`make f06-bff-login-check` PASS、`make f06-bff-live-smoke` 9 项 PASS、`make f06-denial-matrix` 4/4 PASS、`make f06-bff-session-check` PASS、`make f06-vault-check` 8/8 PASS。Vault Gate 的第一次尝试在连接阶段报 `Connection terminated unexpectedly`，未计结果；第二次在同一 SHA 完整运行并通过。这些是隔离项目和本机 live 进程的复验，仍不是已部署 Terminal/全部页面 API 的正式目标回执。
