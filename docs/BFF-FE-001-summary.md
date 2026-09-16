# BFF-FE-001 身份、会话与设置 API 交付总结

> 任务：A2 / BFF-FE-001
> 日期：2026-09-16
> 仓库 Gate：**PASS（本地参考 provider）**
> 目标环境：**NOT RUN / NO RECEIPT**

## 交付范围

- OpenAPI 升级为 1.2.0：C01/C17 共 20 个 operation，新增 `revokeMfaFactor` 和 `ReauthRequest`，统一使用服务端 session cookie，并为状态变更声明 CSRF、recent-auth、幂等、版本冲突与 `auditRef`。
- 新增 `services/bff-gateway` Rust/axum 本地参考 provider：session/context、MFA challenge、reauth、logout、access request、profile、通知偏好、安全设置、会话、可信设备、MFA 因素、下载与浏览器能力。
- provider 执行双提交 CSRF + Origin allowlist、五次 MFA 失败限流、五分钟 recent-auth、当前会话保护、最后有效 MFA 因素保护、资源隐藏 404、幂等写、审计引用和 `permission_revoked` SSE 回放。
- Terminal auth/settings client 转发 CSRF 和 recent-auth 引用；访问申请保持匿名且不伪造 CSRF；生成 client、Zod、JSON Schema、MSW 与 operation manifest 同源更新。
- A2 正向 Gate、八类负向探针、Rust 集成测试和 CI 接线均已纳入仓库。

## 验收边界

| 层次 | 结论 | 说明 |
|---|---|---|
| OpenAPI / 生成物 / 页面追踪 | PASS | 1.2.0；56 operations；43 schemas；C01/C17 20 operations |
| 本地参考 provider | PASS | 401/403/404、CSRF、recent-auth、最后因素、撤销 SSE、幂等与审计由集成测试覆盖 |
| Terminal client | PASS | auth/settings 单元测试和 workspace typecheck 覆盖新参数 |
| GitHub Actions | NOT RUN | workflow 已接线，本地执行不等同于托管 CI 回执 |
| staging consumer/provider | NOT RUN / NO RECEIPT | 未使用 staging 凭据，未生成目标环境签署 |
| 真实 IdP / 持久化 session | NOT RUN | 本地 provider 为内存参考实现，不是生产部署 |
| GPT-6 Astra 功能复审 | NOT_STARTED | 与开发完成状态分离 |

## 未决风险

1. session、reauth grant、幂等记录、审计与 SSE 游标当前仅为进程内状态；生产实现必须落到受控持久层并验证并发、过期、重启恢复和跨实例一致性。
2. OIDC/PKCE、真实 MFA 因素注册与吊销、cookie domain/secure policy、代理层 Origin 传递尚未在 staging 验证。
3. C17 P16 Desktop cache/update/diagnostic 仍由 BFF-FE-011 负责；不得从本任务推导 Desktop 已完成。
4. UI-102/UI-104 可标记为 Local Provider Implemented，但在 staging 签署前不得标记 Integrated/Verified。

## 下一任务

按执行计划依赖拓扑进入 **A2 / BFF-FE-007：Audit 与导出 API**。该任务依赖本任务与 CORE:F05；不得复用本地 `auditRef` 作为目标环境审计账本验收回执。
