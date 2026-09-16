# Page API Coverage 登记表（operationId 回填基线）

> 任务：PRE-01 遗留项 1 / 执行计划第 5.7 节"逐页接口覆盖 Gate"
> 版本：1.3  日期：2026-09-16（1.3：A1 冻结全量页面 operationId 命名与 published/planned 边界）
> 状态：**55 个 published operation 已由 OpenAPI 1.1.0 生成；其余 operationId 仅为 A1 planned 基线，仍由 A2–A6 交付 schema/path/provider**

## 1. 回填前提与当前状态

- 执行计划 5.7 要求：每个页面开发前建立一行 Page API Coverage 记录；每个 `UI-Pxx` 必须可追踪到 operationId。
- **版本化 [quantos-bff.v1.yaml](../bff/openapi/quantos-bff.v1.yaml) 当前为 1.1.0，55 个 operationId 已发布并生成 client/schema/MSW。**
- [page-operation-catalog.yaml](../bff/page-operation-catalog.yaml) 冻结 C01–C17 与一期 22 页的 operationId 命名；`planned` 只关闭命名和追踪缺口，不代表 OpenAPI schema、provider 或 staging 已交付。
- 未发布域（C02、C10–C16）必须由对应 A2–A6 任务将 `planned` 升为 `published` 后，页面才可进入相应 Sprint；C17 P15/P17 在 staging 签署前不得标记 Integrated。
- 任何一行缺少稳定 operationId 或仍为占位符时，对应 `UI-Pxx` DoR 阻断。

错误码集合统一基线（各页均适用，页面特有补充在备注列）：`401 / 403 / 404 / 409 / 422 / 429 / 5xx / stream-abort`。

## 2. 登记表

