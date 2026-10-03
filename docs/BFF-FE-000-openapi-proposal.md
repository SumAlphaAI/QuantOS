# BFF-FE-000 页面 BFF OpenAPI 基线

> 更新：2026-10-03；规范：[OpenAPI](../bff/openapi/quantos-bff.v1.yaml)，OpenAPI 3.1 / API 1.4.0 / 62 operations / 51 schemas。
> 命名：[catalog](../bff/page-operation-catalog.yaml)，C01–C17 / 一期 22 页 / 62 published + 46 planned；P16 为二期。
> 工程 Gate：`make bff-contract-check`；实际阶段验收：`pnpm check:bff-a1-acceptance`。

## 范围与联调

最低 G0 面已发布 Session/Context、Research、DataSnapshot、Strategy、Portfolio/Risk、Proposal、Approval、Execution。C17 Settings/Web 和 C10 Audit/Export 已发布；其余 planned 名称和 owner 已冻结，待对应 A3–A6 实现发布。A1 提供生成基线及校验 harness，不要求提前交付这些后续 provider。

前端使用 `createBffClient` 生成式 client，默认 `credentials=include`。Cookie 认证由服务端注入身份和上下文；受认证写携带 CSRF Cookie/Header 与受信 Origin。业务写携带 UUID `X-Request-Id` 与 `Idempotency-Key`，业务重试复用后者。reauth、MFA challenge、logout 和公开访问申请是明确登记的幂等例外。审批与其他高风险命令要求 recent-auth/MFA 等各 operation 声明的条件，服务端仍是最终授权方。

命令顶层闭合，拒绝 actor/tenant/workspace 等伪造输入；Strategy parameters 与 StreamEvent payload 保持开放扩展。Decimal 以精确字符串传输，Money.units 为 int64 字符串，UTC 日期为 RFC3339。转换测试使用实际 Proto 二进制/JSON 路径验证精度、枚举未知值和受信会话注入；页面聚合字段仍由各领域 owner 按 PRE-04 映射实现。

单资源裸返回，列表返回 items/nextCursor，pageSize 最大 200。sort 为 `field:asc|desc`，filter 为 `field:eq:value`；各 operation 的 `x-quantos-policy` 列出实际资源字段白名单，非法字段/表达式返回 422。证据链按 causation 固定顺序，不支持会破坏链节点的 sort/filter；门禁要求该 N/A 原因。审计参考 provider 实际执行 kind/eventId 筛选及 occurredAt/kind/eventId 排序；其他 provider 按其 owner 实现同样的策略。

设置与策略对象返回 ETag，更新带 If-Match，VERSION_CONFLICT 返回 currentVersion，客户端保留草稿。状态冲突无需伪造对象版本。429 要求 retryAfter。错误采用 ErrorEnvelope，全部响应声明 X-Correlation-Id 和 Cache-Control，default 为安全服务端错误，禁止 stack/debug/secret 字段。每 operation 的请求/成功示例直接置于 OpenAPI，并经 schema 校验；policy 声明鉴权、能力、分页、缓存、新鲜度、幂等、审计、请求上限与敏感字段边界。限流配额由 provider owner/目标环境配置，baseline 不虚构线上 QPS。

202 表示任务已受理，最终状态从详情/SSE 获取。SSE 带 Cookie，按最后确认 sequence 重连，网络与 5xx 使用可中断指数退避（250ms 起，最大 4s，总重连默认 10 次）；401/403 或 permission_revoked 为终态。未知 envelope/version 不应用状态。payloadVersion canonical 为 v1，保留已有 1 别名。跨域须由目标 provider 正确配置 Cookie/CORS，loopback 测试不替代浏览器 staging 验证。

## 兼容与自动化

六项生成资产逐字节漂移检查进入 CI。BFF 独立兼容 Gate 从 Git full SHA 获取历史 OpenAPI，拒绝未登记破坏性差异。本次安全修正的工程准入范围、迁移条件、到期日见 [ADR](./adr/ADR-A1-security-contract-correction.md)；不构成生产发布或签署授权。

MSW resolver 经同源请求/响应 validator 包装，Cookie 认证、CSRF、必需头、闭合输入、幂等冲突及敏感字段均受检；缺 resolver 501 明确报错。`pnpm test:bff-provider-contract` 启动仅内存参考模式，实际 HTTP 覆盖 C01/C17/C10 的 26 接口，并反校验 schema/header；不启动数据库、不访问 IdP/存储，不记为 staging 验收。全窗口真实 provider 测试仍需目标环境。

## 验收回执

当前用户已确认 staging 与签署尚不具备，PROVIDER:A1/G0 保持 NOT_STARTED，无当前 source_commit/evidence。不得把工程 Gate PASS 写作正式阶段通过。回执准备完成后按以下步骤关闭 B-01：

1. 先固定待验收的完整 source SHA，并计算 OpenAPI 原始字节与生成 Zod 原始字节按此顺序拼接后的 SHA-256（inputsDigest）。在该 SHA 的实际 staging 部署上验证 Cookie session、请求/响应 schema、CSRF/Origin、幂等/版本、correlation/审计、SSE 恢复/权限撤销、敏感字段七类检查；每项保留 requestId、原始日志文件及 SHA-256。
2. 创建 `schema=quantos-bff-a1-acceptance/v1` 的 JSON：sourceCommit、inputsDigest、status=PASS、environment=staging、实际 HTTPS baseUrl；checks 数组各有 name/status/requestId/evidence/logSha256。evidence 指向 docs/audit/evidence 下真实日志，不写 Cookie/token/数据库凭据。
3. 当前 Product/Frontend/BFF/QA/Security/Risk/Domain 各自签署角色回执。每份 `schema=quantos-g0-role-signoff/v1` 含 approved=true、sourceCommit、inputsDigest、role、identity、signedAt。主回执 signatures 含相同 role/identity/sourceCommit/signedAt、receipt 路径与 receiptSha256；这记录组织确认，不声称具备公钥密码学签名。
4. 保存主回执到 `docs/audit/evidence/bff-a1-staging-acceptance.json`，或通过 QUANTOS_BFF_A1_RECEIPT 指向文件，运行 `pnpm check:bff-a1-acceptance`。门禁校验当前 HEAD/输入摘要、七类证据文件哈希和七角色回执。缺文件、假域名、错误 SHA、修改证据或缺签署一律 NOT_ACCEPTED。
5. 只有完整目标证据与签署获复核后才能更新 PROVIDER:A1/G0 记录；新提交重新验收。配置数据库相关验证仅连接工程已配置的 Supabase PostgreSQL，另存实际执行回执。
