# F06 续修与隔离库复验记录

> 日期：2026-09-24。承接 [全面复审](./F06-comprehensive-review-2026-09-24.md)及[首轮整改](./F06-remediation-2026-09-24.md)。本记录对应本轮提交前的工作树；正式目标回执须在提交后绑定完整 `sourceCommit`。未输出或提交 `.env.local` 的任何秘密值。

## 任务完成概况

本轮继续修复 F06-A01/A05/A06/A08/A09 的仓库可控部分：签发 BFF cookie 前检查用户具有 active actor、Primary workspace 与账户映射；Supabase `/auth/v1/user` 验证后，将同一 access token 的 `sub`、`role`、`aal`、`exp` 绑定到会话；`/v1/session` 和 `/v1/context` 返回 OpenAPI 必填的账户、环境、MFA 状态、真实过期时间及 correlation ID。新增独占角色和 TLS 配置防线，避免 operator URL 或可同时切换 BFF/Execution 角色的登录用于正式服务。SQL capability helper 拒绝省略运行 mode。

**F06 仍为 `FIX_VALIDATION`，不能判定“所有问题已关闭”。** 已有隔离库上的数据库负向证明；正式 OIDC 测试身份、独立 BFF/Execution 登录、全 BFF 页面服务、Execution 交易命令调用 Vault、同区域 P95 与跨区域 <500ms 仍缺。用户给出的 `.env.local` 确实配置了 `DATABASE_URL`；本轮由 Makefile 正确加载并执行数据库测试，但它是 operator/test 连接，不是两个正式服务连接。

## 本轮更改与证据

| 项目 | 结果 | 说明 |
|---|---|---|
| 23 项 migration 隔离 schema 重放 | PASS | `make db-replay-check`；事务回滚，38 张基础表。新增两项前向 migration 已通过 `make db-apply` 应用到当前隔离库。 |
| RLS 与 capability | PASS | `make rls-policy-test`：37 表静态 + 远端 catalog；`make f06-rls-check`：真实 `authenticated` 角色跨租户只见本租户，空 mode 拒绝、匹配 mode 允许。 |
| Vault 受限 SQL | PASS | `make f06-vault-check`：有效路径、命令过期、reference 撤销、会话撤销及 UI/用户/BFF/Engine 8/8 SQL 拒绝。平台 `service_role` 解密视图例外继续按受控运维处理。 |
| Rust 局部验证 | PASS | `cargo test -p quantos-auth -p quantos-policy -p bff-gateway --locked`、相关 Clippy `-D warnings`、`cargo fmt --all` 与 `git diff --check`；直接 Cargo 未加载 `.env.local` 的 PostgreSQL 用例不计远端执行。 |
| 独立 operator URL 安全 | PASS（有限） | `DATABASE_URL` 经测试连接可用；正式 `connect_as_bff`/`ExecutionSecretStore::connect` 要求 `sslmode=verify-full`。operator URL 不会作为未验证 TLS 的正式服务 URL 被复用。独立服务登录尚无运行回执。 |
| 开发机跨区域 P95 | **FAIL** | `make f06-live-check`：5 项中 4 项通过；100 次鉴权读 P95 **651ms**，要求严格小于 500ms。只读基线 `select 1` 20 次 P50 224ms、P95 526ms，说明当前链路网络波动本身已越过门槛；不以放宽阈值或缓存替代每次授权读。 |
| 同区域 P95、正式 OIDC/BFF/Execution | NOT RUN / NO RECEIPT | 本机无同区域运行入口；`.env.local` 未配置 `QUANTOS_BFF_DATABASE_URL`、`QUANTOS_EXECUTION_DATABASE_URL`、`SUPABASE_PUBLISHABLE_KEY`、`QUANTOS_TERMINAL_ORIGIN`、`QUANTOS_BFF_ENVIRONMENT`。 |

隔离库上的严格 native TLS 握手被服务器证书拒绝，错误为 “The validity period in the certificate exceeds the maximum allowed”；独立 Node/OpenSSL 严格验证报告 `SELF_SIGNED_CERT_IN_CHAIN`。现有 operator/test `sslmode=require` 可以执行数据库 Gate，但它不验证服务端证书。正式服务仍要求 `verify-full`，可通过 URL 的 `sslrootcert` 指向受信 PEM；须先修复目标信任链或改用通过证书校验的数据库端点。**不将 operator Gate 的 PASS 外推为正式服务连接 PASS。**

## 留存问题与后续复验

1. **A01/A08**：用真实 OIDC 测试身份和独立 BFF 登录启动 live 服务，补全并执行正式页面 API 的会话、capability、403/404 隐藏、MFA、会话撤销和四类拒绝矩阵。当前 live router 仅实现 F06 身份路由；参考 provider 的固定数据不能直接挂入 live 服务。
2. **A02/A06/A07**：配置仅能切换 `quantos_execution_gateway` 的独立登录，将 `ExecutionSecretStore::resolve_for_command` 接入实际 TradeCommand 提交边界，并做命令过期、账户、轮换、撤销与真实 Vault 负向复验。当前 Execution main 只检查可选连接，没有交易提交入口。
3. **A09**：修复当前 pooler 的证书校验问题，部署同区域运行入口并分别收集同区域 <100ms、开发机跨区域 <500ms 的 100 次鉴权读回执。当前 651ms 为失败，不能记 PASS。
4. **A10**：上述各项在同一完整 SHA 的目标回执全部 PASS 后，更新 F06 `review_status` 与结构化回执，运行 `make f06-acceptance-gate`。此前保持 `FIX_VALIDATION`，下游不可把开发 `COMPLETED` 当成验收接受。

本轮没有接触生产交易凭据，也没有创建目标服务登录或部署；这些目标状态不能由 `.env.local` 中的 operator `DATABASE_URL` 推定。
