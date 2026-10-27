# Database Operations

QuantOS database commands operate against the hosted Supabase PostgreSQL instance referenced by `DATABASE_URL`. No local Supabase stack is used.

## Environment Variables

The repository supports `.env` and `.env.local` at the project root. `Makefile` loads them automatically before running database commands.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Operator/migration connection string for the target Supabase project, branch, or controlled staging database. Never supply this URL to BFF or Execution Gateway. |
| `QUANTOS_BFF_DATABASE_URL` | Live BFF only | Dedicated login with membership only in `quantos_bff`, without `service_role`, superuser, BYPASSRLS, or Vault read privilege; `sslmode=verify-full` is mandatory. |
| `QUANTOS_EXECUTION_DATABASE_URL` | Live Execution only | Dedicated login with membership only in `quantos_execution_gateway`, without `service_role`, superuser, BYPASSRLS, or Vault read privilege; `sslmode=verify-full` is mandatory. |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `QUANTOS_TERMINAL_ORIGIN` | Live BFF only | Supabase Auth validation endpoint and the exact HTTPS Terminal origin. The publishable key is not a `service_role` key. |
| `QUANTOS_BFF_ENVIRONMENT` | Live BFF only | Explicit `dev`, `staging`, or `prod` value returned in the session contract. |
| `QUANTOS_DB_RESET_CONFIRM` | Only for `make db-reset` | Destructive reset guard. Must equal `reset_remote_schema` before the remote `quantos` schema can be dropped and recreated. |

Recommended operator workflow:

1. Keep a non-production `DATABASE_URL` in `.env.local`.
2. Leave `QUANTOS_DB_RESET_CONFIRM` empty by default.
3. Set `QUANTOS_DB_RESET_CONFIRM=reset_remote_schema` only for the specific reset invocation.
4. Remove or clear the reset guard immediately after the reset completes.

## Command Semantics

### `make db-apply`

Applies repository migrations in timestamp order to the remote database referenced by `DATABASE_URL`. Applied filenames are recorded in `quantos.schema_migrations`.

### `make db-reset`

Drops and recreates the remote `quantos` schema, then reapplies all repository migrations. This command is destructive and exits unless `QUANTOS_DB_RESET_CONFIRM=reset_remote_schema`.

### `make db-schema-diff`

Compares the repository migration filenames with the remote `quantos.schema_migrations` ledger. This is a read-only drift check and fails if the ledger is missing or differs from the repository.

### `make db-replay-check`

Rewrites the repository migrations to a randomized `quantos_replay_*` schema, executes all migrations inside one database transaction, verifies that base tables were created, and always rolls the transaction back. This provides an empty-schema replay check without dropping or mutating the active `quantos` schema.

### `make rls-policy-test`

Runs both layers of RLS validation:

- static migration checks in the repository,
- live checks against the remote PostgreSQL catalogs reached through `DATABASE_URL`.

## Connection Guidance

- Use a dedicated non-production Supabase project, branch database, or staging database for routine reset and migration verification.
- Keep `sslmode=require` in `DATABASE_URL`.
- Do not point `make db-reset` at a production database.
- Prefer service credentials only in controlled CI or operator environments.
- No local `psql` installation is required; the repository executes PostgreSQL checks through its Node runner.

## CI Usage

The repository workflow reads `DATABASE_URL` from GitHub Actions secrets when available. Static migration checks always run; live drift and RLS checks run only when the secret is configured.

## L02 Execution Secret Zone Rotation Runbook

当前实现与边界见 [L02 规程](../docs/operations/core-l02-current-function.md)。2026-10-27 本地证据只覆盖自有临时证书、真实 mTLS 子进程、合成签名器与静态 SQL/网络契约；没有连接 Supabase、解密目标秘密、安装网络策略或验证实际恢复 SLA。

### 权限与静态秘密

- 使用独立、verify-full 的 Execution 登录，受限 `quantos_execution_gateway` 角色；不得把 operator、service_role、BFF 或 Engine 连接配置传给执行宿主。平台 service_role 的 Vault 特权是 operator 例外，不能成为应用权限。
- L02 新迁移改用 `quantos.resolve_execution_zone_secret(session_hash, secret_name, command_expiry, account_id, verified_peer_fingerprint, credential_version)`。peer fingerprint 必须来自真实 TLS 证书，不能来自请求头或 JSON。函数独立验证服务 actor/账户/capability、会话/命令 TTL、证书绑定和版本状态，固定 search_path，拒绝非 Execution 角色。旧 3/4 参数 Vault 解密及名称查询对全部应用角色撤权。
- 版本元数据位于 `quantos.execution_credential_versions`，关联当前 `quantos.secret_references`；旧 `execution_secret_refs` 是历史兼容表，不是新授权源。仅保存 Vault UUID 路径、指纹和有效期；不建立动态租约。数据库端只通过 Vault decrypted view 解密，应用角色不能直读。
- `DatabaseVaultSigner` 在 Execution 进程内使用返回的 opaque ExecutionSecret 计算 HMAC；String 在 Drop 时 zeroize，不实现 Debug/Serialize。当前传回的是签名摘要诊断，不是 Binance REST 签名或授予执行权限的回执。原生执行权限仍由 X03 当前授权检查决定。

