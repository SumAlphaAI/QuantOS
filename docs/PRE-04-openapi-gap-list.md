# PRE-04 OpenAPI Gap List

> 任务：PRE-04 接口盘点  版本：1.0  日期：2026-08-14
> 口径：operation 名称表达能力需求，不预设 URL；最终 path/method/schema/envelope 以 BFF 版本化 OpenAPI 为准（执行计划 5.6 节）。
> 追踪：每条 gap 对应契约台账一行与 BFF-FE 任务；状态 `Open → In Design（BFF-FE-000）→ Closed（OpenAPI 发布）`。
> 共性要求（每条 gap 必须满足，不重复列出）：统一错误 envelope（code/message/correlationId/fieldErrors/retryAfter/currentVersion）、cursor 分页、Idempotency-Key（command）、ETag/objectVersion（可变对象）、correlation ID、权限/capability 裁剪、敏感字段脱敏、202 异步受理引用。

| Gap ID | 契约 | 必须新增的页面 operation（Query/Command/Realtime） | 覆盖页面 | 后端任务 | 优先级 | 目标阶段 | BFF-FE | 状态 |
|---|---|---|---|---|---|---|---|---|
| GAP-01 | C01 | Q: getSession、getContext（workspace/account/capabilities）；C: reauth、mfaChallenge、logout、submitAccessRequest；R: 权限变更断开 | P01、GS、P15、官网访问申请 | F06、L03 | P0 | FEP-0/G0 冻结 | BFF-FE-000/001 | In Design（BFF-FE-000 提案） |
| GAP-02 | C02 | Q: getCommandSummary（riskPosture/dataFreshness/pendingApprovals/failedRuns/orderSummary/alerts/sampledAt）；R: command event projection | P02 | F09、R03、X01–X06 | P0 | FEP-1/G1 | BFF-FE-002 | Open |
| GAP-03 | C03 | Q: listResearchRuns、getResearchRun；C: createResearchRun（202+runId）、cancelResearchRun（cancel_requested）；R: subscribeRunStream（sequence/afterSequence replay） | P03、P04 | F07/F08、R03、U01 | P0 | FEP-2/G2 | BFF-FE-003 | In Design（BFF-FE-000 提案） |
| GAP-04 | C04 | Q: listDataSnapshots、getDataSnapshot、getArtifact、getArtifactAttachment | P04、P05 | R02/R03、F05 | P0 | FEP-2/G2 | BFF-FE-003 | In Design（BFF-FE-000 提案） |
| GAP-05 | C05 | Q: listStrategies、getDraft、getBacktest、listReleases、getRelease；C: saveDraft（expectedVersion→409 diff）、runStaticCheck、createBacktest、createRelease、submitReleaseApproval、requestRollback；R: backtest run stream | P06、P07 | S01–S04 | P0 | FEP-3/G3 | BFF-FE-004 | In Design（BFF-FE-000 提案） |
| GAP-06 | C06 | Q: getPortfolio、getRiskView（asOf/stale）；C: engageKillSwitch、releaseKillSwitch（MFA+签名）；R: portfolio/risk projection、kill switch broadcast | P02、P08 | X01/X02 | P0 | FEP-5/G5 | BFF-FE-006 | In Design（BFF-FE-000 提案） |
| GAP-07 | C07 | Q: listProposals、getProposal；C: requestRiskEvaluation（proposal/version/context hash）；R: proposal status stream。**proto 缺口：TradeProposal 无 counter_views 字段（R04 强制反方观点），需 proto v1 增补或 BFF ProposalView 承载** | P09、P20 | R04、X02 | P0 | FEP-5/G5 | BFF-FE-006 | In Design（BFF-FE-000 提案） |
| GAP-08 | C08 | Q: listApprovals、getApproval；C: decideApproval（signature+mfaChallengeRef）、reauth；MFA challenge 生命周期 | P07、P10、P20 | F06、X03、L03 | P0 | FEP-5/G5 | BFF-FE-006 | In Design（BFF-FE-000 提案） |
| GAP-09 | C09 | Q: listOrders、getOrder；C: submitCommandRef（Idempotency-Key）、requestCancel；R: order event stream | P11、P19（标记）、P20 | X03/X04、L01 | P0 | FEP-5/G5 | BFF-FE-006 | In Design（BFF-FE-000 提案） |
| GAP-10 | C10 | Q: searchAuditEvents、getEvidenceChain（correlation/causation 分页）；C: createExport、getExportStatus、getExportDownload（短时签名 URL） | P12 及全部领域页跳转 | F05、X06 | P0 | FEP-5/G5 | BFF-FE-007 | Open |
| GAP-11 | C11 | Q: getServiceHealth、listIncidents、getIncident、admin 四类 query；C: runApprovedRunbookAction（仅 actionId+precheck）、member/policy/capability/flag 版本化 CRUD | P13、P14 | F06/F09、X06 | P1 | FEP-6/G6 | BFF-FE-010 | Open |
| GAP-12 | C12 | Q: getMarketCatalog、getWatchlist、getVenueQuotes、getCandleSeries（history）；C: saveWatchlist；R: quote stream、candle stream（断流定格） | P18、P19、P20 | R01/R02、L01 | P0 | FEP-4/G4 | BFF-FE-005 | Open |
| GAP-13 | C13 | Q: getOrderCapabilities、getPreflight（quoteRef/balance/limit impact/objectVersion/blockingReasons）；R: preflight refresh push | P20 | X01–X03、L01 | P0 | FEP-5/G5 | BFF-FE-006 | Open |
| GAP-14 | C14 | Q: getPerformanceSummary、getPerformanceSeries、getAttribution；C: createReport、getReportStatus、getReportDownload | P21 | X01/X05（BFF 新增页面模型） | P1 | FEP-4/G4 | BFF-FE-008 | Open |
| GAP-15 | C15 | Q: listReconRuns、getReconRun、listBreaks、getBreak、listLedgerEntries；C: requestReconRerun（幂等）；R: recon status stream；禁止 edit-ledger operation | P22、P11、P21 | X05 | P0 | FEP-5/G5 | BFF-FE-009 | Open |
| GAP-16 | C16 | Q: listAlerts、getAlert、getSubscriptions；C: ackAlert、unackAlert、saveSubscription；R: alert stream（授权/去重/限速） | P23、P02、P13、全局 | F09、X05/X06 | P1 | FEP-6/G6 | BFF-FE-010 | Open |
| GAP-17 | C17 | Q: getProfile、listSessions、listDevices、getNotificationPrefs、listDownloads、getPlatformCapabilities；C: saveProfile、revokeSession、revokeDevice、setupMfa、clearOfflineCache、checkUpdate、createDiagnosticJob；R: session 撤销推送 | P15、P16、P17 | F06、F09、L02/L03 | P0 | FEP-1/G1（P15）、FEP-6/G6（P16/P17） | BFF-FE-001/011 | Open |

## 统一基线（GAP-00，BFF-FE-000 本体）

- envelope、分页（cursor/pageSize/nextCursor）、sort/filter、202 job 引用、Idempotency-Key、ETag/objectVersion、错误模型、SSE event envelope（streamId/sequence/eventId/occurredAt/correlationId/payloadVersion）由 BFF-FE-000 一次性冻结，GAP-01–17 继承，不逐条重复设计。
- 现有 `quantos.swagger.json`（7 个 Engine/EventLedger operation）保留为服务级契约，页面不直接消费；页面只引用 BFF 版本化 OpenAPI 生成的 client。
- 关闭条件：对应 BFF-FE 任务达成 `Reviewed + Mocked`（进入 Sprint 前一个 Sprint），最终 `Implemented` 后页面方可标记 Integrated。
