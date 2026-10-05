# BFF-FE-001 身份、会话与设置 API 交付总结

> 任务：A2 / BFF-FE-001
> 历史交付日期：2026-09-16；当前整改日期：2026-10-03
> 历史仓库 Gate：**PASS（本地参考 provider）**
> 历史目标环境：**NOT RUN / NO RECEIPT**

## 当前整改（2026-10-05）

本轮修复高危 2 项、中危 4 项；逐项复验与阶段状态见 [整改报告](audit/BFF-FE-001-remediation-2026-10-05.md)。客户端默认 30 秒 deadline，可传调用方 AbortSignal；不自动重试写操作，未知结果须沿用原 idempotency key、版本和草稿。`lastVerifiedAt` 表示最近可信主认证或 MFA 成功时间，不由 session expiry 倒推。`check:bff-fe-001:development` 与 local_contract、RELEASE 分账。

## 既有基线（2026-10-03）

API 1.5.0：62 operations / 52 schemas；C01/C17 20 operations。当前整改入口为 [整改复验记录](audit/BFF-FE-001-remediation-2026-10-03.md)，基线清单为 [baseline.json](audit/evidence/bff-fe-001-remediation-20261003/baseline.json)。原始 2026-09-16 交付内容及其证据保留在下文，不能代表当前验收。

真实 Supabase Auth/PostgreSQL 与本机 live BFF 联调单独记录；staging consumer/provider、联合签署延至 FINAL 评审。PROVIDER:A2/G1 与 Desktop 不由本次工程整改代为签署。

## 历史交付范围（2026-09-16）

- OpenAPI 升级为 1.2.0：C01/C17 共 20 个 operation，新增 `revokeMfaFactor` 和 `ReauthRequest`，统一使用服务端 session cookie，并为状态变更声明 CSRF、recent-auth、幂等、版本冲突与 `auditRef`。
- 新增 `services/bff-gateway` Rust/axum 本地参考 provider：session/context、MFA challenge、reauth、logout、access request、profile、通知偏好、安全设置、会话、可信设备、MFA 因素、下载与浏览器能力。
- provider 执行双提交 CSRF + Origin allowlist、五次 MFA 失败限流、五分钟 recent-auth、当前会话保护、最后有效 MFA 因素保护、资源隐藏 404、幂等写、审计引用和 `permission_revoked` SSE 回放。
- Terminal auth/settings client 转发 CSRF 和 recent-auth 引用；访问申请保持匿名且不伪造 CSRF；生成 client、Zod、JSON Schema、MSW 与 operation manifest 同源更新。
- A2 正向 Gate、八类负向探针、Rust 集成测试和 CI 接线均已纳入仓库。

## 历史验收边界（2026-09-16）

| 层次 | 结论 | 说明 |
|---|---|---|
| OpenAPI / 生成物 / 页面追踪 | PASS | 1.2.0；56 operations；43 schemas；C01/C17 20 operations |
| 本地参考 provider | PASS | 401/403/404、CSRF、recent-auth、最后因素、撤销 SSE、幂等与审计由集成测试覆盖 |
| Terminal client | PASS | auth/settings 单元测试和 workspace typecheck 覆盖新参数 |
| GitHub Actions | NOT RUN | workflow 已接线，本地执行不等同于托管 CI 回执 |
| staging consumer/provider | NOT RUN / NO RECEIPT | 未使用 staging 凭据，未生成目标环境签署 |
| 真实 IdP / 持久化 session | NOT RUN | 本地 provider 为内存参考实现，不是生产部署 |
| GPT-6 Astra 功能复审 | NOT_STARTED | 与开发完成状态分离 |

## 历史未决风险（现状以当前整改记录为准）

1. session、reauth grant、幂等记录、审计与 SSE 游标当前仅为进程内状态；生产实现必须落到受控持久层并验证并发、过期、重启恢复和跨实例一致性。
2. OIDC/PKCE、真实 MFA 因素注册与吊销、cookie domain/secure policy、代理层 Origin 传递尚未在 staging 验证。
3. C17 P16 Desktop cache/update/diagnostic 仍由 BFF-FE-011 负责；不得从本任务推导 Desktop 已完成。
4. UI-102/UI-104 可标记为 Local Provider Implemented，但在 staging 签署前不得标记 Integrated/Verified。

## 历史下一任务安排

按执行计划依赖拓扑进入 **A2 / BFF-FE-007：Audit 与导出 API**。该任务依赖本任务与 CORE:F05；不得复用本地 `auditRef` 作为目标环境审计账本验收回执。

2026-10-05 人工验收流程更新：当前及后续原六方/多角色验收确认统一按[用户确认流程](./gate-records/user-acceptance-confirmation-workflow.md)，由 Codex 拟稿、项目用户单人确认。本文此前多人签署描述保留历史口径；当前要求以新规程为准，实际测试/目标证据仍独立验收。