### 轮换与撤销（目标恢复 ≤5 分钟；目标 SLA NOT_RUN）

以下均为获准目标环境的后续操作，本轮没有执行：

1. 独立创建新证书、静态 Vault entry/version 和更高版本号，记录来源、账户、指纹与期限。保留历史版本；禁止版本回滚。
2. 在受控事务中将旧版本设为 draining，`rotated_at` 使用目标时钟，`retire_at` 不晚于其后 300 秒；创建唯一 active 新版本。使用新证书签发新短会话（≤15 分钟），绑定同账户/指纹/版本。命令不超过会话及 5 分钟上限。
3. 原子更新宿主可信 registry，再用新证书和新版本做独立、获准的最小 smoke；记录真实开始/恢复时刻。旧版本仅在半开区间 `[rotated_at, retire_at)` 可用；300 秒边界即拒绝。控制面/SQL 不一致会拒绝，不回退旧秘密。
4. 在期限前撤销旧会话/版本、关闭旧连接。紧急事件直接 revoked 匹配版本并撤销会话，不等待 drain；不要删除业务事件或审计。新版本和旧版本都须分别证明撤销。
5. 采集已绑定候选 SHA 的真实 Vault、角色/RLS、证书/秘密轮换、撤销与 ≤5 分钟恢复证据。本地受控时钟只是机制测试，不是实际 SLA。

### 网络与恢复

- `NetworkAllowlist` 在 connect 前核对精确 DNS、端口和已批准地址，再验证服务端 CA/hostname/pin；不使用代理环境、重定向或 DNS fallback。fixture 显式允许 loopback，不代表目标网络策略已生效。
- `deploy/execution-zone-policy.json` 和 systemd drop-in 是未安装的默认拒绝模板；地址集合为空、IPAddressDeny=any。operator 在获准环境明确核对目标 DNS/地址/专用数据库、ingress mTLS、DNS 更新与必要存储路径前，不得部署或声称可用。目标 DNS/IP、OS/eBPF/防火墙及进程隔离需实际验收。
- 未知网络/签名/协议结果不得自动重发；保留原命令及 X04 不确定占位，使用原 L01 只读恢复路径。当前 L02 fixture 仅验证 submit；受限取消/恢复完整业务链、持久去重和跨副本恢复尚未联调。
- 目标只读权限探针为 `supabase/tests/l02_zone_privileges.sql`，须另行授权且已应用 L02 迁移。本地静态检查不证明 SQL 可执行、RLS 或真实解密。旧 F06 4 参数 target probe 的历史回执保持原范围；L02 迁移后它应拒绝，不可用作新准入，也不得把它重新放权来恢复旧 probe。

## F06 isolated acceptance and application login setup

Use separate login roles for BFF and Execution. An operator creates each login outside migrations and grants only `quantos_bff` or `quantos_execution_gateway` membership respectively. Set their connection URLs only in the corresponding service environment. Do not reuse `DATABASE_URL` or a Supabase `service_role` URL. The application checks the effective login and changes to its restricted role at startup.

The `DATABASE_URL` operator/test URL may use `sslmode=require` for existing isolated PostgreSQL Gates; this does not validate the server certificate. Live application URLs must use `sslmode=verify-full`. When the database uses a private CA, include its PEM file path as `sslrootcert` in the application URL. On 2026-09-24 the configured isolated pooler failed strict native TLS with “The validity period in the certificate exceeds the maximum allowed”; a separate Node/OpenSSL probe reported `SELF_SIGNED_CERT_IN_CHAIN`. A trusted CA chain or a verified endpoint is required before live BFF/Execution acceptance; do not weaken the live service check to make this endpoint pass.

On the approved isolated test database, run `make db-replay-check`, `make db-migration-check`, `make rls-policy-test`, `make f06-rls-check`, `make f06-vault-check`, and `make f06-live-check`. The Makefile loads `.env.local`; a direct `cargo test` does not. `f06-live-check` requires 100 samples and a declared `QUANTOS_F06_TOPOLOGY` (`developer_remote` or `same_region`). A green isolated SQL Gate does not prove deployed BFF/Execution, real OIDC, or same-region latency. Record those results against the exact source commit before changing F06 review status to `ACCEPTED`.
