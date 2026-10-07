# PRE-04 OpenAPI Gap List

> 任务：PRE-04 接口盘点  版本：1.2  日期：2026-10-02
> 口径：operationId 与 catalog 精确对应；published 的 path/method/schema/envelope 以 BFF 版本化 OpenAPI 为准，planned 仍由后续任务定义（执行计划 5.6 节）。
> 追踪：每条 gap 对应契约台账一行与 BFF-FE 任务；一期 Web 状态：无 published 为 Open；部分发布且有 planned 为 Partial；全部发布且无 planned 为 Closed。它仅表示契约缺口，不表示 provider/目标环境已验收。
> 共性要求（每条 gap 必须满足，不重复列出）：统一错误 envelope（code/message/correlationId/fieldErrors/retryAfter/currentVersion）、cursor 分页、Idempotency-Key（command）、ETag/objectVersion（可变对象）、correlation ID、权限/capability 裁剪、敏感字段脱敏、202 异步受理引用。

| Gap ID | 契约 | published / planned operationId | 覆盖页面 | 后端任务 | 优先级 | 目标阶段 | BFF-FE | 状态 |
|---|---|---|---|---|---|---|---|---|
| GAP-01 | C01 | 已发布：getSession、getContext、reauth、mfaChallenge、logout、submitAccessRequest；未发布：无 | P01、P15、GS、WEB-06、WEB-07 | F06、L03 | P0 | FEP-0/G0 冻结 | BFF-FE-001 | Closed |
| GAP-02 | C02 | 已发布：无；未发布：getCommandSummary、subscribeCommandEvents | P02 | F09、R03、X01、X02、X03、X04、X05、X06 | P0 | FEP-1/G1 | BFF-FE-002 | Open |
| GAP-03 | C03 | 已发布：listResearchRuns、createResearchRun、getResearchRun、cancelResearchRun、subscribeResearchRun；未发布：无 | P03、P04 | F07、F08、R03、U01 | P0 | FEP-2/G2 | BFF-FE-003 | Closed |
| GAP-04 | C04 | 已发布：listDataSnapshots、getDataSnapshot、getArtifact；未发布：getArtifactAttachment | P04、P05 | R02、R03、F05 | P0 | FEP-2/G2 | BFF-FE-003 | Partial |
| GAP-05 | C05 | 已发布：listStrategies、getStrategyDraft、saveStrategyDraft、runStaticCheck、createBacktest、getBacktest、listReleases、createRelease、getRelease、submitReleaseApproval、requestReleaseRollback；未发布：subscribeBacktestRun | P06、P07 | S01、S02、S03、S04 | P0 | FEP-3/G3 | BFF-FE-004 | Partial |
| GAP-06 | C06 | 已发布：getPortfolio、getRiskView、engageKillSwitch、releaseKillSwitch、subscribePortfolio；未发布：无 | P02、P08 | X01、X02 | P0 | FEP-5/G5 | BFF-FE-006 | Closed |
| GAP-07 | C07 | 已发布：listProposals、getProposal、requestRiskEvaluation、subscribeProposal；未发布：无 | P09、P20 | R04、X02 | P0 | FEP-5/G5 | BFF-FE-006 | Closed |
| GAP-08 | C08 | 已发布：listApprovals、getApproval、decideApproval；未发布：无 | P07、P10、P20 | F06、X03、L03 | P0 | FEP-5/G5 | BFF-FE-006 | Closed |
| GAP-09 | C09 | 已发布：submitTradeCommand、listOrders、getOrder、requestOrderCancel、subscribeOrder；未发布：无 | P11、P19、P20 | X03、X04、L01 | P0 | FEP-5/G5 | BFF-FE-006 | Closed |
| GAP-10 | C10 | 已发布：searchAuditEvents、getEvidenceChain、createExport、getExportStatus、cancelExport、getExportDownload；未发布：无 | P04、P07、P09、P10、P11、P12、P13、P14、P22、P23 | F05、X06 | P0 | FEP-5/G5 | BFF-FE-007 | Closed |
| GAP-11 | C11 | 已发布：无；未发布：getServiceHealth、listIncidents、getIncident、listMembers、listPolicies、listCapabilities、listFeatureFlags、runApprovedRunbookAction、updateMember、savePolicy、saveCapability、saveFeatureFlag | P13、P14 | F06、F09、X06 | P1 | FEP-6/G6 | BFF-FE-010 | Open |
| GAP-12 | C12 | 已发布：无；未发布：getMarketCatalog、getWatchlist、getVenueQuotes、getCandleSeries、saveWatchlist、subscribeQuotes、subscribeCandles | P18、P19、P20 | R01、R02、L01 | P0 | FEP-4/G4 | BFF-FE-005 | Open |
| GAP-13 | C13 | 已发布：无；未发布：getOrderCapabilities、getTradePreflight、subscribeTradePreflight | P20 | X01、X02、X03、L01 | P0 | FEP-5/G5 | BFF-FE-006 | Open |
| GAP-14 | C14 | 已发布：无；未发布：getPerformanceSummary、getPerformanceSeries、getPerformanceAttribution、createPerformanceReport、getReportStatus、getReportDownload | P21 | X01、X05 | P1 | FEP-4/G4 | BFF-FE-008 | Open |
| GAP-15 | C15 | 已发布：无；未发布：listReconciliationRuns、getReconciliationRun、listReconciliationBreaks、getReconciliationBreak、listLedgerEntries、requestReconciliationRerun、subscribeReconciliationRun | P11、P21、P22 | X05 | P0 | FEP-5/G5 | BFF-FE-009 | Open |
| GAP-16 | C16 | 已发布：无；未发布：listAlerts、getAlert、getAlertSubscriptions、ackAlert、unackAlert、saveAlertSubscriptions、subscribeAlerts | P02、P13、P23 | F09、X05、X06 | P1 | FEP-6/G6 | BFF-FE-010 | Open |
| GAP-17 | C17 | 已发布：getProfile、saveProfile、getNotificationPrefs、saveNotificationPrefs、getSecuritySettings、listSessions、revokeSession、subscribeSessionRevocations、listDevices、revokeDevice、setupMfa、revokeMfaFactor、listDownloads、getPlatformCapabilities；未发布：无 | P15、P17 | F06、F09、L03 | P0 | FEP-1/G1（一期 Web P15/P17） | BFF-FE-001/011 | Closed |

## 统一基线（GAP-00，BFF-FE-000 本体）

- envelope、分页（cursor/pageSize/nextCursor）、sort/filter、202 job 引用、Idempotency-Key、ETag/objectVersion、错误模型、SSE event envelope（streamId/sequence/eventId/occurredAt/correlationId/payloadVersion）由 BFF-FE-000 一次性冻结，GAP-01–17 继承，不逐条重复设计。
- 现有 `quantos.swagger.json`（7 个 Engine/EventLedger operation）保留为服务级契约，页面不直接消费；页面只引用 BFF 版本化 OpenAPI 生成的 client。
- Gap Closed 只表示一期 catalog 全部 operation 发布；进入页面 Sprint 的 Reviewed/Mocked、provider 实现和真实 staging 集成仍独立验收。C04 附件和 C05 backtest stream 保持 Partial；C17 Web Closed，原生面由二期承接。
- 原生 P16/cache/update/diagnostic 不进入本表，见 [DESK-PRE-04承接表](./DESK-PRE-04-interface-transfer.md)。
