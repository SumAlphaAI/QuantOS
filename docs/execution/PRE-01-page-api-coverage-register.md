# Page API Coverage 登记表（operationId 回填基线）

> 任务：PRE-01 遗留项 1 / 执行计划第 5.7 节"逐页接口覆盖 Gate"
> 版本：1.6  日期：2026-10-19（当前契约引用复核；不代表 provider/staging 运行）
> 状态：**132 个 published operation 已由 OpenAPI 1.12.0 生成；仅 C02 的 getCommandSummary / subscribeCommandEvents 仍为 planned，归属 BFF-FE-002**

## 1. 回填前提与当前状态

- 执行计划 5.7 要求：每个页面开发前建立一行 Page API Coverage 记录；每个 `UI-Pxx` 必须可追踪到 operationId。
- **版本化 [quantos-bff.v1.yaml](../../bff/openapi/quantos-bff.v1.yaml) 当前为 1.12.0，132 个 operationId 已发布并生成 client/schema/MSW。**
- [page-operation-catalog.yaml](../../bff/page-operation-catalog.yaml) 冻结 C01–C17 与一期 22 页的 operationId 命名；`planned` 只关闭命名和追踪缺口，不代表 OpenAPI schema、provider 或 staging 已交付。
- C01/C03–C17 已发布契约与生成物；C02 的两个 operation 仍为 `planned`，provider、完整 UI 与目标环境状态分别按各任务记录。`published` 仅表示契约/生成物发布，新页面开发须 G0 DEVELOPMENT 与 PROVIDER:ALL 阶段 READY；Integrated 须满足对应任务的 INTEGRATION 门禁，正式 staging/签署按 RELEASE 执行。
- 任何一行缺少稳定 operationId 或仍为占位符时，对应 `UI-Pxx` DoR 阻断。

错误码集合统一基线（各页均适用，页面特有补充在备注列）：`401 / 403 / 404 / 409 / 422 / 429 / 5xx / stream-abort`。

共享认证操作 getSession/getContext/reauth/mfaChallenge/logout 统一追踪到 GS 的 C01/BFF-FE-001；其余页面 operationId 必须在对应页面的契约与 BFF owner 追踪中出现。P05 元数据下载仅使用 getDataSnapshot 已授权响应，不导出原始行情或审计事件；C10 createExport 的 ExportScope 以 correlationIds 为输入，不是快照元数据下载接口。

## 2. 登记表