| 页面 | 路由 | Query operationId | Command operationId | Realtime channel/operationId | 权限/capability | 数据新鲜度字段 | OpenAPI 版本 | mock 版本 | BFF owner | 最后验证 |
|---|---|---|---|---|---|---|---|---|---|---|
| GS | 全局壳 | getSession、getContext | reauth、mfaChallenge、logout | subscribe*（各域流；权限变更以重连 403/permission_revoked 终态） | 全部登录角色 | expiresAt、asOf、sampledAt | 1.0.0 | 1.0.0 | BFF TL | 2026-08-14 |
| 官网 | `/access-request` | – | submitAccessRequest | – | 访客（防滥用/限速） | – | 1.0.0 | 1.0.0 | BFF TL | 2026-08-14 |
| P01 | `/login`、`/mfa`、`/auth/callback`、`/access-request`、`/unauthorized`、`/offline` | getSession、getContext | mfaChallenge、reauth、logout、submitAccessRequest | 无（认证页无实时通道；401 驱动） | 访客/已登录 | mfaState、expiresAt | 1.0.0 | 1.0.0 | BFF TL | 2026-08-14 |
| P02 | `/command` | getCommandSummary（planned，C02）；getPortfolio、getRiskView（published，C06）；listAlerts（planned，C16） | – | subscribeCommandEvents、subscribeAlerts（planned）；subscribePortfolio（published） | 卡片按 capability | sampledAt、dataFreshness、asOf | planned / BFF-FE-002/010 | 未生成 | BFF TL | 2026-09-16（命名） |
| P03 | `/research`、`/research/new` | listResearchRuns、getResearchRun | createResearchRun、cancelResearchRun | 无（创建后转 P04 订阅） | 研/开创建；其他只读 | deadlineAt、capturedAt/maxAgeSeconds | 1.0.0 | 1.0.0 | BFF TL | 2026-08-14 |
| P04 | `/research/:runId`、`/artifacts/:artifactId` | getResearchRun、getArtifact；getArtifactAttachment（planned） | cancelResearchRun；createExport（planned） | subscribeResearchRun（SSE，afterSequence） | 资源级授权 | capturedAt、maxAgeSeconds | 1.1.0 + planned / BFF-FE-003/007 | 1.1.0（published only） | BFF TL | 2026-09-16 |
| P05 | `/data-snapshots`、`/:snapshotId` | listDataSnapshots、getDataSnapshot | createExport（planned，C10） | 无（快照不可变） | 研/开/风；资源级只读 | capturedAt、maxAgeSeconds、qualityBlocked | 1.1.0 + planned / BFF-FE-007 | 1.1.0（published only） | BFF TL | 2026-09-16（命名） |
| P06 | `/strategies`、`/new`、`/:strategyId/lab` | listStrategies、getStrategyDraft | saveStrategyDraft（If-Match→409）、runStaticCheck | 无（回测状态经 P07） | 开编辑；其他只读 | objectVersion、updatedAt | 1.0.0 | 1.0.0 | BFF TL | 2026-08-14 |
| P07 | `/backtests/:runId`、`/releases`、`/:releaseId` | getBacktest、listReleases、getRelease | createBacktest、createRelease、submitReleaseApproval、requestReleaseRollback | subscribeBacktestRun（planned；发布前以 getBacktest 轮询） | 开；风/审批按动作 | reportArtifactId、objectVersion、allowedTargets | 1.1.0 + planned / BFF-FE-004 | 1.1.0（published only） | BFF TL | 2026-09-16 |
| P08 | `/portfolio`、`/risk`、`/risk/rules/:ruleId` | getPortfolio、getRiskView | engageKillSwitch、releaseKillSwitch | subscribePortfolio（含 kill switch 广播） | 交/风；kill switch 授权风控+MFA | asOf、stale | 1.0.0 | 1.0.0 | BFF TL | 2026-08-14 |
| P09 | `/proposals`、`/:proposalId` | listProposals、getProposal | requestRiskEvaluation | subscribeProposal | 交/风/审；资源级 | expiresAt、contextHash、objectVersion | 1.0.0 | 1.0.0 | BFF TL | 2026-08-14 |
| P10 | `/approvals`、`/:approvalId` | listApprovals、getApproval | decideApproval（+mfaChallenge/reauth） | 无（拉取式；操作前强制刷新） | 风（审批人）；禁自批 | expiresAt、objectVersion、decidedAt | 1.0.0 | 1.0.0 | BFF TL | 2026-08-14 |
| P11 | `/orders`、`/:orderId` | listOrders、getOrder | requestOrderCancel | subscribeOrder（SSE） | 交操作；运/风只读 | asOf、venue health、expiresAt | 1.0.0 | 1.0.0 | BFF TL | 2026-08-14 |
| P12 | `/audit`、`/:correlationId`、`/exports/:exportId` | searchAuditEvents、getEvidenceChain、getExportStatus、getExportDownload（planned，C10） | createExport（planned，C10） | 无（异步 job 轮询） | 审/管/资源级；脱敏 | occurredAt、retention、export expiresAt | planned / BFF-FE-007 | 未生成 | BFF TL | 2026-09-16（命名） |
| P13 | `/operations`、`/operations/incidents/:incidentId` | getServiceHealth、listIncidents、getIncident、listAlerts、getAlert（planned，C11/C16） | runApprovedRunbookAction、ackAlert、unackAlert（planned） | subscribeAlerts（planned） | 运/管 | sampledAt、latency | planned / BFF-FE-010 | 未生成 | BFF TL | 2026-09-16（命名） |
| P14 | `/admin/members`、`/policies`、`/capabilities`、`/flags` | listMembers、listPolicies、listCapabilities、listFeatureFlags（planned，C11） | updateMember、savePolicy、saveCapability、saveFeatureFlag（planned；版本化、双人审批） | – | 管；最后管理员保护 | configVersion、objectVersion、effectiveAt | planned / BFF-FE-010 | 未生成 | BFF TL | 2026-09-16（命名） |
| P15 | `/settings/profile`、`/notifications`、`/security` | getProfile、getNotificationPrefs、getSecuritySettings、listSessions、listDevices | saveProfile、saveNotificationPrefs、revokeSession、revokeDevice、setupMfa | subscribeSessionRevocations | 已登录本人 | session expiresAt、lastActiveAt、trustedUntil | 1.1.0 | 1.1.0 | BFF TL（待签署） | 2026-08-15 |
| P16 | `/settings/desktop` | 待回填（platform capabilities） | 待回填（cache clear、update、diagnostic） | – | DT 已登录；Web 受限态 | update manifest version | 待回填 | 待回填 | BFF TL | – |
| P17 | `/settings/browser` | getPlatformCapabilities、listDownloads | 无（浏览器授权仅由用户手势调用 Browser API；BFF 不扩大本地权限） | – | Web 已登录；Desktop 隐藏入口 | download expiresAt | 1.1.0 | 1.1.0 | BFF TL（待签署） | 2026-08-15 |
| P18 | `/markets`、`/markets/:symbol` | getMarketCatalog、getWatchlist、getVenueQuotes（planned，C12） | saveWatchlist（planned） | subscribeQuotes（planned） | 行情许可证级 | source、asOf、latency、quality | planned / BFF-FE-005 | 未生成 | BFF TL | 2026-09-16（命名） |
| P19 | `/markets/:symbol/chart` | getCandleSeries（planned，C12） | 无（只读；受控导出经 C10） | subscribeCandles（planned）；subscribeOrder（published，标记层） | 行情许可证级 | asOf、quality、gaps | planned / BFF-FE-005 + 1.1.0 | 1.1.0（published only） | BFF TL | 2026-09-16（命名） |
| P20 | `/trade`、`/trade/:symbol` | getOrderCapabilities、getTradePreflight、getVenueQuotes（planned，C12/C13） | requestRiskEvaluation、submitTradeCommand（published，C07/C09） | subscribeTradePreflight、subscribeQuotes（planned） | 交；风/审批只读 | quoteRef、asOf、objectVersion、mode、expiresAt | planned / BFF-FE-005/006 + 1.1.0 | 1.1.0（published only） | BFF TL | 2026-09-16（命名） |
| P21 | `/performance`、`/performance/reports/:reportId` | getPerformanceSummary、getPerformanceSeries、getPerformanceAttribution、getReportStatus、getReportDownload、listLedgerEntries（planned，C14/C15） | createPerformanceReport（planned） | subscribeAlerts（planned，报表完成通知） | 交/风/研只读；账户级 | asOf、ledgerVersion、valuationSnapshotId、provisional | planned / BFF-FE-008/009/010 | 未生成 | BFF TL | 2026-09-16（命名） |
| P22 | `/reconciliation`、`/:runId` | listReconciliationRuns、getReconciliationRun、listReconciliationBreaks、getReconciliationBreak、listLedgerEntries（planned，C15） | requestReconciliationRerun（planned） | subscribeReconciliationRun（planned） | 交/风/运；资源级只读 | ledgerVersion、window、asOf | planned / BFF-FE-009 | 未生成 | BFF TL | 2026-09-16（命名） |
| P23 | `/alerts`、`/alerts/:alertId` | listAlerts、getAlert、getAlertSubscriptions（planned，C16） | ackAlert、unackAlert、saveAlertSubscriptions（planned） | subscribeAlerts（planned） | 事件授权级 | occurredAt、asOf | planned / BFF-FE-010 | 未生成 | BFF TL | 2026-09-16（命名） |

mock 版本说明：生成 TypeScript client、Zod、JSON Schema 与 MSW handlers 与 OpenAPI 同源；当前版本 `1.1.0`。C17 是 UI-104 additive 候选面，需 BFF-FE-001/011 staging 签署后才能从 Contract Mocked 升级为 Integrated。

## 3. 回填执行流程（已完成首轮）

1. ~~BFF-FE-000 发布版本化 OpenAPI~~ 已完成（1.0.0，2026-08-14）。
2. ~~为一期 22 页冻结稳定 operationId 命名与后续 owner~~ 已由 A1 catalog 完成；planned 条目不得解释为已发布。
3. BFF TL 与 Frontend TL 在 A2–A6 逐域核对权限、错误码、新鲜度、schema/path，并将 planned 升为 published。
4. 生成 client/Zod/JSON Schema/MSW 漂移、页面契约覆盖与 A1 catalog 正/负向检查均进入 CI；后续版本发布时必须同步 catalog 与本表。
