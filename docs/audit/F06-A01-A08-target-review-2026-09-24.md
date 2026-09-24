# F06-A01/A08 服务端续修复验

> 复验日期：2026-09-24。测试源码提交：`559471e60bdb380695853d1151cd2e655a79cbc7`。隔离 Supabase 项目与本机 live BFF；Terminal 浏览器不属于本次 F06 Gate。回执见 [结构化结果](./F06-A01-A08-target-receipt-2026-09-24.json)。本记录不包含数据库 URL、密钥、令牌、口令或测试身份标识。

## 完成概况

| 问题 | 本轮状态 | 依据与边界 |
|---|---|---|
| A01 身份到正式服务 | **部分通过，保持 OPEN** | 独立 BFF 登录、严格 TLS、真实 Supabase Auth 用户到 live BFF 会话、Primary 上下文和撤销均已复验；Runtime Gateway 的目标身份路径尚无独立 Runtime 数据库登录/Storage 配置及 live HTTP 回执。外部 OIDC provider 也未执行。 |
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
| 静态检查 | `cargo fmt --all -- --check`、定向 Clippy `-D warnings`、两项 Node 语法检查、`git diff --check` PASS。 |

## 风险与后续

1. A01 的 BFF 分段已能复验，但 F06 初审还指出 Runtime 身份闭环。当前 `.env.local` 没有 `QUANTOS_RUNTIME_DATABASE_URL` 和 `QUANTOS_RUNTIME_STORAGE_KEY`，因此未启动 live Runtime，也未证明其请求复用独立 BFF 会话。需在隔离环境准备受限 Runtime 登录和测试 Storage 后执行真实会话、无 cookie、无权限、撤销、跨租户请求；在此之前 A01 维持 `OPEN`。
2. 本次 A08 回执绑定测试代码提交。保存本报告的文档提交不会改动被测代码，但完整 F06 放行 Gate 仍要求它自身的 `sourceCommit=HEAD`、所有问题关闭及五项总回执 PASS；不能以 A08 单项通过替代 A02/Execution、A09/P95 或全任务验收。
3. 本次没有真实 Terminal 浏览器、全部页面 API 或外部 OIDC provider 运行回执；按 [Gate 边界修正](./F06-gate-scope-correction-2026-09-24.md)处理。隔离库上的角色切换验证不冒充已部署服务角色。