| 页面 | 路由 | Query operationId | Command operationId | Realtime channel/operationId | 权限/capability | 数据新鲜度字段 | OpenAPI 版本 | mock 版本 | BFF owner | 最后验证 |
|---|---|---|---|---|---|---|---|---|---|---|
| GS | 全局壳 | getSession、getContext | reauth、mfaChallenge、logout | subscribeSessionRevocations；各域订阅见对应页面 | 全部登录角色 | expiresAt、asOf、sampledAt | 1.12.0 | 1.12.0（generated only） | BFF TL | 2026-10-19（契约/生成物引用；provider 验证范围仍见原任务记录） |
| 官网 | `/access-request` | – | submitAccessRequest | – | 访客（防滥用/限速） | – | 1.12.0 | 1.12.0（generated only） | BFF TL | 2026-10-19（契约/生成物引用；provider 验证范围仍见原任务记录） |
| P01 | `/login`、`/mfa`、`/auth/callback`、`/access-request`、`/unauthorized`、`/offline` | getSession、getContext | mfaChallenge、reauth、logout、submitAccessRequest | 无（认证页无实时通道；401 驱动） | 访客/已登录 | mfaState、expiresAt | 1.12.0 | 1.12.0（generated only） | BFF TL | 2026-10-19（契约/生成物引用；provider 验证范围仍见原任务记录） |
| P02 | `/command` | getCommandSummary（planned，C02）；getPortfolio、getRiskView（published，C06）；listAlerts（published，C16） | – | subscribeCommandEvents（planned）；subscribeAlerts（published）；subscribePortfolio（published） | 卡片按 capability | sampledAt、dataFreshness、asOf | 1.12.0 + planned / BFF-FE-002/006/010 | 1.12.0（published only） | BFF TL | 2026-10-19（契约/生成物引用；provider 验证范围仍见原任务记录） |
| P03 | `/research`、`/research/new` | listResearchRuns、getResearchRun | createResearchRun、cancelResearchRun | 无（创建后转 P04 订阅） | 研/开创建；其他只读 | deadlineAt、capturedAt/maxAgeSeconds | 1.12.0 | 1.12.0（generated only） | BFF TL | 2026-10-19（契约/生成物引用；provider 验证范围仍见原任务记录） |
| P04 | `/research/:runId`、`/artifacts/:artifactId` | getResearchRun、getArtifact；getArtifactAttachment（published 1.12.0） | cancelResearchRun；createExport（published） | subscribeResearchRun（SSE，afterSequence） | 资源级授权 | capturedAt、maxAgeSeconds | 1.12.0 | 1.12.0（published only） | BFF TL | 2026-10-19（契约/生成物引用；provider 验证范围仍见原任务记录） |
| P05 | `/data-snapshots`、`/data-snapshots/:snapshotId` | listDataSnapshots、getDataSnapshot | 无（下载已授权元数据复用 getDataSnapshot 响应，不调用审计导出） | subscribeAlerts（published，C16；质量告警，快照本身不可变） | 研/开/风；资源级只读 | capturedAt、maxAgeSeconds、qualityBlocked | 1.12.0 / BFF-FE-003/010 | 1.12.0（published only） | BFF TL | 2026-10-19（契约/生成物引用；provider 验证范围仍见原任务记录） |
| P06 | `/strategies`、`/strategies/new`、`/strategies/:strategyId/lab` | listStrategies、getStrategyDraft | saveStrategyDraft（If-Match→409）、runStaticCheck | 无（回测状态经 P07） | 开编辑；其他只读 | objectVersion、updatedAt | 1.12.0（generated only；A4功能范围仍见原验收） | 1.12.0（generated only） | BFF TL | 2026-10-19（契约/生成物引用；provider 验证范围仍见原任务记录） |
| P07 | `/backtests/:runId`、`/releases`、`/releases/:releaseId` | getBacktest、listReleases、getRelease | createBacktest、createRelease、submitReleaseApproval、requestReleaseRollback | subscribeBacktestRun（有限journal/续传；polling恢复） | 开；风/审批按动作 | reportArtifactId、objectVersion、allowedTargets | 1.12.0 / BFF-FE-004 | 1.12.0（generated only；A4功能范围仍见原验收） | BFF TL | 2026-10-19（契约/生成物引用；provider 验证范围仍见原任务记录） |
| P08 | `/portfolio`、`/risk`、`/risk/rules/:ruleId` | getPortfolio、getRiskView | engageKillSwitch、releaseKillSwitch | subscribePortfolio（含 kill switch 广播） | 交/风；kill switch 授权风控+MFA | asOf、stale | 1.12.0 / BFF-FE-006 | 1.12.0（generated only；A4功能范围仍见原验收） | BFF TL | 2026-10-19（契约/生成物引用；provider 验证范围仍见原任务记录） |
| P09 | `/proposals`、`/proposals/:proposalId` | listProposals、getProposal | requestRiskEvaluation | subscribeProposal | 交/风/审；资源级 | expiresAt、contextHash、objectVersion | 1.12.0 / BFF-FE-006 | 1.12.0（generated only；A4功能范围仍见原验收） | BFF TL | 2026-10-19（契约/生成物引用；provider 验证范围仍见原任务记录） |
| P10 | `/approvals`、`/approvals/:approvalId` | listApprovals、getApproval | decideApproval（+mfaChallenge/reauth） | 无（拉取式；操作前强制刷新） | 风（审批人）；禁自批 | expiresAt、objectVersion、decidedAt | 1.12.0 / BFF-FE-006 | 1.12.0（generated only；A4功能范围仍见原验收） | BFF TL | 2026-10-19（契约/生成物引用；provider 验证范围仍见原任务记录） |
| P11 | `/orders`、`/orders/:orderId` | listOrders、getOrder | requestOrderCancel | subscribeOrder（SSE） | 交操作；运/风只读 | asOf、venue health、expiresAt | 1.12.0 / BFF-FE-006 | 1.12.0（generated only；A4功能范围仍见原验收） | BFF TL | 2026-10-19（契约/生成物引用；provider 验证范围仍见原任务记录） |
| P12 | `/audit`、`/audit/:correlationId`、`/exports/:exportId` | searchAuditEvents、getEvidenceChain、getExportStatus、getExportDownload | createExport、cancelExport | 无（异步 job 轮询） | 审/管/资源级；脱敏 | occurredAt、retentionUntil、download expiresAt | 1.12.0 / BFF-FE-007 | 1.12.0（本地参考 provider；staging 待签署） | BFF TL | 2026-10-19（契约/生成物引用；provider 验证范围仍见原任务记录） |
| P13 | `/operations`、`/operations/incidents/:incidentId` | getServiceHealth、getServiceMetrics、listIncidents、getIncident、getIncidentTimeline、listRunbookActions | openIncident、ackIncident、resolveIncident、checkRunbookPreconditions、runApprovedRunbookAction、ackAlert、unackAlert（published） | subscribeAlerts（published） | 运/管 | sampledAt、latency | 1.12.0 / BFF-FE-010 | 1.12.0（generated only） | BFF TL | 2026-10-19（契约/生成物引用；provider 验证范围仍见原任务记录） |
| P14 | `/admin/members`、`/admin/policies`、`/admin/capabilities`、`/admin/flags` | listMembers、getMember、listRoles、getRole、listPolicies、getPolicy、listCapabilities、getCapability、listFeatureFlags、getFeatureFlag | createMember、updateMember、deleteMember、createRole、saveRole、deleteRole、createPolicy、savePolicy、deletePolicy、createCapability、saveCapability、deleteCapability、createFeatureFlag、saveFeatureFlag、deleteFeatureFlag（published；版本化、双人审批） | – | 管；最后管理员保护 | configVersion、objectVersion、effectiveAt | 1.12.0 / BFF-FE-010 | 1.12.0（generated only） | BFF TL | 2026-10-19（契约/生成物引用；provider 验证范围仍见原任务记录） |
| P15 | `/settings/profile`、`/settings/notifications`、`/settings/security` | getProfile、getNotificationPrefs、getSecuritySettings、listSessions、listDevices | saveProfile、saveNotificationPrefs、revokeSession、revokeDevice、setupMfa、revokeMfaFactor | subscribeSessionRevocations | 已登录本人 | session expiresAt、lastActiveAt、trustedUntil | 1.12.0 | 1.12.0（generated only） | BFF TL（本地参考 provider；staging 待签署） | 2026-10-19（契约/生成物引用；provider 验证范围仍见原任务记录） |
| P17 | `/settings/browser` | getPlatformCapabilities、listDownloads | 无（浏览器授权仅由用户手势调用 Browser API；BFF 不扩大本地权限） | – | Web 已登录 | download expiresAt | 1.12.0 | 1.12.0（generated only） | BFF TL（本地参考 provider；staging 待签署） | 2026-10-19（契约/生成物引用；provider 验证范围仍见原任务记录） |
| P18 | `/markets`、`/markets/:symbol` | getMarketCatalog、getWatchlist、getVenueQuotes（published，C12） | saveWatchlist（published，C12） | subscribeQuotes（published，C12） | 行情许可证级 | source、asOf、latency、quality | 1.12.0 / BFF-FE-005 | 1.12.0（generated；本地参考 provider） | BFF TL | 2026-10-19（契约/生成物引用；provider 验证范围仍见原任务记录） |
| P19 | `/markets/:symbol/chart` | getCandleSeries（published，C12） | 无（只读；受控导出经 C10） | subscribeCandles（published，C12）；subscribeOrder（published，标记层） | 行情许可证级 | asOf、quality、gaps | 1.12.0 / BFF-FE-005 | 1.12.0（published only） | BFF TL | 2026-10-19（契约/生成物引用；provider 验证范围仍见原任务记录） |
| P20 | `/trade`、`/trade/:symbol` | getOrderCapabilities、getTradePreflight（published 1.12.0，C13）；getVenueQuotes（C12原范围） | requestRiskEvaluation、submitTradeCommand（published，C07/C09） | subscribeTradePreflight（published 1.12.0，C13）；subscribeQuotes（C12原范围） | 交；风/审批只读 | quoteRef、asOf、objectVersion、mode、expiresAt | 1.12.0 / BFF-FE-006 | 1.12.0（generated only；A4功能范围仍见原验收） | BFF TL | 2026-10-19（契约/生成物引用；provider 验证范围仍见原任务记录） |
| P21 | `/performance`、`/performance/reports/:reportId` | getPerformanceSummary、getPerformanceSeries、getPerformanceAttribution、getReportStatus、getPerformanceReport、getReportDownload、downloadPerformanceReport、listLedgerEntries（published，C14/C15） | createPerformanceReport（published） | subscribeAlerts（published，报表完成通知） | 交/风/研只读；账户级 | asOf、ledgerVersion、valuationSnapshotId、provisional | 1.12.0 / BFF-FE-008/009/010 | 1.12.0（generated only） | BFF TL | 2026-10-19（契约/生成物引用；provider 验证范围仍见原任务记录） |
| P22 | `/reconciliation`、`/reconciliation/:runId` | listReconciliationRuns、getReconciliationRun、listReconciliationBreaks、getReconciliationBreak、listLedgerEntries（published，C15） | requestReconciliationRerun（published） | subscribeReconciliationRun（published） | 交/风/运；资源级只读 | ledgerVersion、window、asOf | 1.12.0 / BFF-FE-009 | 1.12.0（generated only） | BFF TL | 2026-10-19（契约/生成物引用；provider 验证范围仍见原任务记录） |
| P23 | `/alerts`、`/alerts/:alertId` | listAlerts、getAlert、getAlertSubscriptions | ackAlert、unackAlert、saveAlertSubscriptions（published） | subscribeAlerts（published） | 事件授权级 | occurredAt、asOf | 1.12.0 / BFF-FE-010 | 1.12.0（generated only） | BFF TL | 2026-10-19（契约/生成物引用；provider 验证范围仍见原任务记录） |

