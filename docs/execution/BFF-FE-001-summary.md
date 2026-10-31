# BFF-FE-001 身份、会话与设置 API 交付总结

> 任务：A2 / BFF-FE-001
> 历史交付日期：2026-09-16；当前整改日期：2026-10-05
> 历史仓库 Gate：**PASS（本地参考 provider）**
> 历史目标环境：**NOT RUN / NO RECEIPT**

## 当前契约引用（2026-10-31）

API 1.34.0：160 operations / 180 schemas；C01/C17 本任务仍为20项。[当前 inventory](./BFF-FE-001-current-inventory.json) 同步实际 OpenAPI/生成物，新增原生/来源/财务控制仍按各自 catalog 归属追踪，不扩大 A2 验收。原 [2026-10-03 整改](../audit/BFF-FE-001-remediation-2026-10-03.md) 与下文各轮记录保留原范围；本轮执行见 [ad011968 CI 修复记录](../audit/ci-remediation-ad011968-2026-10-31.md)。当前 Gate 必须重新执行三组 provider/consumer 语义回归并核对源码摘要，缺失、失败或旧缓存仍拒绝；这不是刷新历史回执或真实数据库/目标验收。formalAccepted=false，stagingStatus=DEFERRED_TO_FINAL_REVIEW。

## 历史契约引用（2026-10-27）

API 1.18.0：142 operations / 132 schemas；C01/C17 本任务仍为20项。当前 [inventory](./BFF-FE-001-current-inventory.json) 与已发布 OpenAPI/生成物同步；新增受控 Assisted 接口由 C08/BFF-FE-006 追踪，不扩大本任务验收范围。本轮 [CI 修复记录](../audit/ci-remediation-19f09fb5-2026-10-27.md) 留存实际 provider/client 语义回归与拒绝控制。`check:bff-fe-001` 必须执行当前源码三组回归并核对来源摘要，不能用台账更新或历史缓存替代。Supabase/staging、完整联调、正式确认及发布保持独立门禁；formalAccepted=false，stagingStatus=DEFERRED_TO_FINAL_REVIEW。历史整改、回执及其原始范围保留。

## 历史契约引用（2026-10-25）

API 1.16.0：134 operations / 119 schemas；C01/C17 仍为20项。当前 [inventory](./BFF-FE-001-current-inventory.json) 只登记契约引用；当前 CI 修复与实际语义回归见 [177fe94c 修复记录](../audit/ci-remediation-177fe94c-2026-10-25.md)。`check:bff-fe-001` 必须在当前源码运行三组 provider/consumer 语义测试并核对摘要，不能用历史执行缓存代替；Supabase/staging、完整联调与正式确认仍按独立门禁执行。原 [2026-10-03 整改](../audit/BFF-FE-001-remediation-2026-10-03.md) 与 [第三轮记录](../audit/ci-remediation-round3-2026-10-19.md) 保留原 SHA 和范围，不改绑为当前验收。

## 历史功能范围（2026-10-13）

API 1.7.0：70 operations / 62 schemas；C01/C17 共20项。当前台账为 [current inventory](./BFF-FE-001-current-inventory.json)，本地功能准入按 [A2_LOCAL规程](../operations/research-local-admission.md) 的同候选实际回归和26项HTTP记录校验；上游独立Gate与真实Supabase/staging及正式确认分账。原 [2026-10-03整改](../audit/BFF-FE-001-remediation-2026-10-03.md) 与其baseline原件保持历史范围，不转移为当前回执。

## 历史整改（2026-10-05）

本轮高危 2 项、中危 4 项全部 CLOSED；24/24 控制点、20/20 API 满足当前 DEVELOPMENT 范围，严格阶段门禁 READY，formalAccepted=false。逐项复验与阶段状态见 [整改报告](../audit/BFF-FE-001-remediation-2026-10-05.md)。客户端默认 30 秒 deadline，可传调用方 AbortSignal；不自动重试写操作，未知结果须沿用原 idempotency key、版本和草稿。`lastVerifiedAt` 表示最近可信主认证或 MFA 成功时间，不由 session expiry 倒推。`check:bff-fe-001:development` 与 local_contract、RELEASE 分账。

## 既有基线（2026-10-03）

API 1.5.0：62 operations / 52 schemas；C01/C17 20 operations。当前整改入口为 [整改复验记录](../audit/BFF-FE-001-remediation-2026-10-03.md)，基线清单为 [baseline.json](../audit/evidence/bff-fe-001-remediation-20261003/baseline.json)。原始 2026-09-16 交付内容及其证据保留在下文，不能代表当前验收。

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

2026-10-05 人工验收流程更新：当前及后续原六方/多角色验收确认统一按[用户确认流程](../gate-records/user-acceptance-confirmation-workflow.md)，由 Codex 拟稿、项目用户单人确认。本文此前多人签署描述保留历史口径；当前要求以新规程为准，实际测试/目标证据仍独立验收。
