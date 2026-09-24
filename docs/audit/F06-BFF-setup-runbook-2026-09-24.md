# F06 独立 BFF 与真实身份测试配置清单

> 2026-09-24。仅用于已确认的隔离 Supabase 项目。`.env.local` 已被 Git 忽略，须保持权限 `0600`；不要在聊天或提交中粘贴数据库口令、API key、访问令牌或测试用户口令。

## 已自动完成

- `make f06-bff-preflight` 已只读确认：`DATABASE_URL` 与 `SUPABASE_URL` 属于同一项目；`quantos_bff` 组角色存在；operator 有创建角色权限；尚无 `quantos_bff_login`、publishable key、BFF URL 和 Terminal Origin。
- `.env.local` 权限已收紧为 `0600`。
- `make f06-bff-provision` 已准备好：只在设置 `QUANTOS_F06_ISOLATED_PROJECT=1` 且项目 CA 严格校验通过后，为确认过的隔离项目创建 `quantos_bff_login`，只授予 `quantos_bff`，生成独立随机口令，并把 `sslmode=verify-full` 的 `QUANTOS_BFF_DATABASE_URL` 写入本机 `.env.local`。脚本拒绝覆盖现有登录或 URL，不输出口令。

## 需要项目管理员提供的配置

1. **数据库 CA 证书**：在同一个 Supabase 项目的 **Settings → Database → SSL Configuration → Download Certificate** 下载 `prod-ca-2021.crt`，保存到本机绝对路径。`.crt` 是文件名后缀，下载内容本身是 PEM 编码，直接写 `QUANTOS_BFF_SSLROOTCERT=/绝对路径/prod-ca-2021.crt`，无需改名或转换。下载证书不改变数据库设置；不要关闭 SSL 验证。若当前 pooler 仍报证书链或有效期错误，需要在 Dashboard 的 **Connect** 中选择证书可验证的 direct 或 session endpoint，再由我验证；不能把应用 URL 降级为 `sslmode=require`。[Supabase SSL 文档](https://supabase.com/docs/guides/platform/ssl-enforcement)、[连接方式](https://supabase.com/docs/guides/database/connecting-to-postgres)。
2. **Publishable key**：在相同项目的 **Settings → API Keys** 复制 `sb_publishable_...`，本机 `.env.local` 加 `SUPABASE_PUBLISHABLE_KEY=...`。不要使用 `SUPABASE_SERVICE_ROLE_KEY` 或 `sb_secret_...`。若项目尚无 publishable key，先在该页面创建。[Supabase API key 文档](https://supabase.com/docs/guides/getting-started/api-keys)。
3. **Terminal Origin（启动 live BFF 时才需要）**：目前 Terminal 尚未部署，仓库 `local-integrated` 开发入口是 `http://localhost:3100`，而 live BFF 要求 HTTPS Origin，因此**现在不要填 `QUANTOS_TERMINAL_ORIGIN`**，也不要把 staging 示例域名冒充真实入口。这不阻止独立数据库登录的预检与创建。实际通过 HTTPS 启动本地 Terminal 后，填 `QUANTOS_TERMINAL_ORIGIN=https://localhost:3100`；或在 staging Terminal 真正上线后，填其实际 HTTPS origin（只有 scheme、host、可选端口；无路径或尾斜杠）。同时设置 `QUANTOS_BFF_ENVIRONMENT=dev` 或 `staging`，与运行环境一致。

完成 CA 证书配置并确认项目确属隔离测试环境后，即可告知“CA 已配置”，无需把值发到聊天。我会运行 `make f06-bff-preflight`、`QUANTOS_F06_ISOLATED_PROJECT=1 make f06-bff-provision`，随后用新登录执行严格 TLS 和角色权限验证。Publishable key 与 Terminal Origin 可以在启动 live BFF 前再配置。新登录的 Supabase shared session pooler 用户名格式是 `quantos_bff_login.<project-ref>`；脚本自动生成该 URL。必须使用 `5432` session pooler 或可达的 direct 连接，不能用 `6543` transaction pooler承载进程级 `SET ROLE`。[Supabase 连接文档](https://supabase.com/docs/guides/database/connecting-to-postgres)。

## 测试身份

最省事的路径是在确认项目隔离后，由我使用现有受控 Auth Admin 凭据创建**专用测试用户**，随机生成口令并只存本机 `.env.local`，再为该 `auth.users` 身份建立唯一测试 tenant、active actor、Primary workspace、paper account 和最小 capability 映射，执行真实 Supabase Auth 登录到 live BFF 的回执。若你希望测试身份绑定自己可收信的邮箱，可在同一项目的 **Authentication → Users → Add user → Send invitation** 创建；只需在本机 `.env.local` 写 `QUANTOS_F06_TEST_EMAIL=你的测试邮箱`，不要向聊天发送口令。涉及 MFA 的测试需要你用认证器完成一次 TOTP 绑定与挑战；我随后可验证 `aal2` 会话。邮件用户能证明真实 Supabase Auth；若本次验收必须覆盖外部 OIDC 提供商，还需在隔离项目启用相应 provider 并使用该 provider 的专用测试身份。[Supabase 用户邀请](https://supabase.com/docs/guides/auth/users)、[MFA 文档](https://supabase.com/docs/guides/auth/auth-mfa)。

## 验收边界

当前可自动执行的是同项目检查、独立数据库登录创建、严格 TLS/最小权限验证、测试映射、live BFF 会话及负向探针。正式页面 API 尚未全部挂入 live router，因此这些配置本身不能关闭 F06-A01/A08；仍需目标 HTTP 矩阵与同一完整提交 SHA 回执。