mock 版本说明：生成 TypeScript client、Zod、JSON Schema 与 MSW handlers 与 OpenAPI 同源；当前版本 `1.12.0`。C01/C10/C17 P15 以及 C06–C09/C13 已有本地 Rust 参考 provider；A4仅为受控Paper/Shadow功能范围，参见 [A4规程](../operations/bff-fe-006-functional-admission.md)，但 Integrated 须满足对应任务 INTEGRATION 门禁；正式 staging 消费者/provider 签署按 RELEASE 执行；P16 只属二期 BFF-DESKTOP-001。

## 3. 回填执行流程（已完成首轮）

本次仅更新当前契约/生成物引用，不将既有 provider 功能验收改绑到新版本；A4 原验收使用的 1.8.0/1.9.0 及原始验证日期保留于历史报告与证据。本表的生成物版本不表示同版本 provider、完整 UI 或目标环境已通过。

1. ~~BFF-FE-000 发布版本化 OpenAPI~~ 已完成（1.0.0，2026-08-14）。
2. ~~为一期 22 页冻结稳定 operationId 命名与后续 owner~~ 已由 A1 catalog 完成；planned 条目不得解释为已发布。
3. BFF TL 与 Frontend TL 在 A2–A6 逐域核对权限、错误码、新鲜度、schema/path，并将 planned 升为 published。
4. 生成 client/Zod/JSON Schema/MSW 漂移、页面契约覆盖与 A1 catalog 正/负向检查均进入 CI；后续版本发布时必须同步 catalog 与本表。
