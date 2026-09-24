# F06-A01/A08 服务端续修复验

> 复验日期：2026-09-24 至 2026-09-25。验收脚本初版提交：`559471e60bdb380695853d1151cd2e655a79cbc7`；Runtime 登录 Gate 提交：`b105360def26f09fdf4821910818388a713a4b03`；A01/A08 共同复验的完整源码提交：`fa6e540714231663324ada627c60c101764122fb`。隔离 Supabase 项目与本机 live BFF/Runtime；Terminal 浏览器不属于本次 F06 Gate。回执见 [结构化结果](./F06-A01-A08-target-receipt-2026-09-24.json)。本记录不包含数据库 URL、密钥、令牌、口令或测试身份标识。

## 完成概况

| 问题 | 本轮状态 | 依据与边界 |
|---|---|---|
| A01 身份到正式服务 | **F06 单项复验通过，关闭 A01** | 独立 BFF/Runtime 登录、严格 TLS、真实 Supabase Auth 用户到 live BFF 会话及 Runtime HTTP 身份链均已复验。首次 Runtime 启动暴露阻塞型 PostgreSQL 初始化在 Tokio 主线程 panic，现已修复。Runtime 本次仅经用户授权在本机子进程临时使用隔离项目高权限 Storage key，未执行 Storage 操作；正式 Storage 权限和外部 OIDC 浏览器登录由各自后续 Gate 验收。 |
| A08 四类拒绝与四角色 Vault 拒绝 | **复验通过，关闭 A08** | 四类服务端/数据库拒绝 4/4（其中缺 actor/tenant 有两个实际探针），Vault 四角色 × 两条解密路径 8/8，实际 SQLSTATE `42501`；均在上述同一代码提交的隔离目标执行。页面 API 与浏览器 E2E 已移出 F06 Gate。 |

## 明细与证据

| Gate | 结果 |
|---|---|
| `make f06-bff-preflight`、`make f06-auth-preflight` | 隔离 Auth 与数据库同项目；BFF 专用登录存在，CA 严格 TLS 通过；Auth Admin/publishable 接口 HTTP 200。operator 测试 URL 的 `sslmode=require` 不充当 BFF 正式连接。 |
| `make f06-bff-login-check` | PASS；独立 BFF 登录、`verify-full` 与受限角色。 |
| `make f06-bff-live-smoke` | PASS；真实测试身份 subject 匹配配置，9 项 HTTP 探针。缺 cookie 401、错误 Origin 403、无效 token 401、会话建立 204、会话读取 200、Primary 上下文 200、跨账户隐藏 404、退出 204、已撤销会话 401。cookie 为 `Secure; HttpOnly; SameSite=Strict`，BFF 会话到期不晚于已验证 Auth token。Origin 是仅用于服务端烟测的合成 HTTPS 值。 |
| `make f06-denial-matrix` | PASS，四类 4/4；缺 actor/tenant 2/2、未授予 capability 1/1、`authenticated` 跨租户 RLS 只返回零行、`quantos_engine` 取 secret 被 `42501` 拒绝。 |
| `make f06-vault-check` | PASS，`anon`、`authenticated`、`quantos_bff`、`quantos_engine` 对解密视图与 allowlist 函数各 1 次拒绝，共 8/8，SQLSTATE 均为 `42501`；有效 Gateway 路径及命令过期、引用/会话撤销负向检查通过。测试角色授予及数据写入均在回滚事务内。 |
| `make f06-bff-session-check` | PASS；主账户绑定和服务端撤销的隔离数据库测试。 |
| `make f06-runtime-login-check` | PASS；在隔离库创建仅能切换 `quantos_runtime` 的专用登录，随机口令只存本机 `.env.local`；同一提交 `b105360` 下复验 CA/主机名 TLS、角色隔离、Runtime 表读取，Vault 函数被 `42501` 拒绝。该 Gate 不启动 Runtime HTTP 或访问 Storage。 |
| `QUANTOS_F06_ISOLATED_PROJECT=1 QUANTOS_F06_ALLOW_TEMP_ADMIN_STORAGE_KEY=1 make f06-runtime-live-smoke` | PASS，提交 `fa6e540`。BFF 使用真实 Supabase Auth 签发 opaque cookie；Runtime 使用独立受限数据库登录。缺 cookie 401、有效身份读取不存在 run 为 404、错误 Origin 403、非 owner 注册工具 403、BFF 退出 204、旧 cookie 再访问 401。两个服务只绑定 loopback，Origin 为合成 HTTPS 值；运行前验证目标项目与队列为空。高权限 Storage key 仅传给本机 Runtime 子进程，未写 `.env.local`，未发起 Storage 操作。 |
| A01 同 SHA 复验 | 在 `fa6e540` 上再次运行 `make f06-bff-live-smoke` 与 `make f06-runtime-login-check`，均 PASS；与该 SHA 的 live Runtime HTTP 回执构成同一源码提交的身份链。 |
| A08 同 SHA 复验 | 在 `fa6e540` 上再次运行 `make f06-denial-matrix` 与 `make f06-vault-check`，四类 4/4、Vault 8/8 再次 PASS；与 A01 使用同一完整源码提交。 |
| 静态检查 | `cargo fmt --all -- --check`、定向 Clippy `-D warnings`、两项 Node 语法检查、`git diff --check` PASS。 |

## 风险与后续

1. A01 的真实 Supabase Auth → BFF cookie → live Runtime 身份拒绝链已在隔离目标复验，符合 F06 服务端身份范围，故关闭该单项。本次 Runtime 使用用户明确授权的临时高权限 Storage key，未验证受限 `quantos-artifacts` 凭据或 Storage 读写；[Runtime 运行手册](../runbooks/f07_runtime_recovery.md)的正式配置要求仍未满足。外部 OIDC provider 的浏览器登录流程也未运行，归 Web G1 联调。不得把本机隔离身份烟测写成完整 Runtime 部署或 F06 整体验收。
2. A01/A08 回执分别绑定所列测试代码提交。保存本报告的文档提交不会改动被测代码，但完整 F06 放行 Gate 仍要求它自身的 `sourceCommit=HEAD`、所有问题关闭及五项总回执 PASS；不能以两项单独通过替代 A02/Execution、A09/P95 或全任务验收。
3. 本次没有真实 Terminal 浏览器、全部页面 API 或外部 OIDC provider 运行回执；按 [Gate 边界修正](./F06-gate-scope-correction-2026-09-24.md)处理。隔离库上的角色切换验证不冒充已部署服务角色。

## Runtime 启动缺口修复

首次 live 烟测在 `/healthz` 前失败，脱敏诊断为 PostgreSQL 阻塞客户端在 Tokio 主线程内启动嵌套 runtime，引发 panic。已将 Runtime 数据库与 Storage adapter 初始化移到 `spawn_blocking`；定向 Clippy `-D warnings`、编译和同提交 live 烟测通过。此前失败不计通过回执。
